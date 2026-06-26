"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, MoreHorizontal, Pin, Trash2 } from 'lucide-react';
import { Note } from '../../types';

interface NoteEditorViewProps {
    note: Note;
    onSave: (updated: Note) => void;
    onBack: () => void;
    onDelete: (id: string) => void;
    onPin: (id: string) => void;
}

export function NoteEditorView({ note, onSave, onBack, onDelete, onPin }: NoteEditorViewProps) {
    const [title, setTitle] = useState(note.title);
    const [body, setBody] = useState(note.body);
    const [showMenu, setShowMenu] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const bodyRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setTitle(note.title);
        setBody(note.body);
    }, [note.id]);

    // Auto-resize textarea on mount
    useEffect(() => {
        if (titleRef.current) {
            titleRef.current.style.height = 'auto';
            titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
        }
        if (bodyRef.current) {
            bodyRef.current.style.height = 'auto';
            bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px';
        }
    }, [note.id]);

    const scheduleSave = (newTitle: string, newBody: string) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            onSave({ ...note, title: newTitle, body: newBody, modifiedAt: new Date().toISOString() });
        }, 500);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setTitle(val);
        scheduleSave(val, body);
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setBody(val);
        scheduleSave(title, val);
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            bodyRef.current?.focus();
        }
    };

    const handleBack = () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        onSave({ ...note, title, body, modifiedAt: new Date().toISOString() });
        onBack();
    };

    const formattedDate = new Date(note.modifiedAt).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-0 z-[120] flex flex-col"
            style={{ background: 'var(--bg-main)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 pt-4 pb-1 flex-shrink-0">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-0.5 text-[var(--accent)] py-2 pr-3 active:opacity-70"
                >
                    <ChevronLeft size={24} />
                    <span className="text-base font-medium">Notes</span>
                </button>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-[var(--accent)] rounded-full active:bg-white/10"
                >
                    <MoreHorizontal size={22} />
                </button>
            </div>

            {/* Context menu */}
            {showMenu && (
                <>
                    <div
                        className="fixed inset-0 z-[130]"
                        onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute top-14 right-4 z-[140] glass rounded-2xl shadow-2xl border border-white/10 overflow-hidden min-w-[190px]">
                        <button
                            onClick={() => { onPin(note.id); setShowMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-[var(--text-main)] hover:bg-white/5 active:bg-white/10"
                        >
                            <Pin size={16} className={note.isPinned ? 'text-[var(--accent)]' : ''} />
                            <span className="text-sm">{note.isPinned ? 'Unpin Note' : 'Pin Note'}</span>
                        </button>
                        <div className="h-px bg-white/10" />
                        <button
                            onClick={() => {
                                setShowMenu(false);
                                onDelete(note.id);
                                onBack();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:bg-white/5 active:bg-white/10"
                        >
                            <Trash2 size={16} />
                            <span className="text-sm">Delete Note</span>
                        </button>
                    </div>
                </>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-32">
                <p className="text-xs text-[var(--text-tertiary)] mb-4 mt-1 text-center">{formattedDate}</p>

                <textarea
                    ref={titleRef}
                    value={title}
                    onChange={handleTitleChange}
                    onKeyDown={handleTitleKeyDown}
                    placeholder="Title"
                    className="w-full bg-transparent border-none outline-none resize-none text-[var(--text-main)] font-bold text-[26px] leading-tight mb-3 overflow-hidden placeholder:text-[var(--text-tertiary)]"
                    rows={1}
                    style={{ minHeight: '40px' }}
                />

                <textarea
                    ref={bodyRef}
                    value={body}
                    onChange={handleBodyChange}
                    placeholder="Start writing..."
                    className="w-full bg-transparent border-none outline-none resize-none text-[var(--text-main)] text-[16px] leading-relaxed overflow-hidden placeholder:text-[var(--text-tertiary)]"
                    rows={12}
                    autoFocus={!note.title}
                    style={{ minHeight: '200px' }}
                />
            </div>

            {/* Bottom formatting toolbar */}
            <div className="flex-shrink-0 glass border-t border-white/10 px-4 py-2 pb-safe flex items-center gap-1"
                style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
                <button className="font-bold text-sm px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-white/10 active:bg-white/20">B</button>
                <button className="italic text-sm px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-white/10 active:bg-white/20">I</button>
                <button className="underline text-sm px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-white/10 active:bg-white/20">U</button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button className="text-sm px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-white/10 active:bg-white/20 flex items-center gap-1">
                    <span className="text-base leading-none">•</span>
                    <span className="text-xs">List</span>
                </button>
                <div className="flex-1" />
                <button
                    onClick={handleBack}
                    className="text-[var(--accent)] text-sm font-medium px-2 py-1"
                >
                    Done
                </button>
            </div>
        </motion.div>
    );
}
