// Playback mixer: per-element volume that also works on iPhone and iPad.
//
// iOS Safari ignores HTMLMediaElement.volume (it is always 1), so the beat and
// vocal sliders did nothing there. Routing each element through a Web Audio
// GainNode gives real level control on every browser:
//
//   <audio> ──► MediaElementSource ──► GainNode (slider) ──► speakers
//
// Two traps this module avoids:
// - Once an element is routed, it only sounds while the AudioContext is
//   running, and iOS only lets a context start from a tap. So the context is
//   created only in unlock(), which must be called from a tap (Play, Record).
//   Until then, elements play directly and fall back to element.volume.
// - The recorder has its own AudioContext that it closes when the mic goes
//   idle. Playback uses a separate context so that never cuts the music.

import { VocalDriftTracker } from './vocalDrift';

type AudioContextCtor = typeof AudioContext;

function getCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext || null;
}

let ctx: AudioContext | null = null;
/** Elements routed through a gain node. An element can only ever be routed once. */
const gains = new WeakMap<HTMLMediaElement, GainNode>();
/** Elements known to the mixer, with their current level, so unlock() can route them. */
const tracked = new Map<HTMLMediaElement, number>();

function clampLevel(level: number): number {
  return Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 1;
}

function route(el: HTMLMediaElement, level: number): void {
  if (!ctx || gains.has(el)) return;
  try {
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = level;
    source.connect(gain);
    gain.connect(ctx.destination);
    gains.set(el, gain);
    el.volume = 1; // the gain node does the work now
  } catch (err) {
    // Already routed elsewhere or unsupported: keep the element-volume fallback.
    console.warn('[mixer] could not route element:', err);
  }
}

/**
 * Starts (or wakes) the playback context. Call synchronously inside a tap or
 * key handler, before any await, so iOS allows it.
 */
export function unlockMixer(): void {
  const Ctor = getCtor();
  if (!Ctor) return;
  if (!ctx || ctx.state === 'closed') {
    try {
      ctx = new Ctor({ latencyHint: 'playback' });
    } catch {
      ctx = null;
      return;
    }
    // After a call or Siri, iOS leaves the context 'interrupted'; routed audio
    // is silent until it runs again, so try to wake it as soon as possible.
    const c = ctx;
    c.addEventListener('statechange', () => {
      if (c.state === 'interrupted' as AudioContextState || c.state === 'suspended') c.resume().catch(() => {});
    });
  }
  // 'suspended' on first use, 'interrupted' on iOS after a call or Siri.
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  for (const [el, level] of tracked) route(el, level);
}

/**
 * Attempts to resume a suspended or iOS-interrupted playback AudioContext
 * (e.g. when returning from a brief tab or app switch). Resolves true if running.
 */
export async function resumeMixerIfNeeded(): Promise<boolean> {
  if (!ctx || ctx.state === 'closed') return false;
  if (ctx.state === 'running') return true;
  try {
    await ctx.resume();
  } catch {
    return false;
  }
  return (ctx?.state as string) === 'running';
}

/**
 * Output delay of the playback context that `el` plays through, in seconds: how far the sound the
 * singer hears lags the element's `currentTime`. `null` when the element is not routed through the
 * mixer (then it plays on the browser's own path and this context's numbers don't describe it).
 * Browsers that don't report `outputLatency` (Safari) give `baseLatency` only, so this undercounts there.
 */
export function getPlaybackOutputLatencySec(el: HTMLMediaElement | null | undefined): number | null {
  if (!el || !ctx || ctx.state === 'closed' || !gains.has(el)) return null;
  const base = Number.isFinite(ctx.baseLatency) ? ctx.baseLatency : 0;
  const out = typeof ctx.outputLatency === 'number' && Number.isFinite(ctx.outputLatency) ? ctx.outputLatency : 0;
  return Math.max(0, base) + Math.max(0, out);
}

/** Registers an element with the mixer at the given level (0..1). */
export function attachToMixer(el: HTMLMediaElement, level: number): void {
  const l = clampLevel(level);
  tracked.set(el, l);
  if (ctx && ctx.state !== 'closed') route(el, l);
  applyLevel(el, l);
}

/** Forgets an element (e.g. the beat was removed). */
export function detachFromMixer(el: HTMLMediaElement): void {
  if (loopVoice?.el === el) stopBeatLoop();
  tracked.delete(el);
}

/** Sets an element's level (0..1): via its gain node if routed, else element.volume. */
export function setMixerLevel(el: HTMLMediaElement | null | undefined, level: number): void {
  if (!el) return;
  const l = clampLevel(level);
  if (tracked.has(el)) tracked.set(el, l);
  applyLevel(el, l);
}

function applyLevel(el: HTMLMediaElement, level: number): void {
  if (ctx && loopVoice && loopVoice.el === el) {
    // The seamless loop carries this element's sound; the element itself stays muted.
    loopVoice.bus.gain.setTargetAtTime(level, ctx.currentTime, 0.015);
    return;
  }
  const gain = gains.get(el);
  if (gain && ctx) {
    // A short ramp avoids zipper noise while a slider is dragged.
    gain.gain.setTargetAtTime(level, ctx.currentTime, 0.015);
  } else {
    el.volume = level;
  }
}

// ---------------------------------------------------------------------------
// Sample-accurate Web Audio playback for recorded vocal takes
// ---------------------------------------------------------------------------
// Playing recorded WAV blobs through HTMLAudioElement + MediaElementSource can
// stall or go silent after seeking or rate nudges on iOS Safari. Decoding each
// take into an AudioBuffer and driving it via AudioBufferSourceNode avoids
// WebKit's media-element WAV bugs and keeps vocals sample-locked to the beat.

const MAX_CACHED_VOCAL_BUFFERS = 24;
const vocalBuffers = new Map<string, AudioBuffer>();
const vocalPending = new Map<string, Promise<AudioBuffer | null>>();
const vocalFailed = new Set<string>();

let vocalGainNode: GainNode | null = null;
/** Fade used when a vocal source is replaced or stopped: long enough to hide the cut, too short to hear. */
const VOCAL_XFADE_SEC = 0.004;

/**
 * How far ahead of `ctx.currentTime` an event must be scheduled to actually happen when asked.
 * With the 'playback' latency hint the context's clock advances in ~23 ms steps and the audio thread has
 * already rendered up to a step ahead of it, so anything scheduled closer than that runs "in the past",
 * which means immediately: a 5 ms fade becomes a hard cut. Everything that needs a smooth edge is
 * scheduled at least this far ahead (and given the matching offset, so it still lines up in time).
 */
function scheduleMargin(): number {
  const base = ctx && Number.isFinite(ctx.baseLatency) ? ctx.baseLatency : 0.02;
  return Math.max(0.025, base + 0.012);
}

/** How long before a loop's end the seamless loop must be armed, so it can start exactly on the bar line. */
export function getLoopLeadSec(): number {
  return scheduleMargin() + 0.02;
}
let activeVocal: {
  key: string;
  source: AudioBufferSourceNode;
  /** This source's own fader, so fading it never touches the volume slider's gain. */
  fader: GainNode;
  startedOffset: number;
  startedCtxTime: number;
} | null = null;

/** Fades a vocal source to silence, finishing exactly at `endAt`, and stops it just after. */
function releaseVocal(v: NonNullable<typeof activeVocal>, endAt: number, fadeSec: number): void {
  if (!ctx) return;
  const begin = Math.max(ctx.currentTime, endAt - fadeSec);
  try {
    const g = v.fader.gain;
    g.cancelScheduledValues(begin);
    g.setValueAtTime(1, begin);
    g.linearRampToValueAtTime(0, Math.max(endAt, begin + 0.001));
  } catch { /* fader already gone */ }
  try { v.source.stop(Math.max(endAt, begin) + 0.003); } catch { /* already stopped or never started */ }
}

function getVocalGainNode(): GainNode | null {
  if (!ctx || ctx.state === 'closed') return null;
  if (!vocalGainNode || vocalGainNode.context !== ctx) {
    vocalGainNode = ctx.createGain();
    vocalGainNode.connect(ctx.destination);
  }
  return vocalGainNode;
}

function decodeAudioBytes(audioCtx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise<AudioBuffer>((resolve, reject) => {
    let settled = false;
    const ok = (b: AudioBuffer) => { if (!settled) { settled = true; resolve(b); } };
    const fail = (e: unknown) => { if (!settled) { settled = true; reject(e instanceof Error ? e : new Error('Decode failed')); } };
    try {
      const maybe = audioCtx.decodeAudioData(bytes.slice(0), ok, fail);
      if (maybe && typeof maybe.then === 'function') maybe.then(ok, fail);
    } catch (e) {
      fail(e);
    }
  });
}

function rememberVocalBuffer(key: string, buffer: AudioBuffer): void {
  if (vocalBuffers.has(key)) vocalBuffers.delete(key);
  vocalBuffers.set(key, buffer);
  while (vocalBuffers.size > MAX_CACHED_VOCAL_BUFFERS) {
    const oldest = vocalBuffers.keys().next().value;
    if (oldest !== undefined) vocalBuffers.delete(oldest);
    else break;
  }
}

/** Pre-decodes a take's audio into the playback AudioContext so playback starts instantly. */
export function preloadVocalBuffer(key: string, blob?: Blob, url?: string): Promise<AudioBuffer | null> {
  if (!key) return Promise.resolve(null);
  const cached = vocalBuffers.get(key);
  if (cached) return Promise.resolve(cached);
  const inFlight = vocalPending.get(key);
  if (inFlight) return inFlight;
  if (!ctx || ctx.state === 'closed') return Promise.resolve(null);

  const audioCtx = ctx;
  const task = (async () => {
    try {
      let bytes: ArrayBuffer | null = null;
      if (blob) {
        bytes = await blob.arrayBuffer();
      } else if (url) {
        const res = await fetch(url);
        bytes = await res.arrayBuffer();
      }
      if (!bytes || bytes.byteLength === 0) {
        vocalFailed.add(key);
        return null;
      }
      const buffer = await decodeAudioBytes(audioCtx, bytes);
      vocalFailed.delete(key);
      rememberVocalBuffer(key, buffer);
      return buffer;
    } catch (err) {
      console.warn('[mixer] vocal buffer decode failed, using element fallback:', err);
      vocalFailed.add(key);
      return null;
    } finally {
      vocalPending.delete(key);
    }
  })();

  vocalPending.set(key, task);
  return task;
}

/** Stops any active Web Audio vocal source, fading it out just ahead of the audio thread so it never clicks. */
export function stopVocalBufferPlayback(): void {
  vocalDrift.reset();
  if (!ctx || !activeVocal) return;
  const current = activeVocal;
  activeVocal = null;
  releaseVocal(current, ctx.currentTime + scheduleMargin(), VOCAL_XFADE_SEC);
}

/** Drops a cached vocal buffer (e.g. when a take or song is deleted). */
export function evictVocalBuffer(key: string): void {
  if (activeVocal?.key === key) stopVocalBufferPlayback();
  vocalBuffers.delete(key);
  vocalPending.delete(key);
  vocalFailed.delete(key);
}

/**
 * De-clicks an element loop wrap, for when the seamless loop is not ready (its copy is still decoding, or
 * the beat is too long to decode). A seek splices hard at a moment that cannot be known to the
 * millisecond (it lands somewhere in the next one or two audio blocks), so the beat is faded down, held
 * silent across a wide window, and faded back up, all scheduled ahead of the audio thread so every ramp
 * is smooth. Returns how long to wait before issuing the seek so that it lands inside the silence.
 */
export function triggerLoopWrapFade(beatEl: HTMLMediaElement | null | undefined, beatLevel: number): number {
  if (!ctx || ctx.state !== 'running' || !beatEl) return 0;
  if (loopVoice?.el === beatEl) return 0; // the loop voice owns this element's sound
  const gain = gains.get(beatEl)?.gain;
  if (!gain) return 0;
  const target = clampLevel(beatLevel);
  const now = ctx.currentTime;
  const m = scheduleMargin();
  const downAt = now + m;
  const upAt = downAt + 0.05;
  try {
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(target, downAt);
    gain.linearRampToValueAtTime(0, downAt + 0.005);
    gain.setValueAtTime(0, upAt);
    gain.linearRampToValueAtTime(target, upAt + 0.006);
  } catch {
    gain.setTargetAtTime(target, now, 0.01);
  }
  return m + 0.012;
}

export type VocalBufferStatus = 'playing' | 'pending' | 'ended' | 'fallback';

/**
 * Synchronizes Web Audio playback for the current vocal take.
 * Returns:
 * - 'playing': Web Audio AudioBufferSourceNode is actively playing in sync
 * - 'pending': decoding is in flight (caller should wait rather than falling back)
 * - 'ended': offset is outside the decoded buffer duration
 * - 'fallback': Web Audio is unavailable or decoding failed (use HTMLAudioElement)
 */
/** Decides when the running vocal has really drifted (see vocalDrift.ts); a per-frame 80 ms check made iPhone playback choppy. */
const vocalDrift = new VocalDriftTracker();
const wallSec = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

export function syncVocalBufferPlayback(
  key: string,
  blob: Blob | undefined,
  url: string | undefined,
  offsetSec: number,
  volume: number,
  strict: boolean,
  fadeInMs = 0,
  atCtxTime?: number
): VocalBufferStatus {
  if (!ctx || ctx.state === 'closed') return 'fallback';
  if (vocalFailed.has(key)) return 'fallback';

  const buffer = vocalBuffers.get(key);
  if (!buffer) {
    stopVocalBufferPlayback();
    void preloadVocalBuffer(key, blob, url);
    return 'pending';
  }

  if (offsetSec < 0 || offsetSec >= buffer.duration) {
    stopVocalBufferPlayback();
    return 'ended';
  }

  if (ctx.state === 'suspended' || ctx.state === ('interrupted' as AudioContextState)) {
    ctx.resume().catch(() => {});
  }

  const gain = getVocalGainNode();
  if (!gain) return 'fallback';

  // A restart is already booked for a moment still ahead (a loop wrap): leave it alone until it happens.
  if (!strict && activeVocal && activeVocal.startedCtxTime > ctx.currentTime) return 'playing';

  const wasSameTake = Boolean(activeVocal && activeVocal.key === key);
  /** True when this restart corrects drift, so the learned offset is kept rather than learned again. */
  let isDriftCorrection = false;
  if (wasSameTake && activeVocal && !strict) {
    const livePos = activeVocal.startedOffset + (ctx.currentTime - activeVocal.startedCtxTime);
    const correction = vocalDrift.check(wallSec(), livePos - offsetSec);
    if (correction === null) {
      gain.gain.setTargetAtTime(clampLevel(volume), ctx.currentTime, 0.015);
      return 'playing';
    }
    offsetSec = Math.max(0, offsetSec + correction);
    isDriftCorrection = true;
  }
  if (!isDriftCorrection) vocalDrift.reset();

  // Start the new source on the audio clock, far enough ahead to be honoured, beginning that much further
  // into the take so it still lines up. The running source (if any) fades out to end exactly then.
  const previous = activeVocal;
  activeVocal = null;
  const now = ctx.currentTime;
  const intendedAt = atCtxTime ?? now;
  const startAt = Math.max(intendedAt, now + scheduleMargin());
  const startOffset = offsetSec + (startAt - intendedAt);
  if (previous) releaseVocal(previous, startAt, VOCAL_XFADE_SEC);
  if (startOffset >= buffer.duration) return 'ended';

  gain.gain.setTargetAtTime(clampLevel(volume), now, 0.015);

  const fadeInSec = Math.max(0.003, Math.min(0.01, (fadeInMs > 0 ? fadeInMs : 4) / 1000));
  const fader = ctx.createGain();
  fader.gain.value = 0;
  fader.gain.setValueAtTime(0, startAt);
  fader.gain.linearRampToValueAtTime(1, startAt + fadeInSec);
  fader.connect(gain);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(fader);
  source.onended = () => {
    if (activeVocal?.source === source) activeVocal = null;
    try { source.disconnect(); } catch { /* already disconnected */ }
    try { fader.disconnect(); } catch { /* already disconnected */ }
  };
  source.start(startAt, startOffset);
  activeVocal = { key, source, fader, startedOffset: startOffset, startedCtxTime: startAt };
  return 'playing';
}

// ---------------------------------------------------------------------------
// Seamless section loop for the beat
// ---------------------------------------------------------------------------
// A media element can only loop by seeking. Measured in Chromium: the seek lands ~24 ms after the call
// and splices hard with no gap, and the moment the app issues it follows the frame clock, so every
// wrap clicks and the loop length jitters by up to a frame. While a section loops, the beat is
// therefore played from a decoded copy of just that section: an AudioBufferSourceNode looping
// sample-accurately on the audio clock. The end of the copy is cross-faded into the audio that
// precedes the section's start, which makes the seam continuous instead of a jump.
//
// The media element keeps running underneath, muted, so every other part of the player (and the
// fallback when the copy is not decoded yet) is unchanged.

/** Length of the cross-fade that hides the seam. */
export const LOOP_SEAM_SEC = 0.006;
/** Beats longer than this are not decoded for looping (memory); they keep the element fallback. */
const MAX_LOOP_BEAT_SEC = 600;
const MAX_CACHED_LOOP_REGIONS = 8;

/**
 * Cuts [startSec, endSec) out of decoded audio and prepares it to loop without a seam.
 * With audio before the start, the last `seamSec` is blended into that lead-in, so the sample after
 * the wrap follows on exactly as it does in the song. At the very start of a file there is no lead-in,
 * so the head and tail are faded instead. Returns copies; the input is not modified.
 */
export function renderLoopRegion(
  channels: Float32Array[],
  sampleRate: number,
  startSec: number,
  endSec: number,
  seamSec = LOOP_SEAM_SEC
): Float32Array[] | null {
  if (channels.length === 0 || !(sampleRate > 0)) return null;
  const total = channels[0].length;
  const s = Math.max(0, Math.round(startSec * sampleRate));
  const e = Math.min(total, Math.round(endSec * sampleRate));
  const n = e - s;
  if (n < Math.round(0.05 * sampleRate)) return null;
  const seam = Math.max(2, Math.min(Math.round(seamSec * sampleRate), Math.floor(n / 4)));
  return channels.map(ch => {
    const out = ch.slice(s, e);
    if (s >= seam) {
      for (let i = 0; i < seam; i++) {
        const w = ((i + 1) / seam) * (Math.PI / 2);
        out[n - seam + i] = ch[e - seam + i] * Math.cos(w) + ch[s - seam + i] * Math.sin(w);
      }
    } else {
      const half = Math.max(1, Math.floor(seam / 2));
      for (let i = 0; i < half; i++) {
        const g = i / half;
        out[i] *= g;
        out[n - 1 - i] *= g;
      }
    }
    return out;
  });
}

const regionKeyOf = (beatKey: string, startSec: number, endSec: number): string =>
  `${beatKey}|${startSec.toFixed(4)}|${endSec.toFixed(4)}`;

const loopRegions = new Map<string, AudioBuffer>();
const loopPending = new Map<string, Promise<boolean>>();
const beatDecodes = new Map<string, Promise<AudioBuffer | null>>();
const loopFailedBeats = new Set<string>();
/** The most recent full decode, kept so another section of the same beat does not decode again. */
let lastFullDecode: { key: string; buffer: AudioBuffer } | null = null;
let fullDecodeTimer: ReturnType<typeof setTimeout> | null = null;
/** A whole decoded beat is large, so it is dropped a minute after it was last needed. */
function keepFullDecode(key: string, buffer: AudioBuffer): void {
  lastFullDecode = { key, buffer };
  if (fullDecodeTimer) clearTimeout(fullDecodeTimer);
  fullDecodeTimer = setTimeout(() => { lastFullDecode = null; fullDecodeTimer = null; }, 60_000);
}

async function decodeWholeBeat(beatKey: string, blob: Blob | undefined, url: string | undefined): Promise<AudioBuffer | null> {
  if (lastFullDecode?.key === beatKey) {
    keepFullDecode(beatKey, lastFullDecode.buffer);
    return lastFullDecode.buffer;
  }
  const inFlight = beatDecodes.get(beatKey);
  if (inFlight) return inFlight;
  const audioCtx = ctx;
  if (!audioCtx || audioCtx.state === 'closed') return null;
  const task = (async () => {
    try {
      let bytes: ArrayBuffer | null = null;
      if (blob) bytes = await blob.arrayBuffer();
      else if (url) bytes = await (await fetch(url)).arrayBuffer();
      if (!bytes || bytes.byteLength === 0) return null;
      const buffer = await decodeAudioBytes(audioCtx, bytes);
      keepFullDecode(beatKey, buffer);
      return buffer;
    } catch (err) {
      console.warn('[mixer] beat decode for looping failed, using the element fallback:', err);
      loopFailedBeats.add(beatKey);
      return null;
    } finally {
      beatDecodes.delete(beatKey);
    }
  })();
  beatDecodes.set(beatKey, task);
  return task;
}

/** True when the loop copy for this section is decoded and ready to play. */
export function isBeatLoopReady(beatKey: string, startSec: number, endSec: number): boolean {
  return loopRegions.has(regionKeyOf(beatKey, startSec, endSec));
}

/**
 * Decodes the beat (once) and prepares the loop copy for one section. Safe to call repeatedly:
 * it dedupes, and resolves false when looping cannot be done this way (the element fallback is used).
 */
export function prepareBeatLoop(
  beatKey: string,
  blob: Blob | undefined,
  url: string | undefined,
  startSec: number,
  endSec: number,
  durationSec = 0
): Promise<boolean> {
  if (!ctx || ctx.state === 'closed' || !beatKey || !(endSec > startSec)) return Promise.resolve(false);
  if (loopFailedBeats.has(beatKey) || durationSec > MAX_LOOP_BEAT_SEC) return Promise.resolve(false);
  const rk = regionKeyOf(beatKey, startSec, endSec);
  if (loopRegions.has(rk)) return Promise.resolve(true);
  const inFlight = loopPending.get(rk);
  if (inFlight) return inFlight;
  const task = (async () => {
    try {
      const full = await decodeWholeBeat(beatKey, blob, url);
      if (!full || !ctx) return false;
      const channels = Array.from({ length: full.numberOfChannels }, (_, c) => full.getChannelData(c));
      const region = renderLoopRegion(channels, full.sampleRate, startSec, endSec);
      if (!region) return false;
      const out = ctx.createBuffer(region.length, region[0].length, full.sampleRate);
      region.forEach((data, c) => out.copyToChannel(data as Float32Array<ArrayBuffer>, c));
      loopRegions.set(rk, out);
      while (loopRegions.size > MAX_CACHED_LOOP_REGIONS) {
        const oldest = loopRegions.keys().next().value;
        if (oldest === undefined) break;
        loopRegions.delete(oldest);
      }
      return true;
    } catch (err) {
      console.warn('[mixer] could not prepare the section loop:', err);
      return false;
    } finally {
      loopPending.delete(rk);
    }
  })();
  loopPending.set(rk, task);
  return task;
}

/** Forgets decoded beat audio (e.g. when the beat is removed or replaced). */
export function releaseBeatLoopCache(): void {
  stopBeatLoop();
  loopRegions.clear();
  loopPending.clear();
  loopFailedBeats.clear();
  lastFullDecode = null;
  if (fullDecodeTimer) { clearTimeout(fullDecodeTimer); fullDecodeTimer = null; }
}

let loopVoice: {
  el: HTMLMediaElement;
  source: AudioBufferSourceNode;
  bus: GainNode;
  startSec: number;
  endSec: number;
  /** Audio-clock time at which the section's first sample plays. */
  t0: number;
  lengthSec: number;
} | null = null;

export interface BeatLoopClock {
  startSec: number;
  endSec: number;
  /** Audio-clock time of the loop's next wrap (its first start, while still scheduled). */
  nextWrapCtxTime: number;
  /** The audio clock now. */
  ctxNow: number;
  /** Seconds since the loop started playing; negative while it is still scheduled. */
  elapsedSec: number;
  /** Where in the song the loop is now (always within [startSec, endSec)). */
  positionSec: number;
  /** Completed passes. */
  loops: number;
}

/** The running seamless loop's clock, or null when the beat is not being looped this way. */
export function getBeatLoopClock(): BeatLoopClock | null {
  if (!ctx || !loopVoice) return null;
  const elapsed = ctx.currentTime - loopVoice.t0;
  if (elapsed < 0) {
    return {
      startSec: loopVoice.startSec,
      endSec: loopVoice.endSec,
      nextWrapCtxTime: loopVoice.t0,
      ctxNow: ctx.currentTime,
      elapsedSec: elapsed,
      positionSec: loopVoice.startSec,
      loops: 0,
    };
  }
  const loops = Math.floor(elapsed / loopVoice.lengthSec);
  return {
    startSec: loopVoice.startSec,
    endSec: loopVoice.endSec,
    nextWrapCtxTime: loopVoice.t0 + (loops + 1) * loopVoice.lengthSec,
    ctxNow: ctx.currentTime,
    elapsedSec: elapsed,
    positionSec: loopVoice.startSec + (elapsed - loops * loopVoice.lengthSec),
    loops,
  };
}

/**
 * Starts looping the prepared section on the audio clock so that it begins `inSec` from now (never sooner
 * than the scheduling margin), fading the beat element out just before. Returns the audio-clock time the
 * loop starts, or null (and changes nothing) when the loop copy is not ready.
 */
export function startBeatLoop(el: HTMLMediaElement, beatKey: string, startSec: number, endSec: number, inSec = 0): number | null {
  if (!ctx || ctx.state !== 'running' || loopVoice) return null;
  const region = loopRegions.get(regionKeyOf(beatKey, startSec, endSec));
  const elGain = gains.get(el);
  if (!region || !elGain) return null;

  const level = clampLevel(tracked.get(el) ?? 1);
  const now = ctx.currentTime;
  const t0 = now + Math.max(scheduleMargin(), inSec);

  const source = ctx.createBufferSource();
  source.buffer = region;
  source.loop = true;
  source.loopStart = 0;
  source.loopEnd = region.duration;
  // The first entry fades in (the beat element fades out just before): the loop's own seam is already
  // blended, but its first sample follows the element's audio, which is a different signal.
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.setValueAtTime(0, t0);
  bus.gain.linearRampToValueAtTime(level, t0 + 0.005);
  source.connect(bus);
  bus.connect(ctx.destination);
  source.start(t0, 0);

  try {
    elGain.gain.cancelScheduledValues(now);
    elGain.gain.setValueAtTime(level, t0 - 0.004);
    elGain.gain.linearRampToValueAtTime(0, t0);
  } catch {
    elGain.gain.setTargetAtTime(0, t0, 0.001);
  }

  loopVoice = { el, source, bus, startSec, endSec, t0, lengthSec: region.duration };
  return t0;
}

/** How long a hand-back to the beat element takes (it must be scheduled ahead of the audio thread). */
export function getLoopHandoffSec(): number {
  return scheduleMargin() + 0.005;
}

/**
 * Ends the seamless loop. By default it stops at once and the beat element's level is restored (the element
 * is paused or about to be moved, so there is nothing to hear). With `handoff`, the loop plays on, without
 * repeating, for `getLoopHandoffSec()`, then crossfades to the element: the caller moves the element to
 * where the loop will be by then.
 */
export function stopBeatLoop(opts: { handoff?: boolean } = {}): void {
  const voice = loopVoice;
  if (!voice) return;
  loopVoice = null;
  if (!ctx) return;
  const now = ctx.currentTime;
  const level = clampLevel(tracked.get(voice.el) ?? 1);
  const elGain = gains.get(voice.el);
  const done = () => {
    try { voice.source.disconnect(); } catch { /* already disconnected */ }
    try { voice.bus.disconnect(); } catch { /* already disconnected */ }
  };

  if (opts.handoff) {
    const at = now + getLoopHandoffSec();
    const fade = 0.006;
    try { voice.source.loop = false; } catch { /* already ended */ }
    try {
      voice.bus.gain.cancelScheduledValues(now);
      voice.bus.gain.setValueAtTime(level, at);
      voice.bus.gain.linearRampToValueAtTime(0, at + fade);
    } catch { /* bus already gone */ }
    try { voice.source.stop(at + fade + 0.003); } catch { /* already stopped */ }
    voice.source.onended = done;
    if (elGain) {
      try {
        elGain.gain.cancelScheduledValues(now);
        elGain.gain.setValueAtTime(0, at);
        elGain.gain.linearRampToValueAtTime(level, at + fade);
      } catch {
        elGain.gain.setTargetAtTime(level, at, 0.005);
      }
    }
    return;
  }

  try { voice.source.stop(); } catch { /* already stopped */ }
  done();
  if (elGain) {
    try {
      elGain.gain.cancelScheduledValues(now);
      elGain.gain.setValueAtTime(level, now);
    } catch {
      elGain.gain.value = level;
    }
  }
}
