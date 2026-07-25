"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Mic, PenSquare, MoreHorizontal,
    List, Grid3X3, CheckCircle2, Paperclip,
    Check, Pin, Trash2, X, Menu
} from 'lucide-react';
import { Note, RecordingSession, Beat } from '../../types';
import { NoteAttachmentsView } from './NoteAttachmentsView';

// ── Helpers ─────────────────────────────────────────────────────────────────

interface TimeGroup { label: string; notes: Note[] }

function groupNotesByTime(notes: Note[]): TimeGroup[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const sevenAgo = new Date(today); sevenAgo.setDate(sevenAgo.getDate() - 7);
    const thirtyAgo = new Date(today); thirtyAgo.setDate(thirtyAgo.getDate() - 30);

    const map = new Map<string, Note[]>();
    const order: string[] = [];

    const push = (label: string, n: Note) => {
        if (!map.has(label)) { map.set(label, []); order.push(label); }
        map.get(label)!.push(n);
    };

    for (const note of notes) {
        const d = new Date(note.modifiedAt);
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (day >= today) push('Today', note);
        else if (day >= yesterday) push('Yesterday', note);
        else if (d >= sevenAgo) push('Previous 7 Days', note);
        else if (d >= thirtyAgo) push('Previous 30 Days', note);
        else push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), note);
    }
    return order.map(label => ({ label, notes: map.get(label)! }));
}

function formatNoteDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const noteDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today.getTime() - noteDay.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (diffDays <= 6) return d.toLocaleDateString('en-US', { weekday: 'long' });
    if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

// ── Swipeable Note Row ───────────────────────────────────────────────────────

interface SwipeableNoteRowProps {
    note: Note;
    isFirst: boolean;
    selectMode: boolean;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onPin: () => void;
}

function SwipeableNoteRow({ note, isFirst, selectMode, isSelected, onSelect, onDelete, onPin }: SwipeableNoteRowProps) {
    const [offsetX, setOffsetX] = useState(0);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const startX = useRef<number | null>(null);
    const hasMoved = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (selectMode || e.button !== 0) return;
        startX.current = e.clientX;
        hasMoved.current = false;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        if (startX.current === null) return;
        const diff = e.clientX - startX.current;
        if (Math.abs(diff) > 5) hasMoved.current = true;
        setOffsetX(Math.min(0, Math.max(-120, diff)));
        if (confirmDelete && Math.abs(diff) > 5) setConfirmDelete(false);
    };
    const handlePointerUp = (e: React.PointerEvent) => {
        if (startX.current === null) return;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        startX.current = null;
        setOffsetX(offsetX < -50 ? -90 : 0);
    };
    const handleClick = (e: React.MouseEvent) => {
        if (hasMoved.current) { e.stopPropagation(); return; }
        if (offsetX < -10) { setOffsetX(0); setConfirmDelete(false); e.stopPropagation(); return; }
        if (selectMode) onSelect();
    };

    return (
        <div className="relative overflow-hidden">
            {!isFirst && <div className="h-px bg-white/5 mx-4" />}
            {/* Swipe action buttons */}
            <div className="absolute inset-y-0 right-0 flex items-center gap-1.5 pr-2 z-0">
                <button
                    onClick={() => { onPin(); setOffsetX(0); }}
                    className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"
                >
                    <Pin size={16} className="text-blue-400" />
                </button>
                <button
                    onClick={() => {
                        if (confirmDelete) { onDelete(); } else { setConfirmDelete(true); }
                    }}
                    className={`h-10 rounded-xl flex items-center justify-center transition-all ${confirmDelete ? 'w-20 bg-red-500' : 'w-10 bg-red-500/20'}`}
                >
                    {confirmDelete
                        ? <span className="text-[10px] font-bold text-white">Confirm</span>
                        : <Trash2 size={16} className="text-red-400" />
                    }
                </button>
            </div>
            {/* Row */}
            <div
                className="relative z-10 flex items-center gap-3 px-4 py-3 active:bg-white/5 cursor-pointer select-none touch-pan-y"
                style={{ transform: `translateX(${offsetX}px)`, background: 'var(--bg-card)', transition: startX.current === null ? 'transform 0.2s ease' : 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={handleClick}
            >
                {selectMode && (
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-tertiary)]'}`}>
                        {isSelected && <Check size={13} className="text-black font-bold" />}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        {note.isPinned && <Pin size={11} className="flex-shrink-0" style={{ color: 'var(--accent)' }} fill="currentColor" />}
                        <p className="text-[15px] font-semibold text-[var(--text-main)] truncate">
                            {note.title || 'New Note'}
                        </p>
                    </div>
                    <p className="text-[13px] text-[var(--text-secondary)] truncate">
                        <span>{formatNoteDate(note.modifiedAt)}</span>
                        <span className="mx-1.5 text-[var(--text-tertiary)]">·</span>
                        <span className="text-[var(--text-tertiary)]">
                            {note.body.trim() || 'No additional text'}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Gallery Card ─────────────────────────────────────────────────────────────

function GalleryCard({ note, selectMode, isSelected, onToggle }: {
    note: Note;
    selectMode: boolean;
    isSelected: boolean;
    onToggle: () => void;
}) {
    return (
        <div
            className={`flex flex-col ${selectMode ? 'cursor-pointer active:opacity-70 transition-opacity' : ''}`}
            onClick={selectMode ? onToggle : undefined}
        >
            <div className="rounded-2xl p-3 overflow-hidden relative" style={{ background: '#1a1a1a', height: 140 }}>
                {selectMode && (
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 transition-colors ${isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-white/40 bg-black/40'}`}>
                        {isSelected && <Check size={11} className="text-black" />}
                    </div>
                )}
                {note.isPinned && (
                    <Pin size={9} className="absolute top-2 left-2 z-10" style={{ color: 'var(--accent)' }} fill="currentColor" />
                )}
                {note.title && (
                    <p className="text-[11px] font-bold text-[var(--text-main)] leading-snug mb-1 line-clamp-2">{note.title}</p>
                )}
                <p className="text-[10px] text-[var(--text-secondary)] leading-snug line-clamp-6">
                    {note.body.trim() || 'No additional text'}
                </p>
            </div>
            <div className="mt-1.5 px-0.5">
                <p className="text-[11px] font-semibold text-[var(--text-main)] truncate">{note.title || 'New Note'}</p>
                <p className="text-[10px] text-[var(--text-secondary)]">{formatNoteDate(note.modifiedAt)}</p>
            </div>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface NotesViewProps {
    notes: Note[];
    sessions: RecordingSession[];
    beats: Beat[];
    onNotesChange: (notes: Note[]) => void;
    onOpenRecorder?: () => void;
    onOpenSidebar?: () => void;
    projectTitle?: string;
    onOpenStudio?: () => void;
}

export function NotesView({ notes, sessions, beats, onNotesChange, onOpenRecorder, onOpenSidebar, projectTitle, onOpenStudio }: NotesViewProps) {
    const [viewStyle, setViewStyle] = useState<'list' | 'gallery'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('studio-pro-notes-prefs') as 'list' | 'gallery') || 'list';
        }
        return 'list';
    });
    const [showMenu, setShowMenu] = useState(false);
    const [showAttachments, setShowAttachments] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const searchRef = useRef<HTMLInputElement>(null);

    const changeViewStyle = (style: 'list' | 'gallery') => {
        setViewStyle(style);
        localStorage.setItem('studio-pro-notes-prefs', style);
        setShowMenu(false);
    };

    const sortedNotes = useMemo(() => {
        const filtered = searchQuery
            ? notes.filter(n => {
                const q = searchQuery.toLowerCase();
                return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
            })
            : notes;
        return [...filtered].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
        });
    }, [notes, searchQuery]);

    // Recording transcripts aren't part of Note.title/.body, so search them
    // separately — otherwise a lyric said in a take is unfindable from here.
    const matchingSessions = useMemo(() => {
        if (!searchQuery) return [];
        const q = searchQuery.toLowerCase();
        return sessions.filter(s => s.transcription?.toLowerCase().includes(q));
    }, [sessions, searchQuery]);

    const groups = useMemo(() => groupNotesByTime(sortedNotes), [sortedNotes]);

    const deleteNote = useCallback((id: string) => {
        onNotesChange(notes.filter(n => n.id !== id));
    }, [notes, onNotesChange]);

    const pinNote = useCallback((id: string) => {
        onNotesChange(notes.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
    }, [notes, onNotesChange]);

    const deleteSelected = useCallback(() => {
        onNotesChange(notes.filter(n => !selectedIds.has(n.id)));
        setSelectedIds(new Set());
        setSelectMode(false);
    }, [notes, selectedIds, onNotesChange]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
            });
        };

    return (
        <div className="relative h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-main)' }}>
            {/* ── Scrollable area ── */}
            <div className="flex-1 overflow-y-auto pb-36">
                {/* Header */}
                <div className="px-5 pt-6 pb-2">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            {onOpenSidebar && (
                                <button
                                    onClick={onOpenSidebar}
                                    className="p-2 -ml-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all cursor-pointer mt-1"
                                    style={{ color: 'var(--text-secondary)' }}
                                    title="Open Menu"
                                >
                                    <Menu size={22} />
                                </button>
                            )}
                            <div>
                                <h1 className="text-[38px] font-bold leading-tight" style={{ color: 'var(--text-main)' }}>Notes</h1>
                                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                    {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            {selectMode ? (
                                <button
                                    onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                                    className="text-sm font-medium"
                                    style={{ color: 'var(--accent)' }}
                                >
                                    Done
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowMenu(true)}
                                    className="p-2 rounded-full active:bg-white/10"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    <MoreHorizontal size={22} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Inline search */}
                <AnimatePresence>
                    {showSearch && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="px-5 pb-3 overflow-hidden"
                        >
                            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-card)' }}>
                                <Search size={15} style={{ color: 'var(--text-tertiary)' }} className="flex-shrink-0" />
                                <input
                                    ref={searchRef}
                                    autoFocus
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search"
                                    className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-[var(--text-tertiary)]"
                                    style={{ color: 'var(--text-main)' }}
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')}>
                                        <X size={14} style={{ color: 'var(--text-tertiary)' }} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Recordings section — take transcripts matching the search */}
                {searchQuery && matchingSessions.length > 0 && (
                    <div className="px-5 mb-2">
                        <h2 className="text-[19px] font-bold mt-6 mb-2" style={{ color: 'var(--text-main)' }}>
                            Recordings
                        </h2>
                        <div className="rounded-2xl overflow-hidden divide-y divide-white/5" style={{ background: 'var(--bg-card)' }}>
                            {matchingSessions.map(s => {
                                const q = searchQuery.toLowerCase();
                                const idx = s.transcription?.toLowerCase().indexOf(q) ?? -1;
                                const snippetStart = Math.max(0, idx - 30);
                                const snippet = idx >= 0 ? `…${s.transcription!.slice(snippetStart, idx + 60)}…` : '';
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => setShowAttachments(true)}
                                        className="w-full text-left px-4 py-3 active:bg-white/5 transition-colors"
                                    >
                                        <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-main)' }}>
                                            {s.name || 'Recording'}
                                        </p>
                                        {snippet && (
                                            <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                                                {snippet}
                                            </p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Notes list / gallery */}
                <div className="px-5">
                    {notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center pt-24 pb-12 text-center">
                            <PenSquare size={60} className="mb-5 opacity-20" style={{ color: 'var(--text-secondary)' }} />
                            <p className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>No Notes</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                Tap the compose button to get started
                            </p>
                        </div>
                    ) : searchQuery && sortedNotes.length === 0 && matchingSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center pt-24 text-center">
                            <Search size={48} className="mb-4 opacity-20" style={{ color: 'var(--text-secondary)' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>No results for &ldquo;{searchQuery}&rdquo;</p>
                        </div>
                    ) : searchQuery && sortedNotes.length === 0 ? null : viewStyle === 'list' ? (
                        groups.map(group => (
                             <div key={group.label}>
                                <h2 className="text-[19px] font-bold mt-6 mb-2" style={{ color: 'var(--text-main)' }}>
                                    {group.label}
                                </h2>
                                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                                    {group.notes.map((note, idx) => (
                                        <SwipeableNoteRow
                                            key={note.id}
                                            note={note}
                                            isFirst={idx === 0}
                                            selectMode={selectMode}
                                            isSelected={selectedIds.has(note.id)}
                                            onSelect={() => toggleSelect(note.id)}
                                            onDelete={() => deleteNote(note.id)}
                                            onPin={() => pinNote(note.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        groups.map(group => (
                            <div key={group.label}>
                                <h2 className="text-[19px] font-bold mt-6 mb-3" style={{ color: 'var(--text-main)' }}>
                                    {group.label}
                                </h2>
                                <div className="grid grid-cols-3 gap-2">
                                    {group.notes.map(note => (
                                        <GalleryCard
                                            key={note.id}
                                            note={note}
                                            selectMode={selectMode}
                                            isSelected={selectedIds.has(note.id)}
                                            onToggle={() => toggleSelect(note.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Delete bar in select mode ── */}
            <AnimatePresence>
                {selectMode && selectedIds.size > 0 && (
                    <motion.div
                        initial={{ y: 80 }}
                        animate={{ y: 0 }}
                        exit={{ y: 80 }}
                        className="absolute bottom-24 left-0 right-0 flex justify-center px-5 z-10"
                    >
                        <button
                            onClick={deleteSelected}
                            className="flex items-center gap-2 bg-red-500 text-white rounded-full px-6 py-3 font-semibold text-sm shadow-2xl active:scale-95 transition-transform"
                        >
                            <Trash2 size={16} />
                            Delete {selectedIds.size} {selectedIds.size === 1 ? 'Note' : 'Notes'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Bottom bar ── */}
            <div
                className="absolute bottom-0 left-0 right-0 glass border-t border-white/10 px-4 py-3 flex items-center gap-2.5"
                style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
            >
                {/* Search pill */}
                <button
                    onClick={() => {
                        setShowSearch(v => !v);
                        if (showSearch) setSearchQuery('');
                        else setTimeout(() => searchRef.current?.focus(), 100);
                    }}
                    className="flex-1 flex items-center gap-2 rounded-full px-4 py-2.5 text-[var(--text-tertiary)] text-sm transition-colors active:opacity-70"
                    style={{ background: 'var(--bg-card)' }}
                >
                    <Search size={16} />
                    <span className="flex-1 text-left">{searchQuery || 'Search'}</span>
                    {showSearch && searchQuery && (
                        <X size={14} onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }} />
                    )}
                </button>

                {/* Mic */}
                <button
                    onClick={onOpenRecorder}
                    className="w-11 h-11 flex items-center justify-center rounded-full active:scale-95 transition-transform"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                    title="Voice note"
                >
                    <Mic size={20} />
                </button>

                {/* Compose */}
                <button
                    onClick={onOpenStudio}
                    className="w-11 h-11 flex items-center justify-center rounded-full active:scale-95 transition-transform"
                    style={{ background: 'var(--accent)' }}
                    title="New note"
                >
                    <PenSquare size={20} className="text-black" />
                </button>
            </div>

            {/* ── Overflow menu ── */}
            <AnimatePresence>
                {showMenu && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[115]"
                            onClick={() => setShowMenu(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: -6 }}
                            style={{ transformOrigin: 'top right' }}
                            className="absolute top-16 right-4 z-[116] glass rounded-2xl shadow-2xl border border-white/10 overflow-hidden min-w-[220px]"
                        >
                            <button
                                onClick={() => changeViewStyle('list')}
                                className="w-full flex items-center justify-between px-4 py-3.5 text-[var(--text-main)] hover:bg-white/5 active:bg-white/10"
                            >
                                <div className="flex items-center gap-3">
                                    <List size={17} />
                                    <span className="text-sm">View as List</span>
                                </div>
                                {viewStyle === 'list' && <Check size={16} style={{ color: 'var(--accent)' }} />}
                            </button>
                            <div className="h-px bg-white/10" />
                            <button
                                onClick={() => changeViewStyle('gallery')}
                                className="w-full flex items-center justify-between px-4 py-3.5 text-[var(--text-main)] hover:bg-white/5 active:bg-white/10"
                            >
                                <div className="flex items-center gap-3">
                                    <Grid3X3 size={17} />
                                    <span className="text-sm">View as Gallery</span>
                                </div>
                                {viewStyle === 'gallery' && <Check size={16} style={{ color: 'var(--accent)' }} />}
                            </button>
                            <div className="h-px bg-white/10" />
                            <button
                                onClick={() => {
                                    setSelectMode(true);
                                    setSelectedIds(new Set());
                                    setShowMenu(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-[var(--text-main)] hover:bg-white/5 active:bg-white/10"
                            >
                                <CheckCircle2 size={17} />
                                <span className="text-sm">Select Notes</span>
                            </button>
                            <div className="h-px bg-white/10" />
                            <button
                                onClick={() => { setShowAttachments(true); setShowMenu(false); }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-[var(--text-main)] hover:bg-white/5 active:bg-white/10"
                            >
                                <Paperclip size={17} />
                                <span className="text-sm">View Attachments</span>
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Attachments overlay ── */}
            <AnimatePresence>
                {showAttachments && (
                    <NoteAttachmentsView
                        sessions={sessions}
                        beats={beats}
                        onClose={() => setShowAttachments(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
