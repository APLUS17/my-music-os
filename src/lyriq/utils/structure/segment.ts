// Section boundaries from repetition and change.
//
// 1. Beat-synchronous features: harmony (chroma), timbre (MFCC), loudness.
// 2. Novelty, three ways:
//    - Foote checkerboard novelty on timbre and on harmony self-similarity (where the sound changes),
//    - Serrà "structure features" on a recurrence lag matrix (where the pattern of repeats changes),
//    - loudness steps.
// 3. A dynamic programme over bar lines (downbeats) that trades novelty against a
//    phrase prior: beats are built from 8- and 16-bar blocks, so those lengths win,
//    4 bars is allowed for short edges and breaks, and nothing runs past 16 bars
//    (an unchanging loop still comes out as writable 16-bar blocks).

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
  /** Band levels per beat (dB): low 30-120 Hz, mid 300-3000 Hz, high 3.5 kHz+. */
  lowDb: Float64Array;
  midDb: Float64Array;
  highDb: Float64Array;
  /** Harmonic spread per beat: entropy of the chroma (0 = one note, 1 = all twelve). */
  chromaSpread: Float64Array;
  /** Strongest low (kick/808) and high (crash/hat) attack within a few frames of the beat. */
  lowHit: Float64Array;
  highHit: Float64Array;
}

export const TIMBRE_DIM = N_MFCC + 1;

export interface SegmentParams {
  /** Weights of the novelty components. */
  wStructure: number;
  wTimbre: number;
  wHarmony: number;
  wEnergy: number;
  wTransition: number;
  /** Penalty for a boundary that isn't on the first bar of a 4-bar phrase. */
  hyperPenalty: number;
  /** Weight of the kick/808 vote when choosing which beat is beat 1. */
  anchorWeight: number;
  /** Per-boundary cost: higher means fewer sections. */
  boundaryCost: number;
  /** Bonus for 8- and 16-bar sections (half of it for 4 bars). */
  phraseBonus: number;
  /** Longest section, in bars. */
  maxBars: number;
}

export const DEFAULT_SEGMENT_PARAMS: SegmentParams = {
  wStructure: 1,
  wTimbre: 1,
  wHarmony: 0.5,
  wEnergy: 0.5,
  wTransition: 0.5,
  hyperPenalty: 0.4,
  anchorWeight: 1.5,
  boundaryCost: 1.4,
  phraseBonus: 0.8,
  maxBars: 16,
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
  const lowDb = new Float64Array(n);
  const midDb = new Float64Array(n);
  const highDb = new Float64Array(n);
  const chromaSpread = new Float64Array(n);
  const lowHit = new Float64Array(n);
  const highHit = new Float64Array(n);
  const toDb = (p: number) => 10 * Math.log10(p + 1e-10);
  for (let i = 0; i < n; i++) {
    const a = Math.min(feats.nFrames - 1, Math.max(0, Math.floor(times[i] * feats.fps)));
    const end = i + 1 < n ? times[i + 1] : durationSec;
    const b = Math.min(feats.nFrames, Math.max(a + 1, Math.floor(end * feats.fps)));
    const cnt = b - a;
    let r = 0, pl = 0, pm = 0, ph = 0;
    for (let f = Math.max(0, a - 2); f <= Math.min(feats.nFrames - 1, a + 2); f++) {
      lowHit[i] = Math.max(lowHit[i], feats.lowOnset[f]);
      highHit[i] = Math.max(highHit[i], feats.highOnset[f]);
    }
    for (let f = a; f < b; f++) {
      pl += 10 ** (feats.lowDb[f] / 10);
      pm += 10 ** (feats.midDb[f] / 10);
      ph += 10 ** (feats.highDb[f] / 10);
      for (let p = 0; p < 12; p++) chroma[i * 12 + p] += feats.chroma[f * 12 + p];
      for (let k = 0; k < N_MFCC; k++) mfccSum[i * N_MFCC + k] += feats.mfcc[f * N_MFCC + k];
      r += 10 ** (feats.rmsDb[f] / 10);
    }
    rmsDb[i] = toDb(r / cnt);
    lowDb[i] = toDb(pl / cnt);
    midDb[i] = toDb(pm / cnt);
    highDb[i] = toDb(ph / cnt);
    {
      let tot = 0;
      for (let p = 0; p < 12; p++) tot += chroma[i * 12 + p];
      let h = 0;
      for (let p = 0; p < 12; p++) { const q = chroma[i * 12 + p] / (tot || 1); if (q > 0) h -= q * Math.log(q); }
      chromaSpread[i] = h / Math.log(12);
    }
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
  return { n, times, chroma, timbre, rmsDb, lowDb, midDb, highDb, chromaSpread, lowHit, highHit };
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

/**
 * Producer transitions at a beat: a dropout right before it (drums/808 muted on the
 * last beat or two of the bar) followed by the full beat coming back, plus an impact
 * on the beat itself (kick/808 hit, crash or riser in the highs).
 */
export function transitionNovelty(bf: BeatFeatures): Float64Array {
  const n = bf.n;
  const z = (a: Float64Array) => {
    let m = 0;
    for (let i = 0; i < n; i++) m += a[i];
    m /= n || 1;
    let v = 0;
    for (let i = 0; i < n; i++) v += (a[i] - m) ** 2;
    const sd = Math.sqrt(v / (n || 1)) || 1;
    return Array.from(a, x => (x - m) / sd);
  };
  const zLow = z(bf.lowHit);
  const zHigh = z(bf.highHit);
  const out = new Float64Array(n);
  for (let u = 4; u < n; u++) {
    // Level of the bar before, without its last two beats, vs. the dip at its end.
    const before = (bf.rmsDb[u - 4] + bf.rmsDb[u - 3]) / 2;
    const dip = Math.min(bf.rmsDb[u - 1], (bf.rmsDb[u - 1] + bf.rmsDb[u - 2]) / 2);
    const back = bf.rmsDb[u];
    const dropout = Math.max(0, before - dip) > 3 && back - dip > 3 ? Math.min(before - dip, back - dip) : 0;
    const impact = Math.max(0, zLow[u]) + Math.max(0, zHigh[u]);
    out[u] = dropout / 6 + 0.5 * impact;
  }
  return normaliseMax(out);
}

export interface NoveltyCurves {
  structure: Float64Array;
  timbre: Float64Array;
  harmony: Float64Array;
  energy: Float64Array;
  transition: Float64Array;
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
    transition: transitionNovelty(bf),
    ssmTimbre,
    ssmHarmony,
  };
}

/** Combined novelty per beat unit, standardised (z-scores) so costs mean the same in every song. */
export function combinedNovelty(nov: NoveltyCurves, n: number, params: SegmentParams = DEFAULT_SEGMENT_PARAMS): Float64Array {
  const out = new Float64Array(n);
  const wSum = params.wStructure + params.wTimbre + params.wHarmony + params.wEnergy + params.wTransition || 1;
  for (let i = 0; i < n; i++) {
    out[i] =
      (params.wStructure * nov.structure[i] + params.wTimbre * nov.timbre[i] +
        params.wHarmony * nov.harmony[i] + params.wEnergy * nov.energy[i] +
        params.wTransition * nov.transition[i]) / wSum;
  }
  let m = 0;
  for (let i = 0; i < n; i++) m += out[i];
  m /= n || 1;
  let v = 0;
  for (let i = 0; i < n; i++) v += (out[i] - m) ** 2;
  const sd = Math.sqrt(v / (n || 1)) || 1;
  for (let i = 0; i < n; i++) out[i] = (out[i] - m) / sd;
  return out;
}

/**
 * Picks section starts among bar lines.
 * `barUnits`: beat-unit indices of the bar lines (downbeats), ascending.
 * Returns the chosen unit indices (excluding 0), each a section start, and the score,
 * so callers can compare downbeat phases.
 */
export function chooseBoundaries(
  novelty: Float64Array,
  n: number,
  barUnits: number[],
  params: SegmentParams,
  /** Start time of each unit, and the bar length: section lengths are measured in time. */
  timing: { times: number[]; durationSec: number; barSec: number },
  /** 4-bar phrase grid: bar k (0 = first bar line) starts a phrase when (k - hyperOffset) % 4 == 0. */
  hyperOffset = 0
): { starts: number[]; score: number } {
  const bars = barUnits.filter(u => u > 0 && u < n);
  const pos = [0, ...bars, n];
  // Bar index of each position (bar lines counted from the first one).
  const barIdx = [-1, ...bars.map((_, k) => k), -1];
  const P = pos.length;
  const timeOf = (u: number) => (u >= n ? timing.durationSec : timing.times[u]);
  const barsBetween = (a: number, b: number) => (timeOf(pos[b]) - timeOf(pos[a])) / timing.barSec;
  // The novelty peak may sit a beat either side of the bar line it belongs to, but a peak
  // right on the bar line counts more: otherwise all four beat phases score the same.
  const valueAt = (u: number) =>
    Math.max(novelty[u] ?? -Infinity, 0.8 * (novelty[u - 1] ?? -Infinity), 0.8 * (novelty[u + 1] ?? -Infinity));
  const prior = (bars: number, edge: boolean) => {
    const r = Math.round(bars);
    // Edge sections may be partial bars (a pickup before bar 1, a tail after the last bar).
    if (Math.abs(bars - r) > 0.3) return edge ? 0 : -3 * params.phraseBonus;
    if (r === 8 || r === 16) return params.phraseBonus;
    if (r === 4) return edge ? params.phraseBonus * 0.5 : 0;
    if (r === 12) return 0;
    if (r % 2 === 0) return -params.phraseBonus;
    return -2 * params.phraseBonus;
  };
  const best = new Float64Array(P).fill(-Infinity);
  const prev = new Int32Array(P).fill(-1);
  best[0] = 0;
  for (let j = 1; j < P; j++) {
    const offPhrase = j < P - 1 && (((barIdx[j] - hyperOffset) % 4) + 4) % 4 !== 0;
    const gain = j === P - 1 ? 0 : valueAt(pos[j]) - params.boundaryCost - (offPhrase ? params.hyperPenalty : 0);
    for (let i = j - 1; i >= 0; i--) {
      const bars = barsBetween(i, j);
      if (bars > params.maxBars + 0.3) break;
      // No section under 1.5 bars, anywhere: a 1-second "outro" is noise, not a section.
      if (bars < 1.5 || best[i] === -Infinity) continue;
      const s = best[i] + prior(bars, i === 0 || j === P - 1) + gain;
      if (s > best[j]) { best[j] = s; prev[j] = i; }
    }
  }
  if (best[P - 1] === -Infinity) return { starts: [], score: -Infinity };
  const starts: number[] = [];
  for (let j = prev[P - 1]; j > 0; j = prev[j]) starts.push(pos[j]);
  return { starts: starts.reverse(), score: best[P - 1] };
}
