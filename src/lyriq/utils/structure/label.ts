// Repetition groups and beat-style section names.
//
// Groups: blocks that sound like each other (same chords and sound, beat by beat)
// get the same letter. Names, for instrumentals, use the five names producers use:
//   Hook   - the fullest block that comes back (the loop with everything in it),
//   Verse  - the other blocks (the beat a rapper or singer writes over),
//   Bridge - a one-off change in the second half,
//   Intro / Outro - a short or sparse first / last block.
// Names are a heuristic from the audio; boundaries and groups are what's measured.

import type { SectionType } from '../../types';
import type { BeatFeatures } from './segment';

export interface Segment {
  /** First and one-past-last beat unit. */
  start: number;
  end: number;
}

export interface LabelParams {
  /** Similarity, in standard deviations above the song's typical beat-pair similarity, to join a group. */
  groupThreshold: number;
  /** ...and at least this share of the most similar pair of blocks in the beat. */
  relativeThreshold: number;
}

export const DEFAULT_LABEL_PARAMS: LabelParams = { groupThreshold: 1.5, relativeThreshold: 0.85 };

/**
 * Beat-by-beat similarity of two segments: the shorter slides over the longer
 * in whole bars and the best alignment wins.
 */
export function segmentSimilarity(S: Float32Array, n: number, a: Segment, b: Segment): number {
  const la = a.end - a.start;
  const lb = b.end - b.start;
  const [short, long] = la <= lb ? [a, b] : [b, a];
  const ls = short.end - short.start;
  const ll = long.end - long.start;
  if (ls <= 0 || ll <= 0) return -Infinity;
  let best = -Infinity;
  for (let off = 0; off <= ll - ls; off += 4) {
    let s = 0;
    for (let k = 0; k < ls; k++) s += S[(short.start + k) * n + (long.start + off + k)];
    best = Math.max(best, s / ls);
  }
  if (best === -Infinity) {
    // Lengths not aligned to bars: compare the overlapping prefix.
    let s = 0;
    for (let k = 0; k < ls; k++) s += S[(short.start + k) * n + (long.start + Math.min(k, ll - 1))];
    best = s / ls;
  }
  return best;
}

/**
 * Average-linkage agglomerative grouping. Returns a group id per segment (0-based, in
 * order of first appearance) and the segment-to-segment similarity (z-scores).
 */
export function groupSegments(S: Float32Array, n: number, segs: Segment[], params: LabelParams = DEFAULT_LABEL_PARAMS): { groups: number[]; sim: number[][] } {
  const K = segs.length;
  if (K === 0) return { groups: [], sim: [] };
  // The song's typical similarity between beats more than 2 bars apart, to make the threshold relative.
  let sum = 0, sumSq = 0, cnt = 0;
  const step = Math.max(1, Math.floor(n / 200));
  for (let i = 0; i < n; i += step) for (let j = i + 9; j < n; j += step) { const v = S[i * n + j]; sum += v; sumSq += v * v; cnt++; }
  const mu = cnt ? sum / cnt : 0;
  const sd = cnt ? Math.sqrt(Math.max(1e-9, sumSq / cnt - mu * mu)) : 1;

  const sim: number[][] = Array.from({ length: K }, () => new Array(K).fill(0));
  for (let i = 0; i < K; i++) for (let j = i + 1; j < K; j++) {
    const v = (segmentSimilarity(S, n, segs[i], segs[j]) - mu) / sd;
    sim[i][j] = v;
    sim[j][i] = v;
  }
  let maxSim = -Infinity;
  for (let i = 0; i < K; i++) for (let j = i + 1; j < K; j++) maxSim = Math.max(maxSim, sim[i][j]);
  let clusters: number[][] = segs.map((_, i) => [i]);
  for (;;) {
    let bi = -1, bj = -1, bv = -Infinity;
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      let s = 0;
      for (const a of clusters[i]) for (const b of clusters[j]) s += sim[a][b];
      s /= clusters[i].length * clusters[j].length;
      if (s > bv) { bv = s; bi = i; bj = j; }
    }
    // Join only clear repeats: above the threshold and close to the best match in this beat
    // (a hook and a verse built on one loop are similar, but less so than hook and hook).
    if (bi < 0 || bv < Math.max(params.groupThreshold, params.relativeThreshold * maxSim)) break;
    clusters[bi] = [...clusters[bi], ...clusters[bj]];
    clusters = clusters.filter((_, k) => k !== bj);
  }
  const groupOf = new Array(K).fill(-1);
  clusters.sort((x, y) => Math.min(...x) - Math.min(...y));
  clusters.forEach((c, g) => c.forEach(i => { groupOf[i] = g; }));
  return { groups: groupOf, sim };
}

/**
 * Length-weighted z-scores with a floor under the spread, so blocks that are really the
 * same (an unchanging loop) stay near 0 instead of having their noise stretched to +-1.
 */
function zWeighted(values: number[], weights: number[], minSd: number): number[] {
  const W = weights.reduce((a, b) => a + b, 0) || 1;
  const m = values.reduce((s, v, i) => s + v * weights[i], 0) / W;
  const sd = Math.sqrt(values.reduce((s, v, i) => s + (v - m) ** 2 * weights[i], 0) / W);
  return values.map(v => (v - m) / Math.max(sd, minSd));
}

/**
 * Arrangement density per block, as z-scores across the beat. Masters are limited, so
 * loudness alone says little; what changes between a verse and a hook is what's playing:
 *   808 / low end (30-120 Hz level and kick punch), highs (hats, crashes: 3.5 kHz+),
 *   mid-range layers (300 Hz-3 kHz) and harmonic spread (how many notes sound at once).
 */
export function blockFullness(bf: BeatFeatures, segs: Segment[]): number[] {
  const mean = (a: Float64Array, sg: Segment, db: boolean) => {
    let s = 0;
    for (let u = sg.start; u < sg.end; u++) s += db ? 10 ** (a[u] / 10) : a[u];
    s /= Math.max(1, sg.end - sg.start);
    return db ? 10 * Math.log10(s + 1e-10) : s;
  };
  const w = segs.map(sg => sg.end - sg.start);
  // Floors: 1.5 dB for band levels, 15% of the mean kick punch, 0.03 of chroma entropy.
  const punchRaw = segs.map(sg => mean(bf.lowHit, sg, false));
  const punchMean = punchRaw.reduce((a, b) => a + b, 0) / (punchRaw.length || 1);
  const low = zWeighted(segs.map(sg => mean(bf.lowDb, sg, true)), w, 1.5);
  const punch = zWeighted(punchRaw, w, Math.max(1e-6, 0.15 * punchMean));
  const high = zWeighted(segs.map(sg => mean(bf.highDb, sg, true)), w, 1.5);
  const mid = zWeighted(segs.map(sg => mean(bf.midDb, sg, true)), w, 1.5);
  const spread = zWeighted(segs.map(sg => mean(bf.chromaSpread, sg, false)), w, 0.03);
  const raw = segs.map((_, i) => low[i] + 0.5 * punch[i] + high[i] + 0.5 * mid[i] + 0.5 * spread[i]);
  return zWeighted(raw, w, 1);
}

/**
 * Splits a repeat group in two where its blocks fall into a sparse and a full set
 * (a gap of at least `gap` in fullness). Returns new group ids.
 */
export function splitByFullness(groups: number[], fullness: number[], gap = 0.5): number[] {
  const out = [...groups];
  let next = Math.max(-1, ...groups) + 1;
  const ids = [...new Set(groups)];
  for (const g of ids) {
    const idx = groups.map((x, i) => (x === g ? i : -1)).filter(i => i >= 0);
    if (idx.length < 2) continue;
    const sorted = [...idx].sort((a, b) => fullness[a] - fullness[b]);
    let bestGap = 0, at = -1;
    for (let k = 1; k < sorted.length; k++) {
      const d = fullness[sorted[k]] - fullness[sorted[k - 1]];
      if (d > bestGap) { bestGap = d; at = k; }
    }
    if (bestGap >= gap) {
      const id = next++;
      for (const i of sorted.slice(at)) out[i] = id;
    }
  }
  return out;
}

export interface LabelInput {
  groups: number[];
  /** Arrangement density per block (z-scores), from blockFullness. */
  fullness: number[];
  /** Length per block in bars. */
  bars: number[];
  /** Start and end (seconds) per block. */
  starts: number[];
  ends: number[];
  durationSec: number;
}

/** Beat-style names for each block: Intro, Hook, Verse, Bridge, Outro. */
export function nameBeatSections(input: LabelInput): SectionType[] {
  const { groups, fullness: f, bars, starts, ends, durationSec } = input;
  const K = groups.length;
  if (K === 0) return [];
  if (K === 1) return ['verse'];
  const lens = starts.map((s, i) => ends[i] - s);
  const L = K - 1;
  const members = new Map<number, number[]>();
  groups.forEach((g, i) => members.set(g, [...(members.get(g) ?? []), i]));
  const count = (i: number) => members.get(groups[i])!.length;
  const types: SectionType[] = new Array(K).fill('verse');
  const meanOf = (idx: number[]) => idx.reduce((s, i) => s + f[i] * lens[i], 0) / (idx.reduce((s, i) => s + lens[i], 0) || 1);

  // Intro / outro: only the first / last block, 4-8 bars, and noticeably sparser
  // than the body. A beat that drops full at 0:00 has no intro: bar 1 is the first section.
  const body = Array.from({ length: K }, (_, i) => i).filter(i => i > 0 && i < L);
  const bodyMean = body.length ? meanOf(body) : 0;
  // (Edge blocks may carry a partial bar: a lead-in before beat 1, a tail after the last bar.)
  if (bars[0] < 9.5 && f[0] < bodyMean - 0.5) types[0] = 'intro';
  if (L > 0 && bars[L] < 9.5 && f[L] < bodyMean - 0.5) types[L] = 'outro';
  const open = (i: number) => types[i] === 'verse';

  // Hook: the fullest group that repeats, if it clearly stands out from the rest.
  let hookGroup = -1;
  let bestF = -Infinity;
  for (const [g, idx] of members) {
    const core = idx.filter(open);
    if (core.length < 2) continue;
    const m = meanOf(core);
    if (m > bestF) { bestF = m; hookGroup = g; }
  }
  if (hookGroup >= 0) {
    // It must stand out from something: with one loop throughout there is no hook to tell apart.
    const rest = Array.from({ length: K }, (_, i) => i).filter(i => open(i) && groups[i] !== hookGroup);
    if (!rest.length || bestF - meanOf(rest) < 0.5) hookGroup = -1;
  }
  if (hookGroup >= 0) {
    for (const i of members.get(hookGroup)!) if (open(i)) types[i] = 'hook';
  } else {
    // Nothing full repeats, but one block clearly is the fullest: that's the hook.
    const idx = Array.from({ length: K }, (_, i) => i).filter(open);
    if (idx.length >= 2) {
      const top = idx.reduce((b, i) => (f[i] > f[b] ? i : b), idx[0]);
      if (f[top] - Math.max(...idx.filter(i => i !== top).map(i => f[i])) > 0.8) types[top] = 'hook';
    }
  }

  // Pacing: no hook straight after a hook (8-16 bars of something else between them),
  // except a double hook that closes the beat. The sparser of the two becomes a verse.
  for (let i = 1; i < K; i++) {
    if (types[i] !== 'hook' || types[i - 1] !== 'hook') continue;
    const closing = i === L || (i === L - 1 && types[L] === 'outro');
    if (closing) continue;
    if (f[i - 1] < f[i]) types[i - 1] = 'verse';
    else types[i] = 'verse';
  }

  // Bridge: one block, heard once, in the second half, after a hook.
  for (let i = 1; i < L; i++) {
    if (types[i] !== 'verse' || count(i) > 1) continue;
    const mid = (starts[i] + ends[i]) / 2 / durationSec;
    const afterHook = types.slice(0, i).includes('hook');
    const othersRepeat = groups.some((g, j) => j !== i && members.get(g)!.length > 1);
    if (mid > 0.45 && mid < 0.92 && afterHook && othersRepeat) {
      types[i] = 'bridge';
      break;
    }
  }
  return types;
}

/** Joins neighbouring blocks with the same music while the result stays within maxBars. */
export function mergeRepeats(segs: Segment[], groups: number[], bars: number[], maxBars = 16): { segs: Segment[]; groups: number[] } {
  const outS: Segment[] = [];
  const outG: number[] = [];
  const outB: number[] = [];
  for (let i = 0; i < segs.length; i++) {
    const k = outS.length - 1;
    if (k >= 0 && outG[k] === groups[i] && outB[k] + bars[i] <= maxBars + 0.3) {
      outS[k] = { start: outS[k].start, end: segs[i].end };
      outB[k] += bars[i];
    } else {
      outS.push({ ...segs[i] });
      outG.push(groups[i]);
      outB.push(bars[i]);
    }
  }
  return { segs: outS, groups: outG };
}

// ---------------------------------------------------------------------------
// Lyrics: repeated lines mark the hook
// ---------------------------------------------------------------------------

function normLine(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, '').replace(/\s+/g, ' ').trim();
}

function lineSet(text: string): Set<string> {
  return new Set(text.split('\n').map(normLine).filter(l => l.split(' ').length >= 2));
}

/**
 * Indices of sections whose lyrics repeat another section's (half their lines or
 * more in common). The largest such group is returned: that is the hook.
 * Returns [] when no lyrics repeat.
 */
export function hookFromRepeatedLyrics(texts: string[]): number[] {
  const sets = texts.map(lineSet);
  const K = sets.length;
  const parent = Array.from({ length: K }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < K; i++) for (let j = i + 1; j < K; j++) {
    const a = sets[i], b = sets[j];
    if (a.size === 0 || b.size === 0) continue;
    let common = 0;
    for (const l of a) if (b.has(l)) common++;
    if (common / Math.min(a.size, b.size) >= 0.5) parent[find(i)] = find(j);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < K; i++) if (sets[i].size > 0) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  let best: number[] = [];
  for (const g of groups.values()) if (g.length >= 2 && g.length > best.length) best = g;
  return best;
}

/**
 * Renames sections whose lyrics repeat to "hook". Lyrics are the written text plus
 * any take transcripts. Returns the same array when nothing repeats.
 */
export function markRepeatedLyricsAsHook<T extends { text: string; type: SectionType; voiceNotes?: Array<{ transcript?: string }> }>(
  sections: T[]
): { sections: T[]; changed: number } {
  const texts = sections.map(s =>
    [s.text, ...(s.voiceNotes ?? []).map(t => t.transcript ?? '')].filter(Boolean).join('\n')
  );
  const idx = hookFromRepeatedLyrics(texts);
  if (idx.length < 2) return { sections, changed: 0 };
  let changed = 0;
  const out = sections.map((s, i) => {
    if (!idx.includes(i) || s.type === 'chorus' || s.type === 'hook') return s;
    changed++;
    return { ...s, type: 'hook' as SectionType };
  });
  return { sections: changed ? out : sections, changed };
}
