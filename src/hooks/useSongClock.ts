'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SongClock, attachSongClock } from '@/lib/timeline/songClock';

/**
 * Creates the song clock and keeps it fed from the beat and vocal audio
 * elements. `getAnchorSec` says where the active take starts on the beat.
 */
export function useSongClock(
    beatRef: React.RefObject<HTMLAudioElement | null>,
    vocalRef: React.RefObject<HTMLAudioElement | null>,
    getAnchorSec: () => number
): SongClock {
    const [clock] = useState(() => new SongClock());
    const anchorRef = useRef(getAnchorSec);
    useEffect(() => { anchorRef.current = getAnchorSec; }, [getAnchorSec]);

    useEffect(() => {
        return attachSongClock(clock, () => ({
            beat: beatRef.current,
            vocal: vocalRef.current,
            vocalAnchorSec: () => anchorRef.current(),
        }));
    }, [clock, beatRef, vocalRef]);

    return clock;
}

/**
 * Subscribes to a derived value of the clock. The component re-renders only
 * when `select`'s result changes (keep it a primitive), not on every frame.
 * Wrap `select` in useCallback.
 */
export function useClockValue<T>(clock: SongClock, select: (time: number, playing: boolean) => T): T {
    const getSnapshot = useCallback(() => select(clock.time, clock.playing), [clock, select]);
    return useSyncExternalStore(clock.subscribe, getSnapshot, getSnapshot);
}
