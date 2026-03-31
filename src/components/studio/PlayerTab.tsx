'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Rewind, FastForward, MessageSquare, Repeat2, Volume2, Volume1, VolumeX, Languages, List, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecordingSession, Beat, LyricSection, TranscriptionLine } from '@/types';
import { cn } from '@/lib/utils';

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
    isBeatLooping?: boolean;
    beatLoopStart?: number | null;
    beatLoopEnd?: number | null;
    onBeatPlaybackChange?: (isPlaying: boolean) => void;
    onSetLoopRegion?: (startTime: number, endTime: number) => void;
    onClearLoop?: () => void;
    lyrics?: LyricSection[];
    onSelectSession?: (id: string) => void;
    
    // Lifted State Props
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onTogglePlay: (play?: boolean) => void;
    onSeek: (time: number) => void;
}

const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const PlayerTab: React.FC<PlayerTabProps> = ({
    projectTitle,
    session,
    sessions,
    beat,
    beatSrc,
    beatVolume,
    beatMuted,
    onVolumeChange,
    onMuteChange,
    isBeatLooping,
    beatLoopStart,
    beatLoopEnd,
    onBeatPlaybackChange,
    onSetLoopRegion,
    onClearLoop,
    lyrics,
    onSelectSession,
    
    // Lifted
    isPlaying,
    currentTime,
    duration,
    onTogglePlay,
    onSeek,
}) => {
    const pillRefs = useRef<(HTMLDivElement | null)[]>([]);
    const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);
    const [showTakeList, setShowTakeList] = useState(false);

    const skip = (delta: number) => onSeek(currentTime + delta);

    const togglePlay = () => onTogglePlay();

    // Use the session provided by the parent (StudioWorkspace)
    const activeSession = session;
    const sessionIdx = sessions && activeSession ? sessions.findIndex(s => s.id === activeSession.id) : -1;

    // Derived — beat sections drive pills ONLY
    const beatCurrentTime = currentTime + (activeSession?.beatOffset ?? 0);
    const beatSections = beat?.sections ?? [];
    const activeSectionIdx = beatSections.findIndex(s => beatCurrentTime >= s.startTime && beatCurrentTime < s.endTime);
    const progress         = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Transcription Lines from the active session ONLY
    const displayLines = activeSession?.lines || [];

    const activeLyricIdx = useMemo(() => {
        if (displayLines.length === 0) return -1;
        const lookaheadTime = currentTime + 0.1;
        const idx = displayLines.findIndex(l => lookaheadTime >= l.startTime && lookaheadTime < l.endTime);
        if (idx !== -1) return idx;
        if (lookaheadTime >= displayLines[displayLines.length - 1].endTime) {
            return displayLines.length - 1;
        }
        return -1;
    }, [displayLines, currentTime]);

    // Auto-scroll active pill into centre of scroll row
    useEffect(() => {
        if (activeSectionIdx >= 0) {
            pillRefs.current[activeSectionIdx]?.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest',
            });
        }
    }, [activeSectionIdx]);

    // Auto-scroll active lyric
    useEffect(() => {
        if (activeLyricIdx >= 0) {
            lyricRefs.current[activeLyricIdx]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [activeLyricIdx]);

    return (
        <div className="flex flex-col h-full bg-[var(--bg-main)] select-none">
            {/* ── Integrated Header ───────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2 z-30">
                <div className="flex flex-col">
                    <span className="text-[10px] mono uppercase tracking-[0.2em] text-white/40 mb-0.5">Now Playing</span>
                    <h2 className="text-sm font-bold text-white tracking-tight truncate max-w-[180px]">{projectTitle}</h2>
                </div>

                {sessions && sessions.length > 0 && (
                    <div className="relative">
                        <button 
                            onClick={() => setShowTakeList(!showTakeList)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
                        >
                            <span className="text-[10px] font-bold text-[var(--accent)] mono">TAKE {sessionIdx + 1}</span>
                            <ChevronDown size={14} className={cn("text-white/40 transition-transform duration-300", showTakeList && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                            {showTakeList && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowTakeList(false)} />
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-2 w-40 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-1"
                                    >
                                        {sessions.map((s, i) => (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    onSelectSession?.(s.id);
                                                    setShowTakeList(false);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-4 py-3 text-xs font-semibold transition-colors flex items-center justify-between",
                                                    activeSession?.id === s.id ? "text-[var(--accent)] bg-[var(--accent)]/5" : "text-white/60 hover:bg-white/5"
                                                )}
                                            >
                                                <span>Take {i + 1}</span>
                                                {activeSession?.id === s.id && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* ── Lyrics display ─────────────────────────────────────── */}
            <div className="flex-1 overflow-hidden px-6 pt-2 pb-4 flex flex-col justify-end relative">
                {displayLines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="flex gap-2">
                            <motion.div className="w-2 h-2 bg-white rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />
                            <motion.div className="w-2 h-2 bg-white rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} />
                            <motion.div className="w-2 h-2 bg-white rounded-full" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }} />
                        </div>
                        <p className="text-white/40 text-sm text-center max-w-xs uppercase tracking-widest font-mono text-[10px]">
                            {activeSession ? "Syncing transcription..." : "Awaiting first take..."}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8 overflow-y-auto scrollbar-hide py-[30vh] mask-fade-edges" style={{ scrollBehavior: 'smooth' }}>
                        {displayLines.map((line, i) => {
                            const isActive = i === activeLyricIdx;
                            const isPast = i < activeLyricIdx;
                            const isFuture = i > activeLyricIdx;
                            const distance = Math.abs(i - activeLyricIdx);
                            
                            let opacity = 0.08; let scale = 0.94; let blur = '3px';

                            if (isActive) { opacity = 1; scale = 1.05; blur = '0px'; }
                            else if (isPast) {
                                if (distance === 1) { opacity = 0.35; scale = 0.98; blur = '1px'; }
                                else { opacity = 0.15; scale = 0.96; blur = '2px'; }
                            } else if (isFuture) {
                                if (distance === 1) { opacity = 0.25; scale = 1; blur = '2px'; }
                                else if (distance === 2) { opacity = 0.12; scale = 0.98; blur = '2.5px'; }
                                else { opacity = 0.05; scale = 0.95; blur = '4px'; }
                            }
                            if (activeLyricIdx === -1 && i === 0) { opacity = 0.25; blur = '2px'; }

                            return (
                                <motion.div
                                    key={`line-${i}`}
                                    ref={el => { lyricRefs.current[i] = el; }}
                                    className={cn("text-left cursor-pointer origin-left", isActive ? "text-white" : "text-white/80")}
                                    initial={false}
                                    animate={{ opacity, scale, filter: `blur(${blur})` }}
                                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                                    onClick={() => onSeek(line.startTime)}
                                >
                                    <p className={cn("text-2xl md:text-3xl font-bold leading-[1.15] tracking-tight", isActive ? "drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]" : "")}>
                                        {line.text}
                                    </p>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
                
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[var(--bg-main)] to-transparent pointer-events-none z-10" />
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--bg-main)] to-transparent pointer-events-none z-10" />
            </div>

            {/* ── Section pills — Primary Structure ────────────────────── */}
            {beat && beatSections.length > 0 && (
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
                                        onSetLoopRegion?.(sec.startTime, sec.endTime);
                                    }}
                                    className={cn(
                                        'w-full px-4 py-2 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap',
                                        isActive
                                            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                                            : 'border-white/20 text-white/70 bg-white/[0.07]'
                                    )}
                                >
                                    {sec.label || sec.type}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Scrubber ───────────────────────────────────────────── */}
            <div className="px-6 pt-3 pb-1">
                <div
                    className="relative w-full h-[2px] bg-white/20 rounded-full cursor-pointer"
                    onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onSeek(((e.clientX - rect.left) / rect.width) * duration);
                    }}
                >
                    <motion.div className="absolute left-0 top-0 h-full bg-white rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.1, ease: 'linear' }} />
                    <motion.div className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] bg-white rounded-full shadow" animate={{ left: `calc(${progress}% - 7px)` }} transition={{ duration: 0.1, ease: 'linear' }} />
                </div>
                <div className="flex justify-between text-xs text-white/50 mt-2 font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
                </div>
            </div>

            {/* ── Controls ──────────────────────────────────────────── */}
            <div className="flex items-center justify-center gap-10 py-5">
                <button className="text-white/40 active:opacity-60 transition-opacity"><SlidersHorizontal size={26} /></button>
                <button onClick={() => skip(-10)} className="text-white active:opacity-60 transition-opacity"><Rewind size={34} fill="white" /></button>
                <button onClick={togglePlay} className="w-20 h-20 bg-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-xl">
                    {isPlaying ? <Pause size={40} className="text-black" fill="black" /> : <Play size={40} className="text-black ml-1" fill="black" />}
                </button>
                <button onClick={() => skip(10)} className="text-white active:opacity-60 transition-opacity"><FastForward size={34} fill="white" /></button>
                <button
                    onClick={() => {
                        if (isBeatLooping) onClearLoop?.();
                        else { const sec = activeSectionIdx >= 0 ? beatSections[activeSectionIdx] : null; if (sec) onSetLoopRegion?.(sec.startTime, sec.endTime); }
                    }}
                    className={cn('active:opacity-60 transition-opacity', isBeatLooping ? 'text-[var(--accent)]' : 'text-white/40')}
                >
                    <Repeat2 size={28} />
                </button>
            </div>

            {/* ── Volume ─────── */}
            <div className="flex items-center gap-3 px-8 pt-1 pb-2">
                <button onClick={() => beatMuted ? onMuteChange(false) : onVolumeChange(Math.max(0, beatVolume - 0.1))} className="text-white/40 shrink-0 active:opacity-60 transition-opacity"><Volume1 size={16} /></button>
                <input type="range" min={0} max={1} step={0.01} value={beatMuted ? 0 : beatVolume} onChange={e => { const v = parseFloat(e.target.value); onVolumeChange(v); if (v > 0 && beatMuted) onMuteChange(false); if (v === 0) onMuteChange(true); }}
                    className="flex-1 h-[3px] accent-white appearance-none bg-white/20 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[14px] [&::-webkit-slider-thumb]:h-[14px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
                    style={{ background: `linear-gradient(to right, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) ${(beatMuted ? 0 : beatVolume) * 100}%, rgba(255,255,255,0.2) ${(beatMuted ? 0 : beatVolume) * 100}%, rgba(255,255,255,0.2) 100%)` }}
                />
                <button onClick={() => beatMuted ? (onMuteChange(false), onVolumeChange(1)) : onVolumeChange(Math.min(1, beatVolume + 0.1))} className="text-white/40 shrink-0 active:opacity-60 transition-opacity"><Volume2 size={16} /></button>
            </div>

            {/* ── Bottom action bar ────── */}
            <div className="flex items-center justify-evenly pb-8 pt-3">
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"><MessageSquare size={20} className="text-white/60" /></button>
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"><Languages size={20} className="text-white/60" /></button>
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"><List size={20} className="text-white/60" /></button>
            </div>
        </div>
    );
};
