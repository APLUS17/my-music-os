import { describe, it, expect } from 'vitest';
import {
    resolveSectionTimings,
    activeSectionIndex,
    distributeLines,
    pickActiveLine,
    matchPhrasesToLines,
    buildTimedLines,
    toSongTime,
    toMediaTime,
} from '../timeline';

const sec = (id: string, text = '', start?: number, end?: number) => ({ id, text, startTimeSec: start, endTimeSec: end });

describe('resolveSectionTimings', () => {
    it('splits untimed sections evenly', () => {
        const t = resolveSectionTimings([sec('a'), sec('b'), sec('c'), sec('d')], 100);
        expect(t.map(x => [x.start, x.end])).toEqual([[0, 25], [25, 50], [50, 75], [75, 100]]);
    });

    it('keeps explicit times', () => {
        const t = resolveSectionTimings([sec('a', '', 0, 10), sec('b', '', 10, 40)], 100);
        expect(t.map(x => [x.start, x.end])).toEqual([[0, 10], [10, 40]]);
    });

    it('fills untimed runs from the gap between timed neighbours, never overlapping', () => {
        const t = resolveSectionTimings([sec('a', '', 0, 20), sec('b'), sec('c'), sec('d', '', 60, 100)], 100);
        expect(t.map(x => [x.start, x.end])).toEqual([[0, 20], [20, 40], [40, 60], [60, 100]]);
        for (let i = 1; i < t.length; i++) expect(t[i].start).toBeGreaterThanOrEqual(t[i - 1].end);
    });

    it('fills a trailing untimed run to the end of the song', () => {
        const t = resolveSectionTimings([sec('a', '', 0, 30), sec('b'), sec('c')], 90);
        expect(t.map(x => [x.start, x.end])).toEqual([[0, 30], [30, 60], [60, 90]]);
    });

    it('returns zero-width untimed sections when there is no audio duration', () => {
        const t = resolveSectionTimings([sec('a'), sec('b', '', 5, 9)], 0);
        expect(t).toEqual([{ id: 'a', start: 0, end: 0 }, { id: 'b', start: 5, end: 9 }]);
    });

    it('ignores nonsense times (end <= start) and treats the section as untimed', () => {
        const t = resolveSectionTimings([sec('a', '', 10, 10), sec('b')], 40);
        expect(t.map(x => [x.start, x.end])).toEqual([[0, 20], [20, 40]]);
    });
});

describe('activeSectionIndex', () => {
    const timings = [{ id: 'a', start: 0, end: 10 }, { id: 'b', start: 10, end: 20 }];
    it('finds the containing section', () => {
        expect(activeSectionIndex(timings, 0)).toBe(0);
        expect(activeSectionIndex(timings, 9.99)).toBe(0);
        expect(activeSectionIndex(timings, 10)).toBe(1);
    });
    it('sticks to the last section once the song has ended', () => {
        expect(activeSectionIndex(timings, 25)).toBe(1);
    });
    it('is -1 with no sections', () => {
        expect(activeSectionIndex([], 5)).toBe(-1);
    });
});

describe('song time conversion', () => {
    it('adds and removes the take anchor', () => {
        expect(toSongTime(3, 12)).toBe(15);
        expect(toMediaTime(15, 12)).toBe(3);
    });
    it('never returns negative media time and tolerates a missing anchor', () => {
        expect(toMediaTime(2, 12)).toBe(0);
        expect(toSongTime(3, undefined)).toBe(3);
        expect(toMediaTime(3, NaN)).toBe(3);
    });
});

describe('distributeLines', () => {
    it('is monotonic and covers the window', () => {
        const d = distributeLines(['one two three', 'four', 'five six seven eight nine'], 10, 40);
        expect(d[0].startSec).toBe(10);
        expect(d[d.length - 1].endSec).toBeCloseTo(40, 5);
        for (let i = 1; i < d.length; i++) expect(d[i].startSec).toBeCloseTo(d[i - 1].endSec, 9);
    });
    it('gives longer lines more time', () => {
        const d = distributeLines(['hi', 'this is a much longer line of words'], 0, 20);
        expect(d[1].endSec - d[1].startSec).toBeGreaterThan(d[0].endSec - d[0].startSec);
    });
    it('skips blank lines', () => {
        expect(distributeLines(['', '  ', 'x'], 0, 5)).toHaveLength(1);
    });
    it('applies a minimum per line unless told otherwise', () => {
        const withMin = distributeLines(['a', 'b', 'c'], 0, 1);
        expect(withMin[2].endSec).toBeCloseTo(4.5, 5);
        const none = distributeLines(['a', 'b', 'c'], 0, 1, 0);
        expect(none[2].endSec).toBeCloseTo(1, 5);
    });
});

describe('pickActiveLine', () => {
    const lines = [{ startSec: 1 }, { startSec: 5 }, { startSec: 9 }];
    it('is -1 before the first line', () => {
        expect(pickActiveLine(lines, 0.5, 0)).toBe(-1);
    });
    it('holds a line through gaps until the next starts', () => {
        expect(pickActiveLine(lines, 4.9, 0)).toBe(0);
        expect(pickActiveLine(lines, 5, 0)).toBe(1);
        expect(pickActiveLine(lines, 100, 0)).toBe(2);
    });
    it('a negative offset lights lines earlier', () => {
        expect(pickActiveLine(lines, 4.8, -250)).toBe(1);
        expect(pickActiveLine(lines, 4.8, 0)).toBe(0);
    });
    it('a positive offset lights lines later', () => {
        expect(pickActiveLine(lines, 5.1, 250)).toBe(0);
    });
});

describe('matchPhrasesToLines', () => {
    const raw = ['I walk alone tonight', '', "Streetlights don't love me", 'I walk alone tonight'];
    it('matches in order, mapping a repeated line to successive occurrences', () => {
        const m = matchPhrasesToLines(
            [{ text: 'i walk alone tonight' }, { text: 'streetlights dont love me' }, { text: 'I walk alone tonight' }],
            raw
        );
        expect(m).toEqual([0, 2, 3]);
    });
    it('returns -1 for an ad-lib that matches nothing without derailing later lines', () => {
        const m = matchPhrasesToLines(
            [{ text: 'yeah' }, { text: 'i walk alone tonight' }, { text: 'streetlights dont love me' }],
            raw
        );
        expect(m).toEqual([-1, 0, 2]);
    });
});

describe('buildTimedLines', () => {
    const sections = [
        { id: 'v', text: 'line one\nline two\n\nline three' },
        { id: 'c', text: 'chorus a\nchorus b' },
    ];
    const timings = [{ id: 'v', start: 0, end: 30 }, { id: 'c', start: 30, end: 50 }];

    it('estimates times across each section window and skips blank lines', () => {
        const lines = buildTimedLines(sections, timings);
        expect(lines.map(l => l.text)).toEqual(['line one', 'line two', 'line three', 'chorus a', 'chorus b']);
        expect(lines.every(l => l.estimated)).toBe(true);
        expect(lines[0].startSec).toBe(0);
        // blank raw line 2 is skipped but raw indexes are preserved
        expect(lines.map(l => l.lineIndex)).toEqual([0, 1, 3, 0, 1]);
        for (let i = 1; i < lines.length; i++) expect(lines[i].startSec).toBeGreaterThanOrEqual(lines[i - 1].startSec);
        expect(lines[3].startSec).toBeGreaterThanOrEqual(30);
    });

    it('uses measured phrase times where they match, and interpolates the rest', () => {
        const phrases = [
            { text: 'line one', startSec: 2, endSec: 6 },
            { text: 'line three', startSec: 20, endSec: 25 },
        ];
        const lines = buildTimedLines(sections, timings, phrases);
        const v = lines.filter(l => l.sectionId === 'v');
        expect(v[0]).toMatchObject({ startSec: 2, estimated: false });
        expect(v[2]).toMatchObject({ startSec: 20, estimated: false });
        // "line two" had no phrase: it sits between the measured neighbours
        expect(v[1].estimated).toBe(true);
        expect(v[1].startSec).toBeGreaterThanOrEqual(6);
        expect(v[1].startSec).toBeLessThanOrEqual(20);
    });

    it('never runs the highlight backwards even if a phrase is out of order', () => {
        const phrases = [
            { text: 'line three', startSec: 5, endSec: 8 },
            { text: 'line one', startSec: 12, endSec: 14 },
        ];
        const lines = buildTimedLines(sections, timings, phrases);
        for (let i = 1; i < lines.length; i++) expect(lines[i].startSec).toBeGreaterThanOrEqual(lines[i - 1].startSec);
    });

    it('ignores phrases that fall in other sections', () => {
        const lines = buildTimedLines(sections, timings, [{ text: 'chorus a', startSec: 12, endSec: 14 }]);
        const c = lines.filter(l => l.sectionId === 'c');
        expect(c.every(l => l.estimated)).toBe(true);
    });

    it('returns nothing for empty sections', () => {
        expect(buildTimedLines([{ id: 'x', text: '  \n ' }], [{ id: 'x', start: 0, end: 10 }])).toEqual([]);
    });
});
