// Repetition groups and section names.
//
// Groups: segments that sound like each other (same chords and sound, beat by beat)
// get the same letter. Names come from rules on those groups: the repeated, loudest
// group is the chorus; other repeated groups are verses (or a pre-chorus when short
// and always right before a chorus); a one-off section late in the song is the bridge;
// quiet first and last sections are intro and outro.
//
// Names are a heuristic. Groups and boundaries are measured.

import type { SectionType } from '../../types';

export interface Segment {
  /** First and one-past-last beat unit. */
  start: number;
  end: number;
}

export interface LabelParams {
  /** Similarity, in standard deviations above the song's typical beat-pair similarity, to join a group. */
  groupThreshold: number;
  /** Mean similarity (z) to the chorus group above which another section also counts as chorus. */
  chorusJoin: number;
  /** Longest opening section (bars) that can be an intro. */
  introMaxBars: number;
}

export const DEFAULT_LABEL_PARAMS: LabelParams = { groupThreshold: 1.0, chorusJoin: 0.5, introMaxBars: 12.5 };

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
  let clusters: number[][] = segs.map((_, i) => [i]);
  for (;;) {
    let bi = -1, bj = -1, bv = -Infinity;
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      let s = 0;
      for (const a of clusters[i]) for (const b of clusters[j]) s += sim[a][b];
      s /= clusters[i].length * clusters[j].length;
      if (s > bv) { bv = s; bi = i; bj = j; }
    }
    if (bi < 0 || bv < params.groupThreshold) break;
    clusters[bi] = [...clusters[bi], ...clusters[bj]];
    clusters = clusters.filter((_, k) => k !== bj);
  }
  const groupOf = new Array(K).fill(-1);
  clusters.sort((x, y) => Math.min(...x) - Math.min(...y));
  clusters.forEach((c, g) => c.forEach(i => { groupOf[i] = g; }));
  return { groups: groupOf, sim };
}

export interface LabelInput {
  groups: number[];
  /** Segment-to-segment similarity (z-scores), from groupSegments. */
  sim?: number[][];
  /** Mean loudness per segment (dB). */
  energyDb: number[];
  /** Length per segment in bars. */
  bars: number[];
  /** Start and end (seconds) per segment. */
  starts: number[];
  ends: number[];
  durationSec: number;
}

/** Names each segment from its repetition group, loudness and position. */
export function labelSegments(input: LabelInput, params: LabelParams = DEFAULT_LABEL_PARAMS): SectionType[] {
  const { groups, energyDb, bars, starts, ends, durationSec, sim } = input;
  const K = groups.length;
  if (K === 0) return [];
  if (K === 1) return ['verse'];

  // Loudness z-scores weighted by section length.
  const lens = starts.map((s, i) => ends[i] - s);
  const totalLen = lens.reduce((a, b) => a + b, 0) || 1;
  const mE = energyDb.reduce((s, e, i) => s + e * lens[i], 0) / totalLen;
  const sdE = Math.sqrt(energyDb.reduce((s, e, i) => s + (e - mE) ** 2 * lens[i], 0) / totalLen) || 1;
  const ez = energyDb.map(e => (e - mE) / sdE);

  const members = new Map<number, number[]>();
  groups.forEach((g, i) => members.set(g, [...(members.get(g) ?? []), i]));
  const count = (i: number) => members.get(groups[i])!.length;

  // Interior segments exclude a short quiet first/last section, so an intro never becomes "the chorus".
  const isEdgeQuiet = (i: number) =>
    (i === 0 || i === K - 1) && bars[i] <= 8.5 && ez[i] < 0.3;

  // Chorus group: repeated, loud, and not only at the very edges.
  let chorusGroup = -1;
  let bestScore = -Infinity;
  for (const [g, idx] of members) {
    const core = idx.filter(i => !isEdgeQuiet(i));
    if (core.length < 2) continue;
    const meanE = core.reduce((s, i) => s + ez[i], 0) / core.length;
    const firstAt = starts[core[0]] / durationSec;
    // A chorus rarely opens a song: slight preference for groups that first appear later.
    const score = meanE + 0.15 * (core.length - 2) + (firstAt > 0.08 ? 0.25 : 0);
    if (score > bestScore) { bestScore = score; chorusGroup = g; }
  }

  const types: SectionType[] = new Array(K).fill('verse');
  if (chorusGroup >= 0) {
    const chorusIdx = members.get(chorusGroup)!;
    for (const i of chorusIdx) types[i] = 'chorus';
    // Sections that sound like the chorus but fell just outside its group join it
    // (a chorus with an extra layer, or a double chorus split in two).
    if (sim) {
      for (let i = 0; i < K; i++) {
        if (types[i] === 'chorus' || isEdgeQuiet(i)) continue;
        const s = chorusIdx.reduce((a, j) => a + sim[i][j], 0) / chorusIdx.length;
        if (s >= params.chorusJoin) types[i] = 'chorus';
      }
    }
  } else if (K >= 3) {
    // Nothing repeats: the loudest interior section is the chorus.
    let bi = 1;
    for (let i = 1; i < K - 1; i++) if (ez[i] > ez[bi]) bi = i;
    types[bi] = 'chorus';
  }

  // Pre-chorus: a short non-chorus group that sits right before a chorus at least twice.
  for (const [g, idx] of members) {
    if (g === chorusGroup || idx.length < 2) continue;
    const before = idx.filter(i => i + 1 < K && types[i + 1] === 'chorus' && i > 0 && types[i - 1] !== 'chorus' && types[i] === 'verse');
    const meanBars = idx.reduce((s, i) => s + bars[i], 0) / idx.length;
    if (before.length >= 2 && meanBars <= 8.5) for (const i of before) types[i] = 'pre-chorus';
  }

  // One-off sections in the second half that aren't the chorus: one bridge.
  let bridgeDone = false;
  for (let i = 1; i < K - 1; i++) {
    if (types[i] !== 'verse' || count(i) > 1) continue;
    const mid = (starts[i] + ends[i]) / 2 / durationSec;
    const afterChorus = types.slice(0, i).includes('chorus');
    if (!bridgeDone && mid > 0.45 && mid < 0.9 && afterChorus) {
      types[i] = 'bridge';
      bridgeDone = true;
    }
  }

  // Intro: the opening section unless it is a full-energy part of a repeated group.
  const opensLoud = ez[0] >= 0.5 && count(0) > 1 && types[0] !== 'chorus';
  if (bars[0] <= params.introMaxBars && !opensLoud) {
    types[0] = 'intro';
    // A two-part intro: a second short, quiet, one-off section right after it.
    if (K > 3 && count(1) === 1 && ez[1] < 0 && bars[1] <= 8.5 && types[1] !== 'chorus') types[1] = 'intro';
  } else if (ez[0] < -0.8) {
    types[0] = 'intro';
  }
  // Outro: a closing section that is quieter than average or doesn't repeat.
  const L = K - 1;
  if (L > 0 && types[L] !== 'intro' && ((bars[L] <= 16.5 && (ez[L] < 0 || count(L) === 1)) || ez[L] < -0.8)) types[L] = 'outro';

  return types;
}

// ---------------------------------------------------------------------------
// Lyrics: repeated lines mark the chorus
// ---------------------------------------------------------------------------

function normLine(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, '').replace(/\s+/g, ' ').trim();
}

function lineSet(text: string): Set<string> {
  return new Set(text.split('\n').map(normLine).filter(l => l.split(' ').length >= 2));
}

/**
 * Indices of sections whose lyrics repeat another section's (half their lines or
 * more in common). The largest such group is returned: that is the chorus.
 * Returns [] when no lyrics repeat.
 */
export function chorusFromRepeatedLyrics(texts: string[]): number[] {
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
 * Renames sections whose lyrics repeat to "chorus". Lyrics are the written text plus
 * any take transcripts. Returns the same array when nothing repeats.
 */
export function markRepeatedLyricsAsChorus<T extends { text: string; type: SectionType; voiceNotes?: Array<{ transcript?: string }> }>(
  sections: T[]
): { sections: T[]; changed: number } {
  const texts = sections.map(s =>
    [s.text, ...(s.voiceNotes ?? []).map(t => t.transcript ?? '')].filter(Boolean).join('\n')
  );
  const idx = chorusFromRepeatedLyrics(texts);
  if (idx.length < 2) return { sections, changed: 0 };
  let changed = 0;
  const out = sections.map((s, i) => {
    if (!idx.includes(i) || s.type === 'chorus' || s.type === 'hook') return s;
    changed++;
    return { ...s, type: 'chorus' as SectionType };
  });
  return { sections: changed ? out : sections, changed };
}
