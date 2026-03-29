'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Rewind, FastForward, Timer, MessageSquare, Grid2X2, Repeat2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { RecordingSession } from '@/types';
import { cn } from '@/lib/utils';

interface PlayerTabProps {
    session: RecordingSession | null;
    beatSrc: string | null;
    beatVolume: number;
    onBeatPlaybackChange?: (isPlaying: boolean) => void;
}

const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const PlayerTab: React.FC<PlayerTabProps> = ({
    session,
    beatSrc,
    beatVolume,
    onBeatPlaybackChange,
}) => {
    const audioRef  = useRef<HTMLAudioElement | null>(null);
    const beatRef   = useRef<HTMLAudioElement | null>(null);
    const pillRefs  = useRef<(HTMLDivElement | null)[]>([]);

    const [isPlaying, setIsPlaying]     = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration]       = useState(0);

    // Reset when session changes
    useEffect(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (beatRef.current) {
            beatRef.current.pause();
            beatRef.current.currentTime = 0;
        }
        onBeatPlaybackChange?.(false);
    }, [session?.id]);

    // Sync beat volume
    useEffect(() => {
        if (beatRef.current) beatRef.current.volume = beatVolume;
    }, [beatVolume]);

    const seekTo = useCallback((time: number) => {
        const clamped = Math.max(0, Math.min(duration || 0, time));
        if (audioRef.current) audioRef.current.currentTime = clamped;
        if (beatRef.current)  beatRef.current.currentTime  = clamped + (session?.beatOffset ?? 0);
        setCurrentTime(clamped);
    }, [duration, session?.beatOffset]);

    const skip = useCallback((delta: number) => {
        seekTo(currentTime + delta);
    }, [currentTime, seekTo]);

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
                beatRef.current.currentTime = (audioRef.current.currentTime) + (session?.beatOffset ?? 0);
                beatRef.current.volume = beatVolume;
                beatRef.current.play().catch(console.error);
                onBeatPlaybackChange?.(true);
            }
            setIsPlaying(true);
        }
    }, [isPlaying, beatSrc, beatVolume, session?.beatOffset, onBeatPlaybackChange]);

    // Active section index
    const sections = session?.sections ?? [];
    const activeSectionIdx = sections.findIndex(
        s => currentTime >= s.startTime && currentTime < s.endTime
    );

    // Auto-scroll active pill into centre of the scroll row
    useEffect(() => {
        if (activeSectionIdx >= 0) {
            pillRefs.current[activeSectionIdx]?.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest',
            });
        }
    }, [activeSectionIdx]);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // No session state
    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <p className="text-white/30 text-sm">Select a recording to use the player</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-main)]">
            {/* Hidden audio elements */}
            <audio
                ref={audioRef}
                src={session.audioUrl || session.base64}
                onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                onEnded={() => {
                    setIsPlaying(false);
                    beatRef.current?.pause();
                    onBeatPlaybackChange?.(false);
                }}
            />
            {beatSrc && <audio ref={beatRef} src={beatSrc} />}

            {/* Middle spacer / session info */}
            <div className="flex-1 flex flex-col items-center justify-center px-6">
                <p className="text-white/20 text-xs uppercase tracking-widest mb-2">Now Playing</p>
                <p className="text-white font-semibold text-lg text-center">{session.name || 'Untitled Recording'}</p>
                {session.transcription && (
                    <p className="text-white/40 text-sm text-center mt-2 line-clamp-2 max-w-xs">
                        {session.transcription}
                    </p>
                )}
            </div>

            {/* Section pills — arrow + pill in one scrollable row so they stay in sync */}
            {sections.length > 0 && (
                <div className="flex gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide mb-1">
                    {sections.map((sec, i) => {
                        const isActive = i === activeSectionIdx;
                        return (
                            <div
                                key={sec.id}
                                ref={el => { pillRefs.current[i] = el; }}
                                className="flex flex-col items-center shrink-0"
                                style={{ minWidth: 80 }}
                            >
                                {/* Arrow — visible only on active, hidden otherwise (keeps row height stable) */}
                                <motion.span
                                    className="text-[var(--accent)] text-sm font-bold mb-1 block"
                                    animate={{ opacity: isActive ? 1 : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    →
                                </motion.span>
                                <button
                                    onClick={() => seekTo(sec.startTime)}
                                    className={cn(
                                        'w-full px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all whitespace-nowrap',
                                        isActive
                                            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                                            : 'border-white/20 text-white bg-white/[0.07]'
                                    )}
                                >
                                    {sec.label || sec.type}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Scrubber */}
            <div className="px-5 mb-1">
                <div
                    className="relative w-full h-[3px] bg-white/20 rounded-full cursor-pointer"
                    onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        seekTo(((e.clientX - rect.left) / rect.width) * duration);
                    }}
                >
                    {/* Green fill */}
                    <div
                        className="absolute left-0 top-0 h-full bg-[var(--accent)] rounded-full"
                        style={{ width: `${progress}%` }}
                    />
                    {/* White dot */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md"
                        style={{ left: `calc(${progress}% - 8px)` }}
                    />
                </div>

                {/* Times */}
                <div className="flex justify-between text-xs text-white/50 mt-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-8 py-3">
                {/* Metronome / tempo — decorative */}
                <button className="text-white/40 hover:text-white/70 transition-colors">
                    <Timer size={22} />
                </button>

                {/* Rewind 10s */}
                <button
                    onClick={() => skip(-10)}
                    className="text-white hover:text-white/70 transition-colors"
                >
                    <Rewind size={26} fill="white" />
                </button>

                {/* Play / Pause */}
                <button
                    onClick={togglePlay}
                    className="w-[60px] h-[60px] bg-white rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                >
                    {isPlaying
                        ? <Pause size={24} className="text-black" fill="black" />
                        : <Play  size={24} className="text-black ml-0.5" fill="black" />}
                </button>

                {/* Fast forward 10s */}
                <button
                    onClick={() => skip(10)}
                    className="text-white hover:text-white/70 transition-colors"
                >
                    <FastForward size={26} fill="white" />
                </button>

                {/* Key / transpose — decorative */}
                <button className="text-white/40 hover:text-white/70 transition-colors text-sm font-bold tracking-tight">
                    b#
                </button>
            </div>

            {/* Bottom action bar */}
            <div className="flex items-center justify-center gap-6 pb-8 pt-2">
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <MessageSquare size={20} className="text-[var(--accent)]" />
                </button>
                <button className="w-10 h-10 flex items-center justify-center">
                    <Grid2X2 size={22} className="text-white/40" />
                </button>
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Repeat2 size={20} className="text-[var(--accent)]" />
                </button>
            </div>
        </div>
    );
};
