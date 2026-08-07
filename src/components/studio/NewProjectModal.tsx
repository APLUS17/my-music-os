'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music } from 'lucide-react';

const GENRES = ['Hip-Hop', 'R&B', 'Pop', 'Afrobeats', 'Alternative', 'Soul', 'Other'];
const MOODS = ['Dark', 'Hype', 'Chill', 'Emotional', 'Introspective', 'Triumphant', 'Raw'];

interface NewProjectModalProps {
    isOpen: boolean;
    onConfirm: (name: string, genre?: string, mood?: string) => void;
    onCancel: () => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onConfirm, onCancel }) => {
    const [name, setName] = useState('');
    const [genre, setGenre] = useState('');
    const [mood, setMood] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName('');
            setGenre('');
            setMood('');
            setTimeout(() => inputRef.current?.focus(), 120);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(name.trim() || 'Untitled Project', genre || undefined, mood || undefined);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm"
                        onClick={onCancel}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                        className="fixed inset-x-4 bottom-0 z-[301] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm"
                    >
                        <form
                            onSubmit={handleSubmit}
                            className="bg-[var(--bg-card)] rounded-t-3xl sm:rounded-3xl border border-[var(--border-main)] p-6 flex flex-col gap-6"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                                        <Music size={16} className="text-[var(--accent)]" />
                                    </div>
                                    <h2 className="text-base font-bold tracking-tight text-[var(--text-main)]">New Project</h2>
                                </div>
                                <button type="button" onClick={onCancel} className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Name */}
                            <div className="space-y-2">
                                <label className="text-[10px] mono uppercase tracking-widest text-[var(--text-tertiary)]">Song title</label>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Untitled Project"
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/40 transition-colors"
                                />
                            </div>

                            {/* Genre */}
                            <div className="space-y-2">
                                <label className="text-[10px] mono uppercase tracking-widest text-[var(--text-tertiary)]">Genre <span className="text-[var(--text-tertiary)]/50 normal-case">(optional — helps AI)</span></label>
                                <div className="flex flex-wrap gap-2">
                                    {GENRES.map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setGenre(genre === g ? '' : g)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border ${
                                                genre === g
                                                    ? 'bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--accent)]'
                                                    : 'bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                                            }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mood */}
                            <div className="space-y-2">
                                <label className="text-[10px] mono uppercase tracking-widest text-[var(--text-tertiary)]">Mood <span className="text-[var(--text-tertiary)]/50 normal-case">(optional)</span></label>
                                <div className="flex flex-wrap gap-2">
                                    {MOODS.map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setMood(mood === m ? '' : m)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border ${
                                                mood === m
                                                    ? 'bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--accent)]'
                                                    : 'bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                                            }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Action */}
                            <button
                                type="submit"
                                className="w-full h-12 bg-[var(--text-main)] text-[var(--bg-main)] rounded-2xl text-sm font-bold tracking-wide hover:opacity-90 active:scale-[0.98] transition-all"
                            >
                                Start Writing
                            </button>
                        </form>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
