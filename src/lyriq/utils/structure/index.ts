// Beat sectioning, all in the browser:
//   beats + bar lines -> 8/16-bar blocks from repetition and change -> repeat groups
//   -> beat-style names (Intro, Hook, Verse, Bridge, Outro).
// See features.ts, beats.ts, segment.ts and label.ts, and README.md.

import type { SectionType } from '../../types';
import type { ArrangementSection } from '../arrangement';
import { ANALYSIS_SR, extractFrameFeatures, resampleTo } from './features';
import { analyzeBeats, fitConstantGrid, withDownbeatPhase } from './beats';
import { beatSyncFeatures, chooseBoundaries, combinedNovelty, computeNovelty, DEFAULT_SEGMENT_PARAMS, type SegmentParams } from './segment';
import { blockFullness, DEFAULT_LABEL_PARAMS, groupSegments, mergeRepeats, nameBeatSections, splitByFullness, type LabelParams, type Segment } from './label';

export { hookFromRepeatedLyrics, markRepeatedLyricsAsHook } from './label';

export interface StructureOptions {
  /** A tempo the user gave (file name or manual). The tracker then only finds the beat phase. */
  hintBpm?: number;
  segment?: Partial<SegmentParams>;
  label?: Partial<LabelParams>;
}

export interface StructureResult {
  bpm: number;
  gridOriginSec: number;
  /** 0..1, how well a constant tempo fits the beats. */
  gridConfidence: number;
  beats: number[];
  downbeats: number[];
  sections: ArrangementSection[];
  /** Repetition group per section: 'A', 'B', ... Same letter = same music. */
  groups: string[];
  durationSec: number;
}

const PROMPTS: Record<SectionType, string> = {
  none: 'Write your lines...',
  intro: 'Set the mood...',
  verse: 'Tell the story...',
  'pre-chorus': 'Build the tension...',
  chorus: 'Deliver the main hook...',
  hook: 'Drop the catchy hook...',
  bridge: 'Shift perspective...',
  outro: 'Bring it home...',
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Titles like "Verse 1", "Verse 2", "Hook" (a hook keeps its name each time it comes back). */
export function titleSections(types: SectionType[]): string[] {
  let verse = 0;
  let chorus = 0;
  return types.map(t => {
    if (t === 'verse') return `Verse ${++verse}`;
    if (t === 'chorus') { chorus++; return chorus > 1 ? `Chorus ${chorus}` : 'Chorus'; }
    if (t === 'pre-chorus') return 'Pre-Chorus';
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
}

function classifyEnergy(energyDb: number[]): Array<'low' | 'medium' | 'high'> {
  const sorted = [...energyDb].sort((a, b) => a - b);
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  if (hi - lo < 1.5) return energyDb.map(() => 'medium');
  return energyDb.map(e => {
    const rel = (e - lo) / (hi - lo);
    return rel >= 0.67 ? 'high' : rel <= 0.33 ? 'low' : 'medium';
  });
}

/** The expensive part (features, beats, novelty), computed once per song. */
export interface PreparedStructure {
  track: ReturnType<typeof analyzeBeats>;
  bf: ReturnType<typeof beatSyncFeatures>;
  nov: ReturnType<typeof computeNovelty>;
  downbeatUnits: number[];
  durationSec: number;
}

export function prepareStructure(mono: Float32Array, sampleRate: number, hintBpm?: number): PreparedStructure | { track: ReturnType<typeof analyzeBeats>; durationSec: number; tooShort: true } {
  const x = resampleTo(mono, sampleRate, ANALYSIS_SR);
  // A single NaN would poison every average downstream.
  let clean = x;
  for (let i = 0; i < x.length; i++) {
    if (!Number.isFinite(x[i])) {
      if (clean === x) clean = x === mono ? x.slice() : x;
      clean[i] = 0;
    }
  }
  const durationSec = clean.length / ANALYSIS_SR;
  const feats = extractFrameFeatures(clean, ANALYSIS_SR);
  const track = analyzeBeats(feats, hintBpm);
  // Loops and sketches: one section.
  if (durationSec < 14 || track.beats.length < 16) return { track, durationSec, tooShort: true };
  const bf = beatSyncFeatures(feats, track.beats, durationSec);
  const nov = computeNovelty(bf);
  // Unit 0 is the region before the first beat when the song doesn't start on one.
  const offset = bf.times.length > track.beats.length ? 1 : 0;
  // Downbeat phase: where the sound, harmony and loudness change most. On real recordings
  // this beats the kick/chord-change cue used inside the beat tracker (37% vs 33% of true
  // section starts on a predicted downbeat, SongFormBench dev split).
  const score = [0, 0, 0, 0];
  const count = [0, 0, 0, 0];
  for (let b = 0; b < track.beats.length; b++) {
    const u = b + offset;
    if (u >= bf.n) break;
    score[b % 4] += nov.timbre[u] + nov.harmony[u] + nov.energy[u] + nov.structure[u];
    count[b % 4]++;
  }
  const means = score.map((v, i) => v / (count[i] || 1));
  const phase = means.indexOf(Math.max(...means));
  const phased = withDownbeatPhase(track, phase, fitConstantGrid(track.beats, track.bpm).t0);
  const downbeatUnits: number[] = [];
  for (let b = 0; b < phased.beats.length; b++) {
    if (b % 4 === phase && b + offset < bf.n) downbeatUnits.push(b + offset);
  }
  return { track: phased, bf, nov, downbeatUnits, durationSec };
}

export function analyzeStructure(mono: Float32Array, sampleRate: number, options: StructureOptions = {}): StructureResult {
  return sectionsFromPrepared(prepareStructure(mono, sampleRate, options.hintBpm), options);
}

/**
 * [first, last] block index of a body that is one loop throughout (every block in the
 * same group, except a first and/or last block in a group of its own). Null otherwise.
 */
function uniformBody(groups: number[]): [number, number] | null {
  const K = groups.length;
  if (K < 2) return null;
  const once = (i: number) => groups.filter(g => g === groups[i]).length === 1;
  const a = once(0) && K > 2 ? 1 : 0;
  const b = once(K - 1) && K - 1 > a + 1 ? K - 2 : K - 1;
  for (let i = a; i <= b; i++) if (groups[i] !== groups[a]) return null;
  return b > a ? [a, b] : null;
}

export function sectionsFromPrepared(prep: ReturnType<typeof prepareStructure>, options: StructureOptions = {}): StructureResult {
  const durationSec = prep.durationSec;
  const single = (track: ReturnType<typeof analyzeBeats>): StructureResult => ({
    ...track,
    durationSec,
    groups: ['A'],
    sections: [{
      type: 'verse', title: 'Verse 1', startTimeSec: 0, endTimeSec: r3(durationSec),
      energy: 'medium', suggestedLyricsPrompt: 'Write your opening verse',
    }],
  });
  if ('tooShort' in prep) return single(prep.track);
  const { bf, nov } = prep;
  const segParams = { ...DEFAULT_SEGMENT_PARAMS, ...options.segment };
  const barSec = (60 / prep.track.bpm) * 4;
  const novelty = combinedNovelty(nov, bf.n, segParams);
  const timing = { times: bf.times, durationSec, barSec };
  const offset = bf.times.length > prep.track.beats.length ? 1 : 0;

  // Beat 1: score each of the four beat phases by its cumulative kick/808 attack; the
  // strongest is the anchor. Then try every phase and every 4-bar phrase offset, and keep
  // the bar grid whose 8/16-bar blocks fit the music best, with the kick anchor as a
  // strong vote (a beat whose kick hits 1 and 3 equally leaves the choice to the music).
  const lowByPhase = [0, 1, 2, 3].map(ph => {
    let sum = 0, c = 0;
    for (let b = ph; b < prep.track.beats.length; b += 4) if (b + offset < bf.n) { sum += bf.lowHit[b + offset]; c++; }
    return c ? sum / c : 0;
  });
  const lm = lowByPhase.reduce((a, b) => a + b, 0) / 4;
  const lsd = Math.sqrt(lowByPhase.reduce((a, b) => a + (b - lm) ** 2, 0) / 4);
  const anchor = lowByPhase.map(v => (lsd > 1e-6 && lsd > 0.05 * lm ? (v - lm) / lsd : 0));
  let best = { phase: prep.track.downbeatPhase, starts: [] as number[], score: -Infinity, bars: [] as number[] };
  for (let phase = 0; phase < 4; phase++) {
    const bars: number[] = [];
    for (let b = phase; b < prep.track.beats.length; b += 4) if (b + offset < bf.n) bars.push(b + offset);
    for (let hyper = 0; hyper < 4; hyper++) {
      const r = chooseBoundaries(novelty, bf.n, bars, segParams, timing, hyper);
      const score = r.score + segParams.anchorWeight * anchor[phase];
      if (score > best.score + 1e-9) best = { phase, starts: r.starts, score, bars };
    }
  }
  const barLines = best.bars;
  const track = withDownbeatPhase(prep.track, best.phase, fitConstantGrid(prep.track.beats, prep.track.bpm).t0);
  const cuts = [0, ...best.starts, bf.n];
  let segs: Segment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) segs.push({ start: cuts[i], end: cuts[i + 1] });
  if (segs.length < 2) return single(track);

  const unitTime = (u: number) => (u >= bf.n ? durationSec : bf.times[u]);
  const barsOf = (list: Segment[]) =>
    list.map((sg, i) => ((i === list.length - 1 ? durationSec : unitTime(sg.end)) - (i === 0 ? 0 : unitTime(sg.start))) / barSec);

  // Repeats: blocks with the same music share a group.
  const S = new Float32Array(bf.n * bf.n);
  for (let i = 0; i < S.length; i++) S[i] = 0.5 * (nov.ssmTimbre[i] + nov.ssmHarmony[i]);
  const labelParams = { ...DEFAULT_LABEL_PARAMS, ...options.label };
  let { groups: groupIds } = groupSegments(S, bf.n, segs, labelParams);
  // Same loop, different arrangement: a hook is often the verse loop with the 808, hats
  // and a melody stacked on. Split a group when some of its blocks are clearly fuller.
  groupIds = splitByFullness(groupIds, blockFullness(bf, segs));

  // One loop throughout (sparse edges aside): the novelty is only noise, so cut the body
  // into regular 16-bar blocks from its first bar instead.
  const loopSpan = uniformBody(groupIds);
  if (loopSpan) {
    const [a, b] = loopSpan;
    const from = segs[a].start;
    const to = segs[b].end;
    const lines = barLines.filter(u => u > from && u < to);
    const cutsIn: number[] = [];
    for (let k = segParams.maxBars; k <= lines.length; k += segParams.maxBars) cutsIn.push(lines[k - 1]);
    // What's left after the last full block: under 4 bars goes to the block after the body
    // (usually the outro); with none, 2-3 bars stand alone and a 1-bar scrap joins the last block.
    const rest = lines.length + 1 - cutsIn.length * segParams.maxBars;
    let end = to;
    if (cutsIn.length && rest > 0 && rest < 4) {
      if (b + 1 < segs.length) {
        end = cutsIn.pop()!;
        segs[b + 1] = { ...segs[b + 1], start: end };
      } else if (rest < 2) {
        cutsIn.pop();
      }
    }
    const body = [from, ...cutsIn, end];
    const bodySegs: Segment[] = [];
    for (let i = 0; i < body.length - 1; i++) bodySegs.push({ start: body[i], end: body[i + 1] });
    segs = [...segs.slice(0, a), ...bodySegs, ...segs.slice(b + 1)];
    groupIds = [...groupIds.slice(0, a), ...bodySegs.map(() => groupIds[a]), ...groupIds.slice(b + 1)];
  }
  // Neighbours that repeat join up (8 + 8 bars of the same loop is one 16-bar section).
  ({ segs, groups: groupIds } = mergeRepeats(segs, groupIds, barsOf(segs), segParams.maxBars));
  // Letters in order of first appearance.
  const letterOf = new Map<number, number>();
  groupIds.forEach(g => { if (!letterOf.has(g)) letterOf.set(g, letterOf.size); });
  groupIds = groupIds.map(g => letterOf.get(g)!);

  // Steady tempo (a DAW beat): put boundaries exactly on the constant bar grid the editor snaps to.
  const onGrid = (t: number) => {
    if (track.gridConfidence < 0.6) return t;
    const k = Math.round((t - track.gridOriginSec) / barSec);
    const g = track.gridOriginSec + k * barSec;
    return Math.abs(g - t) <= (60 / track.bpm) * 0.25 && g > 0 && g < durationSec ? g : t;
  };
  const segStart = segs.map((sg, i) => (i === 0 ? 0 : onGrid(unitTime(sg.start))));
  const segEnd = segs.map((_, i) => (i === segs.length - 1 ? durationSec : segStart[i + 1]));

  const energyDb = segs.map(sg => {
    let p = 0;
    for (let u = sg.start; u < sg.end; u++) p += 10 ** (bf.rmsDb[u] / 10);
    return 10 * Math.log10(p / Math.max(1, sg.end - sg.start) + 1e-10);
  });
  const types = nameBeatSections({
    groups: groupIds,
    fullness: blockFullness(bf, segs),
    bars: segStart.map((st, i) => (segEnd[i] - st) / barSec),
    starts: segStart,
    ends: segEnd,
    durationSec,
  });
  const titles = titleSections(types);
  const energy = classifyEnergy(energyDb);

  return {
    ...track,
    durationSec,
    groups: groupIds.map(g => String.fromCharCode(65 + Math.min(25, g))),
    sections: types.map((type, i) => ({
      type,
      title: titles[i],
      startTimeSec: r3(segStart[i]),
      endTimeSec: r3(segEnd[i]),
      energy: energy[i],
      suggestedLyricsPrompt: PROMPTS[type],
    })),
  };
}
