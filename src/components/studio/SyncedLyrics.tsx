'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SyncedLyricsLine {
    text: string;
    startTime: number;
    endTime: number;
}

interface SyncedLyricsProps {
    lines: SyncedLyricsLine[];
    currentTime: number;
    onSeek: (time: number) => void;
    className?: string;
    emptyMessage?: string;
}

// Karaoke-style scrollable, click-to-seek lyrics/transcript view. Extracted from
// PlayerTab.tsx so the same synced view can be dropped into any player surface
// instead of forcing a re-listen to find a specific line.
export const SyncedLyrics: React.FC<SyncedLyricsProps> = ({ lines, currentTime, onSeek, className, emptyMessage }) => {
    const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);
    const lyricContainerRef = useRef<HTMLDivElement>(null);
    const lyricListRef = useRef<HTMLDivElement>(null);
    const [lyricTranslateY, setLyricTranslateY] = useState(0);

    const activeLyricIdx = useMemo(() => {
        if (lines.length === 0) return -1;
        const lookaheadTime = currentTime + 0.03; // ~half of the 60ms RAF interval
        const idx = lines.findIndex(l => lookaheadTime >= l.startTime && lookaheadTime < l.endTime);
        if (idx !== -1) return idx;
        if (lookaheadTime >= lines[lines.length - 1].endTime) {
            return lines.length - 1;
        }
        return -1;
    }, [lines, currentTime]);

    // Reset list position when a new set of lines loads
    useEffect(() => {
        setLyricTranslateY(0);
    }, [lines]);

    // Spring-based lyric centering — Framer Motion drives the animation, no style mutation
    useEffect(() => {
        if (activeLyricIdx < 0) return;
        const container = lyricContainerRef.current;
        const activeEl = lyricRefs.current[activeLyricIdx];
        if (!container || !activeEl) return;

        const containerRect = container.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        const delta = (containerRect.top + containerRect.height / 2) - (activeRect.top + activeRect.height / 2);

        setLyricTranslateY(prev => prev + delta);
    }, [activeLyricIdx]);

    if (lines.length === 0) {
        return (
            <div className={cn("flex-1 flex items-center justify-center px-6", className)}>
                <p className="text-[var(--text-tertiary)] text-sm text-center">
                    {emptyMessage ?? 'No transcript yet'}
                </p>
            </div>
        );
    }

    return (
        <div
            ref={lyricContainerRef}
            className={cn("flex-1 overflow-hidden px-6 pt-2 pb-4 flex flex-col relative mask-fade-edges", className)}
            style={{ overscrollBehaviorY: 'contain' }}
        >
            <motion.div
                ref={lyricListRef}
                className="flex flex-col gap-8 py-[50vh] shrink-0"
                animate={{ y: lyricTranslateY }}
                transition={{ type: "spring", stiffness: 150, damping: 30, mass: 0.8 }}
            >
                {lines.map((line, i) => {
                    const isActive = i === activeLyricIdx;
                    const isPast = i < activeLyricIdx;
                    const isFuture = i > activeLyricIdx;
                    const distance = Math.abs(i - activeLyricIdx);

                    let opacity = 0.15; let scale = 0.96; let blur = 2;

                    if (isActive) { opacity = 1; scale = 1; blur = 0; }
                    else if (isPast) {
                        if (distance === 1) { opacity = 0.45; scale = 0.98; blur = 1; }
                        else { opacity = 0.25; scale = 0.96; blur = 2; }
                    } else if (isFuture) {
                        if (distance === 1) { opacity = 0.4; scale = 1; blur = 1; }
                        else if (distance === 2) { opacity = 0.2; scale = 0.98; blur = 2; }
                        else { opacity = 0.12; scale = 0.95; blur = 0; }
                    }
                    if (activeLyricIdx === -1 && i === 0) { opacity = 0.25; blur = 1; }

                    return (
                        <motion.div
                            key={`line-${i}`}
                            ref={el => { lyricRefs.current[i] = el; }}
                            className={cn("text-left cursor-pointer", isActive ? "text-[var(--text-main)]" : "text-[var(--text-secondary)]")}
                            initial={false}
                            animate={{ opacity, scale, filter: `blur(${blur}px)` }}
                            transition={{ type: "spring", stiffness: 150, damping: 30, mass: 0.8 }}
                            onClick={() => onSeek(line.startTime)}
                        >
                            <p className={cn("text-2xl md:text-3xl font-bold leading-[1.15] tracking-tight", isActive ? "drop-shadow-[0_0_20px_var(--accent-dim)]" : "")}>
                                {line.text}
                            </p>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
};
