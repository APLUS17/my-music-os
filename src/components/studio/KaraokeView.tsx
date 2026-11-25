'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Pause, Play, Navigation, Minus, Plus } from 'lucide-react';
import type { LyricSection } from '@/types';
import type { SongClock } from '@/lib/timeline/songClock';
import { pickActiveLine, type SectionTiming, type TimedLine } from '@/lib/timeline/timeline';
import { typeLabel } from '@/lib/timeline/sectionEdit';
import { sectionColor, withAlpha } from '@/lib/timeline/sectionColors';
import { useClockValue } from '@/hooks/useSongClock';
import { formatTime } from '@/lib/utils/time';
import { cn } from '@/lib/utils';

interface KaraokeViewProps {
    sections: LyricSection[];
    timings: SectionTiming[];
    lines: TimedLine[];
    clock: SongClock;
    durationSec: number;
    offsetMs: number;
    projectTitle: string;
    onClose: () => void;
    onTogglePlay: () => void;
    onSeek: (timeSec: number) => void;
    onChangeOffset: (ms: number) => void;
}

/** How long a manual scroll holds off auto-centering. */
const MANUAL_PAUSE_MS = 3500;

/** The line being sung, with a fill that sweeps across it as time passes. */
const ActiveLineText = memo(function ActiveLineText({ line, clock, offsetMs }: { line: TimedLine; clock: SongClock; offsetMs: number }) {
    const select = useCallback((t: number) => {
        const span = Math.max(0.25, line.endSec - line.startSec);
        const p = (t - offsetMs / 1000 - line.startSec) / span;
        return Math.round(Math.max(0, Math.min(1, p)) * 100);
    }, [line.endSec, line.startSec, offsetMs]);
    const pct = useClockValue(clock, select);
    return (
        <span
            className="bg-clip-text text-transparent transition-[background-size] duration-100 ease-linear"
            style={{
                backgroundImage: `linear-gradient(90deg, #ffffff ${pct}%, rgba(255,255,255,0.55) ${pct}%)`,
                WebkitBackgroundClip: 'text',
            }}
            data-testid="karaoke-fill"
        >
            {line.text}
        </span>
    );
});

const ProgressBar = memo(function ProgressBar({
    sections, timings, clock, durationSec, onSeek,
}: { sections: LyricSection[]; timings: SectionTiming[]; clock: SongClock; durationSec: number; onSeek: (t: number) => void }) {
    const select = useCallback((t: number) => Math.round(t * 20) / 20, []);
    const t = useClockValue(clock, select);
    const ref = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const seekFrom = (clientX: number) => {
        const el = ref.current;
        if (!el || durationSec <= 0) return;
        const r = el.getBoundingClientRect();
        onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * durationSec);
    };
    return (
        <div
            ref={ref}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(durationSec)}
            aria-valuenow={Math.round(t)}
            className="relative h-8 flex items-center cursor-pointer touch-none select-none"
            onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekFrom(e.clientX); }}
            onPointerMove={e => { if (dragging.current) seekFrom(e.clientX); }}
            onPointerUp={() => { dragging.current = false; }}
            onPointerCancel={() => { dragging.current = false; }}
        >
            <div className="relative w-full h-1.5 rounded-full overflow-hidden bg-white/10">
                {timings.map((tm, i) => {
                    const left = durationSec > 0 ? (tm.start / durationSec) * 100 : 0;
                    const width = durationSec > 0 ? ((tm.end - tm.start) / durationSec) * 100 : 0;
                    const fill = durationSec > 0 ? Math.max(0, Math.min(1, (t - tm.start) / Math.max(0.001, tm.end - tm.start))) : 0;
                    const color = sectionColor(sections[i].type);
                    return (
                        <div key={tm.id} className="absolute top-0 bottom-0" style={{ left: `${left}%`, width: `${width}%`, background: withAlpha(color, 0.3) }}>
                            <div className="h-full" style={{ width: `${fill * 100}%`, background: color }} />
                        </div>
                    );
                })}
            </div>
            <div
                className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                style={{ left: `${durationSec > 0 ? Math.min(100, (t / durationSec) * 100) : 0}%` }}
            />
        </div>
    );
});

function KaraokeViewBase({
    sections, timings, lines, clock, durationSec, offsetMs, projectTitle,
    onClose, onTogglePlay, onSeek, onChangeOffset,
}: KaraokeViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [pausedByUser, setPausedByUser] = useState(false);
    const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activeIdx = useClockValue(clock, useCallback((t: number) => pickActiveLine(lines, t, offsetMs), [lines, offsetMs]));
    const isPlaying = useClockValue(clock, useCallback((_t: number, playing: boolean) => playing, []));
    const timeText = useClockValue(clock, useCallback((t: number) => formatTime(t), []));

    const active = activeIdx >= 0 ? lines[activeIdx] : null;
    const activeSection = active ? sections.find(s => s.id === active.sectionId) : null;

    // Group lines under their section heading, keeping the global line index for highlighting.
    const groups = useMemo(() => {
        const out: Array<{ section: LyricSection; sectionIndex: number; items: Array<{ line: TimedLine; idx: number }> }> = [];
        lines.forEach((line, idx) => {
            const last = out[out.length - 1];
            if (last && last.section.id === line.sectionId) last.items.push({ line, idx });
            else {
                const section = sections.find(s => s.id === line.sectionId);
                if (section) out.push({ section, sectionIndex: line.sectionIndex, items: [{ line, idx }] });
            }
        });
        return out;
    }, [lines, sections]);

    const centerActive = useCallback((behavior: ScrollBehavior) => {
        const container = scrollRef.current;
        if (!container) return;
        const el = container.querySelector('[data-karaoke-active="true"]') as HTMLElement | null;
        if (!el) return;
        const c = container.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const delta = (r.top - c.top + r.height / 2) - c.height / 2;
        if (Math.abs(delta) < 3) return;
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        container.scrollTo({ top: container.scrollTop + delta, behavior: reduce ? 'auto' : behavior });
    }, []);

    // Keep the active line centered. The line grows while it becomes active (a 300 ms
    // size transition), so its center keeps moving: re-center once more when it settles.
    useEffect(() => {
        if (pausedByUser) return;
        const id = requestAnimationFrame(() => centerActive('smooth'));
        const settle = setTimeout(() => centerActive('smooth'), 340);
        return () => { cancelAnimationFrame(id); clearTimeout(settle); };
    }, [activeIdx, pausedByUser, centerActive]);

    // Center immediately on open.
    useEffect(() => {
        const id = requestAnimationFrame(() => centerActive('auto'));
        return () => cancelAnimationFrame(id);
    }, [centerActive]);

    const pauseFollow = useCallback(() => {
        setPausedByUser(true);
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        resumeTimer.current = setTimeout(() => setPausedByUser(false), MANUAL_PAUSE_MS);
    }, []);
    useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
            if (e.key === 'Escape') onClose();
            if (e.key === ' ') { e.preventDefault(); onTogglePlay(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, onTogglePlay]);

    const resync = () => {
        setPausedByUser(false);
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        requestAnimationFrame(() => centerActive('smooth'));
    };

    return (
        <div
            className="absolute inset-0 z-[80] flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]"
            role="dialog"
            aria-label="Karaoke lyrics"
            data-testid="karaoke-view"
        >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close karaoke"
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center active:scale-95"
                    data-testid="karaoke-close"
                >
                    <ChevronDown size={20} />
                </button>
                <div className="min-w-0 text-center px-2">
                    <div className="text-sm font-semibold truncate">{projectTitle || 'Untitled'}</div>
                    <div className="text-[10px] mono uppercase tracking-widest" style={{ color: activeSection ? sectionColor(activeSection.type) : 'var(--text-tertiary)' }}>
                        {activeSection ? typeLabel(activeSection.type) : '—'}
                    </div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-white/5 px-1 h-10" title="Lyric timing: negative lights lines earlier">
                    <button type="button" aria-label="Lyrics earlier" onClick={() => onChangeOffset(offsetMs - 50)} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center"><Minus size={13} /></button>
                    <span className="text-[10px] mono w-12 text-center tabular-nums" data-testid="karaoke-offset">{offsetMs > 0 ? '+' : ''}{offsetMs}ms</span>
                    <button type="button" aria-label="Lyrics later" onClick={() => onChangeOffset(offsetMs + 50)} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center"><Plus size={13} /></button>
                </div>
            </div>

            {/* Lines */}
            <div
                ref={scrollRef}
                className="relative flex-1 overflow-y-auto scrollbar-hide px-6"
                onWheel={pauseFollow}
                onTouchMove={pauseFollow}
                data-testid="karaoke-scroll"
            >
                {lines.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-sm text-[var(--text-tertiary)] px-8">
                        Write some lyrics in the editor and they will show up here, lit in time with the music.
                    </div>
                ) : (
                    // Padding lets the first and last lines reach the vertical center.
                    <div className="py-[42vh] space-y-2.5 max-w-xl mx-auto">
                        {groups.map(group => {
                            const color = sectionColor(group.section.type);
                            return (
                                <div key={group.section.id} className="space-y-2.5">
                                    <div className="pt-6 text-[10px] mono uppercase tracking-[0.25em] font-semibold" style={{ color }}>
                                        {typeLabel(group.section.type)}
                                    </div>
                                    {group.items.map(({ line, idx }) => {
                                        const isActive = idx === activeIdx;
                                        const isPast = idx < activeIdx;
                                        return (
                                            <button
                                                key={line.key}
                                                type="button"
                                                onClick={() => { onSeek(line.startSec); resync(); }}
                                                data-karaoke-active={isActive ? 'true' : undefined}
                                                data-testid="karaoke-line"
                                                className={cn(
                                                    'block w-full text-left leading-snug font-bold transition-all duration-300 origin-left',
                                                    isActive ? 'text-[1.75rem] sm:text-3xl' : 'text-xl sm:text-2xl',
                                                    !isActive && (isPast ? 'text-white/25 hover:text-white/50' : 'text-white/45 hover:text-white/70')
                                                )}
                                            >
                                                {isActive ? <ActiveLineText line={line} clock={clock} offsetMs={offsetMs} /> : line.text}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}

                {pausedByUser && lines.length > 0 && (
                    <button
                        type="button"
                        onClick={resync}
                        className="sticky bottom-3 left-full ml-auto flex items-center gap-1.5 px-3 h-8 rounded-full bg-white text-black text-[11px] font-semibold shadow-lg active:scale-95"
                        data-testid="karaoke-resync"
                    >
                        <Navigation size={12} /> Back to now
                    </button>
                )}
            </div>

            {/* Transport */}
            <div className="flex-shrink-0 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)] to-transparent">
                <ProgressBar sections={sections} timings={timings} clock={clock} durationSec={durationSec} onSeek={onSeek} />
                <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] mono tabular-nums text-[var(--text-tertiary)]" data-testid="karaoke-time">{timeText}</span>
                    <button
                        type="button"
                        onClick={onTogglePlay}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                        data-testid="karaoke-play"
                    >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <span className="text-[11px] mono tabular-nums text-[var(--text-tertiary)]">{formatTime(durationSec)}</span>
                </div>
            </div>
        </div>
    );
}

export const KaraokeView = memo(KaraokeViewBase);
