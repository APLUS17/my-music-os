// Section boundaries from repetition and change.
//
// 1. Beat-synchronous features: harmony (chroma), timbre (MFCC), loudness.
// 2. Novelty, three ways:
//    - Foote checkerboard novelty on timbre and on harmony self-similarity (where the sound changes),
//    - Serrà "structure features" on a recurrence lag matrix (where the pattern of repeats changes),
//    - loudness steps.
// 3. A dynamic programme over downbeats that trades novelty against a phrase-length
//    prior (sections of 4, 8 or 16 bars are the norm in songs).

import type { FrameFeatures } from './features';
import { N_MFCC } from './features';

export interface BeatFeatures {
  /** Number of beat units. */
  n: number;
  /** Start time of each beat unit (seconds); unit i spans [times[i], times[i+1]). */
  times: number[];
  /** L2-normalised chroma, [i * 12 + p]. */
  chroma: Float64Array;
  /** Standardised timbre vector (MFCC z-scores + loudness), [i * TIMBRE_DIM + k]. */
  timbre: Float64Array;
  /** Mean RMS level per beat (dB). */
  rmsDb: Float64Array;
}

export const TIMBRE_DIM = N_MFCC + 1;

export interface SegmentParams {
  /** Weights of the novelty components. */
  wStructure: number;
  wTimbre: number;
  wHarmony: number;
  wEnergy: number;
  /** Per-boundary cost: higher means fewer sections. */
  boundaryCost: number;
  /** Bonus for sections of 4/8/16 bars. */
  phraseBonus: number;
  /** Allow boundaries on any beat, not only on the detected downbeats. */
  anyBeat?: boolean;
  /** How far (beats) a boundary may slide from its downbeat toward a sharper change. */
  refineBeats?: number;
}

/** Tuned on the SongFormBench dev split (40 songs). */
export const DEFAULT_SEGMENT_PARAMS: SegmentParams = {
  wStructure: 1,
  wTimbre: 1,
  wHarmony: 0.5,
  wEnergy: 0.5,
  boundaryCost: 1.4,
  phraseBonus: 0.6,
  refineBeats: 1,
};

/** Averages frame features over each beat interval. The region before the first beat becomes unit 0. */
export function beatSyncFeatures(feats: FrameFeatures, beatTimes: number[], durationSec: number): BeatFeatures {
  const times: number[] = [];
  if (beatTimes.length === 0 || beatTimes[0] > 0.05) times.push(0);
  for (const t of beatTimes) if (t < durationSec - 0.05 && (times.length === 0 || t > times[times.length - 1] + 0.05)) times.push(t);
  const n = times.length;
  const chroma = new Float64Array(n * 12);
  const mfccSum = new Float64Array(n * N_MFCC);
  const rmsDb = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.min(feats.nFrames - 1, Math.max(0, Math.floor(times[i] * feats.fps)));
    const end = i + 1 < n ? times[i + 1] : durationSec;
    const b = Math.min(feats.nFrames, Math.max(a + 1, Math.floor(end * feats.fps)));
    const cnt = b - a;
    let r = 0;
    for (let f = a; f < b; f++) {
      for (let p = 0; p < 12; p++) chroma[i * 12 + p] += feats.chroma[f * 12 + p];
      for (let k = 0; k < N_MFCC; k++) mfccSum[i * N_MFCC + k] += feats.mfcc[f * N_MFCC + k];
      r += 10 ** (feats.rmsDb[f] / 10);
    }
    rmsDb[i] = 10 * Math.log10(r / cnt + 1e-10);
    // Mean-centre, then unit length: drums add the same energy to every pitch class, and
    // without centring every beat looks alike. Cosine of centred chroma is a correlation.
    let mean = 0;
    for (let p = 0; p < 12; p++) mean += chroma[i * 12 + p];
    mean /= 12;
    let norm = 0;
    for (let p = 0; p < 12; p++) { chroma[i * 12 + p] -= mean; norm += chroma[i * 12 + p] ** 2; }
    norm = Math.sqrt(norm) || 1;
    for (let p = 0; p < 12; p++) chroma[i * 12 + p] /= norm;
    for (let k = 0; k < N_MFCC; k++) mfccSum[i * N_MFCC + k] /= cnt;
  }
  // Standardise each timbre dimension over the song; loudness is the last dimension.
  const timbre = new Float64Array(n * TIMBRE_DIM);
  const standardise = (get: (i: number) => number, dim: number, scale: number) => {
    let m = 0;
    for (let i = 0; i < n; i++) m += get(i);
    m /= Math.max(1, n);
    let v = 0;
    for (let i = 0; i < n; i++) v += (get(i) - m) ** 2;
    const sd = Math.sqrt(v / Math.max(1, n)) || 1;
    for (let i = 0; i < n; i++) timbre[i * TIMBRE_DIM + dim] = ((get(i) - m) / sd) * scale;
  };
  for (let k = 0; k < N_MFCC; k++) standardise(i => mfccSum[i * N_MFCC + k], k, 1);
  standardise(i => rmsDb[i], N_MFCC, 2);
  return { n, times, chroma, timbre, rmsDb };
}

/** Cosine self-similarity of row vectors. */
export function cosineSSM(data: Float64Array, n: number, dim: number): Float32Array {
  const norms = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < dim; k++) s += data[i * dim + k] ** 2;
    norms[i] = Math.sqrt(s) || 1;
  }
  const S = new Float32Array(n * n);
  for (let i = 0; i < n; i++) {
    S[i * n + i] = 1;
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      for (let k = 0; k < dim; k++) s += data[i * dim + k] * data[j * dim + k];
      const v = s / (norms[i] * norms[j]);
      S[i * n + j] = v;
      S[j * n + i] = v;
    }
  }
  return S;
}

/** Foote checkerboard novelty with a Gaussian-tapered kernel of half-width w. Normalised to max 1. */
export function footeNovelty(S: Float32Array, n: number, w: number): Float64Array {
  const out = new Float64Array(n);
  const sigma = w / 2;
  const g: number[] = [];
  for (let a = -w; a < w; a++) g.push(Math.exp(-0.5 * ((a + 0.5) / sigma) ** 2));
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let a = -w; a < w; a++) {
      const r = i + a;
      if (r < 0 || r >= n) continue;
      const ga = g[a + w];
      const sa = a < 0 ? -1 : 1;
      for (let b = -w; b < w; b++) {
        const c = i + b;
        if (c < 0 || c >= n) continue;
        const sb = b < 0 ? -1 : 1;
        s += sa * sb * ga * g[b + w] * S[r * n + c];
      }
    }
    out[i] = Math.max(0, s);
  }
  return normaliseMax(out);
}

function normaliseMax(a: Float64Array): Float64Array {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, a[i]);
  if (m > 0) for (let i = 0; i < a.length; i++) a[i] /= m;
  return a;
}

/**
 * Serrà et al. (2014) structure features: delay-embed, mutual k-NN recurrence,
 * circular lag matrix, Gaussian smoothing along time, then the change between
 * consecutive lag columns. Peaks where the repetition pattern changes.
 */
export function structureNovelty(bf: BeatFeatures, embed = 4, kappa = 0.04, sigmaBeats = 4): Float64Array {
  const n = bf.n;
  if (n < embed * 3) return new Float64Array(n);
  const dim = (12 + TIMBRE_DIM) * embed;
  const X = new Float64Array(n * dim);
  for (let i = 0; i < n; i++) {
    for (let e = 0; e < embed; e++) {
      // Centred embedding (i-1 .. i+embed-2): a backward-only window puts every peak embed-1 beats late.
      const src = Math.min(n - 1, Math.max(0, i + e - 1));
      for (let p = 0; p < 12; p++) X[i * dim + e * (12 + TIMBRE_DIM) + p] = bf.chroma[src * 12 + p] * 2;
      for (let k = 0; k < TIMBRE_DIM; k++) X[i * dim + e * (12 + TIMBRE_DIM) + 12 + k] = bf.timbre[src * TIMBRE_DIM + k] * 0.35;
    }
  }
  // Squared distances.
  const D = new Float32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      for (let k = 0; k < dim; k++) { const d = X[i * dim + k] - X[j * dim + k]; s += d * d; }
      D[i * n + j] = s;
      D[j * n + i] = s;
    }
  }
  const k = Math.max(2, Math.round(kappa * n));
  const knn: Set<number>[] = [];
  const idx = new Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) idx[j] = j;
    const row = i * n;
    const cand = idx.filter(j => Math.abs(j - i) > embed);
    cand.sort((a, b) => D[row + a] - D[row + b]);
    knn.push(new Set(cand.slice(0, k)));
  }
  // Lag matrix L[i][l] = R(i, (i + l) mod n), mutual neighbours only.
  const L = new Float32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (const j of knn[i]) {
      if (!knn[j].has(i)) continue;
      const lag = (j - i + n) % n;
      L[i * n + lag] = 1;
    }
  }
  // Gaussian smoothing along time.
  const rad = Math.ceil(sigmaBeats * 3);
  const g: number[] = [];
  for (let t = -rad; t <= rad; t++) g.push(Math.exp(-0.5 * (t / sigmaBeats) ** 2));
  const P = new Float32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let t = -rad; t <= rad; t++) {
      const src = i + t;
      if (src < 0 || src >= n) continue;
      const w = g[t + rad];
      const srow = src * n;
      const drow = i * n;
      for (let l = 0; l < n; l++) { const v = L[srow + l]; if (v) P[drow + l] += w * v; }
    }
  }
  const out = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    let s = 0;
    const a = (i - 1) * n;
    const b = i * n;
    for (let l = 0; l < n; l++) { const d = P[b + l] - P[a + l]; s += d * d; }
    out[i] = s;
  }
  return normaliseMax(out);
}

/** Loudness step between the 2 bars before and after each beat. */
export function energyNovelty(bf: BeatFeatures, w = 8): Float64Array {
  const out = new Float64Array(bf.n);
  for (let i = 0; i < bf.n; i++) {
    let a = 0, ca = 0, b = 0, cb = 0;
    for (let t = Math.max(0, i - w); t < i; t++) { a += bf.rmsDb[t]; ca++; }
    for (let t = i; t < Math.min(bf.n, i + w); t++) { b += bf.rmsDb[t]; cb++; }
    out[i] = ca && cb ? Math.abs(b / cb - a / ca) : 0;
  }
  return normaliseMax(out);
}

export interface NoveltyCurves {
  structure: Float64Array;
  timbre: Float64Array;
  harmony: Float64Array;
  energy: Float64Array;
}

export function computeNovelty(bf: BeatFeatures): NoveltyCurves & { ssmTimbre: Float32Array; ssmHarmony: Float32Array } {
  const ssmTimbre = cosineSSM(bf.timbre, bf.n, TIMBRE_DIM);
  const ssmHarmony = cosineSSM(bf.chroma, bf.n, 12);
  const t8 = footeNovelty(ssmTimbre, bf.n, 8);
  const t16 = footeNovelty(ssmTimbre, bf.n, 16);
  const h8 = footeNovelty(ssmHarmony, bf.n, 8);
  const h16 = footeNovelty(ssmHarmony, bf.n, 16);
  const timbre = new Float64Array(bf.n);
  const harmony = new Float64Array(bf.n);
  for (let i = 0; i < bf.n; i++) {
    timbre[i] = 0.5 * (t8[i] + t16[i]);
    harmony[i] = 0.5 * (h8[i] + h16[i]);
  }
  return {
    structure: structureNovelty(bf),
    timbre: normaliseMax(timbre),
    harmony: normaliseMax(harmony),
    energy: energyNovelty(bf),
    ssmTimbre,
    ssmHarmony,
  };
}

/**
 * Picks section starts among downbeat beat-units.
 * `downbeatUnits`: beat-unit indices that are downbeats, ascending.
 * Returns the chosen unit indices (excluding 0), each a section start.
 */
export function chooseBoundaries(
  nov: NoveltyCurves,
  n: number,
  downbeatUnits: number[],
  params: SegmentParams = DEFAULT_SEGMENT_PARAMS,
  /** Start time of each unit, and the bar length: section lengths are measured in time. */
  timing?: { times: number[]; durationSec: number; barSec: number }
): number[] {
  if (downbeatUnits.length < 3) return [];
  const combined = new Float64Array(n);
  const wSum = params.wStructure + params.wTimbre + params.wHarmony + params.wEnergy || 1;
  for (let i = 0; i < n; i++) {
    combined[i] =
      (params.wStructure * nov.structure[i] + params.wTimbre * nov.timbre[i] +
        params.wHarmony * nov.harmony[i] + params.wEnergy * nov.energy[i]) / wSum;
  }
  // Standardise so the boundary cost means the same in every song.
  let m = 0;
  for (let i = 0; i < n; i++) m += combined[i];
  m /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (combined[i] - m) ** 2;
  const sd = Math.sqrt(v / n) || 1;
  const valueAt = (u: number) => {
    let best = -Infinity;
    for (let d = -1; d <= 1; d++) {
      const j = u + d;
      if (j >= 0 && j < n) best = Math.max(best, (combined[j] - m) / sd);
    }
    return best;
  };

  // Positions: virtual start (unit 0), downbeats > 0, virtual end (unit n).
  const pos = [0, ...downbeatUnits.filter(u => u > 0 && u < n), n];
  const beatsPerBar = 4;
  const timeOf = (u: number) => (timing ? (u >= n ? timing.durationSec : timing.times[u]) : u);
  const barsBetween = (a: number, b: number) =>
    timing ? (timeOf(pos[b]) - timeOf(pos[a])) / timing.barSec : (pos[b] - pos[a]) / beatsPerBar;
  const prior = (bars: number) => {
    const r = Math.round(bars);
    if (bars < 1.5) return -3;
    if (Math.abs(bars - r) > 0.3) return -params.phraseBonus; // partial bars: only at the song edges
    if (r === 4 || r === 8 || r === 16) return params.phraseBonus;
    if (r === 2 || r === 12) return 0;
    if (r > 32) return -params.phraseBonus * 2;
    return -params.phraseBonus * 0.5;
  };
  const P = pos.length;
  const best = new Float64Array(P).fill(-Infinity);
  const prev = new Int32Array(P).fill(-1);
  best[0] = 0;
  const maxBack = 40; // positions (bars): no section longer than 40 bars
  for (let j = 1; j < P; j++) {
    const gain = j === P - 1 ? 0 : valueAt(pos[j]) - params.boundaryCost;
    for (let i = Math.max(0, j - maxBack); i < j; i++) {
      if (best[i] === -Infinity) continue;
      const bars = barsBetween(i, j);
      // Edge sections (first / last) may be partial bars without the penalty.
      const isEdge = i === 0 || j === P - 1;
      // No section shorter than 1.5 bars, anywhere: a 1-second "outro" is noise, not a section.
      if (bars < 1.5) continue;
      const pr = isEdge && Math.abs(bars - Math.round(bars)) > 0.3 ? 0 : prior(bars);
      const s = best[i] + pr + gain;
      if (s > best[j]) { best[j] = s; prev[j] = i; }
    }
  }
  const chosen: number[] = [];
  for (let j = prev[P - 1]; j > 0; j = prev[j]) chosen.push(pos[j]);
  chosen.reverse();

  // Each boundary may slide a couple of beats to the sharpest change nearby: on real
  // recordings the downbeat phase is often off by a beat or two, or slips mid-song.
  const r = params.refineBeats ?? 0;
  if (r <= 0) return chosen;
  const refined: number[] = [];
  for (let k = 0; k < chosen.length; k++) {
    const lo = Math.max(1, chosen[k] - r, (refined[k - 1] ?? 0) + 4);
    const hi = Math.min(n - 1, chosen[k] + r, (chosen[k + 1] ?? n) - 4);
    let bu = chosen[k];
    let bv = -Infinity;
    for (let u = lo; u <= hi; u++) {
      // Ties go to the original downbeat.
      const v = combined[u] + (u === chosen[k] ? 1e-6 : 0);
      if (v > bv) { bv = v; bu = u; }
    }
    refined.push(bu);
  }
  return refined;
}
