// Song structure analysis, all in the browser:
//   beats + downbeats -> boundaries from repetition and change -> repetition groups -> names.
// See features.ts, beats.ts, segment.ts and label.ts.

import type { SectionType } from '../../types';
import type { ArrangementSection } from '../arrangement';
import { ANALYSIS_SR, extractFrameFeatures, resampleTo } from './features';
import { analyzeBeats, fitConstantGrid, withDownbeatPhase } from './beats';
import { beatSyncFeatures, chooseBoundaries, computeNovelty, DEFAULT_SEGMENT_PARAMS, TIMBRE_DIM, type SegmentParams } from './segment';
import { predictLabels, segmentFeatures, type SegmentContext } from './labelModel';
import { DEFAULT_LABEL_PARAMS, groupSegments, labelSegments, type LabelParams, type Segment } from './label';

export { chorusFromRepeatedLyrics, markRepeatedLyricsAsChorus } from './label';

export interface StructureOptions {
  /** A tempo the user gave (file name or manual). The tracker then only finds the beat phase. */
  hintBpm?: number;
  segment?: Partial<SegmentParams>;
  label?: Partial<LabelParams>;
  /** 'model' (default): the fitted scorer in labelModel.ts. 'rules': the hand-written rules in label.ts. */
  labelWith?: 'model' | 'rules';
  /** Override the fitted weights (benchmarking only). */
  labelWeights?: number[][];
  /** Include per-section feature vectors in the result (benchmarking only). */
  debug?: boolean;
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
  debug?: { features: number[][] };
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

/** Titles like "Verse 1", "Chorus", "Chorus 2". */
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

export function sectionsFromPrepared(prep: ReturnType<typeof prepareStructure>, options: StructureOptions = {}): StructureResult {
  const { track, durationSec } = prep;
  const barSec = (60 / track.bpm) * 4;
  const single = (): StructureResult => ({
    ...track,
    durationSec,
    groups: ['A'],
    sections: [{
      type: 'verse', title: 'Verse 1', startTimeSec: 0, endTimeSec: r3(durationSec),
      energy: 'medium', suggestedLyricsPrompt: 'Write your opening verse',
    }],
  });
  if ('tooShort' in prep) return single();
  const { bf, nov, downbeatUnits } = prep;

  const segParams = { ...DEFAULT_SEGMENT_PARAMS, ...options.segment };
  const candidates = segParams.anyBeat ? Array.from({ length: bf.n }, (_, i) => i) : downbeatUnits;
  const starts = chooseBoundaries(nov, bf.n, candidates, segParams, { times: bf.times, durationSec, barSec });
  const cuts = [0, ...starts, bf.n];
  const segs: Segment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) segs.push({ start: cuts[i], end: cuts[i + 1] });
  if (segs.length < 2) return single();

  const unitTime = (u: number) => (u >= bf.n ? durationSec : bf.times[u]);
  const segStart = segs.map((s, i) => (i === 0 ? 0 : unitTime(s.start)));
  const segEnd = segs.map((s, i) => (i === segs.length - 1 ? durationSec : unitTime(s.end)));

  const S = new Float32Array(bf.n * bf.n);
  for (let i = 0; i < S.length; i++) S[i] = 0.5 * (nov.ssmTimbre[i] + nov.ssmHarmony[i]);
  const labelParams = { ...DEFAULT_LABEL_PARAMS, ...options.label };
  const { groups: groupIds, sim } = groupSegments(S, bf.n, segs, labelParams);

  const energyDb = segs.map(s => {
    let p = 0;
    for (let u = s.start; u < s.end; u++) p += 10 ** (bf.rmsDb[u] / 10);
    return 10 * Math.log10(p / Math.max(1, s.end - s.start) + 1e-10);
  });
  const bars = segStart.map((st, i) => (segEnd[i] - st) / barSec);
  const timbre = segs.map(sg => [0, 1, 2].map(k => {
    let t = 0;
    for (let u = sg.start; u < sg.end; u++) t += bf.timbre[u * TIMBRE_DIM + k];
    return t / Math.max(1, sg.end - sg.start);
  }));
  const ctx: SegmentContext = { groups: groupIds, sim, energyDb, bars, starts: segStart, ends: segEnd, durationSec, timbre };
  const types = options.labelWith === 'rules'
    ? labelSegments({ groups: groupIds, sim, energyDb, bars, starts: segStart, ends: segEnd, durationSec }, labelParams)
    : predictLabels(ctx, options.labelWeights);
  const titles = titleSections(types);
  const energy = classifyEnergy(energyDb);

  return {
    ...track,
    durationSec,
    groups: groupIds.map(g => String.fromCharCode(65 + Math.min(25, g))),
    ...(options.debug ? { debug: { features: segmentFeatures(ctx) } } : {}),
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
