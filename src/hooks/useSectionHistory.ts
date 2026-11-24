'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LyricSection } from '@/types';
import { EditHistory } from '@/lib/timeline/history';

type Next = LyricSection[] | ((prev: LyricSection[]) => LyricSection[]);

/**
 * Undo/redo for the lyric sections. Route editing through `commit` instead of
 * calling the state setter directly. Anything that still sets the sections
 * directly (loading a song, say) simply invalidates the history, which is
 * the safe outcome.
 */
export function useSectionHistory(
    sections: LyricSection[],
    setSections: (next: LyricSection[]) => void
) {
    const [history] = useState(() => new EditHistory<LyricSection[]>());
    const latest = useRef(sections);
    const [, setVersion] = useState(0);

    useEffect(() => { latest.current = sections; }, [sections]);

    const commit = useCallback((next: Next, opts?: { coalesceKey?: string }) => {
        const prev = latest.current;
        const value = typeof next === 'function' ? next(prev) : next;
        if (value === prev) return;
        history.push(prev, value, { key: opts?.coalesceKey });
        latest.current = value;
        setSections(value);
        setVersion(v => v + 1);
    }, [history, setSections]);

    const undo = useCallback((): boolean => {
        const restored = history.undo(latest.current);
        setVersion(v => v + 1);
        if (!restored) return false;
        latest.current = restored;
        setSections(restored);
        return true;
    }, [history, setSections]);

    const redo = useCallback((): boolean => {
        const restored = history.redo(latest.current);
        setVersion(v => v + 1);
        if (!restored) return false;
        latest.current = restored;
        setSections(restored);
        return true;
    }, [history, setSections]);

    return { commit, undo, redo, canUndo: history.canUndo, canRedo: history.canRedo };
}
