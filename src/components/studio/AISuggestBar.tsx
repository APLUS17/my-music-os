'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RotateCcw, X, Plus } from 'lucide-react';
import { LyricSection } from '@/types';
import { suggestLyricLine } from '@/app/actions';

interface AISuggestBarProps {
    activeSectionId: string | null;
    sections: LyricSection[];
    projectTitle: string;
    genre?: string;
    mood?: string;
    onInsert: (sectionId: string, line: string) => void;
    onDismiss: () => void;
}

export const AISuggestBar: React.FC<AISuggestBarProps> = ({
    activeSectionId,
    sections,
    projectTitle,
    genre,
    mood,
    onInsert,
    onDismiss,
}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSectionIdRef = useRef<string | null>(null);

    const fetchSuggestions = useCallback(async (sectionId: string) => {
        const section = sectionId === '__open__'
            ? sections[sections.length - 1]
            : sections.find(s => s.id === sectionId);

        if (!section) return;

        setIsLoading(true);
        setError(null);
        setSuggestions([]);

        const result = await suggestLyricLine({
            sectionType: section.type,
            sectionText: section.text,
            projectTitle,
            genre,
            mood,
            allSections: sections.map(s => ({ type: s.type, text: s.text })),
        });

        setIsLoading(false);

        if (result.success && result.suggestions.length > 0) {
            setSuggestions(result.suggestions);
        } else {
            setError('No suggestions right now — try again.');
        }
    }, [sections, projectTitle, genre, mood]);

    useEffect(() => {
        if (!activeSectionId) {
            setSuggestions([]);
            setError(null);
            return;
        }

        if (activeSectionId === lastSectionIdRef.current && suggestions.length > 0) return;

        lastSectionIdRef.current = activeSectionId;
        setSuggestions([]);
        setError(null);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(activeSectionId);
        }, 1200);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [activeSectionId, fetchSuggestions]);

    const handleInsert = (line: string) => {
        if (!activeSectionId) return;
        const sectionId = activeSectionId === '__open__'
            ? sections[sections.length - 1]?.id
            : activeSectionId;
        if (sectionId) onInsert(sectionId, line);
        setSuggestions([]);
        lastSectionIdRef.current = null;
    };

    const handleRefresh = () => {
        if (!activeSectionId) return;
        lastSectionIdRef.current = null;
        fetchSuggestions(activeSectionId);
    };

    const visible = !!activeSectionId;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className="flex-shrink-0 border-t border-[var(--border-main)] bg-[var(--bg-card)]/80 backdrop-blur-xl px-4 py-3"
                >
                    <div className="flex items-center gap-3 max-w-3xl mx-auto">
                        {/* Icon */}
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                            <Sparkles size={13} className={`text-[var(--accent)] ${isLoading ? 'animate-pulse' : ''}`} />
                        </div>

                        {/* Suggestions or loading */}
                        <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide min-w-0">
                            {isLoading && (
                                <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <motion.div
                                                key={i}
                                                className="w-1 h-1 rounded-full bg-[var(--accent)]/50"
                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs mono">Writing...</span>
                                </div>
                            )}

                            {error && !isLoading && (
                                <span className="text-xs text-[var(--text-tertiary)]">{error}</span>
                            )}

                            {!isLoading && suggestions.map((line, i) => (
                                <motion.button
                                    key={i}
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.07 }}
                                    onClick={() => handleInsert(line)}
                                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] text-[var(--text-main)] text-xs font-medium hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 transition-all active:scale-95 max-w-[220px] text-left"
                                >
                                    <Plus size={11} className="flex-shrink-0 text-[var(--accent)]" />
                                    <span className="truncate">{line}</span>
                                </motion.button>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                                onClick={handleRefresh}
                                disabled={isLoading}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-secondary)] transition-all disabled:opacity-30"
                                title="New suggestions"
                            >
                                <RotateCcw size={13} className={isLoading ? 'animate-spin' : ''} />
                            </button>
                            <button
                                onClick={onDismiss}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-secondary)] transition-all"
                                title="Dismiss"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
