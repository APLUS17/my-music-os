import { describe, it, expect, vi } from 'vitest';
import { readSongTime, SongClock } from '../songClock';
import { sanitizeSyncSettings, DEFAULT_SYNC_SETTINGS, LYRIC_OFFSET_RANGE_MS } from '../syncSettings';

const base = { beatPlaying: false, vocalPlaying: false, beatLoaded: false, vocalLoaded: false, beatTime: 0, vocalTime: 0, anchor: 0 };

describe('readSongTime', () => {
    it('uses the beat as the timeline when it is playing, even alongside a take', () => {
        expect(readSongTime({ ...base, beatPlaying: true, vocalPlaying: true, beatTime: 41, vocalTime: 2.5, anchor: 38.4 }, null)).toBe(41);
    });
    it('uses the take plus its anchor when only the take is playing', () => {
        expect(readSongTime({ ...base, vocalPlaying: true, vocalTime: 2.5, anchor: 38.4 }, null)).toBeCloseTo(40.9, 9);
    });
    it('a take with no beat has no anchor', () => {
        expect(readSongTime({ ...base, vocalPlaying: true, vocalTime: 7 }, null)).toBe(7);
    });
    it('when paused, follows whichever element the user last moved', () => {
        const paused = { ...base, beatLoaded: true, vocalLoaded: true, beatTime: 50, vocalTime: 3, anchor: 10 };
        expect(readSongTime(paused, 'beat')).toBe(50);
        expect(readSongTime(paused, 'vocal')).toBe(13);
    });
    it('when paused with nothing moved yet, prefers the take, then the beat, then 0', () => {
        expect(readSongTime({ ...base, beatLoaded: true, vocalLoaded: true, beatTime: 5, vocalTime: 2, anchor: 1 }, null)).toBe(3);
        expect(readSongTime({ ...base, beatLoaded: true, beatTime: 5 }, null)).toBe(5);
        expect(readSongTime(base, null)).toBe(0);
    });
    it('ignores a "last moved" element that has nothing loaded', () => {
        expect(readSongTime({ ...base, vocalLoaded: true, vocalTime: 4, anchor: 1 }, 'beat')).toBe(5);
    });
});

describe('SongClock', () => {
    it('notifies subscribers only when the value actually changes', () => {
        const clock = new SongClock();
        const fn = vi.fn();
        clock.subscribe(fn);
        clock.set(1, true);
        clock.set(1, true);
        clock.set(1.5, true);
        expect(fn).toHaveBeenCalledTimes(2);
        expect(clock.getTime()).toBe(1.5);
        expect(clock.getPlaying()).toBe(true);
    });
    it('stops notifying after unsubscribe', () => {
        const clock = new SongClock();
        const fn = vi.fn();
        const off = clock.subscribe(fn);
        off();
        clock.set(3, false);
        expect(fn).not.toHaveBeenCalled();
    });
});

describe('sanitizeSyncSettings', () => {
    it('falls back to defaults for junk input', () => {
        expect(sanitizeSyncSettings(null)).toEqual(DEFAULT_SYNC_SETTINGS);
        expect(sanitizeSyncSettings('nope')).toEqual(DEFAULT_SYNC_SETTINGS);
        expect(sanitizeSyncSettings({ lyricOffsetMs: 'x', followPlayback: 1 })).toEqual(DEFAULT_SYNC_SETTINGS);
    });
    it('clamps and rounds the offset', () => {
        expect(sanitizeSyncSettings({ lyricOffsetMs: 99999 }).lyricOffsetMs).toBe(LYRIC_OFFSET_RANGE_MS);
        expect(sanitizeSyncSettings({ lyricOffsetMs: -99999 }).lyricOffsetMs).toBe(-LYRIC_OFFSET_RANGE_MS);
        expect(sanitizeSyncSettings({ lyricOffsetMs: -249.6 }).lyricOffsetMs).toBe(-250);
        expect(sanitizeSyncSettings({ lyricOffsetMs: NaN }).lyricOffsetMs).toBe(DEFAULT_SYNC_SETTINGS.lyricOffsetMs);
    });
    it('keeps valid values', () => {
        expect(sanitizeSyncSettings({ lyricOffsetMs: 120, followPlayback: false })).toEqual({ lyricOffsetMs: 120, followPlayback: false });
    });
});
