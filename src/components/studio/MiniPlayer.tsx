'use client';

import React from 'react';
import { Play, Pause, Music2, Mic } from 'lucide-react';
import { motion } from 'framer-motion';

interface MiniPlayerProps {
    trackName: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onTogglePlay: () => void;
    onExpand: () => void;
    hasContent: boolean;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
    trackName,
    isPlaying,
    currentTime,
    duration,
    onTogglePlay,
    onExpand,
    hasContent,
}) => {
    if (!hasContent) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40"
            style={{ width: 'calc(100% - 48px)', maxWidth: '360px' }}
        >
            <div
                onClick={onExpand}
                className="cursor-pointer relative overflow-hidden rounded-[28px] border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.6),0_0_0_0.5px_rgba(255,255,255,0.05)]"
                style={{
                    background: 'rgba(18,18,18,0.72)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                }}
            >
                {/* Progress bar — razor thin at very top */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/5">
                    <motion.div
                        className="h-full bg-[var(--accent)] rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4, ease: 'linear' }}
                    />
                </div>

                {/* Pill content */}
                <div className="flex items-center gap-3 px-4 py-3">
                    {/* Icon badge */}
                    <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0">
                        {trackName.toLowerCase().includes('take') || trackName.toLowerCase().includes('vocal') ? (
                            <Mic size={14} className="text-[var(--accent)]" />
                        ) : (
                            <Music2 size={14} className="text-[var(--accent)]" />
                        )}
                    </div>

                    {/* Track name */}
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--text-main)] truncate leading-tight tracking-tight">
                            {trackName}
                        </p>
                        {isPlaying && (
                            <p className="text-[10px] text-[var(--accent)] mono uppercase tracking-widest mt-0.5">
                                Now Playing
                            </p>
                        )}
                    </div>

                    {/* Play/Pause — stop propagation so tap doesn't also expand */}
                    <motion.button
                        onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
                        whileTap={{ scale: 0.88 }}
                        className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 cursor-pointer shadow-[0_0_16px_rgba(127,255,0,0.25)]"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? (
                            <Pause size={16} fill="black" stroke="none" />
                        ) : (
                            <Play size={16} fill="black" stroke="none" className="translate-x-px" />
                        )}
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
};
