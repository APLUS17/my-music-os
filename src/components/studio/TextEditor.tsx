"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TextEditorProps {
    initialContent?: string;
    onSave?: (content: string) => void;
    onSelectionChange?: (selectedText: string) => void;
    className?: string;
}

export function TextEditor({
    initialContent = "",
    onSave,
    onSelectionChange,
    className,
}: TextEditorProps) {
    const [content, setContent] = useState(initialContent);
    const [isSaving, setIsSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Debounced save mock
    useEffect(() => {
        const timer = setTimeout(() => {
            if (content !== initialContent) {
                setIsSaving(true);
                setTimeout(() => {
                    onSave?.(content);
                    setIsSaving(false);
                }, 800);
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [content, initialContent, onSave]);

    const handleSelect = () => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            const selected = content.substring(start, end).trim();
            if (selected && selected.length > 2) {
                onSelectionChange?.(selected);
            }
        }
    };

    return (
        <div className={cn("relative flex h-full flex-col bg-transparent", className)}>
            <div className="flex items-center justify-between border-b border-white/5 bg-black/40 px-6 py-4 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-white/20 text-[20px]">edit_note</span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
                        The Pad
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 opacity-40">
                        <span className="material-symbols-outlined text-[14px]">format_align_left</span>
                        <span className="text-[10px] font-mono tabular-nums">
                            {content.length} CH
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "w-1 h-1 rounded-full transition-all duration-500",
                            isSaving ? "bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]" : "bg-white/10"
                        )} />
                        <span
                            className={cn(
                                "text-[10px] font-bold uppercase tracking-widest transition-all duration-500",
                                isSaving ? "text-pink-500" : "text-white/20"
                            )}
                        >
                            {isSaving ? "Syncing" : "Saved"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onSelect={handleSelect}
                    className="w-full h-full resize-none bg-transparent p-10 text-xl font-medium leading-[1.7] text-white/90 placeholder:text-white/10 focus:outline-none selection:bg-pink-500/30 selection:text-white"
                    placeholder="Enter lyrics here..."
                    spellCheck={false}
                />

                {/* Visual Depth Accents */}
                <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>

            {/* Ambient Background Glow for Editor */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] bg-pink-500/[0.02] rounded-full blur-[120px] pointer-events-none" />
        </div>
    );
}

