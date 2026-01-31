"use client";

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, X, Music, Repeat, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeatUploaderProps {
    audioSrc: string | null;
    onUpload: (file: File) => void;
    onClear: () => void;
}

/**
 * BeatUploader - Embedded beat player with loop controls
 */
export function BeatUploader({ audioSrc, onUpload, onClear }: BeatUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    // Loop state
    const [isLooping, setIsLooping] = useState(true);
    const [loopStart, setLoopStart] = useState<number | null>(null);
    const [loopEnd, setLoopEnd] = useState<number | null>(null);
    const [draggingMarker, setDraggingMarker] = useState<"start" | "end" | null>(null);

    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch((err) => {
                    console.log("Playback prevented:", err);
                    setIsPlaying(false);
                });
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying]);

    // Handle loop logic during playback
    const handleTimeUpdate = () => {
        if (audioRef.current && !draggingMarker) {
            const curr = audioRef.current.currentTime;
            setCurrentTime(curr);

            if (isLooping && loopStart !== null && loopEnd !== null) {
                if (curr >= loopEnd || curr < loopStart) {
                    audioRef.current.currentTime = loopStart;
                }
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            const dur = audioRef.current.duration;
            setDuration(dur);
            setIsPlaying(true);
            // Default loop to full song
            setLoopStart(0);
            setLoopEnd(dur);
        }
    };

    // Dragging logic for loop markers
    useEffect(() => {
        const handleMove = (clientX: number) => {
            if (!progressRef.current || duration === 0) return;
            const rect = progressRef.current.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const time = percent * duration;

            if (draggingMarker === "start") {
                const endLimit = loopEnd ?? duration;
                // Enforce min loop size of 1s
                const newStart = Math.min(time, endLimit - 1);
                setLoopStart(Math.max(0, newStart));
            } else if (draggingMarker === "end") {
                const startLimit = loopStart ?? 0;
                const newEnd = Math.max(time, startLimit + 1);
                setLoopEnd(Math.min(newEnd, duration));
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (draggingMarker) {
                e.preventDefault();
                handleMove(e.clientX);
            }
        };

        const onMouseUp = () => setDraggingMarker(null);

        if (draggingMarker) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [draggingMarker, duration, loopEnd, loopStart]);


    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (draggingMarker) return;
        if (!audioRef.current || !progressRef.current || duration === 0) return;
        const rect = progressRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audioRef.current.currentTime = percent * duration;
        setCurrentTime(percent * duration);
    };

    const formatTime = (t: number) => {
        if (!t && t !== 0) return "0:00";
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(file);
        }
    };

    // Empty state
    if (!audioSrc) {
        return (
            <div className="w-full flex justify-start animate-in fade-in">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-2.5 flex items-center gap-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all group cursor-pointer"
                >
                    <div className="w-8 h-8 rounded bg-[var(--bg-card)] flex items-center justify-center border border-[var(--border-subtle)]">
                        <Music size={14} />
                    </div>
                    <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-primary)]">Track 1</span>
                        <span className="text-[9px] text-[var(--text-secondary)]">Empty • Tap to load beat</span>
                    </div>
                </button>
            </div>
        );
    }

    const loopStartPercent = loopStart !== null ? (loopStart / duration) * 100 : 0;
    const loopWidthPercent = loopStart !== null && loopEnd !== null ? ((loopEnd - loopStart) / duration) * 100 : 100;

    // Loaded state
    return (
        <div className={cn(
            "w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg flex flex-col animate-in fade-in slide-in-from-top-1 transition-all duration-300 overflow-hidden",
            isCollapsed ? "p-0" : "p-3 gap-3"
        )}>
            <audio
                ref={audioRef}
                src={audioSrc}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                loop={isLooping}
            />

            {/* Header */}
            <div className={cn("flex items-center justify-between select-none", isCollapsed && "p-2")}>
                <div
                    className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <div
                        onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
                        className={cn(
                            "w-9 h-9 rounded flex items-center justify-center transition-all shrink-0 cursor-pointer",
                            isPlaying
                                ? "bg-[var(--accent-primary)] text-[var(--bg-main)] shadow-[0_0_10px_var(--accent-primary)]"
                                : "bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]"
                        )}
                    >
                        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                    </div>

                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">Reference Track</span>
                            <span className="text-[9px] font-mono text-[var(--text-muted)] tabular-nums">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                        </div>
                        {isCollapsed && (
                            <div className="w-full h-0.5 bg-[var(--bg-card)] mt-1.5 rounded-full overflow-hidden relative max-w-[120px]">
                                <div
                                    className="absolute top-0 bottom-0 left-0 bg-[var(--text-secondary)]"
                                    style={{ width: `${(currentTime / duration) * 100}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => setIsLooping(!isLooping)}
                        className={cn(
                            "p-1.5 rounded transition-colors cursor-pointer",
                            isLooping
                                ? "text-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        )}
                        title={isLooping ? "Loop On" : "Loop Off"}
                    >
                        <Repeat size={14} />
                    </button>
                    <button
                        onClick={onClear}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-destructive)] rounded transition-colors cursor-pointer"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Expanded Controls */}
            {!isCollapsed && (
                <div className="relative pt-4 pb-2 select-none">
                    <div
                        ref={progressRef}
                        onClick={handleSeek}
                        className="w-full h-12 bg-[var(--bg-card)] rounded-md cursor-pointer relative group overflow-hidden border border-[var(--border-subtle)]"
                    >
                        {/* Waveform Visualization (Simulated) */}
                        <div className="absolute inset-0 flex items-center justify-around px-1 opacity-20 pointer-events-none">
                            {Array.from({ length: 50 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="w-0.5 bg-[var(--text-primary)] rounded-full"
                                    style={{
                                        height: `${20 + Math.sin(i * 0.3) * 40 + Math.random() * 20}%`
                                    }}
                                />
                            ))}
                        </div>

                        {/* Loop Region Highlight */}
                        {isLooping && (
                            <div
                                className="absolute top-0 bottom-0 bg-[var(--accent-primary)]/10 border-x border-[var(--accent-primary)]/30"
                                style={{
                                    left: `${loopStartPercent}%`,
                                    width: `${loopWidthPercent}%`
                                }}
                            />
                        )}

                        {/* Progress Fill */}
                        <div
                            className="absolute top-0 bottom-0 left-0 bg-[var(--text-secondary)]/10 pointer-events-none"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                        />

                        {/* Playhead */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-[var(--text-primary)] z-10 pointer-events-none"
                            style={{ left: `${(currentTime / duration) * 100}%` }}
                        />
                    </div>

                    {/* Loop Handles */}
                    {isLooping && (
                        <>
                            {/* Start Handle */}
                            <div
                                className="absolute top-1 bottom-1 w-4 -ml-2 flex flex-col items-center justify-center group cursor-ew-resize z-20"
                                style={{ left: `${loopStartPercent}%` }}
                                onMouseDown={() => setDraggingMarker("start")}
                            >
                                <div className="h-full w-0.5 bg-[var(--accent-primary)] group-hover:bg-[var(--accent-cta)]" />
                                <div className="absolute top-0 w-2 h-2 rounded-full bg-[var(--accent-primary)] group-hover:scale-125 transition-transform" />
                                <div className="absolute -top-4 text-[9px] font-mono text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 bg-[var(--bg-card)] px-1 rounded border border-[var(--border-subtle)]">
                                    {formatTime(loopStart || 0)}
                                </div>
                            </div>

                            {/* End Handle */}
                            <div
                                className="absolute top-1 bottom-1 w-4 -ml-2 flex flex-col items-center justify-center group cursor-ew-resize z-20"
                                style={{ left: `${(loopStartPercent + loopWidthPercent)}%` }}
                                onMouseDown={() => setDraggingMarker("end")}
                            >
                                <div className="h-full w-0.5 bg-[var(--accent-primary)] group-hover:bg-[var(--accent-cta)]" />
                                <div className="absolute bottom-0 w-2 h-2 rounded-full bg-[var(--accent-primary)] group-hover:scale-125 transition-transform" />
                                <div className="absolute -bottom-4 text-[9px] font-mono text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 bg-[var(--bg-card)] px-1 rounded border border-[var(--border-subtle)]">
                                    {formatTime(loopEnd || duration)}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
