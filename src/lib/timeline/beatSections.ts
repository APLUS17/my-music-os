/**
 * Beat sectioning without AI: tempo + bar grid from the audio itself, then
 * section boundaries from how the music changes bar to bar.
 *
 *   1. onset envelope (10 ms frames) -> tempo, refined to 0.05 BPM so the bar
 *      grid does not drift over a 3-minute track
 *   2. beat phase + which beat is "1" (the downbeat) from onset strength
 *   3. per-bar features (loudness, onset density, brightness)
 *   4. dynamic programming picks boundaries where the music changes most,
 *      preferring phrase lengths of 4/8/16 bars
 *   5. sections are labelled by relative energy (intro, verse, chorus, ...)
 *
 * Labels are a best guess. The UI lets the user drag boundaries and retype
 * labels, so the job here is a good first draft, not a verdict.
 */

import type { SectionEnergy, SectionType } from '@/types';

export interface BeatSegment {
    startSec: number;
    endSec: number;
    bars: number;
    type: SectionType;
    energy: SectionEnergy;
    /** Mean loudness (linear RMS) of the segment, for display/debug. */
    rms: number;
}

export interface BeatStructure {
    method: 'audio' | 'even';
    bpm: number | null;
    /** 0..1; 0 for the even-split fallback. */
    confidence: number;
    /** First bar line at or after 0, seconds. */
    gridStartSec: number;
    barSec: number;
    durationSec: number;
    segments: BeatSegment[];
}

const TARGET_HOP_SEC = 0.01;

/**
 * Frame hop in whole samples and its EXACT duration. Using the nominal 10 ms
 * instead is a trap: at 22.05 kHz the hop is 220 samples = 9.977 ms, and that
 * 0.23% skew alone turns 100 BPM into 99.77 and drifts a bar grid by ~0.4 s
 * over a three-minute track.
 */
export function hopFor(sampleRate: number): { hop: number; hopSec: number } {
    const hop = Math.max(1, Math.round(sampleRate * TARGET_HOP_SEC));
    return { hop, hopSec: hop / sampleRate };
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

export interface BpmEstimate {
    bpm: number;
    /** 0..1, how much stronger the chosen tempo is than the average candidate. */
    confidence: number;
}

const TEMPO_PRIOR_CENTER_BPM = 130;
const TEMPO_PRIOR_WIDTH_OCTAVES = 1;

/** RMS of each `hop`-sized frame. */
export function frameEnergy(samples: Float32Array, hop: number): Float32Array {
    const frames = Math.floor(samples.length / hop);
    const out = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
        let sum = 0;
        const o = f * hop;
        for (let i = 0; i < hop; i++) sum += samples[o + i] * samples[o + i];
        out[f] = Math.sqrt(sum / hop);
    }
    return out;
}

/** Positive energy rise per frame, with the mean removed. Peaks mark drum hits and note starts. */
export function onsetStrength(energy: Float32Array): Float32Array {
    const onsets = new Float32Array(energy.length);
    let mean = 0;
    for (let i = 1; i < energy.length; i++) {
        const d = energy[i] - energy[i - 1];
        onsets[i] = d > 0 ? d : 0;
        mean += onsets[i];
    }
    mean /= Math.max(1, energy.length);
    for (let i = 0; i < onsets.length; i++) onsets[i] = Math.max(0, onsets[i] - mean);
    return onsets;
}

/**
 * Estimates tempo from onset autocorrelation over a 50-220 BPM range. A steady
 * beat also correlates at double period, so candidates are weighted toward
 * 130 BPM to break half/double-time ties; clearly slow or fast beats still win
 * when their peak is stronger. Returns null for signals with no periodicity.
 */
export function detectBpmFromChannelData(channelData: Float32Array, sampleRate: number): BpmEstimate | null {
    const { hop, hopSec } = hopFor(sampleRate);
    const windowSec = 40;
    const total = channelData.length;
    if (total < sampleRate * 6) return null;

    // A window from a quarter in: intros are often sparse.
    const windowSamples = Math.min(total, Math.floor(sampleRate * windowSec));
    const start = Math.min(Math.floor(total * 0.25), total - windowSamples);
    const numHops = Math.floor(windowSamples / hop);
    if (numHops < 300) return null;

    const energy = frameEnergy(channelData.subarray(start, start + numHops * hop), hop);
    const onsets = onsetStrength(energy);
    let any = 0;
    for (let i = 0; i < onsets.length; i++) any += onsets[i];
    if (any < 1e-6) return null;

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
    // Score a 3-lag neighbourhood so a fast tempo whose period falls between
    // two hops doesn't lose to the sharper peak at twice the period.
    const score = (lag: number) => (corr[lag - 1] + corr[lag] + corr[lag + 1]) * prior(lag);
    let best = minLag;
    for (let lag = minLag; lag <= maxLag; lag++) if (score(lag) > score(best)) best = lag;
    if (corr[best - 1] > corr[best] && best - 1 >= minLag) best -= 1;
    else if (corr[best + 1] > corr[best] && best + 1 <= maxLag) best += 1;
    const avg = sum / (maxLag - minLag + 1);
    if (!(corr[best] > 0) || !(avg > 0)) return null;

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

/**
 * Folds a tempo into 76-152 BPM for display. A beat felt as 140 reads equally
 * well as 70, and no detector can tell which a producer means, so show the
 * conventional one. Section boundaries never depend on this: they sit on the
 * detected bar grid, which lines up with real bars either way.
 */
export function foldBpm(bpm: number): number {
    let b = bpm;
    while (b < 76) b *= 2;
    while (b >= 152) b /= 2;
    return Math.round(b * 100) / 100;
}

export interface BeatGrid {
    bpm: number;
    /** Seconds of the earliest bar line at or after 0. */
    gridStartSec: number;
    barSec: number;
}

/**
 * Refines a coarse tempo against the WHOLE track and finds beat phase plus
 * the downbeat. Fractional tempo matters: 0.3 BPM of error is half a second of
 * drift by the end of a 3-minute song, which would put section lines in the
 * wrong bar.
 */
export function fitBeatGrid(onsets: Float32Array, coarseBpm: number, hopSec: number, beatsPerBar = 4): BeatGrid {
    const n = onsets.length;
    let bestScore = -Infinity;
    let bestBpm = coarseBpm;
    let bestPhase = 0; // in hops

    const range = coarseBpm * 0.016; // the coarse estimate is good to about +-1.5%
    for (let cand = coarseBpm - range; cand <= coarseBpm + range; cand += 0.05) {
        const beatHops = 60 / cand / hopSec;
        const bins = Math.max(1, Math.round(beatHops));
        const hist = new Float64Array(bins);
        const cnt = new Float64Array(bins);
        for (let i = 0; i < n; i++) {
            const phase = ((i % beatHops) + beatHops) % beatHops;
            const b = Math.min(bins - 1, Math.floor((phase / beatHops) * bins));
            hist[b] += onsets[i];
            cnt[b]++;
        }
        for (let b = 0; b < bins; b++) {
            // Smooth over neighbours so a hit landing between two bins still counts.
            const prev = hist[(b + bins - 1) % bins];
            const next = hist[(b + 1) % bins];
            const s = (hist[b] * 2 + prev + next) / Math.max(1, cnt[b] * 2 + cnt[(b + bins - 1) % bins] + cnt[(b + 1) % bins]);
            if (s > bestScore) {
                bestScore = s;
                bestBpm = cand;
                bestPhase = (b / bins) * beatHops;
            }
        }
    }

    const beatSec = 60 / bestBpm;
    const beatHops = beatSec / hopSec;
    const firstBeatSec = bestPhase * hopSec;

    // Which of the 4 beats is the downbeat: the one with the strongest hits.
    const strength = new Float64Array(beatsPerBar);
    const counts = new Float64Array(beatsPerBar);
    for (let k = 0; ; k++) {
        const center = Math.round(bestPhase + k * beatHops);
        if (center >= n) break;
        const slot = k % beatsPerBar;
        let peak = 0;
        for (let d = -2; d <= 2; d++) {
            const idx = center + d;
            if (idx >= 0 && idx < n) peak = Math.max(peak, onsets[idx]);
        }
        strength[slot] += peak;
        counts[slot]++;
    }
    let downbeat = 0;
    let bestStrength = -Infinity;
    for (let s = 0; s < beatsPerBar; s++) {
        const avg = counts[s] > 0 ? strength[s] / counts[s] : 0;
        if (avg > bestStrength + 1e-9) {
            bestStrength = avg;
            downbeat = s;
        }
    }

    const barSec = beatSec * beatsPerBar;
    const firstBarSec = firstBeatSec + downbeat * beatSec;
    // Earliest bar line >= 0 on the same grid.
    const gridStartSec = ((firstBarSec % barSec) + barSec) % barSec;
    return { bpm: Math.round(bestBpm * 100) / 100, gridStartSec, barSec };
}

// ---------------------------------------------------------------------------
// Bar features -> boundaries
// ---------------------------------------------------------------------------

export interface BarFeatures {
    rms: number;
    onsetRate: number;
    brightness: number;
}

/** Standardizes features across the song so loudness, density and brightness weigh comparably. */
function zScore(bars: BarFeatures[]): number[][] {
    const keys: Array<keyof BarFeatures> = ['rms', 'onsetRate', 'brightness'];
    const cols = keys.map(k => bars.map(b => b[k]));
    const stats = cols.map(c => {
        const mean = c.reduce((a, b) => a + b, 0) / Math.max(1, c.length);
        const variance = c.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, c.length);
        return { mean, std: Math.sqrt(variance) };
    });
    return bars.map((_, i) => cols.map((c, k) => {
        const { mean, std } = stats[k];
        return std < 1e-9 ? 0 : (c[i] - mean) / std;
    }));
}

/** How different the bars after boundary `b` are from the bars before it (in standardized feature space). */
export function boundaryNovelty(bars: BarFeatures[], window = 4): number[] {
    const z = zScore(bars);
    const B = bars.length;
    const nov = new Array<number>(B + 1).fill(0);
    for (let b = 1; b < B; b++) {
        const w = Math.min(window, b, B - b);
        if (w < 1) continue;
        const dim = z[0]?.length ?? 0;
        let dist = 0;
        for (let k = 0; k < dim; k++) {
            let before = 0;
            let after = 0;
            for (let i = 0; i < w; i++) {
                before += z[b - 1 - i][k];
                after += z[b + i][k];
            }
            const d = (after - before) / w;
            dist += d * d;
        }
        nov[b] = Math.sqrt(dist);
    }
    return nov;
}

const SEGMENT_COST = 0.7;
const NOVELTY_WEIGHT = 1.2;
const LENGTH_PENALTY: Record<number, number> = { 4: 0.5, 8: 0, 12: 0.4, 16: 0.1, 24: 0.5, 32: 0.6 };
const MAX_SEGMENT_BARS = 32;
/** A novelty bump counts only at its peak; this is how much of a non-peak boundary's score survives. */
const NON_PEAK_WEIGHT = 0.2;
const PEAK_RADIUS_BARS = 3;

function lengthPenalty(len: number): number {
    if (len < 4) return 1.2 + (4 - len) * 0.8; // phrases this short are almost never real sections
    return LENGTH_PENALTY[len] ?? 0.9 + 0.05 * Math.abs(len - 8);
}

/**
 * A step change in the music lights up novelty across several bars either
 * side of the true boundary (the comparison windows overlap it). Keep only the
 * peak of each bump so the segmenter doesn't buy extra sections on the slope.
 */
function suppressNonPeaks(novelty: number[]): number[] {
    return novelty.map((v, b) => {
        for (let d = -PEAK_RADIUS_BARS; d <= PEAK_RADIUS_BARS; d++) {
            const j = b + d;
            if (d !== 0 && j >= 1 && j < novelty.length - 1 && novelty[j] > v + 1e-9) return v * NON_PEAK_WEIGHT;
        }
        return v;
    });
}

/**
 * Chooses section boundaries (as bar indices) by dynamic programming: reward
 * boundaries where the music changes, penalise odd phrase lengths and
 * needless extra sections. Returns segment lengths in bars, summing to B.
 */
export function segmentBars(bars: BarFeatures[]): number[] {
    const B = bars.length;
    if (B === 0) return [];
    if (B <= 4) return [B];
    const novelty = suppressNonPeaks(boundaryNovelty(bars));

    const best = new Array<number>(B + 1).fill(-Infinity);
    const prev = new Array<number>(B + 1).fill(0);
    best[0] = 0;
    for (let i = 1; i <= B; i++) {
        for (let len = 1; len <= Math.min(MAX_SEGMENT_BARS, i); len++) {
            const from = i - len;
            if (best[from] === -Infinity) continue;
            const gain = i < B ? NOVELTY_WEIGHT * novelty[i] : 0;
            const score = best[from] - SEGMENT_COST - lengthPenalty(len) + gain;
            if (score > best[i]) {
                best[i] = score;
                prev[i] = from;
            }
        }
    }
    const lens: number[] = [];
    for (let i = B; i > 0; i = prev[i]) lens.unshift(i - prev[i]);
    return lens;
}

function quantile(sorted: number[], q: number): number {
    if (sorted.length === 0) return 0;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Guesses a label per segment from relative energy and position. Heuristic:
 * the loudest ~third of the body is the chorus, a short quiet segment before a
 * chorus is a pre-chorus, a quiet segment late in the song after the choruses
 * is a bridge.
 */
export function labelSegments(
    segs: Array<{ bars: number; rms: number }>
): Array<{ type: SectionType; energy: SectionEnergy }> {
    const n = segs.length;
    if (n === 0) return [];
    const rmsSorted = segs.map(s => s.rms).sort((a, b) => a - b);
    const lowCut = quantile(rmsSorted, 1 / 3);
    const highCut = quantile(rmsSorted, 2 / 3);
    const energyOf = (rms: number): SectionEnergy => (rms >= highCut ? 'high' : rms <= lowCut ? 'low' : 'medium');

    const types: SectionType[] = new Array(n).fill('verse');
    if (n === 1) return [{ type: 'verse', energy: energyOf(segs[0].rms) }];

    const median = quantile(rmsSorted, 0.5);
    const hasIntro = segs[0].rms < median * 0.95 || segs[0].bars <= 4;
    const hasOutro = n > 2 && (segs[n - 1].rms < median * 0.95 || segs[n - 1].bars <= 4);
    if (hasIntro) types[0] = 'intro';
    if (hasOutro) types[n - 1] = 'outro';

    const bodyIdx: number[] = [];
    for (let i = 0; i < n; i++) if (types[i] === 'verse') bodyIdx.push(i);
    if (bodyIdx.length > 0) {
        const bodyRms = bodyIdx.map(i => segs[i].rms).sort((a, b) => a - b);
        const lo = bodyRms[0];
        const hi = bodyRms[bodyRms.length - 1];
        // Chorus = the louder half of the range between the quietest and loudest
        // body section. A midpoint (not a percentile) copes with several
        // sections at nearly the same level; if the range is tiny, nothing
        // stands out and everything stays a verse.
        if (hi >= lo * 1.15) {
            const mid = lo + (hi - lo) / 2;
            for (const i of bodyIdx) if (segs[i].rms >= mid) types[i] = 'chorus';
        }
        // A short, quieter segment right before a chorus builds into it.
        for (const i of bodyIdx) {
            if (types[i] === 'verse' && i + 1 < n && types[i + 1] === 'chorus' && segs[i].bars <= 4) {
                types[i] = 'pre-chorus';
            }
        }
        // A quiet segment late in the song, after the choruses have landed, is the bridge.
        let choruses = 0;
        const lastChorus = types.lastIndexOf('chorus');
        for (let i = 0; i < n; i++) {
            if (types[i] === 'chorus') choruses++;
            if (
                types[i] === 'verse' && choruses >= (n >= 7 ? 1 : 2) && i < lastChorus &&
                segs[i].rms <= quantile(bodyRms, 0.4) && segs[i].bars <= 12
            ) {
                types[i] = 'bridge';
                break;
            }
        }
    }
    return segs.map((s, i) => ({ type: types[i], energy: energyOf(s.rms) }));
}

// ---------------------------------------------------------------------------
// Whole-track analysis
// ---------------------------------------------------------------------------

/** Pattern used when the audio gives no usable tempo. */
const EVEN_PATTERN: SectionType[] = ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro'];

/** Even split with a stock song shape. Honest fallback: flagged `method: 'even'`, confidence 0. */
export function evenStructure(durationSec: number, bpm: number | null = null): BeatStructure {
    if (!(durationSec > 0)) {
        return { method: 'even', bpm, confidence: 0, gridStartSec: 0, barSec: 0, durationSec: 0, segments: [] };
    }
    const count = Math.max(2, Math.min(EVEN_PATTERN.length, Math.round(durationSec / 25)));
    const pattern = count === EVEN_PATTERN.length
        ? EVEN_PATTERN
        : count <= 3 ? (['verse', 'chorus', 'verse'] as SectionType[]).slice(0, count)
            : ['intro', ...Array.from({ length: count - 2 }, (_, i) => (i % 2 === 0 ? 'verse' : 'chorus') as SectionType), 'outro'] as SectionType[];
    const each = durationSec / pattern.length;
    return {
        method: 'even',
        bpm,
        confidence: 0,
        gridStartSec: 0,
        barSec: bpm ? (60 / bpm) * 4 : 0,
        durationSec,
        segments: pattern.map((type, i) => ({
            startSec: i * each,
            endSec: (i + 1) * each,
            bars: bpm ? Math.max(1, Math.round(each / ((60 / bpm) * 4))) : 0,
            type,
            energy: 'medium' as SectionEnergy,
            rms: 0,
        })),
    };
}

/** Mean of `values` over [from, to) frames. */
function meanRange(values: Float32Array, from: number, to: number): number {
    const a = Math.max(0, from);
    const b = Math.min(values.length, to);
    if (b <= a) return 0;
    let s = 0;
    for (let i = a; i < b; i++) s += values[i];
    return s / (b - a);
}

/**
 * Analyses a decoded beat (mono samples) and proposes sections.
 * Never throws on odd input: falls back to an even split.
 */
export function analyzeBeatStructure(mono: Float32Array, sampleRate: number): BeatStructure {
    const durationSec = mono.length / sampleRate;
    if (!(durationSec > 0)) return evenStructure(0);

    const est = detectBpmFromChannelData(mono, sampleRate);
    if (!est) return evenStructure(durationSec);

    const { hop, hopSec } = hopFor(sampleRate);
    const energy = frameEnergy(mono, hop);
    const onsets = onsetStrength(energy);
    // Fit the grid at the conventional tempo so a 4-bar phrase measures as 4 bars even when the
    // detector latched onto half time.
    const grid = fitBeatGrid(onsets, foldBpm(est.bpm), hopSec);
    const { barSec, gridStartSec } = grid;
    if (!(barSec > 0)) return evenStructure(durationSec, est.bpm);

    // Brightness proxy: zero-crossing rate per frame (cheap spectral-centroid stand-in).
    const zcr = new Float32Array(energy.length);
    for (let f = 0; f < zcr.length; f++) {
        let c = 0;
        const o = f * hop;
        for (let i = 1; i < hop; i++) if ((mono[o + i] >= 0) !== (mono[o + i - 1] >= 0)) c++;
        zcr[f] = c / hop;
    }

    // If the first bar line sits well into the track, the stretch before it is a
    // (partial) bar of its own, not something to discard.
    const originSec = gridStartSec > 0.3 * barSec ? gridStartSec - barSec : gridStartSec;
    const barFrames = barSec / hopSec;
    const startFrame = originSec / hopSec;
    // A trailing partial bar counts only if it is more than half a bar.
    const bars = Math.max(1, Math.floor((durationSec - originSec) / barSec + 0.5));
    if (bars < 2) return evenStructure(durationSec, grid.bpm);

    const features: BarFeatures[] = [];
    for (let b = 0; b < bars; b++) {
        const from = Math.round(startFrame + b * barFrames);
        const to = Math.round(startFrame + (b + 1) * barFrames);
        features.push({
            rms: meanRange(energy, from, to),
            onsetRate: meanRange(onsets, from, to),
            brightness: meanRange(zcr, from, to),
        });
    }

    const lens = segmentBars(features);
    const raw: Array<{ startBar: number; bars: number; rms: number }> = [];
    let bar = 0;
    for (const len of lens) {
        let rms = 0;
        for (let i = 0; i < len; i++) rms += features[bar + i].rms;
        raw.push({ startBar: bar, bars: len, rms: rms / len });
        bar += len;
    }
    const labels = labelSegments(raw);

    const segments: BeatSegment[] = raw.map((r, i) => {
        const startSec = i === 0 ? 0 : originSec + r.startBar * barSec;
        const endSec = i === raw.length - 1 ? durationSec : originSec + (r.startBar + r.bars) * barSec;
        return {
            startSec: round3(startSec),
            endSec: round3(Math.min(durationSec, endSec)),
            bars: r.bars,
            type: labels[i].type,
            energy: labels[i].energy,
            rms: r.rms,
        };
    }).filter(s => s.endSec - s.startSec > 0.05);

    return {
        method: 'audio',
        bpm: grid.bpm,
        confidence: est.confidence,
        gridStartSec: originSec,
        barSec,
        durationSec,
        segments,
    };
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Waveform peaks for the section strip
// ---------------------------------------------------------------------------

/** Downsamples mono audio to `count` peak heights in 0..1 for drawing. */
export function computePeaks(mono: Float32Array, count: number): number[] {
    const out: number[] = new Array(count).fill(0);
    if (mono.length === 0 || count <= 0) return out;
    const block = Math.max(1, Math.floor(mono.length / count));
    let max = 0;
    for (let i = 0; i < count; i++) {
        const from = i * block;
        const to = Math.min(mono.length, from + block);
        let peak = 0;
        for (let j = from; j < to; j++) {
            const v = Math.abs(mono[j]);
            if (v > peak) peak = v;
        }
        out[i] = peak;
        if (peak > max) max = peak;
    }
    return max > 0 ? out.map(v => v / max) : out;
}

/** Mixes a decoded AudioBuffer to mono. */
export function mixToMono(buffer: { numberOfChannels: number; length: number; getChannelData(c: number): Float32Array }): Float32Array {
    const n = buffer.numberOfChannels;
    if (n === 1) return buffer.getChannelData(0);
    const out = new Float32Array(buffer.length);
    for (let c = 0; c < n; c++) {
        const ch = buffer.getChannelData(c);
        for (let i = 0; i < out.length; i++) out[i] += ch[i] / n;
    }
    return out;
}
