// Frame-level audio features for structure analysis: log-mel bands, MFCC-style
// timbre, chroma (harmony), loudness and onset strength.
//
// Everything here is plain arithmetic on a Float32Array so it runs the same in
// a Web Worker, on the main thread and in Node tests.

/** Analysis rate. Harmony and timbre live well below 5.5 kHz, and it keeps the FFT cheap. */
export const ANALYSIS_SR = 11025;
export const N_FFT = 2048;
/** 256 samples at 11025 Hz = 23.2 ms per frame (43.07 frames/s). */
export const HOP = 256;
export const N_MELS = 40;
/** Onsets use a short window (46 ms): with the long one, a hit "arrives" up to 90 ms early. */
export const N_FFT_ONSET = 512;
const N_MELS_ONSET = 24;
export const N_MFCC = 13;

export interface FrameFeatures {
  sampleRate: number;
  hop: number;
  /** Frames per second. */
  fps: number;
  nFrames: number;
  /** log-power mel bands, [frame * N_MELS + band]. */
  logMel: Float32Array;
  /** MFCC 1..13 (c0 dropped: loudness is tracked separately), [frame * N_MFCC + k]. */
  mfcc: Float32Array;
  /** Chroma, 12 pitch classes, unnormalised log-compressed energy, [frame * 12 + pc]. */
  chroma: Float32Array;
  /** RMS level in dB per frame. */
  rmsDb: Float32Array;
  /** Spectral-flux onset strength (all bands). */
  onset: Float32Array;
  /** Onset strength from the bands under ~150 Hz (kick drum, 808). */
  lowOnset: Float32Array;
  /** Onset strength from the bands above 3.5 kHz (hats, crashes, risers). */
  highOnset: Float32Array;
  /** Band levels in dB: low 30-120 Hz (808/kick), mid 300-3000 Hz (melodic layers), high 3.5 kHz+ (hats, air). */
  lowDb: Float32Array;
  midDb: Float32Array;
  highDb: Float32Array;
}

/** Block-averaging resampler, the same as the app's downsampleMono, also handling non-integer ratios. */
export function resampleTo(input: Float32Array, inputRate: number, targetRate: number): Float32Array {
  if (inputRate === targetRate) return input;
  if (targetRate > inputRate) {
    // Linear upsampling (rare: only for very low-rate sources).
    const ratio = inputRate / targetRate;
    const out = new Float32Array(Math.floor(input.length / ratio));
    for (let i = 0; i < out.length; i++) {
      const p = i * ratio;
      const i0 = Math.floor(p);
      const i1 = Math.min(input.length - 1, i0 + 1);
      const f = p - i0;
      out[i] = input[i0] * (1 - f) + input[i1] * f;
    }
    return out;
  }
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

// ---------------------------------------------------------------------------
// FFT (iterative radix-2, in place)
// ---------------------------------------------------------------------------

interface FftPlan {
  n: number;
  rev: Uint32Array;
  cos: Float64Array;
  sin: Float64Array;
}

function makeFftPlan(n: number): FftPlan {
  const bits = Math.round(Math.log2(n));
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = -Math.sin((2 * Math.PI * i) / n);
  }
  return { n, rev, cos, sin };
}

function fftInPlace(plan: FftPlan, re: Float64Array, im: Float64Array): void {
  const { n, rev, cos, sin } = plan;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = sin[k * step];
        const a = start + k;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Filterbanks
// ---------------------------------------------------------------------------

const hzToMel = (f: number) => 2595 * Math.log10(1 + f / 700);
const melToHz = (m: number) => 700 * (10 ** (m / 2595) - 1);

interface SparseBand { start: number; weights: Float64Array }

function melFilterbank(sr: number, nFft: number, nMels: number, fMin: number, fMax: number): SparseBand[] {
  const nBins = nFft / 2 + 1;
  const mMin = hzToMel(fMin);
  const mMax = hzToMel(fMax);
  const edges = Array.from({ length: nMels + 2 }, (_, i) => melToHz(mMin + ((mMax - mMin) * i) / (nMels + 1)));
  const binHz = sr / nFft;
  const bands: SparseBand[] = [];
  for (let m = 0; m < nMels; m++) {
    const lo = edges[m], mid = edges[m + 1], hi = edges[m + 2];
    const start = Math.max(0, Math.floor(lo / binHz));
    const end = Math.min(nBins - 1, Math.ceil(hi / binHz));
    const w = new Float64Array(Math.max(1, end - start + 1));
    for (let k = start; k <= end; k++) {
      const f = k * binHz;
      const v = f <= mid ? (f - lo) / Math.max(1e-9, mid - lo) : (hi - f) / Math.max(1e-9, hi - mid);
      w[k - start] = Math.max(0, v);
    }
    // Slaney-style area normalisation so wide high bands don't dominate.
    const norm = 2 / Math.max(1e-9, hi - lo);
    for (let i = 0; i < w.length; i++) w[i] *= norm;
    bands.push({ start, weights: w });
  }
  return bands;
}

/** Maps FFT bins in [fMin, fMax] to pitch classes (0 = C). Bins too coarse for a semitone are skipped. */
function chromaMap(sr: number, nFft: number, fMin: number, fMax: number): Int8Array {
  const nBins = nFft / 2 + 1;
  const out = new Int8Array(nBins).fill(-1);
  const binHz = sr / nFft;
  for (let k = 1; k < nBins; k++) {
    const f = k * binHz;
    if (f < fMin || f > fMax) continue;
    const midi = 69 + 12 * Math.log2(f / 440);
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    out[k] = pc;
  }
  return out;
}

function dctMatrix(nIn: number, nOut: number, skipFirst: boolean): Float64Array {
  const first = skipFirst ? 1 : 0;
  const m = new Float64Array(nOut * nIn);
  for (let k = 0; k < nOut; k++) {
    for (let n = 0; n < nIn; n++) {
      m[k * nIn + n] = Math.cos((Math.PI / nIn) * (n + 0.5) * (k + first)) * Math.sqrt(2 / nIn);
    }
  }
  return m;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Computes all frame features in one STFT pass. Input must already be mono at
 * ANALYSIS_SR (use resampleTo). Costs one 2048-point FFT per 23 ms of audio.
 */
export function extractFrameFeatures(x: Float32Array, sr: number = ANALYSIS_SR): FrameFeatures {
  const nBins = N_FFT / 2 + 1;
  const nFrames = Math.max(1, Math.floor(x.length / HOP) + 1);
  const plan = makeFftPlan(N_FFT);
  const win = new Float64Array(N_FFT);
  for (let i = 0; i < N_FFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT);
  const mel = melFilterbank(sr, N_FFT, N_MELS, 30, Math.min(5000, sr / 2));
  const chromaOf = chromaMap(sr, N_FFT, 150, 2000);
  const dct = dctMatrix(N_MELS, N_MFCC, true);
  // Band centre frequencies, to group mel bands into low / mid / high.
  const centreHz = mel.map(b => ((b.start + b.weights.indexOf(Math.max(...b.weights))) * sr) / N_FFT);
  const bandsIn = (lo: number, hi: number) => centreHz.map((hz, i) => ({ i, hz })).filter(b => b.hz >= lo && b.hz < hi).map(b => b.i);
  const subBands = bandsIn(30, 120);
  const midBands = bandsIn(300, 3000);
  const highBands = bandsIn(3500, 1e9);

  const logMel = new Float32Array(nFrames * N_MELS);
  const mfcc = new Float32Array(nFrames * N_MFCC);
  const chroma = new Float32Array(nFrames * 12);
  const rmsDb = new Float32Array(nFrames);
  const onset = new Float32Array(nFrames);
  const lowOnset = new Float32Array(nFrames);
  const highOnset = new Float32Array(nFrames);
  const lowDb = new Float32Array(nFrames);
  const midDb = new Float32Array(nFrames);
  const highDb = new Float32Array(nFrames);

  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);
  const power = new Float64Array(nBins);
  const melRow = new Float64Array(N_MELS);
  const chromaRow = new Float64Array(12);
  const half = N_FFT / 2;

  for (let f = 0; f < nFrames; f++) {
    // center=True framing with zero padding.
    const centre = f * HOP;
    let sumSq = 0;
    let count = 0;
    for (let i = 0; i < N_FFT; i++) {
      const idx = centre - half + i;
      const v = idx >= 0 && idx < x.length ? x[idx] : 0;
      re[i] = v * win[i];
      im[i] = 0;
      if (i >= half - HOP / 2 && i < half + HOP / 2) { sumSq += v * v; count++; }
    }
    rmsDb[f] = 10 * Math.log10(sumSq / Math.max(1, count) + 1e-10);
    fftInPlace(plan, re, im);
    for (let k = 0; k < nBins; k++) power[k] = re[k] * re[k] + im[k] * im[k];

    for (let m = 0; m < N_MELS; m++) {
      const { start, weights } = mel[m];
      let s = 0;
      for (let i = 0; i < weights.length; i++) s += weights[i] * power[start + i];
      melRow[m] = 10 * Math.log10(s + 1e-10);
      logMel[f * N_MELS + m] = melRow[m];
    }
    const bandDb = (idx: number[]) => {
      let p = 0;
      for (const m of idx) p += 10 ** (melRow[m] / 10);
      return 10 * Math.log10(p + 1e-10);
    };
    lowDb[f] = bandDb(subBands);
    midDb[f] = bandDb(midBands);
    highDb[f] = bandDb(highBands);
    for (let k = 0; k < N_MFCC; k++) {
      let s = 0;
      for (let n = 0; n < N_MELS; n++) s += dct[k * N_MELS + n] * melRow[n];
      mfcc[f * N_MFCC + k] = s;
    }
    chromaRow.fill(0);
    for (let k = 0; k < nBins; k++) {
      const pc = chromaOf[k];
      // Log-compressed magnitude per bin (CLP chroma): one loud partial can't swamp the rest.
      if (pc >= 0) chromaRow[pc] += Math.log1p(100 * Math.sqrt(power[k]));
    }
    for (let p = 0; p < 12; p++) chroma[f * 12 + p] = chromaRow[p];
  }

  // Onset curves from a short-window STFT centred on the same frames.
  const oPlan = makeFftPlan(N_FFT_ONSET);
  const oWin = new Float64Array(N_FFT_ONSET);
  for (let i = 0; i < N_FFT_ONSET; i++) oWin[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT_ONSET);
  const oMel = melFilterbank(sr, N_FFT_ONSET, N_MELS_ONSET, 30, Math.min(5000, sr / 2));
  const oCentre = oMel.map(b => ((b.start + b.weights.indexOf(Math.max(...b.weights))) * sr) / N_FFT_ONSET);
  const oLow = oCentre.map((hz, i) => ({ i, hz })).filter(b => b.hz < 150).map(b => b.i);
  const oHigh = oCentre.map((hz, i) => ({ i, hz })).filter(b => b.hz >= 3500).map(b => b.i);
  const oLog = new Float32Array(nFrames * N_MELS_ONSET);
  const ore = new Float64Array(N_FFT_ONSET);
  const oim = new Float64Array(N_FFT_ONSET);
  const ohalf = N_FFT_ONSET / 2;
  for (let f = 0; f < nFrames; f++) {
    const centre = f * HOP;
    for (let i = 0; i < N_FFT_ONSET; i++) {
      const idx = centre - ohalf + i;
      ore[i] = (idx >= 0 && idx < x.length ? x[idx] : 0) * oWin[i];
      oim[i] = 0;
    }
    fftInPlace(oPlan, ore, oim);
    for (let m = 0; m < N_MELS_ONSET; m++) {
      const { start, weights } = oMel[m];
      let p = 0;
      for (let i = 0; i < weights.length; i++) { const k = start + i; p += weights[i] * (ore[k] * ore[k] + oim[k] * oim[k]); }
      oLog[f * N_MELS_ONSET + m] = 10 * Math.log10(p + 1e-10);
    }
  }
  {
    let pk = -Infinity;
    for (let i = 0; i < oLog.length; i++) if (oLog[i] > pk) pk = oLog[i];
    for (let i = 0; i < oLog.length; i++) if (oLog[i] < pk - 80) oLog[i] = pk - 80;
  }

  // Like librosa's power_to_db(top_db=80): floor the mel spectrogram 80 dB under its peak,
  // so the jump out of digital silence doesn't read as the strongest onset in the song.
  let peak = -Infinity;
  for (let i = 0; i < logMel.length; i++) if (logMel[i] > peak) peak = logMel[i];
  const floor = peak - 80;
  for (let i = 0; i < logMel.length; i++) if (logMel[i] < floor) logMel[i] = floor;

  for (let f = 1; f < nFrames; f++) {
    let flux = 0;
    let low = 0;
    let high = 0;
    for (let m = 0; m < N_MELS_ONSET; m++) {
      const d = oLog[f * N_MELS_ONSET + m] - oLog[(f - 1) * N_MELS_ONSET + m];
      if (d > 0) flux += d;
    }
    for (const m of oLow) {
      const d = oLog[f * N_MELS_ONSET + m] - oLog[(f - 1) * N_MELS_ONSET + m];
      if (d > 0) low += d;
    }
    for (const m of oHigh) {
      const d = oLog[f * N_MELS_ONSET + m] - oLog[(f - 1) * N_MELS_ONSET + m];
      if (d > 0) high += d;
    }
    onset[f] = flux / N_MELS_ONSET;
    lowOnset[f] = oLow.length ? low / oLow.length : 0;
    highOnset[f] = oHigh.length ? high / oHigh.length : 0;
  }

  return { sampleRate: sr, hop: HOP, fps: sr / HOP, nFrames, logMel, mfcc, chroma, rmsDb, onset, lowOnset, highOnset, lowDb, midDb, highDb };
}
