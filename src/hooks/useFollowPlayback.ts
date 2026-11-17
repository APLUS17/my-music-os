'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a manual scroll pauses following before it resumes by itself. */
const MANUAL_SCROLL_PAUSE_MS = 4000;
/** Don't yank the view away from someone who is typing. */
const TYPING_GRACE_MS = 2500;
/** Where the active line rests, as a fraction of the visible height (a bit above centre, clear of the player pill). */
const REST_FRACTION = 0.4;

interface Options {
    containerRef: React.RefObject<HTMLElement | null>;
    /** Master switch (setting on, and something is playing). */
    enabled: boolean;
    /** Changes whenever the active line changes. */
    activeKey: string | null;
}

/**
 * Keeps the active lyric line in view while playing. Pauses itself when the
 * user scrolls or types, resumes after a few seconds, and offers `recenter`
 * for a "jump back to now" button.
 */
export function useFollowPlayback({ containerRef, enabled, activeKey }: Options) {
    const [pausedByUser, setPausedByUser] = useState(false);
    const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTypingAt = useRef(0);

    const scrollToActive = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const container = containerRef.current;
        if (!container) return;
        const el = container.querySelector('[data-active-lyric-line="true"]') as HTMLElement | null;
        if (!el) return;
        const c = container.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        if (c.height <= 0) return;
        const centerInView = r.top - c.top + r.height / 2;
        const delta = centerInView - c.height * REST_FRACTION;
        if (Math.abs(delta) < 4) return;
        const max = Math.max(0, container.scrollHeight - container.clientHeight);
        const top = Math.max(0, Math.min(max, container.scrollTop + delta));
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        container.scrollTo({ top, behavior: reduce ? 'auto' : behavior });
    }, [containerRef]);

    const pauseFollowing = useCallback(() => {
        setPausedByUser(true);
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        resumeTimer.current = setTimeout(() => setPausedByUser(false), MANUAL_SCROLL_PAUSE_MS);
    }, []);

    // User intent: wheel / touch / drag on the scroller, or typing in it.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onUserScroll = () => { if (enabled) pauseFollowing(); };
        const onKey = () => { lastTypingAt.current = Date.now(); };
        el.addEventListener('wheel', onUserScroll, { passive: true });
        el.addEventListener('touchmove', onUserScroll, { passive: true });
        el.addEventListener('keydown', onKey);
        return () => {
            el.removeEventListener('wheel', onUserScroll);
            el.removeEventListener('touchmove', onUserScroll);
            el.removeEventListener('keydown', onKey);
        };
    }, [containerRef, enabled, pauseFollowing]);

    useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

    // Follow the active line.
    useEffect(() => {
        if (!enabled || pausedByUser || activeKey === null) return;
        if (Date.now() - lastTypingAt.current < TYPING_GRACE_MS) return;
        // Wait a frame so the new highlight has rendered.
        const id = requestAnimationFrame(() => scrollToActive('smooth'));
        return () => cancelAnimationFrame(id);
    }, [enabled, pausedByUser, activeKey, scrollToActive]);

    const recenter = useCallback(() => {
        setPausedByUser(false);
        if (resumeTimer.current) { clearTimeout(resumeTimer.current); resumeTimer.current = null; }
        requestAnimationFrame(() => scrollToActive('smooth'));
    }, [scrollToActive]);

    // A stale pause (the timer clears it within a few seconds) never applies while following is off.
    return { isFollowing: enabled && !pausedByUser, pausedByUser: enabled && pausedByUser, recenter };
}
