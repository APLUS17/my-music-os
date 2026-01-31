"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

interface SandboxViewProps {
    text: string;
    onChange: (text: string) => void;
    onPromote: () => void;
}

/**
 * SandboxView - Free-form writing mode ("Flow" mode)
 * 
 * A full-height textarea for capturing thoughts, rhymes, and rough ideas.
 * Shows a "Convert to Verse" button when text is > 5 chars.
 */
export function SandboxView({ text, onChange, onPromote }: SandboxViewProps) {
    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500 relative">
            <div className="flex-1 relative">
                <textarea
                    value={text}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={`Start writing...\n\nCapture thoughts, rhymes, or rough ideas here.\nPromote them to the structure when you're ready.`}
                    className="w-full h-full bg-transparent resize-none focus:outline-none text-[var(--text-primary)] text-lg leading-[1.6] font-sans placeholder:text-[var(--text-muted)] placeholder:opacity-50 scrollbar-hide pb-32"
                    spellCheck={false}
                    autoFocus
                />

                {/* Subtle fade at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--bg-main)] to-transparent pointer-events-none" />

                {text.length > 5 && (
                    <div className="absolute bottom-4 right-0 animate-in slide-in-from-right duration-500 z-10">
                        <button
                            onClick={onPromote}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-main)] rounded-full text-[10px] font-mono uppercase tracking-wider hover:opacity-90 transition-transform hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
                        >
                            Convert to Verse <ArrowRight size={12} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
