import { describe, it, expect } from 'vitest';
import type { LyricSection } from '@/types';
import {
    materializeTimings,
    moveBoundary,
    splitSectionAt,
    mergeWithNext,
    applyBeatSegments,
    snapToBar,
    isBlankSongStructure,
    clearTimings,
} from '../sectionEdit';
import type { BeatSegment } from '../beatSections';

const s = (id: string, text = '', start?: number, end?: number): LyricSection => ({
    id, type: 'verse', repeats: 1, text, startTimeSec: start, endTimeSec: end,
});
const times = (secs: LyricSection[]) => secs.map(x => [x.startTimeSec, x.endTimeSec]);

describe('materializeTimings', () => {
    it('gives every section explicit times', () => {
        expect(times(materializeTimings([s('a'), s('b')], 60))).toEqual([[0, 30], [30, 60]]);
    });
});

describe('moveBoundary', () => {
    const base = [s('a', '', 0, 30), s('b', '', 30, 60)];
    it('moves the shared boundary', () => {
        expect(times(moveBoundary(base, 1, 40, 60))).toEqual([[0, 40], [40, 60]]);
    });
    it('clamps so neither neighbour shrinks below the minimum', () => {
        expect(times(moveBoundary(base, 1, 0, 60, 2))).toEqual([[0, 2], [2, 60]]);
        expect(times(moveBoundary(base, 1, 999, 60, 2))).toEqual([[0, 58], [58, 60]]);
    });
    it('ignores the outer edges', () => {
        expect(moveBoundary(base, 0, 10, 60)).toBe(base);
        expect(moveBoundary(base, 2, 10, 60)).toBe(base);
    });
    it('does not touch other sections', () => {
        const three = [s('a', '', 0, 20), s('b', '', 20, 40), s('c', '', 40, 60)];
        const out = moveBoundary(three, 1, 25, 60);
        expect(times(out)).toEqual([[0, 25], [25, 40], [40, 60]]);
    });
});

describe('splitSectionAt', () => {
    it('splits the containing section, keeping text on the first half', () => {
        const out = splitSectionAt([s('a', 'hello', 0, 40), s('b', 'x', 40, 60)], 15, 60, 'new');
        expect(out.map(x => x.id)).toEqual(['a', 'new', 'b']);
        expect(times(out)).toEqual([[0, 15], [15, 40], [40, 60]]);
        expect(out[0].text).toBe('hello');
        expect(out[1].text).toBe('');
    });
    it('refuses to create a sliver', () => {
        const input = [s('a', '', 0, 40)];
        expect(splitSectionAt(input, 0.2, 40, 'n')).toBe(input);
        expect(splitSectionAt(input, 39.6, 40, 'n')).toBe(input);
    });
});

describe('mergeWithNext', () => {
    it('joins text and spans both times', () => {
        const out = mergeWithNext([s('a', 'one', 0, 10), s('b', 'two', 10, 20), s('c', '', 20, 30)], 0, 30);
        expect(out).toHaveLength(2);
        expect(out[0].text).toBe('one\ntwo');
        expect(times(out)).toEqual([[0, 20], [20, 30]]);
    });
    it('does nothing on the last section', () => {
        const input = [s('a', '', 0, 10)];
        expect(mergeWithNext(input, 0, 10)).toBe(input);
    });
    it('does not leave a blank line when one side is empty', () => {
        const out = mergeWithNext([s('a', '', 0, 10), s('b', 'two', 10, 20)], 0, 20);
        expect(out[0].text).toBe('two');
    });
});

describe('applyBeatSegments', () => {
    const seg = (type: BeatSegment['type'], startSec: number, endSec: number): BeatSegment => ({
        type, startSec, endSec, bars: 4, energy: 'medium', rms: 0.5,
    });
    const segs = [seg('intro', 0, 10), seg('verse', 10, 30), seg('chorus', 30, 50)];
    let n = 0;
    const id = () => `gen-${++n}`;

    it('builds sections from the analysis when the song is blank', () => {
        const out = applyBeatSegments([s('x'), s('y')], segs, 50, id);
        expect(out.map(x => x.type)).toEqual(['intro', 'verse', 'chorus']);
        expect(times(out)).toEqual([[0, 10], [10, 30], [30, 50]]);
    });

    it('keeps lyrics and order when the song has text, taking times by position', () => {
        const out = applyBeatSegments([s('a', 'first'), s('b', 'second'), s('c', 'third')], segs, 50, id);
        expect(out.map(x => x.text)).toEqual(['first', 'second', 'third']);
        expect(times(out)).toEqual([[0, 10], [10, 30], [30, 50]]);
        expect(out.map(x => x.id)).toEqual(['a', 'b', 'c']);
    });

    it('adds empty sections when the beat has more segments than the song', () => {
        const out = applyBeatSegments([s('a', 'only')], segs, 50, id);
        expect(out).toHaveLength(3);
        expect(out[0].text).toBe('only');
        expect(out[1].text).toBe('');
        expect(times(out)).toEqual([[0, 10], [10, 30], [30, 50]]);
    });

    it('never drops lyrics when the song has more sections than the beat has segments', () => {
        const input = [s('a', '1'), s('b', '2'), s('c', '3'), s('d', '4'), s('e', '5')];
        const out = applyBeatSegments(input, segs, 50, id);
        expect(out.map(x => x.text)).toEqual(['1', '2', '3', '4', '5']);
        for (let i = 1; i < out.length; i++) expect(out[i].startTimeSec).toBeGreaterThanOrEqual(out[i - 1].endTimeSec!);
        expect(out[out.length - 1].endTimeSec).toBe(50);
    });

    it('returns the input when there is nothing to apply', () => {
        const input = [s('a', 'x')];
        expect(applyBeatSegments(input, [], 50, id)).toBe(input);
    });
});

describe('misc', () => {
    it('snaps to the nearest bar line', () => {
        const grid = { gridStartSec: 0.5, barSec: 2 };
        expect(snapToBar(3.1, grid)).toBeCloseTo(2.5, 9);
        expect(snapToBar(3.6, grid)).toBeCloseTo(4.5, 9);
        expect(snapToBar(3.3, null)).toBe(3.3);
    });
    it('detects a blank song', () => {
        expect(isBlankSongStructure([s('a'), s('b', '  ')])).toBe(true);
        expect(isBlankSongStructure([s('a'), s('b', 'x')])).toBe(false);
    });
    it('clears timings', () => {
        expect(times(clearTimings([s('a', '', 1, 2)]))).toEqual([[undefined, undefined]]);
    });
});
