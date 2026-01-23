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
                // Simulate save delay
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
        <div className={cn("relative flex h-full flex-col bg-black/20", className)}>
            <div className="flex items-center justify-between border-b border-vibecode-border bg-vibecode-dark/50 px-6 py-3 backdrop-blur-xl">
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted">
                    03 // Lyric Pad
                </span>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-mono text-zinc-700 uppercase tracking-tighter">
                        CH: {content.length}
                    </span>
                    <span
                        className={cn(
                            "text-[9px] font-mono uppercase tracking-widest transition-all duration-500",
                            isSaving ? "text-vibecode-primary opacity-100" : "text-vibecode-secondary opacity-40"
                        )}
                    >
                        {isSaving ? "SYNCING..." : "OS_STABLE"}
                    </span>
                </div>
            </div>
            <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onSelect={handleSelect}
                className="flex-1 w-full resize-none bg-transparent p-10 text-xl font-light leading-[1.8] text-zinc-200 placeholder:text-zinc-800 focus:outline-none selection:bg-vibecode-primary/30 selection:text-white"
                placeholder="INPUT DATA..."
                spellCheck={false}
            />

            {/* Ambient Pad Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-vibecode-primary/1 rounded-full blur-[120px] pointer-events-none" />
        </div>
    );
}
