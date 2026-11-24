// Tempo, beat and downbeat tracking.
//
// Beats: dynamic-programming beat tracker (Ellis 2007, as in librosa.beat.beat_track).
// Downbeats: the beat phase (of 4) where harmony changes and the kick lands.
// Grid: a constant-tempo line fitted through the tracked beats, which is what the
// editor's bar snapping uses.

import type { FrameFeatures } from './features';

export interface BeatTrack {
  /** Tempo of the fitted constant grid. */
  bpm: number;
  /** Tracked beat times (seconds). Follows tempo drift, unlike the grid. */
  beats: number[];
  /** Which tracked beat (mod 4) is a downbeat. */
  downbeatPhase: number;
  /** Tracked downbeat times (seconds). */
  downbeats: number[];
  /** First downbeat of the fitted constant grid, in [0, bar). */
  gridOriginSec: number;
  /** 0..1: share of tracked beats lying on the constant grid. */
  gridConfidence: number;
}

const TEMPO_PRIOR_BPM = 120;
const MIN_BPM = 55;
const MAX_BPM = 215;
const TIGHTNESS = 100;

function std(a: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m += a[i];
  m /= Math.max(1, a.length);
  let v = 0;
  for (let i = 0; i < a.length; i++) v += (a[i] - m) ** 2;
  return Math.sqrt(v / Math.max(1, a.length - 1));
}

function zscore(a: number[]): number[] {
  const m = a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const sd = std(a) || 1;
  return a.map(v => (v - m) / sd);
}

/**
 * Global tempo from the onset autocorrelation, weighted by a log-normal
 * preference around 120 BPM (one octave wide, like librosa). Returns BPM.
 */
export function estimateTempo(onset: Float32Array, fps: number): number {
  const n = onset.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += onset[i];
  mean /= Math.max(1, n);
  const minLag = Math.max(2, Math.floor((fps * 60) / MAX_BPM));
  const maxLag = Math.min(n - 2, Math.ceil((fps * 60) / MIN_BPM));
  if (maxLag <= minLag + 2) return TEMPO_PRIOR_BPM;
  const ac = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let t = 0; t + lag < n; t++) s += (onset[t] - mean) * (onset[t + lag] - mean);
    ac[lag] = s / (n - lag);
  }
  const prior = (lag: number) => {
    const oct = Math.log2((fps * 60) / lag / TEMPO_PRIOR_BPM);
    return Math.exp(-0.5 * oct * oct);
  };
  let best = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    // A tempo whose period falls between frames splits its peak: score a 3-lag neighbourhood.
    const s = (ac[lag - 1] * 0.5 + ac[lag] + ac[lag + 1] * 0.5) * prior(lag);
    if (s > bestScore) { bestScore = s; best = lag; }
  }
  const y0 = ac[best - 1], y1 = ac[best], y2 = ac[best + 1];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom)) : 0;
  return (fps * 60) / (best + shift);
}

/** Dynamic-programming beat tracker. Returns beat frame indices. */
export function trackBeats(onset: Float32Array, fps: number, bpm: number): number[] {
  const n = onset.length;
  const sd = std(onset) || 1;
  const period = (fps * 60) / bpm;

  // Local score: onset smoothed by a Gaussian of width period/32 (librosa).
  const radius = Math.max(1, Math.round(period));
  const kernel: number[] = [];
  for (let t = -radius; t <= radius; t++) kernel.push(Math.exp(-0.5 * ((t * 32) / period) ** 2));
  const local = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < kernel.length; k++) {
      const j = i + k - radius;
      if (j >= 0 && j < n) s += kernel[k] * (onset[j] / sd);
    }
    local[i] = s;
  }

  const wFrom = Math.round(-2 * period);
  const wTo = -Math.round(period / 2);
  const txCost: number[] = [];
  for (let w = wFrom; w <= wTo; w++) txCost.push(-TIGHTNESS * Math.log(-w / period) ** 2);

  const cum = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  let firstBeat = true;
  let maxLocal = 0;
  for (let i = 0; i < n; i++) maxLocal = Math.max(maxLocal, local[i]);
  for (let i = 0; i < n; i++) {
    let best = -Infinity;
    let arg = -1;
    for (let k = 0; k < txCost.length; k++) {
      const j = i + wFrom + k;
      if (j < 0) continue;
      const v = cum[j] + txCost[k];
      if (v > best) { best = v; arg = j; }
    }
    // Until the first real onset, beats may start anywhere.
    if (firstBeat && local[i] < 0.01 * maxLocal) {
      cum[i] = local[i];
      back[i] = -1;
    } else {
      firstBeat = false;
      cum[i] = arg >= 0 ? local[i] + best : local[i];
      back[i] = arg;
    }
  }

  // Last beat: the final local maximum of the cumulative score above half the median peak.
  const peaks: number[] = [];
  for (let i = 1; i < n - 1; i++) if (cum[i] >= cum[i - 1] && cum[i] >= cum[i + 1]) peaks.push(i);
  if (peaks.length === 0) return [];
  const sorted = peaks.map(i => cum[i]).sort((a, b) => a - b);
  const thresh = 0.5 * sorted[Math.floor(sorted.length / 2)];
  let last = peaks[peaks.length - 1];
  for (let p = peaks.length - 1; p >= 0; p--) {
    if (cum[peaks[p]] >= thresh) { last = peaks[p]; break; }
  }

  const beats: number[] = [];
  for (let i = last; i >= 0; i = back[i]) {
    beats.push(i);
    if (back[i] < 0) break;
  }
  beats.reverse();

  // Trim weak beats at the edges (silence or fade), as librosa does.
  const smoothAt = (i: number) => local[i];
  const rms = Math.sqrt(beats.reduce((s, b) => s + smoothAt(b) ** 2, 0) / Math.max(1, beats.length));
  let a = 0;
  let z = beats.length - 1;
  while (a < z && smoothAt(beats[a]) < 0.5 * rms) a++;
  while (z > a && smoothAt(beats[z]) < 0.5 * rms) z--;
  return beats.slice(a, z + 1);
}

function meanChroma(chroma: Float32Array, from: number, to: number): number[] {
  const out = new Array(12).fill(0);
  const a = Math.max(0, from);
  const b = Math.max(a + 1, to);
  for (let f = a; f < b; f++) for (let p = 0; p < 12; p++) out[p] += chroma[f * 12 + p] ?? 0;
  const mean = out.reduce((s, v) => s + v, 0) / 12;
  const centred = out.map(v => v - mean);
  const norm = Math.sqrt(centred.reduce((s, v) => s + v * v, 0)) || 1;
  return centred.map(v => v / norm);
}

/** Chooses which of every 4 beats is the downbeat: harmony changes plus kick drum. */
export function pickDownbeatPhase(beatFrames: number[], feats: FrameFeatures, beatsPerBar = 4): number {
  if (beatFrames.length < beatsPerBar * 2) return 0;
  const change: number[] = [];
  const kick: number[] = [];
  for (let i = 0; i < beatFrames.length; i++) {
    const prev2 = beatFrames[Math.max(0, i - 2)];
    const cur = beatFrames[i];
    const next2 = beatFrames[Math.min(beatFrames.length - 1, i + 2)];
    const before = meanChroma(feats.chroma, prev2, cur);
    const after = meanChroma(feats.chroma, cur, next2);
    let dot = 0;
    for (let p = 0; p < 12; p++) dot += before[p] * after[p];
    change.push(1 - dot);
    let k = 0;
    for (let f = Math.max(0, cur - 2); f <= Math.min(feats.nFrames - 1, cur + 2); f++) k = Math.max(k, feats.lowOnset[f]);
    kick.push(k);
  }
  const zc = zscore(change);
  const zk = zscore(kick);
  let best = 0;
  let bestScore = -Infinity;
  for (let phase = 0; phase < beatsPerBar; phase++) {
    let s = 0;
    let c = 0;
    for (let i = phase; i < beatFrames.length; i += beatsPerBar) { s += zc[i] + 0.5 * zk[i]; c++; }
    const score = c ? s / c : -Infinity;
    if (score > bestScore) { bestScore = score; best = phase; }
  }
  return best;
}

/** Least-squares constant-tempo grid through the tracked beats, ignoring outliers. */
export function fitConstantGrid(beatTimes: number[], approxBpm: number): { bpm: number; t0: number; confidence: number } {
  if (beatTimes.length < 4) return { bpm: approxBpm, t0: beatTimes[0] ?? 0, confidence: 0 };
  let T = 60 / approxBpm;
  // Index beats by their position on the grid (a skipped beat keeps its slot).
  let t0 = beatTimes[0];
  let inliers = beatTimes.map((t, i) => ({ t, i }));
  // Index each beat from its neighbour, so a few percent of tempo error can't pile
  // up into a whole-beat misassignment over a long song (a skipped beat keeps its slot).
  const slot: number[] = [0];
  for (let k = 1; k < beatTimes.length; k++) slot.push(slot[k - 1] + Math.max(1, Math.round((beatTimes[k] - beatTimes[k - 1]) / T)));
  for (let iter = 0; iter < 4; iter++) {
    const pts = beatTimes.map((t, k) => ({ t, i: slot[k] }));
    const resid = pts.map(p => p.t - (t0 + p.i * T));
    const sortedR = [...resid].sort((a, b) => a - b);
    const med = sortedR[Math.floor(sortedR.length / 2)];
    t0 += med;
    inliers = pts.filter(p => Math.abs(p.t - (t0 + p.i * T)) < 0.12 * T);
    if (inliers.length < 4) break;
    let si = 0, st = 0, sii = 0, sit = 0;
    for (const p of inliers) { si += p.i; st += p.t; sii += p.i * p.i; sit += p.i * p.t; }
    const n = inliers.length;
    const d = n * sii - si * si;
    if (d <= 0) break;
    const slope = (n * sit - si * st) / d;
    if (!(slope > 0)) break;
    T = slope;
    t0 = (st - slope * si) / n;
  }
  const finalIn = beatTimes.filter((t, k) => Math.abs(t - (t0 + slot[k] * T)) < 0.08 * T).length;
  return { bpm: 60 / T, t0, confidence: finalIn / beatTimes.length };
}

/** DAW-made beats sit on whole BPM values: snap to one when the fit is within 0.06 BPM. */
export function tidyBpm(bpm: number): number {
  const r = Math.round(bpm);
  return Math.abs(bpm - r) < 0.06 ? r : Math.round(bpm * 100) / 100;
}

export function analyzeBeats(feats: FrameFeatures, hintBpm?: number): BeatTrack {
  const fps = feats.fps;
  const hinted = hintBpm && hintBpm >= 40 && hintBpm <= 240 ? hintBpm : undefined;
  const bpm0 = hinted ?? estimateTempo(feats.onset, fps);
  const tracked = trackBeats(feats.onset, fps, bpm0);
  const fit = fitConstantGrid(tracked.map(f => f / fps), bpm0);
  // Quiet intros and fade-outs have no drums to track: extend the beats to both ends
  // of the song at the fitted tempo, so every part of the song has beat units.
  const period = (60 / fit.bpm) * fps;
  const beatFrames = [...tracked];
  if (beatFrames.length >= 2 && period > 1) {
    const lead: number[] = [];
    for (let f = beatFrames[0] - period; f >= 0; f -= period) lead.unshift(Math.round(f));
    const tail: number[] = [];
    for (let f = beatFrames[beatFrames.length - 1] + period; f < feats.nFrames - period * 0.5; f += period) tail.push(Math.round(f));
    beatFrames.unshift(...lead);
    beatFrames.push(...tail);
  }
  const beats = beatFrames.map(f => f / fps);
  const bpm = hinted ?? tidyBpm(fit.bpm);
  const base: BeatTrack = {
    bpm,
    beats,
    downbeatPhase: 0,
    downbeats: [],
    gridOriginSec: 0,
    gridConfidence: fit.confidence,
  };
  return withDownbeatPhase(base, pickDownbeatPhase(beatFrames, feats), fit.t0);
}

/** Sets the downbeat phase and derives the downbeats and the constant grid's origin from it. */
export function withDownbeatPhase(track: BeatTrack, phase: number, gridT0?: number): BeatTrack {
  const { beats, bpm } = track;
  const downbeats = beats.filter((_, i) => i % 4 === phase);
  const T = 60 / bpm;
  const bar = 4 * T;
  const t0 = gridT0 ?? beats[0] ?? 0;
  // Grid downbeat nearest the first tracked downbeat, then folded to [0, bar).
  const firstDown = downbeats[0] ?? t0;
  const k = Math.round((firstDown - t0) / T);
  const gridDown = t0 + k * T;
  let origin = ((gridDown % bar) + bar) % bar;
  if (origin > bar - 0.015) origin = 0;
  return { ...track, downbeatPhase: phase, downbeats, gridOriginSec: Math.round(origin * 1000) / 1000 };
}
