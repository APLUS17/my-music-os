// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildLinesFromWhisper, isLikelyHallucination, type WhisperWord } from '../whisperLines';

const w = (word: string, start: number, end: number): WhisperWord => ({ word, start, end });

describe('buildLinesFromWhisper', () => {
    it('re-times a segment from its own words (word times are tighter than segment times)', () => {
        const lines = buildLinesFromWhisper({
            segments: [{ text: ' walking home tonight', start: 0, end: 6 }],
            words: [w(' walking', 1.2, 1.7), w(' home', 1.8, 2.1), w(' tonight', 2.2, 2.9)],
        });
        expect(lines).toEqual([{ text: 'walking home tonight', startSec: 1.2, endSec: 2.9 }]);
    });

    it('splits one long segment into lyric lines at the singer\'s pauses', () => {
        const lines = buildLinesFromWhisper({
            segments: [{ text: ' one two three four five six', start: 0, end: 12 }],
            words: [w(' one', 1, 1.3), w(' two', 1.4, 1.7), w(' three', 1.8, 2.2),
                    w(' four', 4.0, 4.3), w(' five', 4.4, 4.7), w(' six', 4.8, 5.2)],
        });
        expect(lines.map(l => l.text)).toEqual(['one two three', 'four five six']);
        expect(lines[1].startSec).toBe(4);
    });

    it('also splits a very long run of words with no pause', () => {
        const words = Array.from({ length: 22 }, (_, i) => w(` w${i}`, i * 0.3, i * 0.3 + 0.25));
        const lines = buildLinesFromWhisper({ segments: [{ text: words.map(x => x.word).join(''), start: 0, end: 7 }], words });
        expect(lines.length).toBeGreaterThanOrEqual(3);
        lines.forEach(l => expect(l.text.split(' ').length).toBeLessThanOrEqual(10));
    });

    it('gives each word to exactly one segment', () => {
        const lines = buildLinesFromWhisper({
            segments: [
                { text: ' first line', start: 0, end: 3 },
                { text: ' second line', start: 3, end: 6 },
            ],
            words: [w(' first', 0.5, 0.9), w(' line', 1.0, 1.4), w(' second', 3.5, 3.9), w(' line', 4.0, 4.4)],
        });
        expect(lines.map(l => l.text)).toEqual(['first line', 'second line']);
    });

    it('falls back to segment times when there are no words', () => {
        const lines = buildLinesFromWhisper({ segments: [{ text: '  hello there ', start: 2, end: 4 }] });
        expect(lines).toEqual([{ text: 'hello there', startSec: 2, endSec: 4 }]);
    });

    it('builds lines from words alone when there are no segments', () => {
        const lines = buildLinesFromWhisper({ words: [w(' hi', 1, 1.2), w(' there', 1.3, 1.6)] });
        expect(lines).toEqual([{ text: 'hi there', startSec: 1, endSec: 1.6 }]);
    });

    it('drops hallucinated segments (silence and repetition loops)', () => {
        const lines = buildLinesFromWhisper({
            segments: [
                { text: ' Thanks for watching', start: 0, end: 2, no_speech_prob: 0.95, avg_logprob: -1.4 },
                { text: ' la la la la la', start: 2, end: 6, compression_ratio: 3.1 },
                { text: ' real words', start: 6, end: 8, no_speech_prob: 0.01, avg_logprob: -0.2 },
            ],
            words: [w(' real', 6.2, 6.5), w(' words', 6.6, 7.0)],
        });
        expect(lines.map(l => l.text)).toEqual(['real words']);
    });

    it('words from a dropped segment do not leak into the next one', () => {
        const lines = buildLinesFromWhisper({
            segments: [
                { text: ' noise', start: 0, end: 2, no_speech_prob: 0.99, avg_logprob: -2 },
                { text: ' kept', start: 2, end: 4 },
            ],
            words: [w(' noise', 0.5, 1.0), w(' kept', 2.5, 3.0)],
        });
        expect(lines).toEqual([{ text: 'kept', startSec: 2.5, endSec: 3 }]);
    });

    it('clamps to the take length and drops lines that start after it', () => {
        const lines = buildLinesFromWhisper({
            segments: [{ text: ' in range', start: 0, end: 5 }, { text: ' ghost', start: 20, end: 22 }],
            words: [w(' in', 1, 1.5), w(' range', 1.6, 5.9)],
        }, 5);
        expect(lines).toHaveLength(1);                // the 'ghost' segment starts after the audio ends
        expect(lines[0]).toEqual({ text: 'in range', startSec: 1, endSec: 5 });
    });

    it('returns lines in order, never with end before start', () => {
        const lines = buildLinesFromWhisper({
            segments: [{ text: ' b', start: 5, end: 6 }, { text: ' a', start: 1, end: 2 }],
        });
        expect(lines.map(l => l.text)).toEqual(['a', 'b']);
        lines.forEach(l => expect(l.endSec).toBeGreaterThan(l.startSec));
    });

    it('handles empty and junk input', () => {
        expect(buildLinesFromWhisper({})).toEqual([]);
        expect(buildLinesFromWhisper({ segments: [], words: [] })).toEqual([]);
        expect(buildLinesFromWhisper({ segments: [null as never, { text: 5 as never, start: 0, end: 1 }] })).toEqual([]);
    });
});

describe('isLikelyHallucination', () => {
    it('flags repetition and confident silence, not normal speech', () => {
        expect(isLikelyHallucination({ text: 'x', start: 0, end: 1, compression_ratio: 2.6 })).toBe(true);
        expect(isLikelyHallucination({ text: 'x', start: 0, end: 1, no_speech_prob: 0.9, avg_logprob: -1 })).toBe(true);
        expect(isLikelyHallucination({ text: 'x', start: 0, end: 1, no_speech_prob: 0.05, avg_logprob: -0.3, compression_ratio: 1.4 })).toBe(false);
        expect(isLikelyHallucination({ text: 'x', start: 0, end: 1 })).toBe(false);
    });
});
