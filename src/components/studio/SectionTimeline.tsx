'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic2, Scissors, Merge, RotateCcw, SlidersHorizontal, Wand2 } from 'lucide-react';
import type { LyricSection } from '@/types';
import type { SongClock } from '@/lib/timeline/songClock';
import type { SectionTiming } from '@/lib/timeline/timeline';
import { snapToBar, typeLabel, type BarGrid } from '@/lib/timeline/sectionEdit';
import { sectionColor, withAlpha } from '@/lib/timeline/sectionColors';
import { useClockValue } from '@/hooks/useSongClock';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/utils/time';

export interface BeatStructureSummary {
    bpm: number | null;
    method: 'audio' | 'even';
    confidence: number;
}

interface SectionTimelineProps {
    sections: LyricSection[];
    timings: SectionTiming[];
    durationSec: number;
    peaks: number[];
    clock: SongClock;
    /** A beat is loaded, so it can be analysed. Without one, sections can only be even-split. */
    hasBeat: boolean;
    isAnalyzing: boolean;
    summary: BeatStructureSummary | null;
    grid: BarGrid | null;
    /** Whether sections currently carry explicit times (as opposed to an even split). */
    isTimed: boolean;
    onSeek: (timeSec: number) => void;
    onMoveBoundary: (index: number, timeSec: number) => void;
    onSplitAtPlayhead: () => void;
    onMergeWithNext: (index: number) => void;
    onAutoSection: () => void;
    onResetTimings: () => void;
    onOpenKaraoke: () => void;
    onOpenSettings: () => void;
}

/** "Verse 2"-style labels: numbers a type only when it repeats. */
function buildLabels(sections: LyricSection[]): string[] {
    const totals = new Map<string, number>();
    sections.forEach(s => totals.set(s.type, (totals.get(s.type) ?? 0) + 1));
    const seen = new Map<string, number>();
    return sections.map(s => {
        const n = (seen.get(s.type) ?? 0) + 1;
        seen.set(s.type, n);
        return (totals.get(s.type) ?? 0) > 1 ? `${typeLabel(s.type)} ${n}` : typeLabel(s.type);
    });
}

const Playhead = memo(function Playhead({ clock, durationSec }: { clock: SongClock; durationSec: number }) {
    const select = useCallback((t: number) => Math.round(t * 30) / 30, []);
    const t = useClockValue(clock, select);
    const pct = durationSec > 0 ? Math.max(0, Math.min(100, (t / durationSec) * 100)) : 0;
    return (
        <div
            className="absolute top-0 bottom-0 w-px bg-white pointer-events-none z-20 shadow-[0_0_6px_rgba(255,255,255,0.8)]"
            style={{ left: `${pct}%` }}
            data-testid="section-playhead"
        >
            <div className="absolute -top-0.5 -translate-x-1/2 w-2 h-2 rounded-full bg-white" />
        </div>
    );
});

const Waveform = memo(function Waveform({ peaks }: { peaks: number[] }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, rect.width, rect.height);
            if (peaks.length === 0) return;
            const barW = rect.width / peaks.length;
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            const mid = rect.height / 2;
            for (let i = 0; i < peaks.length; i++) {
                const h = Math.max(1, peaks[i] * (rect.height - 6));
                ctx.fillRect(i * barW, mid - h / 2, Math.max(1, barW - 0.5), h);
            }
        };
        draw();
        const ro = new ResizeObserver(draw);
        ro.observe(canvas);
        return () => ro.disconnect();
    }, [peaks]);
    return <canvas ref={ref} className="absolute inset-0 w-full h-full" aria-hidden />;
});

function SectionTimelineBase(props: SectionTimelineProps) {
    const {
        sections, timings, durationSec, peaks, clock, hasBeat, isAnalyzing, summary, grid, isTimed,
        onSeek, onMoveBoundary, onSplitAtPlayhead, onMergeWithNext, onAutoSection, onResetTimings,
        onOpenKaraoke, onOpenSettings,
    } = props;

    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<number | null>(null);
    const scrubbing = useRef(false);

    const labels = useMemo(() => buildLabels(sections), [sections]);

    // Section under the playhead, for the Split / Merge buttons.
    const currentIdx = useClockValue(clock, useCallback((t: number) => {
        for (let i = 0; i < timings.length; i++) if (t >= timings[i].start && t < timings[i].end) return i;
        return t >= (timings[timings.length - 1]?.end ?? Infinity) ? timings.length - 1 : 0;
    }, [timings]));

    const timeFromClientX = useCallback((clientX: number): number => {
        const el = trackRef.current;
        if (!el || durationSec <= 0) return 0;
        const rect = el.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return ratio * durationSec;
    }, [durationSec]);

    // Scrub the track: tap or drag anywhere that isn't a boundary handle.
    const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('[data-boundary]')) return;
        scrubbing.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onSeek(timeFromClientX(e.clientX));
    };
    const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (scrubbing.current) onSeek(timeFromClientX(e.clientX));
    };
    const endScrub = () => { scrubbing.current = false; };

    // Boundary handles.
    const onHandleDown = (index: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(index);
    };
    const onHandleMove = (index: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
        if (dragging !== index) return;
        onMoveBoundary(index, snapToBar(timeFromClientX(e.clientX), grid));
    };
    const onHandleUp = () => setDragging(null);
    const onHandleKey = (index: number, startSec: number) => (e: React.KeyboardEvent) => {
        const step = grid && grid.barSec > 0 ? grid.barSec : 1;
        if (e.key === 'ArrowLeft') { e.preventDefault(); onMoveBoundary(index, startSec - step); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onMoveBoundary(index, startSec + step); }
    };

    const canEdit = durationSec > 0 && sections.length > 0;
    const sourceNote = !summary
        ? null
        : summary.method === 'audio'
            ? `${summary.bpm ? `${Math.round(summary.bpm)} BPM · ` : ''}from the beat`
            : 'Even split · no tempo found';

    return (
        <div className="flex-shrink-0 px-4 pt-1 pb-2 border-b border-[var(--border-main)] bg-[var(--bg-main)]" data-testid="section-timeline">
            {/* Toolbar */}
            <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
                <button
                    type="button"
                    onClick={onAutoSection}
                    disabled={!hasBeat || isAnalyzing}
                    title={hasBeat ? 'Detect sections from the beat' : 'Add a beat to detect sections'}
                    className={cn(
                        'shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold tracking-wide transition-all active:scale-95',
                        hasBeat
                            ? 'bg-[var(--accent)] text-white hover:brightness-110'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] cursor-not-allowed'
                    )}
                    data-testid="auto-section"
                >
                    {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                    {isAnalyzing ? 'Listening…' : isTimed ? 'Re-detect' : 'Auto-section'}
                </button>
                <ToolButton label="Split at playhead" onClick={onSplitAtPlayhead} disabled={!canEdit} icon={<Scissors size={14} />} testId="split-section" />
                <ToolButton
                    label="Merge with next section"
                    onClick={() => onMergeWithNext(currentIdx)}
                    disabled={!canEdit || currentIdx >= sections.length - 1}
                    icon={<Merge size={14} />}
                    testId="merge-section"
                />
                {isTimed && <ToolButton label="Reset sections to an even split" onClick={onResetTimings} icon={<RotateCcw size={14} />} testId="reset-sections" />}
                <div className="flex-1 min-w-2" />
                <button
                    type="button"
                    onClick={onOpenSettings}
                    title="Sync settings"
                    className="shrink-0 w-8 h-8 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] flex items-center justify-center hover:text-[var(--text-main)] active:scale-95"
                    data-testid="open-sync-settings"
                >
                    <SlidersHorizontal size={14} />
                </button>
                <button
                    type="button"
                    onClick={onOpenKaraoke}
                    className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full bg-[var(--bg-secondary)] text-[var(--text-main)] text-[11px] font-semibold tracking-wide hover:bg-[var(--bg-hover)] active:scale-95"
                    data-testid="open-karaoke"
                >
                    <Mic2 size={13} /> Karaoke
                </button>
            </div>

            {/* Track */}
            <div
                ref={trackRef}
                role="slider"
                aria-label="Song timeline"
                aria-valuemin={0}
                aria-valuemax={Math.round(durationSec)}
                aria-valuenow={0}
                onPointerDown={onTrackPointerDown}
                onPointerMove={onTrackPointerMove}
                onPointerUp={endScrub}
                onPointerCancel={endScrub}
                className="relative h-[68px] rounded-xl overflow-hidden bg-[var(--bg-secondary)] touch-none select-none cursor-pointer"
            >
                {/* Section color blocks */}
                {timings.map((t, i) => {
                    const left = durationSec > 0 ? (t.start / durationSec) * 100 : 0;
                    const width = durationSec > 0 ? ((t.end - t.start) / durationSec) * 100 : 0;
                    const color = sectionColor(sections[i].type);
                    return (
                        <div
                            key={t.id}
                            className="absolute top-0 bottom-0"
                            style={{ left: `${left}%`, width: `${width}%`, background: withAlpha(color, 0.22), borderLeft: i === 0 ? 'none' : `1px solid ${withAlpha(color, 0.0)}` }}
                            data-testid="section-block"
                            data-section-id={sections[i].id}
                        >
                            <div
                                className="absolute top-0 left-0 right-0 h-[3px]"
                                style={{ background: color }}
                            />
                            <span
                                className="absolute top-1.5 left-1.5 right-1 text-[9px] font-bold uppercase tracking-wider truncate pointer-events-none"
                                style={{ color }}
                            >
                                {labels[i]}
                            </span>
                        </div>
                    );
                })}

                <Waveform peaks={peaks} />

                {/* Boundary handles */}
                {timings.map((t, i) => {
                    if (i === 0 || durationSec <= 0) return null;
                    const left = (t.start / durationSec) * 100;
                    return (
                        <button
                            key={`h-${t.id}`}
                            type="button"
                            data-boundary={i}
                            data-testid="section-boundary"
                            aria-label={`Move boundary before ${labels[i]}`}
                            onPointerDown={onHandleDown(i)}
                            onPointerMove={onHandleMove(i)}
                            onPointerUp={onHandleUp}
                            onPointerCancel={onHandleUp}
                            onKeyDown={onHandleKey(i, t.start)}
                            className="absolute top-0 bottom-0 -translate-x-1/2 w-6 z-10 flex items-center justify-center cursor-ew-resize touch-none focus:outline-none group"
                            style={{ left: `${left}%` }}
                        >
                            <span className={cn('block w-[3px] h-full rounded-full bg-white/70 group-hover:bg-white transition-colors', dragging === i && 'bg-white')} />
                            <span className={cn('absolute w-3.5 h-5 rounded-md bg-white shadow-md', dragging === i ? 'scale-110' : 'opacity-90 group-hover:opacity-100')} />
                        </button>
                    );
                })}

                {durationSec > 0 && <Playhead clock={clock} durationSec={durationSec} />}

                {durationSec <= 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[var(--text-tertiary)]">
                        Add a beat to see your song&apos;s structure
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mt-1.5 text-[10px] mono text-[var(--text-tertiary)]">
                <span>{sourceNote ?? (isTimed ? 'Sections timed' : durationSec > 0 ? 'Sections split evenly' : '')}</span>
                <span>{durationSec > 0 ? formatTime(durationSec) : ''}</span>
            </div>
        </div>
    );
}

/** Icon-only so the toolbar fits a phone; the label is the tooltip and the screen-reader name. */
function ToolButton({ label, onClick, disabled, icon, testId }: { label: string; onClick: () => void; disabled?: boolean; icon: React.ReactNode; testId?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            data-testid={testId}
            className={cn(
                'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95',
                disabled
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] opacity-60 cursor-not-allowed'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            )}
        >
            {icon}
        </button>
    );
}

export const SectionTimeline = memo(SectionTimelineBase);
