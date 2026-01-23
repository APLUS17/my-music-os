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
            setProgress((current / total) * 100);
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

    return (
        <div
            className={cn(
                "flex h-full flex-col justify-between overflow-hidden rounded border border-vibecode-border bg-black/40 backdrop-blur-2xl relative",
                className
            )}
        >
            {/* Visualizer Placeholder */}
            <div className="relative flex-1 bg-black/80 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-end gap-[2px] opacity-80 h-32">
                        {[...Array(32)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1 rounded-t-sm bg-gradient-to-t from-vibecode-primary/20 to-vibecode-primary"
                                style={{
                                    height: isPlaying ? `${Math.random() * 80 + 10}%` : "5%",
                                    transition: "height 0.15s ease",
                                    animation: isPlaying ? `pulse ${0.4 + Math.random() * 0.4}s infinite alternate` : "none",
                                    animationDelay: `${i * 0.05}s`
                                }}
                            />
                        ))}
                    </div>
                </div>
                {/* Hardware Metadata Label */}
                <div className="absolute top-3 left-4 flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", isPlaying ? "bg-vibecode-secondary animate-pulse" : "bg-zinc-800")} />
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                        INPUT_SIGNAL // {src ? "DECK_A_LOAD_OK" : "NO_DATA_SOURCE"}
                    </span>
                </div>
            </div>

            {/* Controls Section */}
            <div className="p-5 border-t border-vibecode-border bg-vibecode-dark/80">
                {/* Progress Bar Container */}
                <div className="mb-5 group relative h-1.5 w-full cursor-pointer bg-black/60 rounded-full border border-white/5 overflow-hidden">
                    <div
                        className="h-full bg-vibecode-primary shadow-[0_0_10px_rgba(249,115,22,0.4)] transition-all duration-150 ease-linear relative"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute right-0 top-0 h-full w-2 bg-white/40 blur-sm" />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-tighter mb-0.5">ELAPSED</span>
                        <span className="text-sm font-mono text-vibecode-primary tracking-tighter tabular-nums">
                            {audioRef.current ? formatTime(audioRef.current.currentTime) : "0:00:00"}
                        </span>
                    </div>

                    <div className="flex items-center gap-5">
                        <Button variant="ghost" size="icon" className="text-zinc-600 hover:text-vibecode-primary transition-colors">
                            <SkipBack size={18} fill="currentColor" />
                        </Button>

                        <button
                            onClick={togglePlay}
                            className="flex h-14 w-14 items-center justify-center rounded-full bg-vibecode-primary text-black shadow-[0_0_30px_rgba(249,115,22,0.2)] transition-all hover:scale-105 active:scale-95 border-2 border-white/10"
                        >
                            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                        </button>

                        <Button variant="ghost" size="icon" className="text-zinc-600 hover:text-vibecode-primary transition-colors">
                            <SkipForward size={18} fill="currentColor" />
                        </Button>
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-tighter mb-0.5">TOTAL_DUR</span>
                        <span className="text-sm font-mono text-zinc-400 tracking-tighter tabular-nums">
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
