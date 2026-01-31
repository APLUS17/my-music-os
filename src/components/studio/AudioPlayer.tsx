"use client";

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, Repeat, Volume2, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface AudioPlayerProps {
    src?: string;
    className?: string;
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const current = audioRef.current.currentTime;
            const total = audioRef.current.duration;
            setProgress((current / (total || 1)) * 100);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    const barConfig = React.useMemo(() => {
        return Array.from({ length: 48 }).map((_, i) => ({
            animationDuration: `${0.3 + Math.random() * 0.5}s`,
            animationDelay: `${i * 0.03}s`
        }));
    }, []);

    return (
        <div
            className={cn(
                "flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-black/20 relative group/player",
                className
            )}
        >
            {/* Visualizer Section */}
            <div className="relative flex-1 bg-black/40 overflow-hidden flex items-center justify-center pt-8">
                <div className="flex items-end gap-[1.5px] h-32 opacity-80">
                    {barConfig.map((config, i) => (
                        <div
                            key={i}
                            className="w-[3px] rounded-t-full bg-gradient-to-t from-pink-500/20 to-pink-500"
                            style={{
                                height: isPlaying ? `${15 + Math.random() * 85}%` : "8%",
                                transition: "height 0.2s ease-out",
                                animationName: isPlaying ? "pulse" : "none",
                                animationDuration: config.animationDuration,
                                animationIterationCount: "infinite",
                                animationDirection: "alternate",
                                animationDelay: config.animationDelay
                            }}
                        />
                    ))}
                </div>

                {/* Status Indicator */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", isPlaying ? "bg-pink-500 animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.8)]" : "bg-white/10")} />
                    <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em]">
                        {src ? (isPlaying ? "STRE_STREAMING" : "STRE_PAUSED") : "NO_SIGNAL"}
                    </span>
                </div>
            </div>

            {/* Controls Section */}
            <div className="p-4 bg-black/60 backdrop-blur-3xl border-t border-white/5">
                {/* Progress Bar */}
                <div className="mb-4 relative h-1 w-full bg-white/5 rounded-full overflow-hidden cursor-pointer group/progress">
                    <div
                        className="h-full bg-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.6)] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                    {/* Hover indicator could go here */}
                </div>

                <div className="flex items-center justify-between">
                    <div className="w-16">
                        <span className="text-[11px] font-mono text-white/40 tabular-nums">
                            {formatTime(audioRef.current?.currentTime || 0)}
                        </span>
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="text-white/40 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[20px]">skip_previous</span>
                        </button>

                        <button
                            onClick={togglePlay}
                            className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-xl"
                        >
                            <span className="material-symbols-outlined text-[28px] leading-none ml-0.5">
                                {isPlaying ? "pause" : "play_arrow"}
                            </span>
                        </button>

                        <button className="text-white/40 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[20px]">skip_next</span>
                        </button>
                    </div>

                    <div className="w-16 text-right">
                        <span className="text-[11px] font-mono text-white/40 tabular-nums">
                            {formatTime(duration)}
                        </span>
                    </div>
                </div>
            </div>

            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                loop
            />
        </div>
    );
}

