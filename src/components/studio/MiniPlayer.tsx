'use client';

import React from 'react';
import { Play, Pause, Music2, Mic, KeyboardOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MiniPlayerProps {
    trackName: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onTogglePlay: () => void;
    onExpand: () => void;
    hasContent: boolean;
    keyboardHeight?: number;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
    trackName,
    isPlaying,
    currentTime,
    duration,
    onTogglePlay,
    onExpand,
    hasContent,
    keyboardHeight = 0,
}) => {
    if (!hasContent) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const isKeyboardOpen = keyboardHeight > 0;
    const isVocal = trackName.toLowerCase().includes('take') || trackName.toLowerCase().includes('vocal');

    const dismissKeyboard = () => {
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    };

    return (
        <AnimatePresence mode="wait">
            {isKeyboardOpen ? (
                /* ── State 2: bar above keyboard ── */
                <motion.div
                    key="keyboard-bar"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 340 }}
                    className="absolute left-0 right-0 z-40 flex flex-col"
                    style={{ bottom: keyboardHeight }}
                >
                    {/* Bar row */}
                    <div
                        className="flex items-center justify-between px-3 py-2"
                        style={{
                            background: 'rgba(10,10,10,0.88)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderTop: '1px solid rgba(255,255,255,0.07)',
                        }}
                    >
                        {/* Left: disc + tap to play/pause */}
                        <motion.button
                            onClick={onTogglePlay}
                            whileTap={{ scale: 0.88 }}
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 relative cursor-pointer"
                            style={{
                                background: 'var(--accent)',
                                boxShadow: isPlaying ? '0 0 18px rgba(127,255,0,0.4)' : 'none',
                                touchAction: 'manipulation',
                                minWidth: 44,
                                minHeight: 44,
                            }}
                        >
                            {isVocal ? (
                                <Mic size={18} color="black" />
                            ) : (
                                <Music2 size={18} color="black" />
                            )}
                        </motion.button>

                        {/* Right: keyboard dismiss */}
                        <motion.button
                            onClick={dismissKeyboard}
                            whileTap={{ scale: 0.88 }}
                            aria-label="Close keyboard"
                            className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                touchAction: 'manipulation',
                                minWidth: 44,
                                minHeight: 44,
                            }}
                        >
                            <KeyboardOff size={18} className="text-[var(--text-secondary)]" />
                        </motion.button>
                    </div>

                    {/* Lime progress line at bottom edge */}
                    <div className="h-[3px] bg-white/5 w-full">
                        <motion.div
                            className="h-full bg-[var(--accent)] rounded-full"
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.4, ease: 'linear' }}
                        />
                    </div>
                </motion.div>
            ) : (
                /* ── State 1: full pill (unchanged) ── */
                <motion.div
                    key="pill"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40"
                    style={{ width: 'calc(100% - 48px)', maxWidth: '360px', touchAction: 'manipulation' }}
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
                        {/* Progress bar */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/5">
                            <motion.div
                                className="h-full bg-[var(--accent)] rounded-full"
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.4, ease: 'linear' }}
                            />
                        </div>

                        <div className="flex items-center gap-3 px-4 py-3">
                            <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0">
                                {isVocal ? (
                                    <Mic size={14} className="text-[var(--accent)]" />
                                ) : (
                                    <Music2 size={14} className="text-[var(--accent)]" />
                                )}
                            </div>

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

                            <motion.button
                                onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
                                whileTap={{ scale: 0.88 }}
                                className="w-11 h-11 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 cursor-pointer shadow-[0_0_16px_rgba(127,255,0,0.25)]"
                                style={{ touchAction: 'manipulation', minWidth: 44, minHeight: 44 }}
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
            )}
        </AnimatePresence>
    );
};
