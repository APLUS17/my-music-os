// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { analyzeStructure, markRepeatedLyricsAsHook, hookFromRepeatedLyrics, titleSections, type StructureResult } from '../utils/structure';
import { fitConstantGrid, tidyBpm } from '../utils/structure/beats';
import { mergeRepeats, nameBeatSections, splitByFullness } from '../utils/structure/label';
import { isFinalArrangement, toBeatAnalysis, STRUCTURE_VERSION } from '../services/structureAnalysis';
import type { SectionType } from '../types';

const SR = 11025;

// Deterministic noise.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface Part {
  name: SectionType;
  bars: number;
  /** One chord (MIDI notes) per bar, cycled. */
  chords: number[][];
  drums: boolean;
  lead: boolean;
  gain: number;
}

/** Renders a song: chord pads, bass, drums, an optional lead. Returns audio and the true section starts. */
function renderSong(parts: Part[], bpm = 100, leadInSec = 0): { pcm: Float32Array; starts: number[]; bar: number } {
  const BEAT = 60 / bpm;
  const BAR = BEAT * 4;
  const totalBars = parts.reduce((s, p) => s + p.bars, 0);
  const n = Math.ceil((leadInSec + totalBars * BAR) * SR) + SR;
  const pcm = new Float32Array(n);
  const noise = lcg(7);
  const starts: number[] = [];
  let bar0 = 0;
  for (const part of parts) {
    starts.push(leadInSec + bar0 * BAR);
    for (let b = 0; b < part.bars; b++) {
      const chord = part.chords[b % part.chords.length];
      const t0 = leadInSec + (bar0 + b) * BAR;
      const i0 = Math.floor(t0 * SR);
      const i1 = Math.floor((t0 + BAR) * SR);
      for (let i = i0; i < i1; i++) {
        const t = Math.max(0, i / SR - t0);
        let v = 0;
        for (const m of chord) {
          const f = midiHz(m);
          v += 0.12 * (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t) + 0.2 * Math.sin(6 * Math.PI * f * t));
        }
        // Bass on the root, an octave down.
        v += 0.25 * Math.sin(2 * Math.PI * midiHz(chord[0] - 12) * t);
        if (part.lead) {
          // Lead line: chord tones as 8th notes.
          const step = Math.floor(t / (BEAT / 2));
          const note = chord[step % chord.length] + 12;
          const tt = t - step * (BEAT / 2);
          v += 0.18 * Math.exp(-tt * 4) * Math.sin(2 * Math.PI * midiHz(note) * t);
        }
        if (part.drums) {
          const beatPos = t % BEAT;
          const beatIdx = Math.floor(t / BEAT);
          if (beatIdx % 2 === 0) v += 0.8 * Math.exp(-beatPos * 30) * Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-beatPos * 40)) * beatPos);
          else v += 0.45 * Math.exp(-beatPos * 25) * noise();
          const hatPos = t % (BEAT / 2);
          v += 0.08 * Math.exp(-hatPos * 80) * noise();
        }
        pcm[i] += v * part.gain;
      }
    }
    bar0 += part.bars;
  }
  return { pcm, starts, bar: BAR };
}

const LOOP = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const HOOK = [[53, 57, 60], [55, 59, 62], [57, 60, 64], [52, 56, 59]]; // F G Am E
const BRIDGE = [[50, 53, 57], [52, 55, 59]]; // Dm Em

/** Trap-style: hook and verse share the loop; the hook adds the melody and is fuller. */
const TRAP: Part[] = [
  { name: 'intro', bars: 8, chords: LOOP, drums: false, lead: false, gain: 0.5 },
  { name: 'hook', bars: 16, chords: LOOP, drums: true, lead: true, gain: 1 },
  { name: 'verse', bars: 16, chords: LOOP, drums: true, lead: false, gain: 0.75 },
  { name: 'hook', bars: 16, chords: LOOP, drums: true, lead: true, gain: 1 },
  { name: 'verse', bars: 16, chords: LOOP, drums: true, lead: false, gain: 0.75 },
  { name: 'bridge', bars: 8, chords: BRIDGE, drums: false, lead: true, gain: 0.7 },
  { name: 'hook', bars: 16, chords: LOOP, drums: true, lead: true, gain: 1 },
  { name: 'outro', bars: 8, chords: LOOP, drums: false, lead: false, gain: 0.45 },
];

/** Boom-bap with a short silent lead-in: hook on its own chords. */
const BOOMBAP: Part[] = [
  { name: 'intro', bars: 4, chords: LOOP, drums: false, lead: false, gain: 0.5 },
  { name: 'verse', bars: 16, chords: LOOP, drums: true, lead: false, gain: 0.8 },
  { name: 'hook', bars: 8, chords: HOOK, drums: true, lead: true, gain: 1 },
  { name: 'verse', bars: 16, chords: LOOP, drums: true, lead: false, gain: 0.8 },
  { name: 'hook', bars: 8, chords: HOOK, drums: true, lead: true, gain: 1 },
  { name: 'outro', bars: 4, chords: LOOP, drums: false, lead: false, gain: 0.45 },
];

function typeAt(r: StructureResult, t: number) {
  return r.sections.find(x => t >= x.startTimeSec && t < x.endTimeSec)?.type;
}
function groupAt(r: StructureResult, t: number) {
  return r.groups[r.sections.findIndex(x => t >= x.startTimeSec && t < x.endTimeSec)];
}
/** Share of the song's time that got the right name. */
function nameAccuracy(r: StructureResult, parts: Part[], starts: number[], bar: number) {
  let ok = 0, n = 0;
  parts.forEach((p, k) => {
    for (let t = starts[k] + 0.1; t < starts[k] + p.bars * bar; t += 0.25) { n++; if (typeAt(r, t) === p.name) ok++; }
  });
  return ok / n;
}
function onBarGrid(r: StructureResult) {
  const bar = (60 / r.bpm) * 4;
  return r.sections.slice(1).every(x => {
    const k = Math.round((x.startTimeSec - r.gridOriginSec) / bar);
    return Math.abs(x.startTimeSec - (r.gridOriginSec + k * bar)) < 0.02;
  });
}

function beatSuite(label: string, parts: Part[], bpm: number, leadIn = 0) {
  describe(label, () => {
    const { pcm, starts, bar } = renderSong(parts, bpm, leadIn);
    const r = analyzeStructure(pcm, SR);

    it('reads the tempo the producer used', () => {
      expect(Math.abs(r.bpm - bpm) / bpm).toBeLessThan(0.005);
      expect(r.gridConfidence).toBeGreaterThan(0.8);
    });

    it('puts every boundary on a bar line, at the true section starts', () => {
      expect(onBarGrid(r)).toBe(true);
      const est = r.sections.slice(1).map(x => x.startTimeSec);
      const truth = starts.slice(1);
      const hit = truth.filter(t => est.some(e => Math.abs(e - t) < 0.1)).length;
      expect(hit / truth.length).toBeGreaterThanOrEqual(0.85);
      expect(est.length).toBeLessThanOrEqual(truth.length + 1);
    });

    it('makes 4, 8 or 16-bar sections', () => {
      r.sections.forEach((x, i) => {
        const bars = (x.endTimeSec - x.startTimeSec) / bar;
        const edge = i === 0 || i === r.sections.length - 1;
        if (!edge) expect([4, 8, 16]).toContain(Math.round(bars));
        expect(bars).toBeLessThanOrEqual(16.5);
      });
    });

    it('names sections the beat way', () => {
      expect(r.sections.every(x => ['intro', 'hook', 'verse', 'bridge', 'outro'].includes(x.type))).toBe(true);
      expect(nameAccuracy(r, parts, starts, bar)).toBeGreaterThanOrEqual(0.85);
    });

    it('gives every hook the same group', () => {
      const hooks = parts.map((p, k) => (p.name === 'hook' ? starts[k] + bar * 2 : -1)).filter(t => t >= 0);
      expect(new Set(hooks.map(t => groupAt(r, t))).size).toBe(1);
    });

    it('covers [0, duration] with contiguous sections', () => {
      expect(r.sections[0].startTimeSec).toBe(0);
      for (let i = 1; i < r.sections.length; i++) expect(r.sections[i].startTimeSec).toBe(r.sections[i - 1].endTimeSec);
      expect(r.sections[r.sections.length - 1].endTimeSec).toBeCloseTo(pcm.length / SR, 2);
    });
  });
}

beatSuite('trap-style beat, 140 BPM (hook and verse share the loop)', TRAP, 140);
beatSuite('boom-bap beat, 90 BPM, 0.35 s lead-in', BOOMBAP, 90, 0.35);

describe('an unchanging loop still comes out in writable blocks', () => {
  const { pcm, bar } = renderSong([{ name: 'verse', bars: 40, chords: LOOP, drums: true, lead: false, gain: 0.8 }], 100);
  const r = analyzeStructure(pcm, SR);
  it('splits it into bar-aligned blocks of at most 16 bars', () => {
    expect(r.sections.length).toBeGreaterThanOrEqual(3);
    expect(onBarGrid(r)).toBe(true);
    r.sections.forEach(x => expect((x.endTimeSec - x.startTimeSec) / bar).toBeLessThanOrEqual(16.5));
  });
  it('calls them verses: nothing stands out as a hook', () => {
    expect(r.sections.filter(x => x.type === 'hook')).toHaveLength(0);
  });
});

describe('short clips and bad input', () => {
  it('a loop under 14 s is one section', () => {
    const { pcm } = renderSong([{ name: 'verse', bars: 4, chords: LOOP, drums: true, lead: false, gain: 1 }]);
    const r = analyzeStructure(pcm, SR);
    expect(r.sections).toHaveLength(1);
  });
  it('silence does not throw', () => {
    expect(analyzeStructure(new Float32Array(SR * 20), SR).sections.length).toBeGreaterThanOrEqual(1);
  });
  it('non-finite samples are treated as silence', () => {
    const { pcm } = renderSong(BOOMBAP.slice(0, 3), 90);
    pcm[5000] = NaN;
    pcm[90000] = Infinity;
    const r = analyzeStructure(pcm, SR);
    expect(r.sections.length).toBeGreaterThan(1);
    expect(r.sections.every(x => Number.isFinite(x.startTimeSec) && Number.isFinite(x.endTimeSec))).toBe(true);
  });
  it('runs in a few seconds for a 3-minute beat', () => {
    const { pcm } = renderSong(TRAP, 140);
    const t0 = performance.now();
    analyzeStructure(pcm, SR);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});

describe('beat grid helpers', () => {
  it('fits a constant tempo through jittered beats and ignores an outlier', () => {
    const beats = Array.from({ length: 64 }, (_, i) => 0.31 + i * 0.6 + (i % 3 === 0 ? 0.004 : -0.003));
    beats[20] += 0.2;
    const fit = fitConstantGrid(beats, 98);
    expect(fit.bpm).toBeCloseTo(100, 1);
    expect(fit.confidence).toBeGreaterThan(0.9);
  });
  it('snaps near-whole BPM values only', () => {
    expect(tidyBpm(92.03)).toBe(92);
    expect(tidyBpm(92.3)).toBe(92.3);
  });
});

describe('naming rules', () => {
  const base = {
    bars: [8, 16, 16, 16, 16, 8, 16, 8],
    starts: [0, 14, 41, 69, 96, 123, 137, 164],
    ends: [14, 41, 69, 96, 123, 137, 164, 178],
    durationSec: 178,
  };
  it('loud repeated loop = Hook, the other repeated loop = Verse, one-off late = Bridge, quiet edges = Intro/Outro', () => {
    const types = nameBeatSections({ ...base, groups: [0, 1, 2, 1, 2, 3, 1, 4], fullness: [-1.6, 1.1, 0, 1.1, 0, -0.6, 1.1, -1.9] });
    expect(types).toEqual(['intro', 'hook', 'verse', 'hook', 'verse', 'bridge', 'hook', 'outro']);
  });
  it('a beat that drops full at 0:00 has no Intro: bar 1 is the first section', () => {
    const types = nameBeatSections({ ...base, groups: [1, 2, 1, 2, 1, 3, 1, 4], fullness: [1.1, 0, 1.1, 0, 1.1, -0.6, 1.1, -1.9] });
    expect(types[0]).toBe('hook');
    expect(types[7]).toBe('outro');
  });
  it('no hook straight after a hook, except a double hook that closes the beat', () => {
    const types = nameBeatSections({ ...base, groups: [0, 1, 1, 2, 1, 2, 1, 1], fullness: [-1.6, 1.1, 1.0, 0, 1.1, 0, 1.1, 1.0] });
    expect(types.slice(1, 3)).toContain('verse');
    expect(types.slice(6)).toEqual(['hook', 'hook']);
  });
  it('splits one loop into verse and hook groups when part of it is clearly fuller', () => {
    expect(splitByFullness([0, 1, 1, 1, 1, 2], [-1.5, 0.9, 0.1, 0.9, 0.1, -1.6])).toEqual([0, 3, 1, 3, 1, 2]);
    expect(splitByFullness([0, 1, 1, 1, 1, 2], [-1.5, 0.3, 0.2, 0.3, 0.2, -1.6])).toEqual([0, 1, 1, 1, 1, 2]);
  });
  it('no Hook when the repeated loops are equally full', () => {
    const types = nameBeatSections({ ...base, groups: [0, 1, 2, 1, 2, 1, 2, 3], fullness: [-1.6, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, -1.9] });
    expect(types.filter(t => t === 'hook')).toHaveLength(0);
  });
  it('joins neighbouring blocks of the same loop up to 16 bars', () => {
    const segs = [{ start: 0, end: 32 }, { start: 32, end: 64 }, { start: 64, end: 96 }, { start: 96, end: 160 }];
    const r = mergeRepeats(segs, [0, 1, 1, 2], [8, 8, 8, 16]);
    expect(r.segs).toEqual([{ start: 0, end: 32 }, { start: 32, end: 96 }, { start: 96, end: 160 }]);
    expect(r.groups).toEqual([0, 1, 2]);
    expect(mergeRepeats(segs, [0, 1, 1, 1], [8, 8, 8, 16]).segs).toHaveLength(3);
  });
  it('titles: verses numbered, hooks keep their name', () => {
    expect(titleSections(['intro', 'hook', 'verse', 'hook', 'verse', 'bridge', 'outro'])).toEqual(['Intro', 'Hook', 'Verse 1', 'Hook', 'Verse 2', 'Bridge', 'Outro']);
  });
});

describe('lyrics mark the hook', () => {
  const hook = 'we light it up tonight\nnever coming down\nwe light it up tonight';
  it('finds the sections whose lines repeat', () => {
    expect(hookFromRepeatedLyrics(['walking home alone\nstreetlights hum', hook, 'rain keeps falling down\npain is all I found', hook.toUpperCase() + '!'])).toEqual([1, 3]);
    expect(hookFromRepeatedLyrics(['one two three', 'four five six'])).toEqual([]);
  });
  it('renames repeated-lyric sections to Hook, reading take transcripts too', () => {
    const sections = [
      { text: 'walking home alone\nstreetlights hum', type: 'verse' as SectionType },
      { text: '', type: 'verse' as SectionType, voiceNotes: [{ transcript: hook }] },
      { text: 'rain keeps falling down\npain is all I found', type: 'verse' as SectionType },
      { text: hook, type: 'bridge' as SectionType },
    ];
    const { sections: out, changed } = markRepeatedLyricsAsHook(sections);
    expect(changed).toBe(2);
    expect(out.map(x => x.type)).toEqual(['verse', 'hook', 'verse', 'hook']);
    const noRepeats = [sections[0], sections[2]];
    expect(markRepeatedLyricsAsHook(noRepeats).sections).toBe(noRepeats);
  });
});

describe('cached arrangements', () => {
  it('a structure result of the current version is final; drafts and older versions are not', () => {
    const r = analyzeStructure(renderSong(BOOMBAP.slice(0, 3), 90).pcm, SR);
    const a = toBeatAnalysis(r);
    expect(a.source).toBe('local-structure');
    expect(isFinalArrangement(a)).toBe(true);
    expect(isFinalArrangement({ ...a, version: STRUCTURE_VERSION - 1 })).toBe(false);
    expect(isFinalArrangement({ source: 'local-energy', sections: a.sections })).toBe(false);
    expect(isFinalArrangement(undefined)).toBe(false);
  });
});
