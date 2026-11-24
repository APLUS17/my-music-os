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
    insertSectionAfter,
    deleteSectionAt,
    reorderSections,
    getMinSectionSec,
    hasExplicitTimings,
    hasUserEdits,
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
    it('pulls to a bar line when close, and leaves the time alone when far', () => {
        const grid = { gridStartSec: 0.5, barSec: 2 };
        expect(snapToBar(3.1, grid)).toBeCloseTo(2.5, 9);   // 0.6 s away: within tolerance (0.7 s)
        expect(snapToBar(3.6, grid)).toBe(3.6);             // 0.9 s from either bar: free
        expect(snapToBar(4.4, grid)).toBeCloseTo(4.5, 9);
        expect(snapToBar(3.3, null)).toBe(3.3);
    });
    it('respects an explicit tolerance', () => {
        const grid = { gridStartSec: 0, barSec: 2.4 };
        expect(snapToBar(2.5, grid, 0.05)).toBe(2.5);
        expect(snapToBar(2.5, grid, 0.2)).toBeCloseTo(2.4, 9);
    });
    it('never snaps below zero', () => {
        expect(snapToBar(0.1, { gridStartSec: 0.4, barSec: 2 })).toBeGreaterThanOrEqual(0);
    });
    it('detects a blank song', () => {
        expect(isBlankSongStructure([s('a'), s('b', '  ')])).toBe(true);
        expect(isBlankSongStructure([s('a'), s('b', 'x')])).toBe(false);
    });
    it('clears timings', () => {
        expect(times(clearTimings([s('a', '', 1, 2)]))).toEqual([[undefined, undefined]]);
    });
});


/** The song must always be covered end to end: no gap, overlap or zero-width section. */
function expectWholeTimeline(secs: LyricSection[], total: number) {
    expect(secs.length).toBeGreaterThan(0);
    expect(secs[0].startTimeSec).toBe(0);
    expect(secs[secs.length - 1].endTimeSec).toBeCloseTo(total, 3);
    secs.forEach((x, i) => {
        expect(x.endTimeSec! - x.startTimeSec!).toBeGreaterThan(0);
        if (i > 0) expect(x.startTimeSec).toBeCloseTo(secs[i - 1].endTimeSec!, 3);
    });
}

describe('getMinSectionSec', () => {
    it('is one bar clamped to 1-2 s', () => {
        expect(getMinSectionSec(null)).toBe(1);
        expect(getMinSectionSec({ gridStartSec: 0, barSec: 1.5 })).toBe(1.5);
        expect(getMinSectionSec({ gridStartSec: 0, barSec: 2.4 })).toBe(2);
        expect(getMinSectionSec({ gridStartSec: 0, barSec: 0.5 })).toBe(1);
    });
});

describe('insertSectionAfter', () => {
    const timed = () => [s('a', 'one', 0, 30), s('b', 'two', 30, 60), s('c', 'three', 60, 100)];
    const fresh = (id = 'new') => s(id, '');

    it('splits the target so the timeline stays whole (the bug: a trailing section used to get zero width)', () => {
        const out = insertSectionAfter(timed(), 2, fresh(), 100);
        expect(out.map(x => x.id)).toEqual(['a', 'b', 'c', 'new']);
        expectWholeTimeline(out, 100);
        expect(out[3].endTimeSec! - out[3].startTimeSec!).toBeGreaterThan(5);
    });
    it('inserts in the middle without touching other sections', () => {
        const out = insertSectionAfter(timed(), 0, fresh(), 100);
        expect(out.map(x => x.id)).toEqual(['a', 'new', 'b', 'c']);
        expectWholeTimeline(out, 100);
        expect(out[2]).toMatchObject({ id: 'b', startTimeSec: 30, endTimeSec: 60 });
        expect(out[0].text).toBe('one');
    });
    it('puts the split on a bar line when one is near the midpoint', () => {
        const grid = { gridStartSec: 0, barSec: 2.4 };
        const out = insertSectionAfter([s('a', '', 0, 30)], 0, fresh(), 30, grid);
        expect(out[1].startTimeSec! / 2.4).toBeCloseTo(Math.round(out[1].startTimeSec! / 2.4), 2);
    });
    it('borrows from neighbours when the target is too short to split', () => {
        const out = insertSectionAfter([s('a', '', 0, 1.5), s('b', '', 1.5, 20)], 0, fresh(), 20, { gridStartSec: 0, barSec: 2 });
        expectWholeTimeline(out, 20);
        out.forEach(x => expect(x.endTimeSec! - x.startTimeSec!).toBeGreaterThanOrEqual(1));
    });
    it('shares the song evenly when everything is already packed at minimum width', () => {
        const packed = [s('a', '', 0, 1), s('b', '', 1, 2), s('c', '', 2, 3)];
        const out = insertSectionAfter(packed, 1, fresh(), 3);
        expect(out).toHaveLength(4);
        expectWholeTimeline(out, 3);
    });
    it('keeps an untimed song untimed', () => {
        const out = insertSectionAfter([s('a', 'x'), s('b', 'y')], 0, fresh(), 100);
        expect(out.map(x => x.id)).toEqual(['a', 'new', 'b']);
        expect(hasExplicitTimings(out)).toBe(false);
    });
    it('keeps a timed song untimed-safe when there is no audio duration', () => {
        const out = insertSectionAfter(timed(), 0, fresh(), 0);
        expect(out).toHaveLength(4);
        expect(out[1].startTimeSec).toBeUndefined();
    });
    it('marks touched sections as user-modified', () => {
        const out = insertSectionAfter(timed(), 1, fresh(), 100);
        expect(out.find(x => x.id === 'new')!.isUserModified).toBe(true);
        expect(out.find(x => x.id === 'b')!.isUserModified).toBe(true);
    });
    it('copes with an out-of-range index by appending', () => {
        const out = insertSectionAfter(timed(), 99, fresh(), 100);
        expect(out[out.length - 1].id).toBe('new');
        expectWholeTimeline(out, 100);
    });
});

describe('deleteSectionAt', () => {
    const blank = s('blank', '');
    const timed = () => [s('a', 'one', 0, 30), s('b', 'two', 30, 60), s('c', 'three', 60, 100)];

    it('gives a deleted middle section to its predecessor (the bug: this used to leave a gap)', () => {
        const out = deleteSectionAt(timed(), 1, 100, blank);
        expect(out.map(x => x.id)).toEqual(['a', 'c']);
        expectWholeTimeline(out, 100);
        expect(out[0].endTimeSec).toBe(60);
    });
    it('gives a deleted first section to the next one', () => {
        const out = deleteSectionAt(timed(), 0, 100, blank);
        expect(out.map(x => x.id)).toEqual(['b', 'c']);
        expectWholeTimeline(out, 100);
        expect(out[0].startTimeSec).toBe(0);
    });
    it('gives a deleted last section to the one before', () => {
        const out = deleteSectionAt(timed(), 2, 100, blank);
        expectWholeTimeline(out, 100);
        expect(out[out.length - 1].endTimeSec).toBe(100);
    });
    it('replaces the only section with a blank one spanning the song', () => {
        const out = deleteSectionAt([s('a', 'x', 0, 100)], 0, 100, blank);
        expect(out).toEqual([{ ...blank, startTimeSec: 0, endTimeSec: 100 }]);
    });
    it('a lone untimed section becomes a blank untimed one', () => {
        const out = deleteSectionAt([s('a', 'x')], 0, 100, blank);
        expect(out[0].startTimeSec).toBeUndefined();
    });
    it('ignores a bad index', () => {
        const input = timed();
        expect(deleteSectionAt(input, 7, 100, blank)).toBe(input);
    });
    it('does not touch text', () => {
        const out = deleteSectionAt(timed(), 1, 100, blank);
        expect(out.map(x => x.text)).toEqual(['one', 'three']);
    });
});

describe('reorderSections', () => {
    const prev = [s('a', '', 0, 20), s('b', '', 20, 50), s('c', '', 50, 100)];

    it('moves each section with its own length and lays them end to end', () => {
        const out = reorderSections([prev[2], prev[0], prev[1]], prev, 100);
        expect(out.map(x => x.id)).toEqual(['c', 'a', 'b']);
        expectWholeTimeline(out, 100);
        expect(out[0].endTimeSec).toBe(50);                      // c keeps its 50 s
        expect(out[1].endTimeSec! - out[1].startTimeSec!).toBeCloseTo(20, 3);
        expect(out[2].endTimeSec! - out[2].startTimeSec!).toBeCloseTo(30, 3);
    });
    it('leaves an untimed song alone (no times invented)', () => {
        const untimed = [s('a', 'x'), s('b', 'y')];
        const out = reorderSections([untimed[1], untimed[0]], untimed, 100);
        expect(hasExplicitTimings(out)).toBe(false);
        expect(out.map(x => x.id)).toEqual(['b', 'a']);
    });
    it('is a no-op on timing for an unchanged order apart from the modified flag', () => {
        const out = reorderSections(prev, prev, 100);
        expectWholeTimeline(out, 100);
        expect(out.map(x => [x.startTimeSec, x.endTimeSec])).toEqual([[0, 20], [20, 50], [50, 100]]);
    });
    it('handles a section that did not exist before', () => {
        const out = reorderSections([...prev, s('d', '')], prev, 100);
        expectWholeTimeline(out, 100);
    });
});

describe('hasUserEdits', () => {
    it('reflects the flag', () => {
        expect(hasUserEdits([s('a'), s('b')])).toBe(false);
        expect(hasUserEdits([s('a'), { ...s('b'), isUserModified: true }])).toBe(true);
    });
});

describe('manual edits are remembered', () => {
    it('drag, split and merge all flag the sections they touch', () => {
        const base = [s('a', '', 0, 30), s('b', '', 30, 60)];
        expect(moveBoundary(base, 1, 40, 60).every(x => x.isUserModified)).toBe(true);
        expect(splitSectionAt(base, 10, 60, 'n').find(x => x.id === 'n')!.isUserModified).toBe(true);
        expect(mergeWithNext(base, 0, 60)[0].isUserModified).toBe(true);
    });
    it('a fresh detection clears the flag', () => {
        const segs = [{ type: 'verse' as const, startSec: 0, endSec: 60, bars: 8, energy: 'medium' as const, rms: 0.5 }];
        const out = applyBeatSegments([{ ...s('a', 'x'), isUserModified: true }], segs, 60, () => 'g');
        expect(out[0].isUserModified).toBe(false);
    });
});
