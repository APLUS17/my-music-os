'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Rewind, FastForward, MessageSquare, Repeat2, Volume2, Volume1, VolumeX, Languages, List, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecordingSession, Beat, LyricSection, TranscriptionLine } from '@/types';
import { cn } from '@/lib/utils';
import { useActiveBeatSection } from './useActiveBeatSection';
import { formatTime } from '@/lib/utils/time';
import { SyncedLyrics } from './SyncedLyrics';

interface PlayerTabProps {
    projectTitle: string;
    session: RecordingSession | null;
    sessions?: RecordingSession[];
    beat?: Beat | null;
    beatSrc: string | null;
    beatVolume: number;
    beatMuted: boolean;
    onVolumeChange: (v: number) => void;
    onMuteChange: (m: boolean) => void;
    vocalVolume?: number;
    vocalMuted?: boolean;
    onVocalVolumeChange?: (v: number) => void;
    onVocalMuteChange?: (m: boolean) => void;
    isBeatLooping?: boolean;
    beatLoopStart?: number | null;
    beatLoopEnd?: number | null;
    onBeatPlaybackChange?: (isPlaying: boolean) => void;
    onSetLoopRegion?: (startTime: number, endTime: number) => void;
    onClearLoop?: () => void;
    lyrics?: LyricSection[];
    onSelectSession?: (id: string) => void;
    onDeleteSession?: (id: string) => void;
    isAnalyzingVocal?: boolean;
    isAnalyzingBeat?: boolean;
    onDismiss?: () => void;
    onGenerateRecap?: (sessionId: string) => void;

    // Lifted State Props
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onTogglePlay: (play?: boolean) => void;
    onSeek: (time: number) => void;
}

// One mixer channel: mute toggle + label on the left, level slider on the right.
// Lets the beat and the recording be balanced independently so neither bleeds
// over the other during mixed playback.
const ChannelVolumeRow: React.FC<{
    label: string;
    volume: number;
    muted: boolean;
    onVolumeChange: (v: number) => void;
    onMuteChange: (m: boolean) => void;
}> = ({ label, volume, muted, onVolumeChange, onMuteChange }) => {
    const effective = muted ? 0 : volume;
    return (
        <div className="flex items-center gap-3">
            <button
                onClick={() => onMuteChange(!muted)}
                aria-label={muted ? `Unmute ${label.toLowerCase()}` : `Mute ${label.toLowerCase()}`}
                className={cn(
                    'flex items-center gap-1.5 w-[104px] shrink-0 text-left active:opacity-60 transition-colors',
                    muted ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                )}
            >
                {muted ? <VolumeX size={16} /> : effective > 0.5 ? <Volume2 size={16} /> : <Volume1 size={16} />}
                <span className="text-[11px] font-semibold uppercase tracking-wider truncate">{label}</span>
            </button>
            <input
                type="range" min={0} max={1} step={0.01} value={effective}
                onChange={e => {
                    const v = parseFloat(e.target.value);
                    onVolumeChange(v);
                    if (v > 0 && muted) onMuteChange(false);
                    if (v === 0) onMuteChange(true);
                }}
                className="flex-1 h-[3px] my-4 appearance-none rounded-full cursor-pointer slider-v
                [&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:-mt-[4px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-main)] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-none
                [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--text-main)] [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
                style={{ touchAction: 'none', background: `linear-gradient(to right, var(--text-main) 0%, var(--text-main) ${effective * 100}%, var(--border-strong) ${effective * 100}%, var(--border-strong) 100%)` }}
            />
        </div>
    );
};

export const PlayerTab: React.FC<PlayerTabProps> = React.memo(({
    projectTitle,
    session,
    sessions,
    beat,
    beatSrc,
    beatVolume,
    beatMuted,
    onVolumeChange,
    onMuteChange,
    vocalVolume = 1,
    vocalMuted = false,
    onVocalVolumeChange,
    onVocalMuteChange,
    isBeatLooping,
    beatLoopStart,
    beatLoopEnd,
    onBeatPlaybackChange,
    onSetLoopRegion,
    onClearLoop,
    lyrics,
    onSelectSession,
    onDeleteSession,
    isAnalyzingBeat,
    onDismiss,
    onGenerateRecap,

    // Lifted
    isPlaying,
    currentTime,
    duration,
    onTogglePlay,
    onSeek,
}) => {
    const pillRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [showTakeList, setShowTakeList] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => {
        if (!showTakeList) setConfirmDeleteId(null);
    }, [showTakeList]);

    const skip = (delta: number) => onSeek(currentTime + delta);

    const togglePlay = () => onTogglePlay();

    // Use the session provided by the parent (StudioWorkspace)
    const activeSession = session;
    const sessionIdx = sessions && activeSession ? sessions.findIndex(s => s.id === activeSession.id) : -1;

    // Derived — beat sections drive pills ONLY
    // Only calculate beat highlights if recording was made WITH the beat, or fall back to currentTime for beat-only practice/writing
    const beatCurrentTime = activeSession
      ? (activeSession.beatOffset !== null && activeSession.beatOffset !== undefined ? currentTime + activeSession.beatOffset : currentTime)
      : currentTime;
    const beatSections = beatCurrentTime !== null ? (beat?.sections ?? []) : [];

    // We calculate the active index during render for O(1) performance without cascading re-renders.
    // Since calculating the index linearly can be slow, we optimize using an index pointer cache.
    // We wrap it in a custom hook to manage the ref logic properly and avoid lint errors.
    const activeSectionIdx = useActiveBeatSection(beatSections, beatCurrentTime);

    const progress         = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Transcription lines: prefer AI timestamped lines, fall back to written lyrics spread evenly
    const displayLines = useMemo(() => {
        if (activeSession?.lines?.length) return activeSession.lines;
        if (!lyrics?.length) return [];
        const rawLines = lyrics.flatMap(s => s.text.split('\n').filter(l => l.trim()));
        if (!rawLines.length) return [];
        const d = duration > 0 ? duration : rawLines.length * 4; // 4s/line fallback if no duration yet
        const interval = d / rawLines.length;
        return rawLines.map((text, i) => ({
            text,
            startTime: i * interval,
            endTime: (i + 1) * interval,
        }));
    }, [activeSession?.lines, lyrics, duration]);

    const horizontalScrollRaf = useRef<number | null>(null);

    const smoothScroll = useCallback((
        element: HTMLElement,
        targetPosition: number,
        duration: number,
        direction: 'vertical' | 'horizontal'
    ) => {
        const startPosition = direction === 'vertical' ? element.scrollTop : element.scrollLeft;
        const distance = targetPosition - startPosition;
        const startTime = performance.now();

        const rafRef = horizontalScrollRaf;

        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
        }

        const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

        const step = (time: number) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = easeOutCubic(progress);

            const currentPosition = startPosition + distance * ease;

            if (direction === 'vertical') {
                element.scrollTop = currentPosition;
            } else {
                element.scrollLeft = currentPosition;
            }

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                rafRef.current = null;
            }
        };

        rafRef.current = requestAnimationFrame(step);
    }, []);

    // Clean up animation frames on unmount
    useEffect(() => {
        return () => {
            if (horizontalScrollRaf.current !== null) cancelAnimationFrame(horizontalScrollRaf.current);
        };
    }, []);

    // Auto-scroll active pill into centre of scroll row
    useEffect(() => {
        if (activeSectionIdx >= 0) {
            const pillElement = pillRefs.current[activeSectionIdx];
            if (pillElement) {
                const parent = pillElement.parentElement;
                if (parent) {
                    const pillRect = pillElement.getBoundingClientRect();
                    const parentRect = parent.getBoundingClientRect();
                    const pillCenter = pillRect.left + pillRect.width / 2;
                    const parentCenter = parentRect.left + parentRect.width / 2;
                    const scrollTarget = parent.scrollLeft + (pillCenter - parentCenter);

                    smoothScroll(parent, scrollTarget, 300, 'horizontal');
                }
            }
        }
    }, [activeSectionIdx, smoothScroll]);

    return (
        <div className="flex flex-col h-full bg-[var(--bg-main)] select-none">
            {/* ── Header ───────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2 z-30">
                {/* Left: dismiss button OR "Now Playing" label+title */}
                {onDismiss ? (
                    <button onClick={onDismiss} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors active:scale-90 cursor-pointer">
                        <ChevronDown size={28} />
                    </button>
                ) : (
                    <div className="flex flex-col">
                        <span className="text-[10px] mono uppercase tracking-[0.2em] text-[var(--text-tertiary)] mb-0.5">Now Playing</span>
                        <h2 className="text-sm font-bold text-[var(--text-main)] tracking-tight truncate max-w-[180px]">{projectTitle}</h2>
                    </div>
                )}

                {/* Center: project title — only when dismiss button is showing */}
                {onDismiss && (
                    <h2 className="text-sm font-semibold text-[var(--text-main)] tracking-tight truncate max-w-[160px]">{projectTitle}</h2>
                )}

                {/* Right: Generate Recap (short takes without an auto-generated one yet) + takes dropdown */}
                <div className="flex items-center gap-2">
                {activeSession && onGenerateRecap && !activeSession.museRecap && activeSession.kind !== 'muse'
                    && activeSession.museStatus !== 'uploading' && activeSession.museStatus !== 'analyzing' && (
                    <button
                        onClick={() => onGenerateRecap(activeSession.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] transition-all active:scale-95 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-main)] uppercase tracking-wider"
                    >
                        {activeSession.museStatus === 'failed' ? 'Retry Recap' : 'Generate Recap'}
                    </button>
                )}
                {sessions && sessions.length > 0 ? (
                    <div className="relative">
                        <button
                            onClick={() => setShowTakeList(!showTakeList)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] transition-all active:scale-95"
                        >
                            <span className="text-[10px] font-bold text-[var(--accent)] mono">TAKE {sessions.length - sessionIdx}</span>
                            <ChevronDown size={14} className={cn("text-[var(--text-secondary)] transition-transform duration-300", showTakeList && "rotate-180")} />
                        </button>
                        <AnimatePresence>
                            {showTakeList && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowTakeList(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-2 w-40 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                                    >
                                        {sessions.map((s, i) => {
                                            const isActive = activeSession?.id === s.id;
                                            const isConfirming = confirmDeleteId === s.id;
                                            return (
                                                <div
                                                    key={s.id}
                                                    className={cn(
                                                        "group w-full flex items-center transition-colors",
                                                        isActive ? "bg-[var(--accent)]/5" : "hover:bg-[var(--bg-hover)]"
                                                    )}
                                                >
                                                    <button
                                                        onClick={() => { onSelectSession?.(s.id); setShowTakeList(false); }}
                                                        className={cn(
                                                            "flex-1 text-left pl-4 pr-2 py-3 text-xs font-semibold flex items-center justify-between min-w-0",
                                                            isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
                                                        )}
                                                    >
                                                        <span className="truncate">Take {sessions.length - i}</span>
                                                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)] shrink-0 ml-2" />}
                                                    </button>
                                                    {onDeleteSession && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (isConfirming) {
                                                                    onDeleteSession(s.id);
                                                                    setConfirmDeleteId(null);
                                                                } else {
                                                                    setConfirmDeleteId(s.id);
                                                                }
                                                            }}
                                                            aria-label={isConfirming ? `Confirm delete take ${sessions.length - i}` : `Delete take ${sessions.length - i}`}
                                                            title={isConfirming ? "Tap again to confirm" : "Delete take"}
                                                            className={cn(
                                                                "shrink-0 mr-2 h-7 rounded-md flex items-center justify-center transition-all active:scale-95",
                                                                isConfirming
                                                                    ? "px-2 bg-red-500 text-white"
                                                                    : "w-7 text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10"
                                                            )}
                                                        >
                                                            {isConfirming ? (
                                                                <span className="text-[10px] font-bold uppercase tracking-wider">Delete?</span>
                                                            ) : (
                                                                <Trash2 size={14} />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="w-8" />
                )}
                </div>
            </div>

            {/* ── Lyrics display ─────────────────────────────────────── */}
            <SyncedLyrics lines={displayLines} currentTime={currentTime} onSeek={onSeek} />

            {/* ── Section pills — beat only (hidden in full-screen mode) ── */}
            {beat && !onDismiss && (
                isAnalyzingBeat ? (
                    // Beat sections loading — skeleton pills
                    <div className="flex gap-3 px-6 pb-2 pt-4 overflow-hidden">
                        {[80, 64, 96, 72, 88].map((w, i) => (
                            <div key={i} className="shrink-0 h-8 rounded-xl bg-[var(--border-subtle)] animate-pulse" style={{ width: w }} />
                        ))}
                    </div>
                ) : beatSections.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto px-6 pb-2 pt-4 scrollbar-hide">
                        {beatSections.map((sec, i) => {
                            const isActive = i === activeSectionIdx;
                            return (
                                <div
                                    key={sec.id}
                                    ref={el => { pillRefs.current[i] = el; }}
                                    className="flex flex-col items-center shrink-0"
                                    style={{ minWidth: 72 }}
                                >
                                    <motion.span
                                        className="text-[var(--accent)] text-xs font-bold mb-1 block"
                                        animate={{ opacity: isActive ? 1 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        →
                                    </motion.span>
                                    <button
                                        onClick={() => {
                                            const vocalTime = sec.startTime - (activeSession?.beatOffset ?? 0);
                                            onSeek(Math.max(0, vocalTime));
                                            // Only update loop region if loop mode is already active
                                            if (isBeatLooping) {
                                                onSetLoopRegion?.(sec.startTime, sec.endTime);
                                            }
                                        }}
                                        className={cn(
                                            'w-full px-4 py-2 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap',
                                            isActive
                                                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                                                : 'border-[var(--border-main)] text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:border-[var(--text-tertiary)]'
                                        )}
                                    >
                                        {sec.label || sec.type}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : null
            )}

            {/* ── Scrubber ───────────────────────────────────────────── */}
            <div className="px-6 pt-3 pb-1">
                <div
                    className="relative w-full h-[2px] bg-[var(--border-strong)] rounded-full cursor-pointer"
                    onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onSeek(((e.clientX - rect.left) / rect.width) * duration);
                    }}
                >
                    <motion.div className="absolute left-0 top-0 h-full bg-[var(--text-main)] rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.1, ease: 'linear' }} />
                    <motion.div className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] bg-[var(--text-main)] rounded-full shadow" animate={{ left: `calc(${progress}% - 7px)` }} transition={{ duration: 0.1, ease: 'linear' }} />
                </div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-2 font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
                </div>
            </div>

            {/* ── Controls ──────────────────────────────────────────── */}
            <div className="flex items-center justify-center gap-10 py-5">
                <button onClick={() => skip(-10)} className="text-[var(--text-main)] active:opacity-60 transition-opacity"><Rewind size={34} fill="currentColor" /></button>
                <button onClick={togglePlay} className="w-20 h-20 bg-[var(--text-main)] rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-xl">
                    {isPlaying ? <Pause size={40} className="text-[var(--bg-main)]" fill="currentColor" /> : <Play size={40} className="text-[var(--bg-main)] ml-1" fill="currentColor" />}
                </button>
                <button onClick={() => skip(10)} className="text-[var(--text-main)] active:opacity-60 transition-opacity"><FastForward size={34} fill="currentColor" /></button>
                {!onDismiss && (
                    <button
                        onClick={() => {
                            if (isBeatLooping) onClearLoop?.();
                            else { const sec = activeSectionIdx >= 0 ? beatSections[activeSectionIdx] : null; if (sec) onSetLoopRegion?.(sec.startTime, sec.endTime); }
                        }}
                        className={cn('active:opacity-60 transition-opacity', isBeatLooping ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]')}
                    >
                        <Repeat2 size={28} />
                    </button>
                )}
            </div>

            {/* ── Volume — independent Recording / Beat channels ─────── */}
            <div className="flex flex-col gap-1 px-8 pt-1 pb-2">
                {activeSession && onVocalVolumeChange && (
                    <ChannelVolumeRow
                        label="Recording"
                        volume={vocalVolume}
                        muted={vocalMuted}
                        onVolumeChange={onVocalVolumeChange}
                        onMuteChange={onVocalMuteChange ?? (() => {})}
                    />
                )}
                {beatSrc && (
                    <ChannelVolumeRow
                        label="Beat"
                        volume={beatVolume}
                        muted={beatMuted}
                        onVolumeChange={onVolumeChange}
                        onMuteChange={onMuteChange}
                    />
                )}
                {!beatSrc && !(activeSession && onVocalVolumeChange) && (
                    <ChannelVolumeRow
                        label="Volume"
                        volume={beatVolume}
                        muted={beatMuted}
                        onVolumeChange={onVolumeChange}
                        onMuteChange={onMuteChange}
                    />
                )}
            </div>

            {/* Spacer to prevent overlap with floating navigation bar */}
            <div className="h-20" />
        </div>
    );
});
