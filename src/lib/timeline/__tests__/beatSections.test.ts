import { describe, it, expect } from 'vitest';
import {
    analyzeBeatStructure,
    detectBpmFromChannelData,
    segmentBars,
    labelSegments,
    evenStructure,
    foldBpm,
    computePeaks,
    type BarFeatures,
} from '../beatSections';

const SR = 22050;

interface SynthSection {
    bars: number;
    /** Overall level multiplier. */
    level: number;
    /** Extra hi-hat hits per beat (0 = just the kick/snare). */
    hats: number;
}

/**
 * A drum-machine-ish track at a given tempo: kick on beat 1 (strongest),
 * snare on 3, optional hats. Section loudness/density differ so the analyser
 * has real structure to find.
 */
function synthBeat(bpm: number, sections: SynthSection[], leadInSec = 0): { samples: Float32Array; boundariesSec: number[] } {
    const beatSec = 60 / bpm;
    const barSec = beatSec * 4;
    const totalBars = sections.reduce((a, s) => a + s.bars, 0);
    const out = new Float32Array(Math.ceil((leadInSec + totalBars * barSec) * SR));
    const boundaries: number[] = [];

    const hit = (timeSec: number, freq: number, amp: number, decay: number, len = 0.12) => {
        const start = Math.round(timeSec * SR);
        const n = Math.round(len * SR);
        for (let i = 0; i < n && start + i < out.length; i++) {
            const t = i / SR;
            out[start + i] += amp * Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / decay);
        }
    };

    let bar = 0;
    let acc = 0;
    for (const s of sections) {
        boundaries.push(leadInSec + acc * barSec);
        for (let b = 0; b < s.bars; b++, bar++) {
            const barStart = leadInSec + bar * barSec;
            hit(barStart, 60, 0.9 * s.level, 0.05); // kick on 1
            hit(barStart + beatSec * 2, 180, 0.6 * s.level, 0.04); // snare on 3
            // A tick on every beat, as in a real groove (a hit only every 2 beats would read as half tempo).
            hit(barStart + beatSec, 2500, 0.3 * s.level, 0.015, 0.05);
            hit(barStart + beatSec * 3, 2500, 0.3 * s.level, 0.015, 0.05);
            for (let beat = 0; beat < 4; beat++) {
                for (let h = 0; h < s.hats; h++) {
                    hit(barStart + beat * beatSec + (h + 1) * (beatSec / (s.hats + 1)), 6000, 0.25 * s.level, 0.01, 0.04);
                }
            }
        }
        acc += s.bars;
    }
    return { samples: out, boundariesSec: boundaries };
}

describe('detectBpmFromChannelData', () => {
    it('reads a plain 100 BPM beat', () => {
        const { samples } = synthBeat(100, [{ bars: 16, level: 1, hats: 0 }]);
        const est = detectBpmFromChannelData(samples, SR);
        expect(est).not.toBeNull();
        expect(Math.abs(est!.bpm - 100)).toBeLessThanOrEqual(2);
    });

    it('returns null for silence rather than inventing a tempo', () => {
        expect(detectBpmFromChannelData(new Float32Array(SR * 20), SR)).toBeNull();
    });

    it('returns null for audio that is too short', () => {
        expect(detectBpmFromChannelData(new Float32Array(SR * 2), SR)).toBeNull();
    });
});

describe('segmentBars', () => {
    const bar = (rms: number, onsetRate = rms, brightness = rms): BarFeatures => ({ rms, onsetRate, brightness });
    const run = (n: number, v: number) => Array.from({ length: n }, () => bar(v));

    it('places boundaries where the music changes, on 4/8-bar phrases', () => {
        const bars = [...run(4, 0.1), ...run(8, 0.4), ...run(8, 0.9), ...run(8, 0.4), ...run(8, 0.9), ...run(4, 0.1)];
        expect(segmentBars(bars)).toEqual([4, 8, 8, 8, 8, 4]);
    });

    it('does not invent boundaries in a uniform track', () => {
        const lens = segmentBars(run(32, 0.5));
        expect(lens.reduce((a, b) => a + b, 0)).toBe(32);
        expect(lens.length).toBeLessThanOrEqual(2);
    });

    it('always sums to the bar count', () => {
        for (const n of [1, 3, 5, 13, 21, 37]) {
            const bars = Array.from({ length: n }, (_, i) => bar(0.2 + 0.6 * ((i >> 2) % 2)));
            expect(segmentBars(bars).reduce((a, b) => a + b, 0)).toBe(n);
        }
    });

    it('handles empty input', () => {
        expect(segmentBars([])).toEqual([]);
    });
});

describe('labelSegments', () => {
    it('calls the loudest segments choruses, quiet bookends intro/outro', () => {
        const labels = labelSegments([
            { bars: 4, rms: 0.1 },
            { bars: 8, rms: 0.4 },
            { bars: 8, rms: 0.9 },
            { bars: 8, rms: 0.4 },
            { bars: 8, rms: 0.9 },
            { bars: 4, rms: 0.1 },
        ]);
        expect(labels.map(l => l.type)).toEqual(['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro']);
        expect(labels[2].energy).toBe('high');
        expect(labels[0].energy).toBe('low');
    });

    it('handles a single segment', () => {
        expect(labelSegments([{ bars: 8, rms: 0.5 }])).toHaveLength(1);
        expect(labelSegments([])).toEqual([]);
    });
});

describe('analyzeBeatStructure', () => {
    const layout: SynthSection[] = [
        { bars: 4, level: 0.35, hats: 0 }, // intro
        { bars: 8, level: 0.6, hats: 1 }, // verse
        { bars: 8, level: 1.0, hats: 3 }, // chorus
        { bars: 8, level: 0.6, hats: 1 }, // verse
        { bars: 8, level: 1.0, hats: 3 }, // chorus
        { bars: 4, level: 0.35, hats: 0 }, // outro
    ];

    it('finds the tempo and the section boundaries of a synthetic song', () => {
        const { samples, boundariesSec } = synthBeat(100, layout);
        const result = analyzeBeatStructure(samples, SR);
        expect(result.method).toBe('audio');
        expect(Math.abs(result.bpm! - 100)).toBeLessThanOrEqual(1);
        expect(result.segments).toHaveLength(layout.length);

        // Every detected boundary lands within 100 ms of the truth.
        result.segments.forEach((seg, i) => {
            expect(Math.abs(seg.startSec - (i === 0 ? 0 : boundariesSec[i]))).toBeLessThan(0.1);
        });
        expect(result.segments.map(s => s.type)).toEqual(['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro']);
    });

    for (const bpm of [72, 85, 93.7, 110, 128, 140, 150]) {
        it(`finds the same structure at ${bpm} BPM`, () => {
            const { samples, boundariesSec } = synthBeat(bpm, layout);
            const result = analyzeBeatStructure(samples, SR);
            expect(result.method).toBe('audio');
            // Tempo may come back as half or double time; the boundaries are the contract.
            const ratio = result.bpm! / bpm;
            expect([0.5, 1, 2].some(r => Math.abs(ratio - r) < 0.01 * r)).toBe(true);
            expect(result.segments).toHaveLength(layout.length);
            result.segments.forEach((seg, i) => {
                expect(Math.abs(seg.startSec - (i === 0 ? 0 : boundariesSec[i]))).toBeLessThan(0.15);
            });
            expect(result.segments.map(x => x.type)).toEqual(['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro']);
        });
    }

    it('keeps the bar grid locked on a fractional tempo over a long track (no drift)', () => {
        const long: SynthSection[] = [
            { bars: 8, level: 0.5, hats: 0 },
            { bars: 16, level: 1, hats: 2 },
            { bars: 16, level: 0.5, hats: 0 },
            { bars: 16, level: 1, hats: 2 },
            { bars: 8, level: 0.5, hats: 0 },
        ];
        const { samples, boundariesSec } = synthBeat(93.7, long);
        const result = analyzeBeatStructure(samples, SR);
        expect(result.method).toBe('audio');
        // The final boundary is ~2.5 minutes in; a 0.3 BPM error would be ~0.5 s off.
        const lastBoundary = boundariesSec[boundariesSec.length - 1];
        const found = result.segments[result.segments.length - 1].startSec;
        expect(Math.abs(found - lastBoundary)).toBeLessThan(0.15);
    });

    it('is not thrown off by a lead-in before the first downbeat', () => {
        const { samples, boundariesSec } = synthBeat(100, layout, 0.9);
        const result = analyzeBeatStructure(samples, SR);
        expect(result.method).toBe('audio');
        const mid = result.segments[2];
        expect(Math.abs(mid.startSec - boundariesSec[2])).toBeLessThan(0.15);
    });

    it('produces contiguous, ordered segments covering the whole track', () => {
        const { samples } = synthBeat(120, layout);
        const result = analyzeBeatStructure(samples, SR);
        expect(result.segments[0].startSec).toBe(0);
        expect(result.segments[result.segments.length - 1].endSec).toBeCloseTo(samples.length / SR, 2);
        for (let i = 1; i < result.segments.length; i++) {
            expect(result.segments[i].startSec).toBeCloseTo(result.segments[i - 1].endSec, 2);
        }
    });

    it('falls back to an honest even split when there is no tempo', () => {
        const result = analyzeBeatStructure(new Float32Array(SR * 90), SR);
        expect(result.method).toBe('even');
        expect(result.confidence).toBe(0);
        expect(result.segments.length).toBeGreaterThanOrEqual(2);
        expect(result.segments[result.segments.length - 1].endSec).toBeCloseTo(90, 5);
    });

    it('survives an empty buffer', () => {
        const result = analyzeBeatStructure(new Float32Array(0), SR);
        expect(result.segments).toEqual([]);
    });
});

describe('foldBpm', () => {
    it('folds into 76-152', () => {
        expect(foldBpm(70)).toBe(140);
        expect(foldBpm(180)).toBe(90);
        expect(foldBpm(100)).toBe(100);
        expect(foldBpm(75)).toBe(150);
    });
});

describe('evenStructure', () => {
    it('covers the duration with contiguous segments', () => {
        const s = evenStructure(200, 100);
        expect(s.segments[0].startSec).toBe(0);
        expect(s.segments[s.segments.length - 1].endSec).toBeCloseTo(200, 5);
        for (let i = 1; i < s.segments.length; i++) expect(s.segments[i].startSec).toBeCloseTo(s.segments[i - 1].endSec, 9);
    });
});

describe('computePeaks', () => {
    it('normalizes to 0..1', () => {
        const peaks = computePeaks(Float32Array.from([0, 0.5, -1, 0.25, 0, 0, 0.1, 0]), 4);
        expect(Math.max(...peaks)).toBe(1);
        expect(peaks).toHaveLength(4);
    });
    it('is all zeros for silence', () => {
        expect(computePeaks(new Float32Array(100), 5)).toEqual([0, 0, 0, 0, 0]);
    });
});
