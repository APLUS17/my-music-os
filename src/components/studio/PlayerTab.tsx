'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Rewind, FastForward, MessageSquare, Repeat2, Volume2, Volume1, VolumeX, Languages, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecordingSession, Beat, LyricSection, TranscriptionLine } from '@/types';
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
    onClearLoop?: () => void;
    lyrics?: LyricSection[];
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
    onClearLoop,
    lyrics,
}) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const beatRef  = useRef<HTMLAudioElement | null>(null);
    const pillRefs = useRef<(HTMLDivElement | null)[]>([]);
    const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);

    const [isPlaying, setIsPlaying]     = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [beatCurrentTime, setBeatCurrentTime] = useState(0);
    const [duration, setDuration]       = useState(0);
    const [beatMuted, setBeatMuted]     = useState(false);
    const [localVolume, setLocalVolume] = useState(beatVolume);
    const [selectedSession, setSelectedSession] = useState<RecordingSession | null>(session);

    // Reset when session changes
    useEffect(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        setBeatCurrentTime(0);
        setDuration(0);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        if (beatRef.current)  { beatRef.current.pause();  beatRef.current.currentTime  = 0; }
        onBeatPlaybackChange?.(false);
    }, [session?.id]);

    // Sync selected session when parent session changes
    useEffect(() => {
        setSelectedSession(session);
    }, [session?.id]);

    // Reset audio state when selected take changes
    useEffect(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        setBeatCurrentTime(0);
        setDuration(0);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    }, [selectedSession?.id]);

    // Sync beat volume and mute state
    useEffect(() => {
        if (beatRef.current) {
            beatRef.current.volume = beatMuted ? 0 : localVolume;
        }
    }, [beatMuted, localVolume]);

    const seekTo = useCallback((time: number) => {
        const clamped = Math.max(0, Math.min(duration || 0, time));
        if (audioRef.current) audioRef.current.currentTime = clamped;
        
        if (beatRef.current)  {
            let beatTime = clamped + (selectedSession?.beatOffset ?? 0);
            
            // Handle loop wrap-around if looping is active
            if (isBeatLooping && beatLoopStart !== null && beatLoopEnd !== null) {
                const loopDuration = beatLoopEnd - beatLoopStart;
                if (loopDuration > 0) {
                    const offsetInLoop = (beatTime - beatLoopStart) % loopDuration;
                    beatTime = beatLoopStart + (offsetInLoop < 0 ? offsetInLoop + loopDuration : offsetInLoop);
                }
            }
            
            beatRef.current.currentTime = beatTime;
            setBeatCurrentTime(beatTime);
        }
        setCurrentTime(clamped);
    }, [duration, selectedSession?.beatOffset, isBeatLooping, beatLoopStart, beatLoopEnd]);

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
                let beatTime = audioRef.current.currentTime + (selectedSession?.beatOffset ?? 0);
                
                // Handle loop wrap-around if looping is active
                if (isBeatLooping && beatLoopStart !== null && beatLoopEnd !== null) {
                    const loopDuration = beatLoopEnd - beatLoopStart;
                    if (loopDuration > 0) {
                        const offsetInLoop = (beatTime - beatLoopStart) % loopDuration;
                        beatTime = beatLoopStart + (offsetInLoop < 0 ? offsetInLoop + loopDuration : offsetInLoop);
                    }
                }

                beatRef.current.currentTime = beatTime;
                setBeatCurrentTime(beatTime);
                beatRef.current.volume = beatMuted ? 0 : localVolume;
                beatRef.current.play().catch(console.error);
                onBeatPlaybackChange?.(true);
            }
            setIsPlaying(true);
        }
    }, [isPlaying, beatSrc, beatMuted, localVolume, selectedSession?.beatOffset, onBeatPlaybackChange, isBeatLooping, beatLoopStart, beatLoopEnd]);

    // Derived — beat sections drive pills ONLY
    const sections = beat?.sections ?? [];
    const activeSectionIdx = sections.findIndex(s => beatCurrentTime >= s.startTime && beatCurrentTime < s.endTime);
    const progress         = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Real transcription lines
    const transcriptionLines = selectedSession?.lines || [];
    const activeLyricIdx = useMemo(() => {
        if (transcriptionLines.length === 0) return -1;
        
        // Find line where current time falls within bounds
        const idx = transcriptionLines.findIndex(l => currentTime >= l.startTime && currentTime < l.endTime);
        if (idx !== -1) return idx;

        // If we passed the last line, keep the last one active
        if (currentTime >= transcriptionLines[transcriptionLines.length - 1].endTime) {
            return transcriptionLines.length - 1;
        }

        return -1;
    }, [transcriptionLines, currentTime]);

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
                        const time = e.currentTarget.currentTime;
                        setBeatCurrentTime(time);
                        if (isBeatLooping && beatLoopStart != null && beatLoopEnd != null) {
                            if (time >= beatLoopEnd) {
                                e.currentTarget.currentTime = beatLoopStart;
                            }
                        }
                    }}
                />
            )}

            {/* ── Lyrics display ─────────────────────────────────────── */}
            <div className="flex-1 overflow-hidden px-6 pt-10 pb-4 flex flex-col justify-end">
                {transcriptionLines.length === 0 ? (
                    // Loading / Empty state
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
                            {selectedSession?.transcription ? "Processing lyrics..." : "No lyrics detected in this recording."}
                        </p>
                    </div>
                ) : (
                    // Apple Music Style Lyrics
                    <div className="flex flex-col gap-6 overflow-y-auto scrollbar-hide py-[20vh]">
                        {transcriptionLines.map((line, i) => {
                            const offset = i - activeLyricIdx;
                            // Only render near lines
                            if (Math.abs(offset) > 5) return null;

                            const isActive = i === activeLyricIdx;
                            
                            // Visual properties based on offset
                            let opacity = 0.08;
                            let fontSize = '1rem';
                            let fontWeight = 400;

                            if (isActive) {
                                opacity = 1;
                                fontSize = '1.75rem';
                                fontWeight = 600;
                            } else if (offset === -1) { // Just sang
                                opacity = 0.45;
                                fontSize = '1.2rem';
                            } else if (offset === 1) { // Coming next
                                opacity = 0.35;
                                fontSize = '1.1rem';
                            } else if (Math.abs(offset) === 2) {
                                opacity = 0.18;
                                fontSize = '1rem';
                            }

                            return (
                                <motion.p
                                    key={`line-${i}`}
                                    ref={el => { lyricRefs.current[i] = el; }}
                                    className="text-left text-white leading-tight cursor-pointer transition-all duration-500"
                                    style={{ fontSize, fontWeight }}
                                    animate={{ opacity }}
                                    onClick={() => seekTo(line.startTime)}
                                >
                                    {line.text}
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

            {/* ── Section pills — Beat Mode Only ────────────────────── */}
            {beat && sections.length > 0 && (
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
                                        const vocalTime = sec.startTime - (selectedSession?.beatOffset ?? 0);
                                        seekTo(Math.max(0, vocalTime));
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

            {/* ── Controls ──────────────────────────────────────────── */}
            <div className="flex items-center justify-center gap-10 py-5">
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

                <button
                    onClick={() => {
                        if (isBeatLooping) {
                            onClearLoop?.();
                        } else {
                            const sec = activeSectionIdx >= 0 ? sections[activeSectionIdx] : null;
                            if (sec) onSetLoopRegion?.(sec.startTime, sec.endTime);
                        }
                    }}
                    className={cn('active:opacity-60 transition-opacity', isBeatLooping ? 'text-[var(--accent)]' : 'text-white/40')}
                >
                    <Repeat2 size={28} />
                </button>
            </div>

            {/* ── Volume slider — iOS style with speaker icons ─────── */}
            <div className="flex items-center gap-3 px-8 pt-1 pb-2">
                <button
                    onClick={() => {
                        if (beatMuted) { setBeatMuted(false); }
                        else { setLocalVolume(Math.max(0, localVolume - 0.1)); }
                    }}
                    className="text-white/40 shrink-0 active:opacity-60 transition-opacity"
                >
                    <Volume1 size={16} />
                </button>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={beatMuted ? 0 : localVolume}
                    onChange={e => {
                        const v = parseFloat(e.target.value);
                        setLocalVolume(v);
                        if (v > 0 && beatMuted) setBeatMuted(false);
                        if (v === 0) setBeatMuted(true);
                    }}
                    className="flex-1 h-[3px] accent-white appearance-none bg-white/20 rounded-full cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[14px] [&::-webkit-slider-thumb]:h-[14px]
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow
                        [&::-moz-range-thumb]:w-[14px] [&::-moz-range-thumb]:h-[14px]
                        [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                    style={{
                        background: `linear-gradient(to right, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) ${(beatMuted ? 0 : localVolume) * 100}%, rgba(255,255,255,0.2) ${(beatMuted ? 0 : localVolume) * 100}%, rgba(255,255,255,0.2) 100%)`
                    }}
                />
                <button
                    onClick={() => {
                        if (beatMuted) { setBeatMuted(false); setLocalVolume(1); }
                        else { setLocalVolume(Math.min(1, localVolume + 0.1)); }
                    }}
                    className="text-white/40 shrink-0 active:opacity-60 transition-opacity"
                >
                    <Volume2 size={16} />
                </button>
            </div>

            {/* ── Bottom action bar — matches reference layout ────── */}
            <div className="flex items-center justify-evenly pb-8 pt-3">
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition-transform">
                    <MessageSquare size={20} className="text-white/60" />
                </button>
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition-transform">
                    <Languages size={20} className="text-white/60" />
                </button>
                <button className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center active:scale-95 transition-transform">
                    <List size={20} className="text-white/60" />
                </button>
            </div>
        </div>
    );
};
