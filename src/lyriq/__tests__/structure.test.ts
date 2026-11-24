// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { analyzeStructure, markRepeatedLyricsAsChorus, chorusFromRepeatedLyrics, titleSections } from '../utils/structure';
import { fitConstantGrid, tidyBpm } from '../utils/structure/beats';
import { predictLabels, segmentFeatures, FEATURE_NAMES, LABEL_WEIGHTS } from '../utils/structure/labelModel';
import { isFinalArrangement, toBeatAnalysis, STRUCTURE_VERSION } from '../services/structureAnalysis';
import type { SectionType } from '../types';

const SR = 11025;
const BPM = 100;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

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
function renderSong(parts: Part[]): { pcm: Float32Array; starts: number[] } {
  const totalBars = parts.reduce((s, p) => s + p.bars, 0);
  const n = Math.ceil(totalBars * BAR * SR) + SR;
  const pcm = new Float32Array(n);
  const noise = lcg(7);
  const starts: number[] = [];
  let bar0 = 0;
  for (const part of parts) {
    starts.push(bar0 * BAR);
    for (let b = 0; b < part.bars; b++) {
      const chord = part.chords[b % part.chords.length];
      const t0 = (bar0 + b) * BAR;
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
  return { pcm, starts };
}

const VERSE = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const CHORUS = [[53, 57, 60], [55, 59, 62], [57, 60, 64], [52, 56, 59]]; // F G Am E
const BRIDGE = [[50, 53, 57], [52, 55, 59]]; // Dm Em

const SONG: Part[] = [
  { name: 'intro', bars: 4, chords: VERSE, drums: false, lead: false, gain: 0.6 },
  { name: 'verse', bars: 8, chords: VERSE, drums: true, lead: false, gain: 0.8 },
  { name: 'chorus', bars: 8, chords: CHORUS, drums: true, lead: true, gain: 1 },
  { name: 'verse', bars: 8, chords: VERSE, drums: true, lead: false, gain: 0.8 },
  { name: 'chorus', bars: 8, chords: CHORUS, drums: true, lead: true, gain: 1 },
  { name: 'bridge', bars: 8, chords: BRIDGE, drums: false, lead: true, gain: 0.7 },
  { name: 'chorus', bars: 8, chords: CHORUS, drums: true, lead: true, gain: 1 },
  { name: 'outro', bars: 4, chords: VERSE, drums: false, lead: false, gain: 0.5 },
];

describe('analyzeStructure on a synthetic song with known sections', () => {
  const { pcm, starts } = renderSong(SONG);
  const r = analyzeStructure(pcm, SR);
  it('finds the tempo (or its double/half) and a confident constant grid', () => {
    const ratio = r.bpm / BPM;
    expect([0.5, 1, 2].some(k => Math.abs(ratio - k) < 0.01)).toBe(true);
    expect(r.gridConfidence).toBeGreaterThan(0.8);
  });

  it('places most true section starts within one beat', () => {
    const est = r.sections.slice(1).map(s => s.startTimeSec);
    const truth = starts.slice(1);
    const hit = truth.filter(t => est.some(e => Math.abs(e - t) <= BEAT + 0.05)).length;
    expect(hit / truth.length).toBeGreaterThanOrEqual(0.85);
    // ...without inventing many extra sections.
    expect(r.sections.length).toBeLessThanOrEqual(SONG.length + 3);
  });

  it('gives repeated music the same group, and different music a different one', () => {
    const groupAt = (t: number) => r.groups[r.sections.findIndex(s => t >= s.startTimeSec && t < s.endTimeSec)];
    const mid = (k: number) => starts[k] + SONG[k].bars * BAR * 0.5;
    expect(groupAt(mid(2))).toBe(groupAt(mid(4)));
    expect(groupAt(mid(4))).toBe(groupAt(mid(6)));
    expect(groupAt(mid(1))).toBe(groupAt(mid(3)));
    expect(groupAt(mid(1))).not.toBe(groupAt(mid(2)));
  });

  it('calls the loud repeated part the chorus', () => {
    const typeAt = (t: number) => r.sections.find(s => t >= s.startTimeSec && t < s.endTimeSec)?.type;
    const mid = (k: number) => starts[k] + SONG[k].bars * BAR * 0.5;
    const choruses = [2, 4, 6].filter(k => typeAt(mid(k)) === 'chorus').length;
    expect(choruses).toBeGreaterThanOrEqual(2);
    expect(typeAt(mid(1))).not.toBe('chorus');
  });

  it('covers [0, duration] with contiguous sections', () => {
    expect(r.sections[0].startTimeSec).toBe(0);
    for (let i = 1; i < r.sections.length; i++) expect(r.sections[i].startTimeSec).toBe(r.sections[i - 1].endTimeSec);
    expect(r.sections[r.sections.length - 1].endTimeSec).toBeCloseTo(pcm.length / SR, 2);
  });

  it('runs in a few seconds', () => {
    const t0 = performance.now();
    analyzeStructure(pcm, SR);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});

describe('short clips', () => {
  it('a loop under 14 s is one section', () => {
    const { pcm } = renderSong([{ name: 'verse', bars: 4, chords: VERSE, drums: true, lead: false, gain: 1 }]);
    const r = analyzeStructure(pcm, SR);
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].startTimeSec).toBe(0);
  });

  it('silence does not throw', () => {
    const r = analyzeStructure(new Float32Array(SR * 20), SR);
    expect(r.sections.length).toBeGreaterThanOrEqual(1);
  });

  it('non-finite samples are treated as silence', () => {
    const { pcm } = renderSong(SONG.slice(0, 3));
    pcm[5000] = NaN;
    pcm[90000] = Infinity;
    const r = analyzeStructure(pcm, SR);
    expect(r.sections.length).toBeGreaterThan(1);
    expect(r.sections.every(s => Number.isFinite(s.startTimeSec) && Number.isFinite(s.endTimeSec))).toBe(true);
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

describe('lyrics mark the chorus', () => {
  const hook = 'we light it up tonight\nnever coming down\nwe light it up tonight';
  it('finds the sections whose lines repeat', () => {
    expect(chorusFromRepeatedLyrics(['walking home alone\nstreetlights hum', hook, 'rain keeps falling down\npain is all I found', hook.toUpperCase() + '!'])).toEqual([1, 3]);
    expect(chorusFromRepeatedLyrics(['one two three', 'four five six'])).toEqual([]);
  });

  it('renames repeated-lyric sections, reading take transcripts too', () => {
    const sections = [
      { text: 'walking home alone\nstreetlights hum', type: 'verse' as SectionType },
      { text: '', type: 'verse' as SectionType, voiceNotes: [{ transcript: hook }] },
      { text: 'rain keeps falling down\npain is all I found', type: 'verse' as SectionType },
      { text: hook, type: 'bridge' as SectionType },
    ];
    const { sections: out, changed } = markRepeatedLyricsAsChorus(sections);
    expect(changed).toBe(2);
    expect(out.map(s => s.type)).toEqual(['verse', 'chorus', 'verse', 'chorus']);
    const noRepeats = [sections[0], sections[2]];
    expect(markRepeatedLyricsAsChorus(noRepeats)).toEqual({ sections: noRepeats, changed: 0 });
    expect(markRepeatedLyricsAsChorus(noRepeats).sections).toBe(noRepeats);
  });
});

describe('label model', () => {
  it('has one weight per feature plus a bias for every class', () => {
    for (const row of LABEL_WEIGHTS) expect(row).toHaveLength(FEATURE_NAMES.length + 1);
  });

  it('keeps intro at the start and outro at the end', () => {
    const ctx = {
      groups: [0, 1, 2, 1, 2, 3, 2, 0],
      sim: Array.from({ length: 8 }, () => new Array(8).fill(0)),
      energyDb: [-30, -20, -14, -20, -14, -24, -14, -32],
      bars: [4, 8, 8, 8, 8, 8, 8, 4],
      starts: [0, 10, 30, 50, 70, 90, 110, 130],
      ends: [10, 30, 50, 70, 90, 110, 130, 140],
      durationSec: 140,
      timbre: Array.from({ length: 8 }, () => [0, 0, 0]),
    };
    expect(segmentFeatures(ctx)[0]).toHaveLength(FEATURE_NAMES.length);
    const types = predictLabels(ctx);
    expect(types).toHaveLength(8);
    types.forEach((t, i) => {
      if (t === 'intro') expect(i).toBeLessThanOrEqual(1);
      if (t === 'outro') expect(i).toBeGreaterThanOrEqual(6);
    });
    expect(types.filter(t => t === 'bridge').length).toBeLessThanOrEqual(1);
    // The loud group that repeats three times is the chorus.
    expect([types[2], types[4], types[6]].filter(t => t === 'chorus').length).toBeGreaterThanOrEqual(2);
  });

  it('titles sections', () => {
    expect(titleSections(['intro', 'verse', 'chorus', 'verse', 'chorus', 'pre-chorus'])).toEqual(['Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Chorus 2', 'Pre-Chorus']);
  });
});

describe('cached arrangements', () => {
  it('a structure result of the current version is final; drafts and older versions are not', () => {
    const r = analyzeStructure(renderSong(SONG.slice(0, 3)).pcm, SR);
    const a = toBeatAnalysis(r);
    expect(a.source).toBe('local-structure');
    expect(isFinalArrangement(a)).toBe(true);
    expect(isFinalArrangement({ ...a, version: STRUCTURE_VERSION - 1 })).toBe(false);
    expect(isFinalArrangement({ source: 'local-energy', sections: a.sections })).toBe(false);
    expect(isFinalArrangement(undefined)).toBe(false);
  });
});
