'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Rewind, FastForward, MessageSquare, Grid2X2, Repeat2, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecordingSession, Beat } from '@/types';
import { cn } from '@/lib/utils';

interface PlayerTabProps {
    session: RecordingSession | null;
    sessions?: RecordingSession[];
    beat?: Beat | null;
    beatSrc: string | null;
    beatVolume: number;
    isBeatLooping?: boolean;
    beatLoopStart?: number | null;
    beatLoopEnd?: number | null;
    onBeatPlaybackChange?: (isPlaying: boolean) => void;
    onSetLoopRegion?: (startTime: number, endTime: number) => void;
}

const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const PlayerTab: React.FC<PlayerTabProps> = ({
    session,
    sessions,
    beat,
    beatSrc,
    beatVolume,
    isBeatLooping,
    beatLoopStart,
    beatLoopEnd,
    onBeatPlaybackChange,
    onSetLoopRegion,
}) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const beatRef  = useRef<HTMLAudioElement | null>(null);
    const pillRefs = useRef<(HTMLDivElement | null)[]>([]);

    const [isPlaying, setIsPlaying]     = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration]       = useState(0);
    const [beatMuted, setBeatMuted]     = useState(false);
    const [selectedSession, setSelectedSession] = useState<RecordingSession | null>(session);

    // Reset when session changes
    useEffect(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        if (beatRef.current)  { beatRef.current.pause();  beatRef.current.currentTime  = 0; }
        onBeatPlaybackChange?.(false);
    }, [session?.id]);

    // Sync selected session when parent session changes
    useEffect(() => {
        setSelectedSession(session);
    }, [session?.id]);

    // Sync beat volume and mute state
    useEffect(() => {
        if (beatRef.current) {
            beatRef.current.volume = beatMuted ? 0 : beatVolume;
        }
    }, [beatMuted, beatVolume]);

    const seekTo = useCallback((time: number) => {
        const clamped = Math.max(0, Math.min(duration || 0, time));
        if (audioRef.current) audioRef.current.currentTime = clamped;
        if (beatRef.current)  beatRef.current.currentTime  = clamped + (selectedSession?.beatOffset ?? 0);
        setCurrentTime(clamped);
    }, [duration, selectedSession?.beatOffset]);

    const skip = useCallback((delta: number) => seekTo(currentTime + delta), [currentTime, seekTo]);

    const togglePlay = useCallback(() => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            beatRef.current?.pause();
            onBeatPlaybackChange?.(false);
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(console.error);
            if (beatRef.current && beatSrc) {
                beatRef.current.currentTime = audioRef.current.currentTime + (selectedSession?.beatOffset ?? 0);
                beatRef.current.volume = beatVolume;
                beatRef.current.play().catch(console.error);
                onBeatPlaybackChange?.(true);
            }
            setIsPlaying(true);
        }
    }, [isPlaying, beatSrc, beatVolume, selectedSession?.beatOffset, onBeatPlaybackChange]);

    // Derived — beat sections drive pills, fall back to selected session sections
    const sections        = beat?.sections ?? selectedSession?.sections ?? [];
    const activeSectionIdx = sections.findIndex(s => currentTime >= s.startTime && currentTime < s.endTime);
    const progress         = duration > 0 ? (currentTime / duration) * 100 : 0;

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

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <p className="text-white/30 text-sm">Select a recording to use the player</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-main)] select-none">
            {/* Hidden audio */}
            <audio
                ref={audioRef}
                src={selectedSession?.audioUrl || selectedSession?.base64}
                onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                onEnded={() => { setIsPlaying(false); beatRef.current?.pause(); onBeatPlaybackChange?.(false); }}
            />
            {beatSrc && (
                <audio
                    ref={beatRef}
                    src={beatSrc}
                    onTimeUpdate={e => {
                        if (isBeatLooping && beatLoopStart != null && beatLoopEnd != null) {
                            if (e.currentTarget.currentTime >= beatLoopEnd) {
                                e.currentTarget.currentTime = beatLoopStart;
                            }
                        }
                    }}
                />
            )}

            {/* ── Lyrics display ─────────────────────────────────────── */}
            <div className="flex-1 overflow-hidden px-6 pt-10 pb-4 flex flex-col justify-end">
                {!selectedSession?.transcription ? (
                    // Empty state: animated dots + helpful copy
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="flex gap-2">
                            <motion.div
                                className="w-2 h-2 bg-white rounded-full"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                            <motion.div
                                className="w-2 h-2 bg-white rounded-full"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                            />
                            <motion.div
                                className="w-2 h-2 bg-white rounded-full"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                            />
                        </div>
                        <p className="text-white/40 text-sm text-center max-w-xs">
                            No lyrics to display yet. Record your vocal to see it transcribed here.
                        </p>
                    </div>
                ) : (
                    // Lyrics display: sections (beat or vocal) with transcription
                    <div className="flex flex-col gap-3">
                        {sections.map((sec, i) => {
                            const offset = i - (activeSectionIdx < 0 ? 0 : activeSectionIdx);
                            // Only render ±2 from active
                            if (Math.abs(offset) > 2) return null;
                            const text = sec.transcription || sec.label || sec.type;
                            const isActive = offset === 0;
                            const opacity = isActive
                                ? 1
                                : offset === 1 ? 0.45
                                : offset === -1 ? 0.3
                                : 0.18;
                            return (
                                <motion.p
                                    key={sec.id}
                                    onClick={() => seekTo(sec.startTime)}
                                    className="text-left font-bold text-white leading-tight cursor-pointer"
                                    style={{ fontSize: isActive ? '2rem' : '1.5rem', lineHeight: 1.15 }}
                                    animate={{ opacity }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {text}
                                </motion.p>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Take selector ──────────────────────────────────────── */}
            {sessions && sessions.length > 1 && (
                <div className="flex gap-2 overflow-x-auto px-6 pb-1 pt-3 scrollbar-hide">
                    {sessions.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => setSelectedSession(s)}
                            className={cn(
                                'shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                                selectedSession?.id === s.id
                                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                                    : 'border-white/20 text-white/50 bg-white/[0.05]'
                            )}
                        >
                            Take {i + 1}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Section pills ──────────────────────────────────────── */}
            {sections.length > 0 && (
                <div className="flex gap-3 overflow-x-auto px-6 pb-2 pt-4 scrollbar-hide">
                    {sections.map((sec, i) => {
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
                                        seekTo(sec.startTime);
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
                        seekTo(((e.clientX - rect.left) / rect.width) * duration);
                    }}
                >
                    <motion.div
                        className="absolute left-0 top-0 h-full bg-white rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.08, ease: 'linear' }}
                    />
                    <motion.div
                        className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] bg-white rounded-full shadow"
                        animate={{ left: `calc(${progress}% - 7px)` }}
                        transition={{ duration: 0.08, ease: 'linear' }}
                    />
                </div>
                <div className="flex justify-between text-xs text-white/50 mt-2 font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
                </div>
            </div>

            {/* ── Controls — 3 equal-weight filled icons, no circle ──── */}
            <div className="flex items-center justify-center gap-16 py-5">
                <button
                    onClick={() => skip(-10)}
                    className="text-white active:opacity-60 transition-opacity"
                >
                    <Rewind size={34} fill="white" />
                </button>

                <button
                    onClick={togglePlay}
                    className="text-white active:opacity-60 transition-opacity"
                >
                    {isPlaying
                        ? <Pause size={38} fill="white" />
                        : <Play  size={38} fill="white" className="ml-0.5" />}
                </button>

                <button
                    onClick={() => skip(10)}
                    className="text-white active:opacity-60 transition-opacity"
                >
                    <FastForward size={34} fill="white" />
                </button>
            </div>

            {/* ── Bottom action bar ──────────────────────────────────── */}
            <div className="flex items-center justify-center gap-10 pb-8 pt-1">
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <MessageSquare size={20} className="text-[var(--accent)]" />
                </button>
                <button
                    onClick={() => setBeatMuted(m => !m)}
                    className="w-10 h-10 flex items-center justify-center"
                >
                    {beatMuted
                        ? <VolumeX size={22} className="text-white/40" />
                        : <Volume2 size={22} className="text-white/40" />}
                </button>
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Repeat2 size={20} className="text-[var(--accent)]" />
                </button>
            </div>
        </div>
    );
};
