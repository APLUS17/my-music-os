"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, MoreHorizontal, Pin, Trash2 } from 'lucide-react';
import { Note } from '../../types';
import { useVisualViewport } from '../../hooks/useVisualViewport';

interface NoteEditorViewProps {
    note: Note;
    projectTitle?: string;
    onSave: (updated: Note) => void;
    onBack: () => void;
    onDelete: (id: string) => void;
    onPin: (id: string) => void;
}

export function NoteEditorView({ note, projectTitle, onSave, onBack, onDelete, onPin }: NoteEditorViewProps) {
    const viewport = useVisualViewport();
    const [title, setTitle] = useState(note.title);
    const [body, setBody] = useState(note.body);
    const [showMenu, setShowMenu] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setTitle(note.title);
        setBody(note.body);
    }, [note.id]);

    // Auto-resize textarea on mount
    useEffect(() => {
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

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setTitle(val);
        scheduleSave(val, body);
    };

    const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setBody(val);
        scheduleSave(title, val);
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
            className="fixed left-0 right-0 z-[120] flex flex-col bg-black text-white"
            style={{
                background: '#000000',
                height: `${viewport.height}px`,
                top: `${viewport.offsetTop}px`,
                position: 'fixed'
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0 bg-black">
                <div className="flex items-center flex-1 min-w-0">
                    <button
                        onClick={handleBack}
                        className="w-10 h-10 flex items-center justify-center bg-[#1c1c1e] text-white rounded-xl active:opacity-70 flex-shrink-0"
                    >
                        <ChevronLeft size={22} className="text-white" />
                    </button>
                    <div className="flex-1 min-w-0 ml-3 flex flex-col justify-center">
                        <input
                            ref={titleRef}
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            onKeyDown={handleTitleKeyDown}
                            placeholder="Untitled Song"
                            className="bg-transparent border-none outline-none text-white font-bold text-[17px] leading-tight placeholder:text-neutral-500 w-full p-0 m-0"
                        />
                        <span className="text-[13px] text-neutral-400 font-normal mt-0.5 truncate leading-none">
                            {projectTitle || "ApLus"}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-neutral-400 hover:text-white rounded-full active:bg-white/10 flex-shrink-0 ml-2"
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
                    <div className="absolute top-16 right-4 z-[140] glass rounded-2xl shadow-2xl border border-white/10 overflow-hidden min-w-[190px]">
                        <button
                            onClick={() => { onPin(note.id); setShowMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-[var(--text-main)] hover:bg-white/5 active:bg-white/10"
                        >
                            <Pin size={16} className={note.isPinned ? 'text-[var(--accent)]' : ''} />
                            <span className="text-sm">{note.isPinned ? 'Unpin Song' : 'Pin Song'}</span>
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
                            <span className="text-sm">Delete Song</span>
                        </button>
                    </div>
                </>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32 bg-black">
                <textarea
                    ref={bodyRef}
                    value={body}
                    onChange={handleBodyChange}
                    placeholder="Add notes..."
                    className="w-full bg-transparent border-none outline-none resize-none text-white text-[16px] font-mono leading-relaxed placeholder:text-neutral-500"
                    rows={20}
                    autoFocus={true}
                    style={{ minHeight: '300px' }}
                />
            </div>
        </motion.div>
    );
}
