// Audio decoding, analysis, encoding and microphone capture.

import { mapVocal, vocalEnvelope, type VocalMap } from './lyricAlign';
import { buildLocalEnergyArrangement, type BeatGrid } from './arrangement';
import type { BeatAnalysis } from '../types';

/** Files above this are not decoded in-browser (decoded PCM is ~10x the file size). */
const MAX_DECODE_BYTES = 120 * 1024 * 1024;
/** Hard cap on a single recording; PCM is held in memory until the take is stopped. */
const MAX_RECORDING_SEC = 15 * 60;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext || null;
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/**
 * Decodes audio bytes with both the promise and callback forms of
 * decodeAudioData (older WebKit only supports the callback form and detaches
 * the buffer, hence the copy).
 */
function decodeAudioBuffer(ctx: BaseAudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise<AudioBuffer>((resolve, reject) => {
    let settled = false;
    const ok = (b: AudioBuffer) => { if (!settled) { settled = true; resolve(b); } };
    const fail = (e: unknown) => { if (!settled) { settled = true; reject(e instanceof Error ? e : new Error('Audio decode failed')); } };
    try {
      const maybePromise = ctx.decodeAudioData(bytes.slice(0), ok, fail);
      if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(ok, fail);
    } catch (e) {
      fail(e);
    }
  });
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const n = buffer.numberOfChannels;
  if (n === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < n; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / n;
  }
  return out;
}

/** Decodes an audio file to mono PCM (channel mean). Null when the browser can't decode it. */
export async function decodeToMono(file: Blob): Promise<{ mono: Float32Array; sampleRate: number } | null> {
  const Ctor = getAudioContextCtor();
  if (!Ctor || file.size === 0 || file.size > MAX_DECODE_BYTES) return null;
  let ctx: AudioContext | null = null;
  try {
    ctx = new Ctor();
    const buffer = await decodeAudioBuffer(ctx, await file.arrayBuffer());
    return { mono: mixToMono(buffer), sampleRate: buffer.sampleRate };
  } catch (err) {
    console.warn('Could not decode audio for structure analysis:', err);
    return null;
  } finally {
    ctx?.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface BpmEstimate {
  bpm: number;
  /** 0..1, how much stronger the chosen tempo is than the average candidate. */
  confidence: number;
}

/** Centre and width (in octaves) of the tempo preference used to break half/double-time ties. */
const TEMPO_PRIOR_CENTER_BPM = 130;
const TEMPO_PRIOR_WIDTH_OCTAVES = 1;

/**
 * Estimates tempo from onset-energy autocorrelation over a 50-220 BPM search
 * range with parabolic peak interpolation.
 *
 * A periodic beat correlates just as well at twice its period, so a 140 BPM
 * track also looks like 70 BPM. Candidates are therefore weighted by a soft
 * preference centred on 130 BPM: genuinely slow (60) or fast (174) beats still
 * win when their peak is clearly stronger, but a tie goes to the usual range. Returns null when the signal has no
 * usable periodicity, so callers never mistake a failure for "120 BPM".
 */
export function detectBpmFromChannelData(channelData: Float32Array, sampleRate: number): BpmEstimate | null {
  const hopSec = 0.01;
  const hop = Math.max(1, Math.floor(sampleRate * hopSec));
  const windowSec = 40;
  const total = channelData.length;
  if (total < sampleRate * 6) return null;

  // Analyse a window from a quarter in: intros are often sparse.
  const windowSamples = Math.min(total, Math.floor(sampleRate * windowSec));
  const start = Math.min(Math.floor(total * 0.25), total - windowSamples);
  const numHops = Math.floor(windowSamples / hop);
  if (numHops < 300) return null;

  const energy = new Float32Array(numHops);
  for (let h = 0; h < numHops; h++) {
    const from = start + h * hop;
    let sum = 0;
    for (let i = from; i < from + hop; i++) sum += channelData[i] * channelData[i];
    energy[h] = Math.sqrt(sum / hop);
  }

  const onsets = new Float32Array(numHops);
  let mean = 0;
  for (let i = 1; i < numHops; i++) {
    const d = energy[i] - energy[i - 1];
    onsets[i] = d > 0 ? d : 0;
    mean += onsets[i];
  }
  mean /= numHops;
  if (mean < 1e-6) return null;
  for (let i = 0; i < numHops; i++) onsets[i] = Math.max(0, onsets[i] - mean);

  const minLag = Math.floor(60 / 220 / hopSec);
  const maxLag = Math.ceil(60 / 50 / hopSec);
  const corr = new Float64Array(maxLag + 3);
  const prior = (lag: number) => {
    const octaves = Math.log2(60 / (lag * hopSec) / TEMPO_PRIOR_CENTER_BPM) / TEMPO_PRIOR_WIDTH_OCTAVES;
    return Math.exp(-0.5 * octaves * octaves);
  };
  let sum = 0;
  for (let lag = minLag - 2; lag <= maxLag + 2; lag++) {
    let c = 0;
    for (let i = 0; i + lag < numHops; i++) c += onsets[i] * onsets[i + lag];
    corr[lag] = c / (numHops - lag);
    if (lag >= minLag && lag <= maxLag) sum += corr[lag];
  }
  // Candidates are scored on a 3-lag neighbourhood: a fast tempo whose period
  // falls between two hops splits its peak across them and would otherwise lose
  // to the sharper peak at twice the period (reading 174 BPM as 87).
  const score = (lag: number) => (corr[lag - 1] + corr[lag] + corr[lag + 1]) * prior(lag);
  let best = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (score(lag) > score(best)) best = lag;
  }
  // Refine to the strongest raw lag in the winning neighbourhood.
  if (corr[best - 1] > corr[best] && best - 1 >= minLag) best -= 1;
  else if (corr[best + 1] > corr[best] && best + 1 <= maxLag) best += 1;
  const avg = sum / (maxLag - minLag + 1);
  if (!(corr[best] > 0) || !(avg > 0)) return null;

  // Parabolic interpolation around the peak for sub-hop resolution.
  const y0 = corr[best - 1];
  const y1 = corr[best];
  const y2 = corr[best + 1];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  const lag = best + Math.max(-1, Math.min(1, shift));

  const bpm = Math.round(60 / (lag * hopSec));
  const confidence = Math.max(0, Math.min(1, 1 - avg / corr[best]));
  if (bpm < 50 || bpm > 220 || confidence < 0.15) return null;
  return { bpm, confidence };
}

export function calcWaveformSync(channelData: Float32Array, samplesCount: number): number[] {
  const blockSize = Math.floor(channelData.length / samplesCount) || 1;
  const raw: number[] = [];
  let maxVal = 0.0001;

  for (let i = 0; i < samplesCount; i++) {
    const blockStart = blockSize * i;
    let peak = 0;
    let sumSq = 0;
    let count = 0;
    for (let j = 0; j < blockSize && blockStart + j < channelData.length; j++) {
      const a = Math.abs(channelData[blockStart + j]);
      if (a > peak) peak = a;
      sumSq += a * a;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    const combined = peak * 0.75 + rms * 0.25;
    raw.push(combined);
    if (combined > maxVal) maxVal = combined;
  }

  return raw.map(v => Math.max(8, Math.min(100, Math.round((v / maxVal) * 100))));
}

/**
 * Block-averaging downsample. Averaging acts as a crude low-pass filter, which
 * avoids the aliasing that plain sample dropping introduces.
 */
export function downsampleMono(input: Float32Array, inputRate: number, targetRate: number): Float32Array {
  if (targetRate >= inputRate) return input;
  const ratio = inputRate / targetRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.min(input.length, Math.max(from + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = from; j < to; j++) sum += input[j];
    out[i] = sum / (to - from);
  }
  return out;
}

/** Target size for the audio sent to arrangement analysis. */
const ANALYSIS_TARGET_BYTES = 6_000_000;

/**
 * Estimates the downbeat grid phase origin (in seconds, within `[0, barSec)`)
 * so bar snapping aligns with actual transients even when MP3 encoder padding
 * or brief intro silence shifts beat 1 away from `0.000s`.
 */
export function detectGridOriginSec(channelData: Float32Array, sampleRate: number, bpm: number): number {
  if (!(bpm >= 40 && bpm <= 240) || channelData.length < sampleRate * 2) return 0;

  const hopSec = 0.01;
  const hop = Math.max(1, Math.floor(sampleRate * hopSec));
  const scanSamples = Math.min(channelData.length, Math.floor(sampleRate * 24));
  const numHops = Math.floor(scanSamples / hop);
  if (numHops < 100) return 0;

  const energy = new Float32Array(numHops);
  for (let h = 0; h < numHops; h++) {
    const from = h * hop;
    let sum = 0;
    for (let i = from; i < from + hop; i++) sum += channelData[i] * channelData[i];
    energy[h] = Math.sqrt(sum / hop);
  }

  const onsets = new Float32Array(numHops);
  let maxOnset = 0;
  for (let i = 1; i < numHops; i++) {
    const d = energy[i] - energy[i - 1];
    onsets[i] = d > 0 ? d : 0;
    if (onsets[i] > maxOnset) maxOnset = onsets[i];
  }
  if (maxOnset < 1e-5) return 0;

  // Step 1: Find beat phase modulo beatSec that maximizes onset energy.
  const beatSec = 60 / bpm;
  const beatHops = Math.max(1, Math.round(beatSec / hopSec));
  let bestBeatPhase = 0;
  let bestBeatScore = -1;

  for (let p = 0; p < beatHops; p++) {
    let score = 0;
    let count = 0;
    for (let idx = p; idx < numHops; idx += beatHops) {
      const local =
        onsets[idx] +
        0.5 * (idx > 0 ? onsets[idx - 1] : 0) +
        0.5 * (idx + 1 < numHops ? onsets[idx + 1] : 0);
      score += local;
      count++;
    }
    if (count > 0 && score / count > bestBeatScore) {
      bestBeatScore = score / count;
      bestBeatPhase = p;
    }
  }

  // Step 2: Among the 4 beat slots in a bar, pick the strongest downbeat phase (preferring slot 0 on close ties).
  const barHops = beatHops * 4;
  let bestBarSlot = 0;
  let bestDownbeatScore = -1;
  for (let slot = 0; slot < 4; slot++) {
    const startHop = bestBeatPhase + slot * beatHops;
    let score = 0;
    let count = 0;
    for (let idx = startHop; idx < numHops; idx += barHops) {
      score += onsets[idx];
      count++;
    }
    // Slight preference for earlier downbeat phase so clean DAW exports starting at 0 stay at 0.
    const weighted = count > 0 ? (score / count) * (slot === 0 ? 1.08 : 1.0) : 0;
    if (weighted > bestDownbeatScore) {
      bestDownbeatScore = weighted;
      bestBarSlot = slot;
    }
  }

  const originSec = (bestBeatPhase + bestBarSlot * beatHops) * hopSec;
  // Treat tiny < 15ms offsets as exact 0.000s.
  return originSec < 0.015 ? 0 : Math.round(originSec * 1000) / 1000;
}

/**
 * Picks a standard mono PCM sample rate (16000 Hz or 8000 Hz) so the encoded
 * analysis WAV stays compact and universally decodable by audio models.
 */
export function pickAnalysisSampleRate(durationSec: number, sourceSampleRate: number): number {
  const maxRateForBudget = ANALYSIS_TARGET_BYTES / (2 * Math.max(1, durationSec));
  const standardRate = maxRateForBudget >= 16000 ? 16000 : 8000;
  if (sourceSampleRate > 0 && sourceSampleRate < standardRate) {
    return sourceSampleRate;
  }
  return standardRate;
}

/** Computes a normalized RMS energy profile across the track for local section detection. */
export function calcRmsEnvelope(channelData: Float32Array, bins = 180): number[] {
  if (channelData.length === 0 || bins <= 0) return [];
  const actualBins = Math.min(bins, channelData.length);
  const blockSize = Math.max(1, Math.floor(channelData.length / actualBins));
  const out = new Array<number>(actualBins);
  for (let i = 0; i < actualBins; i++) {
    const start = i * blockSize;
    const end = i === actualBins - 1 ? channelData.length : Math.min(channelData.length, start + blockSize);
    let sumSq = 0;
    for (let j = start; j < end; j++) {
      const s = channelData[j];
      sumSq += s * s;
    }
    const count = Math.max(1, end - start);
    out[i] = Math.sqrt(sumSq / count);
  }
  return out;
}

/**
 * Whole-track mono WAV for arrangement analysis. Snaps to standard 16000 Hz or
 * 8000 Hz rates so the upload fits the budget without non-standard sample rates.
 */
export function buildAnalysisWav(mono: Float32Array, sampleRate: number): { blob: Blob; sampleRate: number } {
  const durationSec = mono.length / sampleRate;
  const targetRate = pickAnalysisSampleRate(durationSec, sampleRate);
  const pcm = downsampleMono(mono, sampleRate, targetRate);
  return { blob: encodeWAV(pcm, targetRate), sampleRate: targetRate };
}

/**
 * Builds a compact whole-track WAV Blob + grid metadata + local RMS fallback
 * from a persisted beat Blob for background / on-demand arrangement analysis.
 */
export async function buildBeatAnalysisWav(
  file: Blob,
  hintBpm?: number
): Promise<{
  analysisWav: Blob;
  duration: number;
  detectedBpm: BpmEstimate | null;
  gridOriginSec: number;
  fallbackArrangement: BeatAnalysis;
} | null> {
  const Ctor = getAudioContextCtor();
  if (!Ctor || file.size === 0 || file.size > MAX_DECODE_BYTES) return null;
  let ctx: AudioContext | null = null;
  try {
    ctx = new Ctor();
    const bytes = await file.arrayBuffer();
    const audioBuffer = await decodeAudioBuffer(ctx, bytes);
    const mono = mixToMono(audioBuffer);
    const detectedBpm = detectBpmFromChannelData(mono, audioBuffer.sampleRate);
    const effectiveBpm = hintBpm && hintBpm >= 40 && hintBpm <= 240 ? hintBpm : detectedBpm?.bpm;
    const gridOriginSec = effectiveBpm ? detectGridOriginSec(mono, audioBuffer.sampleRate, effectiveBpm) : 0;
    const grid: BeatGrid | null = effectiveBpm
      ? {
          bpm: effectiveBpm,
          gridOriginSec,
          confidence: hintBpm && hintBpm >= 40 && hintBpm <= 240 ? 1 : detectedBpm?.confidence,
        }
      : null;
    const fallbackArrangement = buildLocalEnergyArrangement(
      calcRmsEnvelope(mono, 180),
      audioBuffer.duration,
      grid
    );
    const analysisWav = buildAnalysisWav(mono, audioBuffer.sampleRate).blob;
    return {
      analysisWav,
      duration: audioBuffer.duration,
      detectedBpm,
      gridOriginSec,
      fallbackArrangement,
    };
  } catch (err) {
    console.warn('Could not build background beat analysis clip:', err);
    return null;
  } finally {
    ctx?.close().catch(() => {});
  }
}

export interface AudioAnalysis {
  waveform: number[];
  duration: number;
  /** null when decoding worked but no reliable tempo was found. */
  detectedBpm: BpmEstimate | null;
  /** Detected downbeat phase offset in seconds (>= 0). */
  gridOriginSec?: number;
  /** Whole-track WAV Blob for server-side arrangement analysis. */
  analysisWav?: Blob;
  /** Deterministic RMS energy arrangement snapped to the beat's bar grid. */
  fallbackArrangement?: BeatAnalysis;
  /** false when only the duration could be probed (decode failed or file too large). */
  decoded: boolean;
}

/**
 * Decodes a file once and derives waveform, duration, tempo, downbeat grid origin,
 * a deterministic energy arrangement fallback, and an analysis clip. If the browser
 * cannot decode the format, falls back to probing the duration through an <audio> element.
 */
export async function extractAudioWaveform(
  file: File | Blob,
  samplesCount: number = 160,
  hintBpm?: number
): Promise<AudioAnalysis> {
  const Ctor = getAudioContextCtor();
  if (Ctor && file.size > 0 && file.size <= MAX_DECODE_BYTES) {
    let ctx: AudioContext | null = null;
    try {
      ctx = new Ctor();
      const bytes = await file.arrayBuffer();
      const audioBuffer = await decodeAudioBuffer(ctx, bytes);
      const mono = mixToMono(audioBuffer);

      let analysisWav: Blob | undefined;
      try {
        analysisWav = buildAnalysisWav(mono, audioBuffer.sampleRate).blob;
      } catch (e) {
        console.warn('Could not build analysis clip:', e);
      }

      const detectedBpm = detectBpmFromChannelData(mono, audioBuffer.sampleRate);
      const effectiveBpm = hintBpm ?? detectedBpm?.bpm;
      const gridOriginSec = effectiveBpm ? detectGridOriginSec(mono, audioBuffer.sampleRate, effectiveBpm) : 0;
      const grid: BeatGrid | null = effectiveBpm
        ? {
            bpm: effectiveBpm,
            gridOriginSec,
            confidence: hintBpm ? 1 : detectedBpm?.confidence,
          }
        : null;
      const fallbackArrangement = buildLocalEnergyArrangement(
        calcRmsEnvelope(mono, 180),
        audioBuffer.duration,
        grid
      );

      return {
        waveform: calcWaveformSync(mono, samplesCount),
        duration: audioBuffer.duration,
        detectedBpm,
        gridOriginSec,
        analysisWav,
        fallbackArrangement,
        decoded: true,
      };
    } catch (err) {
      console.warn('Web Audio decode failed, probing duration instead:', err);
    } finally {
      ctx?.close().catch(() => {});
    }
  }

  const probed = await probeMediaDuration(file);
  return { waveform: [], duration: probed, detectedBpm: null, gridOriginSec: 0, decoded: false };
}

/** Reads duration via <audio> metadata. Returns 0 when it cannot be determined. */
function probeMediaDuration(file: File | Blob, timeoutMs = 4000): Promise<number> {
  return new Promise<number>(resolve => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    let done = false;
    const finish = (d: number) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      probe.removeAttribute('src');
      probe.load();
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };
    const timer = setTimeout(() => finish(0), timeoutMs);
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => finish(probe.duration);
    probe.onerror = () => finish(0);
    probe.src = url;
  });
}

/** Downsamples mono PCM in memory to a 16 kHz mono WAV for batch transcription. */
export function pcmToTranscriptionWav(mono: Float32Array, sampleRate: number): Blob {
  const downsampled = downsampleMono(mono, sampleRate, 16000);
  return encodeWAV(downsampled, Math.min(16000, sampleRate));
}

/**
 * Decodes a recorded blob and returns it as a 16 kHz mono WAV, small enough to
 * upload for batch transcription.
 */
export async function blobToTranscriptionWav(blob: Blob): Promise<Blob> {
  const Ctor = getAudioContextCtor();
  if (!Ctor) throw new Error('Web Audio is not available');
  const ctx = new Ctor();
  try {
    const buf = await decodeAudioBuffer(ctx, await blob.arrayBuffer());
    return pcmToTranscriptionWav(mixToMono(buf), buf.sampleRate);
  } finally {
    ctx.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result ?? '');
      resolve(res.includes(',') ? res.split(',')[1] : res);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read audio'));
    reader.readAsDataURL(blob);
  });
}

/** 16-bit mono PCM WAV encoder. */
export function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

// ---------------------------------------------------------------------------
// Microphone capture
// ---------------------------------------------------------------------------

export type RecorderWarning = 'silent' | 'clipped' | 'interrupted' | 'too-long';

export interface RecordingResult {
  blob: Blob;
  /** Exact: captured sample count divided by the capture sample rate. */
  durationSec: number;
  sampleRate: number;
  /** Highest absolute sample value, 0..1. */
  peak: number;
  /** Amplitude profile for display (48 bars), computed from the captured PCM. */
  waveform: number[];
  warnings: RecorderWarning[];
  /** Input + output latency the browser reports, in seconds (0 if unknown). */
  reportedLatencySec: number;
  /** Duration of the initial capture buffer accumulated before onFirstChunk fired, in seconds. */
  firstChunkBufferSec: number;
  /** Where the take has singing, measured from the captured PCM; used to time lyric lines. */
  vocal: VocalMap;
  /** Pre-downsampled 16 kHz mono WAV built from in-memory PCM so batch STT doesn't re-decode. */
  transcriptionBlob?: Blob;
}

/**
 * Computes where a newly recorded take anchors on the song timeline.
 *
 * When automatic latency compensation is active (`manualLatencyMs === null`)
 * and `firstChunkTimelineSec` was captured on the first emitted PCM chunk,
 * we subtract both browser-reported hardware latency and the initial chunk
 * accumulation buffer (`2048 / sampleRate` for AudioWorklet or `4096 / sampleRate`
 * for ScriptProcessor) so sample 0 aligns accurately to the beat.
 */
export function computeRecordingAnchorSec(params: {
  firstChunkTimelineSec: number | null;
  targetStartSec: number;
  manualLatencyMs: number | null;
  reportedLatencySec: number;
  firstChunkBufferSec: number;
}): number {
  const { firstChunkTimelineSec, targetStartSec, manualLatencyMs, reportedLatencySec, firstChunkBufferSec } = params;
  const baseTime = firstChunkTimelineSec ?? targetStartSec;
  const latencySec =
    manualLatencyMs !== null
      ? manualLatencyMs / 1000
      : reportedLatencySec + (firstChunkTimelineSec !== null ? firstChunkBufferSec : 0);
  return Math.max(0, baseTime - latencySec);
}

export interface MicOptions {
  /** Headphones: leave echo cancellation / noise suppression / AGC off for a clean vocal. */
  headphones: boolean;
}

export interface StartOptions {
  /** Fires once, when the first captured audio reaches the app. */
  onFirstChunk?: () => void;
  /** Fires if the recording hits MAX_RECORDING_SEC; the caller should stop it. */
  onLimit?: () => void;
}

const WORKLET_SOURCE = `
class LyriqCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(2048);
    this.n = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'flush') { this.emit(); this.port.postMessage({ flushed: true }); }
    };
  }
  emit() {
    if (this.n === 0) return;
    const out = this.buf.slice(0, this.n);
    this.n = 0;
    this.port.postMessage({ pcm: out.buffer }, [out.buffer]);
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) this.emit();
      }
    }
    return true;
  }
}
registerProcessor('lyriq-capture', LyriqCapture);
`;

const IDLE_RELEASE_MS = 2 * 60 * 1000;
/** Longest a take waits for the capture context to start before giving up. */
const CONTEXT_START_TIMEOUT_MS = 2500;

/**
 * Microphone recorder producing 16-bit PCM WAV takes.
 *
 * Capture runs in an AudioWorklet (off the main thread) and falls back to a
 * ScriptProcessor where worklets are unavailable. The mic stream is shared
 * between takes so permission is requested once, and released after two idle
 * minutes or when the page is hidden for good.
 */
export class UniversalVoiceRecorder {
  private static sharedStream: MediaStream | null = null;
  private static sharedStreamKey = '';
  private static sharedContext: AudioContext | null = null;
  private static workletReady = new WeakSet<BaseAudioContext>();
  private static workletLoading = new WeakMap<BaseAudioContext, Promise<void>>();
  private static idleTimer: ReturnType<typeof setTimeout> | null = null;
  private static lifecycleBound = false;

  private chunks: Float32Array[] = [];
  private totalSamples = 0;
  private peak = 0;
  private sampleRate = 44100;
  private recording = false;
  private warnings = new Set<RecorderWarning>();
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private node: AudioWorkletNode | ScriptProcessorNode | null = null;
  private ctx: AudioContext | null = null;
  private firstChunkSeen = false;
  private captureChunkSamples = 0;
  private firstChunkSamples = 0;
  private limitFired = false;
  private opts: StartOptions = {};
  private onStateChange: (() => void) | null = null;

  private static bindLifecycle(): void {
    if (UniversalVoiceRecorder.lifecycleBound || typeof window === 'undefined') return;
    UniversalVoiceRecorder.lifecycleBound = true;
    window.addEventListener('pagehide', () => UniversalVoiceRecorder.releaseMic());
  }

  private static scheduleIdleRelease(): void {
    if (UniversalVoiceRecorder.idleTimer) clearTimeout(UniversalVoiceRecorder.idleTimer);
    UniversalVoiceRecorder.idleTimer = setTimeout(() => UniversalVoiceRecorder.releaseMic(), IDLE_RELEASE_MS);
  }

  /**
   * Requests (or reuses) the mic stream. Call from a user gesture so the
   * permission prompt appears on tap rather than mid count-in.
   */
  public static async prepareMicStream(options: MicOptions = { headphones: true }): Promise<MediaStream> {
    UniversalVoiceRecorder.bindLifecycle();
    const key = options.headphones ? 'raw' : 'processed';
    const existing = UniversalVoiceRecorder.sharedStream;

    if (existing) {
      const live = existing.getAudioTracks().some(t => t.readyState === 'live');
      if (live && UniversalVoiceRecorder.sharedStreamKey === key) return existing;
      UniversalVoiceRecorder.releaseStream();
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone recording is not supported in this browser.');
    }

    const processing = !options.headphones;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: processing,
        noiseSuppression: processing,
        autoGainControl: processing,
        channelCount: 1,
      },
    });

    // Muted until a take starts; the open stream keeps permission alive.
    stream.getAudioTracks().forEach(t => {
      t.enabled = false;
      t.addEventListener('ended', () => {
        if (UniversalVoiceRecorder.sharedStream === stream) UniversalVoiceRecorder.sharedStream = null;
      });
    });

    UniversalVoiceRecorder.sharedStream = stream;
    UniversalVoiceRecorder.sharedStreamKey = key;
    UniversalVoiceRecorder.scheduleIdleRelease();
    return stream;
  }

  /**
   * Ensures the capture AudioWorklet module is registered once per AudioContext.
   * Deduplicates concurrent warmUp() and start() calls so mobile Safari/Chrome
   * can compile the worklet inside the Record tap gesture before count-in ends.
   */
  private static ensureWorkletModule(ctx: AudioContext): Promise<void> {
    if (!ctx.audioWorklet) return Promise.reject(new Error('AudioWorklet unsupported'));
    if (UniversalVoiceRecorder.workletReady.has(ctx)) return Promise.resolve();
    const existing = UniversalVoiceRecorder.workletLoading.get(ctx);
    if (existing) return existing;

    const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
    const task = ctx.audioWorklet
      .addModule(url)
      .then(() => {
        UniversalVoiceRecorder.workletReady.add(ctx);
      })
      .finally(() => {
        URL.revokeObjectURL(url);
        if (UniversalVoiceRecorder.workletLoading.get(ctx) === task) {
          UniversalVoiceRecorder.workletLoading.delete(ctx);
        }
      });
    UniversalVoiceRecorder.workletLoading.set(ctx, task);
    return task;
  }

  /**
   * Creates (or wakes) the capture AudioContext and preloads its AudioWorklet.
   * Call synchronously inside the Record tap: the take itself starts after the
   * count-in, outside any gesture, and iOS may refuse to start a context then.
   */
  public static warmUp(): void {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    let ctx = UniversalVoiceRecorder.sharedContext;
    if (!ctx || ctx.state === 'closed') {
      try {
        ctx = new Ctor({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      UniversalVoiceRecorder.sharedContext = ctx;
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (ctx.audioWorklet) {
      UniversalVoiceRecorder.ensureWorkletModule(ctx).catch(() => {});
    }
  }

  private static releaseStream(): void {
    UniversalVoiceRecorder.sharedStream?.getTracks().forEach(t => t.stop());
    UniversalVoiceRecorder.sharedStream = null;
  }

  public static releaseMic(): void {
    if (UniversalVoiceRecorder.idleTimer) clearTimeout(UniversalVoiceRecorder.idleTimer);
    UniversalVoiceRecorder.idleTimer = null;
    UniversalVoiceRecorder.releaseStream();
    const ctx = UniversalVoiceRecorder.sharedContext;
    UniversalVoiceRecorder.sharedContext = null;
    ctx?.close().catch(() => {});
  }

  private async attachWorklet(ctx: AudioContext, source: MediaStreamAudioSourceNode): Promise<AudioWorkletNode> {
    await UniversalVoiceRecorder.ensureWorkletModule(ctx);
    const node = new AudioWorkletNode(ctx, 'lyriq-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
    this.captureChunkSamples = 2048;
    node.port.onmessage = (e: MessageEvent) => {
      if (e.data?.pcm) this.handleChunk(new Float32Array(e.data.pcm as ArrayBuffer));
    };
    source.connect(node);
    return node;
  }

  private attachScriptProcessor(ctx: AudioContext, source: MediaStreamAudioSourceNode): ScriptProcessorNode {
    const node = ctx.createScriptProcessor(4096, 1, 1);
    this.captureChunkSamples = 4096;
    node.onaudioprocess = (e: AudioProcessingEvent) => {
      const input = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input.length);
      copy.set(input);
      this.handleChunk(copy);
    };
    source.connect(node);
    return node;
  }

  private handleChunk(chunk: Float32Array): void {
    if (!this.recording) return;

    if (!this.firstChunkSeen) {
      this.firstChunkSeen = true;
      this.firstChunkSamples = chunk.length;
      this.opts.onFirstChunk?.();
    }

    for (let i = 0; i < chunk.length; i++) {
      const a = Math.abs(chunk[i]);
      if (a > this.peak) this.peak = a;
    }
    this.chunks.push(chunk);
    this.totalSamples += chunk.length;

    if (this.totalSamples / this.sampleRate >= MAX_RECORDING_SEC && !this.limitFired) {
      this.limitFired = true;
      this.warnings.add('too-long');
      this.opts.onLimit?.();
    }
  }

  async start(options: StartOptions & Partial<MicOptions> = {}): Promise<void> {
    this.opts = options;
    this.chunks = [];
    this.totalSamples = 0;
    this.peak = 0;
    this.warnings.clear();
    this.firstChunkSeen = false;
    this.captureChunkSamples = 0;
    this.firstChunkSamples = 0;
    this.limitFired = false;

    if (UniversalVoiceRecorder.idleTimer) clearTimeout(UniversalVoiceRecorder.idleTimer);
    const stream = await UniversalVoiceRecorder.prepareMicStream({ headphones: options.headphones ?? true });

    const Ctor = getAudioContextCtor();
    if (!Ctor) throw new Error('Web Audio is not supported in this browser.');
    let ctx = UniversalVoiceRecorder.sharedContext;
    if (!ctx || ctx.state === 'closed') {
      ctx = new Ctor({ latencyHint: 'interactive' });
      UniversalVoiceRecorder.sharedContext = ctx;
    }
    if (ctx.state !== 'running') {
      // resume() can hang forever when the browser refuses it; never leave the
      // record button stuck waiting.
      await Promise.race([ctx.resume().catch(() => {}), new Promise(r => setTimeout(r, CONTEXT_START_TIMEOUT_MS))]);
      if ((ctx.state as string) !== 'running') {
        throw new Error('Audio input could not start. Tap record to try again.');
      }
    }
    this.ctx = ctx;
    this.sampleRate = ctx.sampleRate;

    // iOS suspends the context for calls/Siri; a take spanning that has a hole in it.
    this.onStateChange = () => {
      if (!this.recording || !this.ctx) return;
      if (this.ctx.state !== 'running') {
        this.warnings.add('interrupted');
        this.ctx.resume().catch(() => {});
      }
    };
    ctx.addEventListener('statechange', this.onStateChange);

    try {
      this.source = ctx.createMediaStreamSource(stream);
      try {
        this.node = await this.attachWorklet(ctx, this.source);
      } catch (err) {
        console.warn('AudioWorklet capture unavailable, using ScriptProcessor:', err);
        this.node = this.attachScriptProcessor(ctx, this.source);
      }

      // A muted sink keeps the graph pulled without monitoring the mic through the speakers.
      this.sink = ctx.createGain();
      this.sink.gain.value = 0;
      this.node.connect(this.sink);
      this.sink.connect(ctx.destination);

      stream.getAudioTracks().forEach(t => { t.enabled = true; });
      this.recording = true;
    } catch (err) {
      this.cleanupCaptureGraph();
      throw err;
    }
  }

  private cleanupCaptureGraph(): void {
    if (this.ctx && this.onStateChange) this.ctx.removeEventListener('statechange', this.onStateChange);
    this.onStateChange = null;
    try { this.node?.disconnect(); } catch { /* already disconnected */ }
    try { this.source?.disconnect(); } catch { /* already disconnected */ }
    try { this.sink?.disconnect(); } catch { /* already disconnected */ }
    if (this.node) {
      if ('port' in this.node) this.node.port.onmessage = null;
      if ('onaudioprocess' in this.node) this.node.onaudioprocess = null;
    }
    this.node = null;
    this.source = null;
    this.sink = null;
  }

  /** Latency the browser reports for the capture context (input + output), seconds. */
  reportedLatencySec(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const out = typeof ctx.outputLatency === 'number' ? ctx.outputLatency : 0;
    const track = UniversalVoiceRecorder.sharedStream?.getAudioTracks()[0];
    const input = (track?.getSettings() as MediaTrackSettings & { latency?: number } | undefined)?.latency;
    return (ctx.baseLatency || 0) + out + (typeof input === 'number' ? input : 0);
  }

  async stop(): Promise<RecordingResult> {
    const wasRecording = this.recording;

    // Pull any samples still buffered inside the worklet before closing the take.
    if (wasRecording && this.node && 'port' in this.node) {
      const port = this.node.port;
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 150);
        const prev = port.onmessage;
        port.onmessage = (e: MessageEvent) => {
          if (e.data?.flushed) { clearTimeout(timer); resolve(); }
          else prev?.call(port, e);
        };
        port.postMessage('flush');
      });
    }
    this.recording = false;
    this.cleanupCaptureGraph();

    // Mute rather than stop the track so the next take doesn't re-prompt for permission.
    UniversalVoiceRecorder.sharedStream?.getAudioTracks().forEach(t => { t.enabled = false; });
    UniversalVoiceRecorder.scheduleIdleRelease();

    const merged = new Float32Array(this.totalSamples);
    let offset = 0;
    for (const c of this.chunks) { merged.set(c, offset); offset += c.length; }
    this.chunks = [];

    const durationSec = this.totalSamples / this.sampleRate;
    if (durationSec >= 0.25 && this.peak < 0.002) this.warnings.add('silent');
    if (this.peak >= 0.995) this.warnings.add('clipped');

    const blob = encodeWAV(merged, this.sampleRate);
    const transcriptionBlob =
      merged.length > 0 && durationSec >= 0.3 && !this.warnings.has('silent')
        ? pcmToTranscriptionWav(merged, this.sampleRate)
        : undefined;
    let vocal: VocalMap = { regions: [], entries: [], gaps: [], sustain: [] };
    try {
      vocal = mapVocal(vocalEnvelope(merged, this.sampleRate));
    } catch (err) {
      console.warn('Vocal timing analysis failed:', err);
    }
    const initialChunkSamples = this.firstChunkSamples > 0 ? this.firstChunkSamples : this.captureChunkSamples;
    const firstChunkBufferSec = this.sampleRate > 0 ? initialChunkSamples / this.sampleRate : 0;
    return {
      blob,
      durationSec,
      sampleRate: this.sampleRate,
      peak: this.peak,
      waveform: merged.length > 0 ? calcWaveformSync(merged, 48) : [],
      warnings: [...this.warnings],
      reportedLatencySec: this.reportedLatencySec(),
      firstChunkBufferSec,
      vocal,
      transcriptionBlob,
    };
  }
}
