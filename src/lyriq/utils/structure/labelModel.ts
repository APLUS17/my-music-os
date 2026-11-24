// Section names from a small fitted scorer instead of hand-written rules.
//
// Each section is described by ~20 numbers (where it sits in the song, how loud it
// is, how often its music repeats, whether it is the loudest repeated part, ...).
// A linear score per name, fitted on 40 annotated songs (SongFormBench, dev split),
// picks the name; sections that share music then vote together. It is a few dozen
// numbers in this file: deterministic, offline, no model download.

import type { SectionType } from '../../types';

export const LABEL_CLASSES = ['intro', 'verse', 'chorus', 'bridge', 'outro'] as const;
export type LabelClass = (typeof LABEL_CLASSES)[number];

export interface SegmentContext {
  groups: number[];
  /** Segment-to-segment similarity (z-scores). */
  sim: number[][];
  energyDb: number[];
  bars: number[];
  starts: number[];
  ends: number[];
  durationSec: number;
  /** Mean timbre (MFCC 1-3 z-scores) per segment. */
  timbre: number[][];
}

export const FEATURE_NAMES = [
  'startFrac', 'endFrac', 'midFracSq', 'isFirst', 'isLast', 'energyZ', 'bars16',
  'groupCount', 'occurrence', 'groupEnergyZ', 'inLoudestRepeated', 'oneOff', 'energyRank',
  'timbre1', 'timbre2', 'timbre3', 'energyStepIn', 'energyStepOut', 'simToLoudest',
  'nextIsLoudest', 'prevIsLoudest',
] as const;

/** Feature vectors, one per segment, in FEATURE_NAMES order. */
export function segmentFeatures(c: SegmentContext): number[][] {
  const K = c.groups.length;
  const lens = c.starts.map((s, i) => c.ends[i] - s);
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const mE = c.energyDb.reduce((s, e, i) => s + e * lens[i], 0) / total;
  const sdE = Math.sqrt(c.energyDb.reduce((s, e, i) => s + (e - mE) ** 2 * lens[i], 0) / total) || 1;
  const ez = c.energyDb.map(e => (e - mE) / sdE);
  const members = new Map<number, number[]>();
  c.groups.forEach((g, i) => members.set(g, [...(members.get(g) ?? []), i]));
  const groupEz = new Map<number, number>();
  for (const [g, idx] of members) groupEz.set(g, idx.reduce((s, i) => s + ez[i] * lens[i], 0) / idx.reduce((s, i) => s + lens[i], 0));
  // The loudest group that repeats (the likeliest chorus).
  let loudest = -1;
  let loudestE = -Infinity;
  for (const [g, idx] of members) if (idx.length >= 2 && groupEz.get(g)! > loudestE) { loudestE = groupEz.get(g)!; loudest = g; }
  const sortedE = [...ez].sort((a, b) => a - b);
  const rank = (v: number) => (K > 1 ? sortedE.indexOf(v) / (K - 1) : 0.5);
  const occ = c.groups.map((g, i) => members.get(g)!.indexOf(i));

  return c.groups.map((g, i) => {
    const start = c.starts[i] / c.durationSec;
    const end = c.ends[i] / c.durationSec;
    const mid = (start + end) / 2;
    const loudIdx = loudest >= 0 ? members.get(loudest)!.filter(j => j !== i) : [];
    const simLoud = loudIdx.length ? loudIdx.reduce((s, j) => s + c.sim[i][j], 0) / loudIdx.length : 0;
    return [
      start, end, mid * mid, i === 0 ? 1 : 0, i === K - 1 ? 1 : 0, ez[i], c.bars[i] / 16,
      Math.min(4, members.get(g)!.length) / 4, Math.min(3, occ[i]) / 3, groupEz.get(g)!,
      g === loudest ? 1 : 0, members.get(g)!.length === 1 ? 1 : 0, rank(ez[i]),
      c.timbre[i][0] ?? 0, c.timbre[i][1] ?? 0, c.timbre[i][2] ?? 0,
      i > 0 ? ez[i] - ez[i - 1] : 0, i < K - 1 ? ez[i + 1] - ez[i] : 0,
      Math.max(-3, Math.min(3, simLoud)),
      i < K - 1 && c.groups[i + 1] === loudest ? 1 : 0, i > 0 && c.groups[i - 1] === loudest ? 1 : 0,
    ];
  });
}

/**
 * Fitted weights: one row per class, FEATURE_NAMES order, bias last.
 * Softmax regression (L2 0.1, chosen by 5-fold cross-validation) on the 40-song
 * SongFormBench-HarmonixSet dev split. Held-out accuracy is in the folder README.
 */
export const LABEL_WEIGHTS: number[][] = [
  // intro
  [-1.201, -1.409, -0.843, 0.887, -0.081, -0.192, -0.109, 0.022, -0.179, -0.266, -0.128, -0.134, -0.698, 0.066, 0.137, 0.032, 0.209, -0.069, -0.112, -0.147, -0.282, 1.508],
  // verse
  [-0.677, -0.255, -0.917, -0.363, -0.527, 0.15, 0.662, 0.023, 0.028, 0.221, -0.044, -0.041, 0.189, 0.171, 0.114, -0.062, -0.082, 0.119, -0.072, 0.245, -0.211, 1.067],
  // chorus
  [0.117, 0.24, 0.107, -0.157, 0.158, 0.124, -0.123, 0.067, 0.052, 0.125, 0.188, -0.137, 0.866, -0.182, -0.234, 0.051, -0.07, -0.035, 0.178, 0.094, 0.114, 0.37],
  // bridge
  [0.617, 0.498, 0.297, -0.27, -0.485, 0.062, -0.175, -0.288, -0.03, 0.047, -0.048, 0.272, 0.055, -0.297, 0.086, 0.121, -0.064, 0.187, 0.091, -0.022, 0.229, -0.917],
  // outro
  [1.143, 0.926, 1.357, -0.097, 0.936, -0.144, -0.256, 0.176, 0.128, -0.127, 0.031, 0.04, -0.412, 0.243, -0.103, -0.141, 0.006, -0.202, -0.085, -0.17, 0.149, -2.028],
];

/** How strongly sections that share music vote for one name. */
export const GROUP_VOTE = 0.5;

export function scoreSegments(x: number[][], weights: number[][] = LABEL_WEIGHTS): number[][] {
  return x.map(row => weights.map(w => {
    let s = w[w.length - 1];
    for (let k = 0; k < row.length; k++) s += w[k] * row[k];
    return s;
  }));
}

/** Names each segment: fitted scores, group voting, and edge constraints (intro only at the start, outro only at the end). */
export function predictLabels(c: SegmentContext, weights: number[][] = LABEL_WEIGHTS, vote = GROUP_VOTE): SectionType[] {
  const K = c.groups.length;
  if (K === 0) return [];
  if (K === 1) return ['verse'];
  const scores = scoreSegments(segmentFeatures(c), weights);
  const members = new Map<number, number[]>();
  c.groups.forEach((g, i) => members.set(g, [...(members.get(g) ?? []), i]));
  const intro = LABEL_CLASSES.indexOf('intro');
  const outro = LABEL_CLASSES.indexOf('outro');
  const bridge = LABEL_CLASSES.indexOf('bridge');
  const out: SectionType[] = [];
  let bridges = 0;
  for (let i = 0; i < K; i++) {
    const idx = members.get(c.groups[i])!;
    const s = scores[i].map((v, k) => {
      if (idx.length < 2 || k === intro || k === outro) return v;
      const others = idx.filter(j => j !== i);
      return v + vote * (others.reduce((a, j) => a + scores[j][k], 0) / others.length);
    });
    if (i > 1) s[intro] = -Infinity;
    if (i < K - 2) s[outro] = -Infinity;
    if (bridges >= 1) s[bridge] = -Infinity;
    const k = s.indexOf(Math.max(...s));
    if (k === bridge) bridges++;
    // An intro can't follow a non-intro.
    if (k === intro && i === 1 && out[0] !== 'intro') { s[intro] = -Infinity; out.push(LABEL_CLASSES[s.indexOf(Math.max(...s))]); continue; }
    out.push(LABEL_CLASSES[k]);
  }
  return out;
}
