"use client";

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Pause, Music2, Mic } from 'lucide-react';
import { RecordingSession, Beat } from '../../types';

interface NoteAttachmentsViewProps {
    sessions: RecordingSession[];
    beats: Beat[];
    onClose: () => void;
}

function formatSessionDate(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(sec?: number) {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NoteAttachmentsView({ sessions, beats, onClose }: NoteAttachmentsViewProps) {
    const [showAllAudio, setShowAllAudio] = useState(false);
    const [showAllBeats, setShowAllBeats] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const displayedSessions = showAllAudio ? sessions : sessions.slice(0, 3);
    const displayedBeats = showAllBeats ? beats : beats.slice(0, 3);

    const handleTogglePlay = (session: RecordingSession) => {
        if (playingId === session.id) {
            audioRef.current?.pause();
            setPlayingId(null);
        } else {
            if (audioRef.current) audioRef.current.pause();
            if (session.audioUrl) {
                const a = new Audio(session.audioUrl);
                a.play().catch(() => {});
                a.onended = () => setPlayingId(null);
                audioRef.current = a;
                setPlayingId(session.id);
            }
        }
    };

    const hasContent = sessions.length > 0 || beats.length > 0;

    return (
        <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-0 z-[120] flex flex-col overflow-y-auto"
            style={{ background: 'var(--bg-main)' }}
        >
            {/* Header */}
            <div className="flex items-center px-4 pt-5 pb-3 flex-shrink-0">
                <button
                    onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-[var(--text-main)] active:bg-white/20 transition-colors"
                >
                    <X size={18} />
                </button>
                <h2 className="flex-1 text-center text-[17px] font-semibold text-[var(--text-main)]">Attachments</h2>
                <div className="w-9" />
            </div>

            <div className="px-5 pb-16 flex-1">
                {!hasContent && (
                    <div className="flex flex-col items-center justify-center py-28 text-center">
                        <Mic size={52} className="text-[var(--text-tertiary)] mb-4 opacity-50" />
                        <p className="text-[var(--text-secondary)] font-medium">No Attachments</p>
                        <p className="text-sm text-[var(--text-tertiary)] mt-1">
                            Recordings and beats will appear here
                        </p>
                    </div>
                )}

                {/* Audio Section */}
                {sessions.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xl font-bold text-[var(--text-main)]">Audio</h3>
                            {sessions.length > 3 && (
                                <button
                                    onClick={() => setShowAllAudio(v => !v)}
                                    className="text-sm font-medium"
                                    style={{ color: 'var(--accent)' }}
                                >
                                    {showAllAudio ? 'Show Less' : 'Show All'}
                                </button>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            {displayedSessions.map(session => (
                                <div
                                    key={session.id}
                                    className="rounded-2xl p-4 flex items-center gap-3"
                                    style={{ background: 'var(--bg-card)' }}
                                >
                                    <button
                                        onClick={() => handleTogglePlay(session)}
                                        className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform shadow-lg"
                                    >
                                        {playingId === session.id
                                            ? <Pause size={16} className="text-white" fill="white" />
                                            : <Play size={16} className="text-white" fill="white" style={{ marginLeft: 2 }} />
                                        }
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-[var(--text-main)] truncate">
                                            {session.name || 'New Recording'}
                                        </p>
                                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                            Audio Recording
                                            {session.duration ? ` · ${formatDuration(session.duration)}` : ''}
                                            {' · '}{formatSessionDate(session.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Beats Section */}
                {beats.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xl font-bold text-[var(--text-main)]">Beats</h3>
                            {beats.length > 3 && (
                                <button
                                    onClick={() => setShowAllBeats(v => !v)}
                                    className="text-sm font-medium"
                                    style={{ color: 'var(--accent)' }}
                                >
                                    {showAllBeats ? 'Show Less' : 'Show All'}
                                </button>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            {displayedBeats.map(beat => (
                                <div
                                    key={beat.id}
                                    className="rounded-2xl p-4 flex items-center gap-3"
                                    style={{ background: 'var(--bg-card)' }}
                                >
                                    <div
                                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'rgba(var(--accent-rgb, 127, 255, 0), 0.15)' }}
                                    >
                                        <Music2 size={20} style={{ color: 'var(--accent)' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-[var(--text-main)] truncate">
                                            {beat.name}
                                        </p>
                                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                            Beat · {beat.duration} · {beat.date}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
