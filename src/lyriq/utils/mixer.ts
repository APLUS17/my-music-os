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

/** Registers an element with the mixer at the given level (0..1). */
export function attachToMixer(el: HTMLMediaElement, level: number): void {
  const l = clampLevel(level);
  tracked.set(el, l);
  if (ctx && ctx.state !== 'closed') route(el, l);
  applyLevel(el, l);
}

/** Forgets an element (e.g. the beat was removed). */
export function detachFromMixer(el: HTMLMediaElement): void {
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
let activeVocal: {
  key: string;
  source: AudioBufferSourceNode;
  startedOffset: number;
  startedCtxTime: number;
} | null = null;

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

/** Stops any active Web Audio vocal source immediately. */
export function stopVocalBufferPlayback(): void {
  if (!activeVocal) return;
  const current = activeVocal;
  activeVocal = null;
  current.source.onended = null;
  try { current.source.stop(); } catch { /* already stopped */ }
  try { current.source.disconnect(); } catch { /* already disconnected */ }
}

/** Drops a cached vocal buffer (e.g. when a take or song is deleted). */
export function evictVocalBuffer(key: string): void {
  if (activeVocal?.key === key) stopVocalBufferPlayback();
  vocalBuffers.delete(key);
  vocalPending.delete(key);
  vocalFailed.delete(key);
}

/**
 * Applies a short 5-10 ms Web Audio gain micro-fade at a loop wrap / jump boundary
 * on both the beat GainNode and vocal GainNode to eliminate click/pop discontinuities.
 */
export function triggerLoopWrapFade(
  beatEl: HTMLMediaElement | null | undefined,
  beatLevel: number,
  vocalLevel: number,
  fadeMs = 8
): void {
  if (!ctx || ctx.state !== 'running') return;
  const fadeSec = Math.max(0.005, Math.min(0.01, fadeMs / 1000));
  const now = ctx.currentTime;

  const beatGain = beatEl ? gains.get(beatEl) : undefined;
  if (beatGain) {
    const target = clampLevel(beatLevel);
    try {
      beatGain.gain.cancelScheduledValues(now);
      beatGain.gain.setValueAtTime(Math.min(target, 0.001), now);
      beatGain.gain.linearRampToValueAtTime(target, now + fadeSec);
    } catch {
      beatGain.gain.setTargetAtTime(target, now, fadeSec);
    }
  }

  if (vocalGainNode && vocalGainNode.context === ctx) {
    const target = clampLevel(vocalLevel);
    try {
      vocalGainNode.gain.cancelScheduledValues(now);
      vocalGainNode.gain.setValueAtTime(Math.min(target, 0.001), now);
      vocalGainNode.gain.linearRampToValueAtTime(target, now + fadeSec);
    } catch {
      vocalGainNode.gain.setTargetAtTime(target, now, fadeSec);
    }
  }
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
export const VOCAL_SYNC_DRIFT_TOLERANCE_SEC = 0.08;

export function syncVocalBufferPlayback(
  key: string,
  blob: Blob | undefined,
  url: string | undefined,
  offsetSec: number,
  volume: number,
  strict: boolean,
  fadeInMs = 0
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

  const wasSameTake = Boolean(activeVocal && activeVocal.key === key);
  if (wasSameTake && activeVocal) {
    const livePos = activeVocal.startedOffset + (ctx.currentTime - activeVocal.startedCtxTime);
    if (!strict && Math.abs(livePos - offsetSec) <= VOCAL_SYNC_DRIFT_TOLERANCE_SEC) {
      gain.gain.setTargetAtTime(clampLevel(volume), ctx.currentTime, 0.015);
      return 'playing';
    }
  }

  stopVocalBufferPlayback();

  const targetVol = clampLevel(volume);
  const now = ctx.currentTime;
  const effectiveFadeMs = fadeInMs > 0 ? fadeInMs : (wasSameTake ? 6 : 0);
  if (effectiveFadeMs > 0) {
    const fadeSec = Math.max(0.005, Math.min(0.01, effectiveFadeMs / 1000));
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.min(targetVol, 0.001), now);
      gain.gain.linearRampToValueAtTime(targetVol, now + fadeSec);
    } catch {
      gain.gain.setTargetAtTime(targetVol, now, 0.015);
    }
  } else {
    gain.gain.setTargetAtTime(targetVol, now, 0.015);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  const startedCtxTime = ctx.currentTime;
  source.onended = () => {
    if (activeVocal?.source === source) {
      activeVocal = null;
    }
    try { source.disconnect(); } catch { /* already disconnected */ }
  };
  source.start(0, offsetSec);
  activeVocal = {
    key,
    source,
    startedOffset: offsetSec,
    startedCtxTime,
  };
  return 'playing';
}
