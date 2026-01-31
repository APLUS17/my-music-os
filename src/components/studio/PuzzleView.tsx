"use client";

import React, { useState } from 'react';
import { LyricScrap, SectionType } from '@/types/studio';
import { Plus, Check, X } from 'lucide-react';

interface PuzzleViewProps {
    scraps: LyricScrap[];
    onAdd: (text: string, type: SectionType) => void;
    onUpdateType: (id: string, type: SectionType) => void;
}

export const PuzzleView: React.FC<PuzzleViewProps> = ({ scraps, onAdd, onUpdateType }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newText, setNewText] = useState("");

    const handleCreate = () => {
        if (newText.trim()) {
            onAdd(newText, 'idea');
        }
        setNewText("");
        setIsCreating(false);
    };

    return (
        <div className="h-full flex flex-col pt-12 animate-in fade-in duration-500">
            <div className="px-6 mb-8 flex items-end justify-between">
                <h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)]">Board</h1>
                <span className="text-[10px] mono text-[var(--text-muted)] mb-1">{scraps.length} ITEMS</span>
            </div>

            <div className="flex-1 overflow-y-auto px-6 scrollbar-hide pb-44">
                <div className="columns-2 gap-4 space-y-4">
                    {/* Creation Card */}
                    {isCreating ? (
                        <div className="break-inside-avoid bg-[var(--bg-elevated)] border border-[var(--accent-primary)] rounded-lg p-4 shadow-xl mb-4">
                            <textarea
                                autoFocus
                                className="w-full bg-transparent text-sm font-sans text-[var(--text-primary)] resize-none focus:outline-none placeholder:text-[var(--text-muted)] min-h-[80px]"
                                placeholder="Capture an idea..."
                                value={newText}
                                onChange={(e) => setNewText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleCreate();
                                    }
                                    if (e.key === 'Escape') setIsCreating(false);
                                }}
                            />
                            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                                <button onClick={() => setIsCreating(false)} className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><X size={14} /></button>
                                <button onClick={handleCreate} className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-colors"><Check size={14} /></button>
                            </div>
                        </div>
                    ) : (
                        <div
                            onClick={() => setIsCreating(true)}
                            className="break-inside-avoid border border-dashed border-[var(--border-subtle)] rounded-lg p-6 flex flex-col items-center justify-center opacity-40 hover:opacity-100 transition-all cursor-pointer hover:border-[var(--text-muted)] hover:bg-[var(--bg-elevated)] min-h-[120px] mb-4"
                        >
                            <Plus size={16} className="text-[var(--text-muted)] mb-2" />
                            <span className="text-[9px] mono uppercase text-[var(--text-muted)]">New Scrap</span>
                        </div>
                    )}

                    {scraps.map((s) => (
                        <div key={s.id} className="break-inside-avoid bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-4 transition-all hover:border-[var(--text-muted)] group cursor-pointer hover:shadow-lg mb-4">
                            <div className="flex items-center justify-between mb-3 border-b border-[var(--border-subtle)] pb-2">
                                <span className="text-[9px] mono uppercase tracking-widest text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                                    {s.type}
                                </span>
                                <div className="w-1 h-1 rounded-full bg-[var(--text-muted)] group-hover:bg-[var(--accent-primary)]" />
                            </div>
                            <p className="text-sm font-sans text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{s.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
