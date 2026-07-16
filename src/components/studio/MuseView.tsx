"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    Mic,
    Trash2,
    Square,
    ArrowLeft,
    Play,
    Pause,
    AlertTriangle,
    Loader2,
    RefreshCw,
    Clock,
    Calendar,
    FileAudio,
    Upload,
    Menu
} from 'lucide-react';
import { RecordingSession, MuseSegmentType, MuseManifest } from '@/types';
import { generateId } from '@/lib/utils/id';
import { useMuseRecorder } from '@/hooks/useMuseRecorder';
import { useActiveBeatSection } from './useActiveBeatSection';

// Meta definitions for segments (colors, names, emojis)
export const MUSE_TYPE_META: Record<MuseSegmentType, { name: string; color: string; emoji: string; bg: string }> = {
    freestyle: { name: 'Freestyle', color: '#7fff00', emoji: '🎤', bg: 'rgba(127, 255, 0, 0.15)' },
    take: { name: 'Take', color: '#a58bff', emoji: '🎬', bg: 'rgba(165, 139, 255, 0.15)' },
    idea: { name: 'Idea', color: '#ffb224', emoji: '💡', bg: 'rgba(255, 178, 36, 0.15)' },
    practicing: { name: 'Practice', color: '#3cc3ff', emoji: '🎸', bg: 'rgba(60, 195, 255, 0.15)' },
    playback: { name: 'Playback', color: '#4c74ff', emoji: '🎧', bg: 'rgba(76, 116, 255, 0.15)' },
    planning: { name: 'Planning', color: '#ff519e', emoji: '📋', bg: 'rgba(255, 81, 158, 0.15)' },
    conversation: { name: 'Speech', color: '#29d4b5', emoji: '💬', bg: 'rgba(41, 212, 181, 0.15)' },
    downtime: { name: 'Downtime', color: '#6c7a89', emoji: '☕', bg: 'rgba(108, 122, 137, 0.15)' }
};

interface MuseViewProps {
    sessions: RecordingSession[];
    activeSessionId: string | null;
    isPlaying: boolean;
    currentTime: number;
    onPlaySession: (id: string, seekTime?: number) => void;
    onPauseSession: () => void;
    onDeleteSession: (id: string) => Promise<void>;
    onSaveMuseSession: (recording: { id: string; blob: Blob; duration: number; mimeType: string }) => Promise<string>;
    onRetryAnalysis: (sessionId: string) => Promise<void>;
    onRecoverSession: (manifest: MuseManifest) => Promise<void>;
    onOpenMenu?: () => void;
}

export function MuseView({
    sessions,
    activeSessionId,
    isPlaying,
    currentTime,
    onPlaySession,
    onPauseSession,
    onDeleteSession,
    onSaveMuseSession,
    onRetryAnalysis,
    onRecoverSession,
    onOpenMenu
}: MuseViewProps) {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [recoveryManifests, setRecoveryManifests] = useState<MuseManifest[]>([]);
    const [isRecovering, setIsRecovering] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const uploadInputRef = useRef<HTMLInputElement | null>(null);

    const recorder = useMuseRecorder();

    // Group Muse sessions
    const museSessions = useMemo(() => {
        return sessions.filter(s => s.kind === 'muse');
    }, [sessions]);

    // Currently viewed session in Recap mode
    const selectedSession = useMemo(() => {
        if (selectedSessionId) {
            return museSessions.find(s => s.id === selectedSessionId) || null;
        }
        return null;
    }, [museSessions, selectedSessionId]);

    // Active segment based on current playback time
    const activeSegmentIdx = useActiveBeatSection(
        selectedSession?.museSegments || [],
        selectedSessionId === activeSessionId ? currentTime : null
    );

    // Load recovery manifests on mount
    useEffect(() => {
        import('@/lib/idb/studioDB').then(({ getMuseManifests }) => {
            getMuseManifests().then(manifests => {
                // Find manifests that aren't already represented in the workspace sessions
                const sessionIds = new Set(sessions.map(s => s.id));
                const orphans = manifests.filter(m => !sessionIds.has(m.id));
                setRecoveryManifests(orphans);
            });
        });
    }, [sessions]);

    // Group sessions by date helper
    const groupedSessions = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const sevenAgo = new Date(today); sevenAgo.setDate(sevenAgo.getDate() - 7);
        const thirtyAgo = new Date(today); thirtyAgo.setDate(thirtyAgo.getDate() - 30);

        const groups = new Map<string, RecordingSession[]>();
        const order: string[] = [];

        const push = (label: string, s: RecordingSession) => {
            if (!groups.has(label)) {
                groups.set(label, []);
                order.push(label);
            }
            groups.get(label)!.push(s);
        };

        const sorted = [...museSessions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        for (const session of sorted) {
            const d = new Date(session.timestamp);
            const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            if (day >= today) push('Today', session);
            else if (day >= yesterday) push('Yesterday', session);
            else if (d >= sevenAgo) push('Previous 7 Days', session);
            else if (d >= thirtyAgo) push('Previous 30 Days', session);
            else push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), session);
        }

        return order.map(label => ({ label, sessions: groups.get(label)! }));
    }, [museSessions]);

    // Format helpers
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Recording action
    const handleStartRecording = async () => {
        await recorder.start();
    };

    const handleStopRecording = async () => {
        try {
            const rec = await recorder.stop();
            const newSessionId = await onSaveMuseSession(rec);
            // Auto open the processing session
            setSelectedSessionId(newSessionId);
        } catch (e) {
            console.error('Stop recording failed:', e);
        }
    };

    // Upload action — feeds an existing audio file through the same
    // save + AI analysis pipeline as a live recording
    const readAudioDuration = (file: File): Promise<number> => {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const probe = new Audio();
            probe.preload = 'metadata';
            const finish = (duration: number) => {
                URL.revokeObjectURL(url);
                resolve(duration);
            };
            probe.onloadedmetadata = () => {
                finish(isFinite(probe.duration) && probe.duration > 0 ? Math.round(probe.duration) : 0);
            };
            probe.onerror = () => finish(0);
            probe.src = url;
        });
    };

    const handleUploadFile = async (file: File) => {
        setIsUploading(true);
        try {
            const duration = await readAudioDuration(file);
            const newSessionId = await onSaveMuseSession({
                id: generateId('muse-'),
                blob: file,
                duration,
                mimeType: file.type || 'audio/mpeg'
            });
            setSelectedSessionId(newSessionId);
        } catch (e) {
            console.error('Audio upload failed:', e);
        } finally {
            setIsUploading(false);
        }
    };

    // Recovery action
    const handleTriggerRecovery = async (manifest: MuseManifest) => {
        setIsRecovering(manifest.id);
        try {
            await onRecoverSession(manifest);
            setRecoveryManifests(prev => prev.filter(m => m.id !== manifest.id));
        } catch (e) {
            console.error('Recovery failed:', e);
        } finally {
            setIsRecovering(null);
        }
    };

    const handleDiscardRecovery = async (manifestId: string) => {
        try {
            const { deleteMuseChunks, deleteMuseManifest } = await import('@/lib/idb/studioDB');
            await deleteMuseChunks(manifestId);
            await deleteMuseManifest(manifestId);
            setRecoveryManifests(prev => prev.filter(m => m.id !== manifestId));
        } catch (e) {
            console.error('Discard recovery failed:', e);
        }
    };

    // Interactive timeline calculation
    const renderInteractiveTimeline = (session: RecordingSession) => {
        const segments = session.museSegments || [];
        const totalDuration = session.duration || 0;
        if (totalDuration === 0 || segments.length === 0) return null;

        const isCurrent = activeSessionId === session.id;
        const currentPosPct = isCurrent ? (currentTime / totalDuration) * 100 : 0;

        const handleScrub = (e: React.PointerEvent<HTMLDivElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clientX = e.clientX;
            const clickX = clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            const seekTime = pct * totalDuration;
            onPlaySession(session.id, seekTime);
        };

        const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleScrub(e);
        };

        const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
            if (e.buttons === 1) { // Left click / dragging active
                handleScrub(e);
            }
        };

        return (
            <div className="flex flex-col gap-2 mt-3">
                <div 
                    className="h-4 w-full rounded-full overflow-hidden flex bg-[var(--bg-hover)] cursor-pointer select-none relative border border-[var(--border-subtle)] hover:border-[var(--border-main)] transition-colors"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                >
                    {segments.map((seg, idx) => {
                        const duration = seg.endTime - seg.startTime;
                        const pct = (duration / totalDuration) * 100;
                        return (
                            <div
                                key={seg.id || idx}
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: MUSE_TYPE_META[seg.type]?.color || '#ffffff',
                                    opacity: 0.85
                                }}
                                className="h-full border-r border-black/10 last:border-r-0 transition-opacity hover:opacity-100"
                                title={`${MUSE_TYPE_META[seg.type]?.name}: ${formatTime(seg.startTime)} - ${formatTime(seg.endTime)}`}
                            />
                        );
                    })}

                    {/* Playhead needle indicator */}
                    {isCurrent && (
                        <div 
                            className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,1)] pointer-events-none transition-all duration-75"
                            style={{ left: `${currentPosPct}%`, transform: 'translateX(-50%)' }}
                        />
                    )}
                </div>

                <div className="flex justify-between text-[10px] font-mono text-[var(--text-tertiary)] px-1">
                    <span>{formatTime(isCurrent ? currentTime : 0)}</span>
                    <span>{formatTime(totalDuration)}</span>
                </div>
            </div>
        );
    };

    // Proportional bar calculation
    const renderProportionalBar = (session: RecordingSession) => {
        const stats = session.museRecap?.stats || {};
        const total = Object.values(stats).reduce((acc: number, val) => acc + (val || 0), 0);
        if (total === 0) return null;

        return (
            <div className="h-2 w-full rounded-full overflow-hidden flex bg-[var(--bg-hover)] mt-3">
                {Object.entries(stats).map(([k, val]) => {
                    const type = k as MuseSegmentType;
                    const duration = val || 0;
                    if (duration === 0) return null;
                    const pct = (duration / total) * 100;
                    return (
                        <div
                            key={type}
                            style={{
                                width: `${pct}%`,
                                backgroundColor: MUSE_TYPE_META[type]?.color || '#ffffff'
                            }}
                            title={`${MUSE_TYPE_META[type]?.name}: ${formatTime(duration)} (${Math.round(pct)}%)`}
                        />
                    );
                })}
            </div>
        );
    };

    // --- RENDER STATES ---

    // 1. RECORDING STATE
    if (recorder.status === 'recording' || recorder.status === 'stopping') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
                <div className="relative w-48 h-48 flex items-center justify-center mb-8">
                    {/* Pulsing ring */}
                    <motion.div
                        animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.4, 0.15] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-full bg-[var(--studio-red)]/20 blur-xl"
                    />
                    
                    {/* Circular Level meter */}
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                        <circle
                            cx="96"
                            cy="96"
                            r="80"
                            className="stroke-[var(--border-subtle)] fill-none"
                            strokeWidth="6"
                        />
                        <motion.circle
                            cx="96"
                            cy="96"
                            r="80"
                            className="stroke-[var(--studio-red)] fill-none"
                            strokeWidth="8"
                            strokeDasharray={2 * Math.PI * 80}
                            strokeDashoffset={2 * Math.PI * 80 * (1 - recorder.level)}
                            transition={{ ease: "easeOut", duration: 0.1 }}
                        />
                    </svg>

                    <div className="z-10 flex flex-col items-center">
                        <Mic className="w-10 h-10 text-[var(--studio-red)] mb-2 animate-pulse" />
                        <span className="font-mono text-3xl font-bold tracking-wider text-[var(--text-main)]">
                            {formatTime(recorder.elapsedSec)}
                        </span>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">Recording</h2>
                <p className="text-[var(--text-secondary)] text-sm max-w-sm mb-6">
                    Everything gets auto-split into takes, ideas, and freestyles.
                </p>

                {recorder.wakeLockActive && (
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-4 py-2 mb-8 text-yellow-500 text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Keep screen on, or recording pauses.</span>
                    </div>
                )}

                <div className="flex items-center gap-6">
                    <button
                        onClick={recorder.discard}
                        disabled={recorder.status === 'stopping'}
                        className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] transition-all"
                    >
                        <Trash2 className="w-5 h-5" />
                        <span className="text-xs">Discard</span>
                    </button>

                    <button
                        onClick={handleStopRecording}
                        disabled={recorder.status === 'stopping'}
                        className="w-16 h-16 rounded-full bg-[var(--studio-red)] hover:opacity-90 flex items-center justify-center shadow-lg shadow-[var(--studio-red)]/20 active:scale-95 transition-all text-white"
                    >
                        {recorder.status === 'stopping' ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <Square className="w-6 h-6 fill-current" />
                        )}
                    </button>

                    <div className="w-12 h-12" /> {/* Balancing spacing placeholder */}
                </div>
            </div>
        );
    }

    // 2. PROCESSING STATE (Within Recap screen)
    if (selectedSession && (selectedSession.museStatus === 'uploading' || selectedSession.museStatus === 'analyzing' || selectedSession.museStatus === 'failed')) {
        const status = selectedSession.museStatus;
        return (
            <div className="flex flex-col justify-center items-center min-h-[70vh] p-6 text-center max-w-md mx-auto">
                <button
                    onClick={() => setSelectedSessionId(null)}
                    className="self-start flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-main)] mb-12 text-sm transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to list</span>
                </button>

                <AnimatePresence mode="wait">
                    {status !== 'failed' ? (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col items-center"
                        >
                            <div className="relative w-20 h-20 flex items-center justify-center mb-8">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                                    className="absolute inset-0 border-t-2 border-r-2 border-t-[var(--accent)] border-r-[var(--accent-dim)] rounded-full"
                                />
                                <Sparkles className="w-8 h-8 text-[var(--accent)] animate-pulse" />
                            </div>

                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-3">Processing Session</h3>
                            <p className="text-[var(--text-secondary)] text-sm mb-6">
                                {status === 'uploading'
                                    ? 'Uploading audio…'
                                    : 'AI is mapping your session…'}
                            </p>

                            <div className="flex flex-col items-start gap-3 w-64 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 rounded-2xl text-left text-xs text-[var(--text-secondary)]">
                                <div className="flex items-center gap-2 text-[var(--text-main)]">
                                    <span className="text-[var(--accent)]">✓</span>
                                    <span>Saved safely on device</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={status === 'uploading' ? 'text-[var(--accent)] animate-pulse' : 'text-[var(--accent)]'}>
                                        {status === 'uploading' ? '●' : '✓'}
                                    </span>
                                    <span className={status === 'uploading' ? 'text-[var(--text-main)]' : ''}>Upload to analyzer</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={status === 'analyzing' ? 'text-[var(--accent)] animate-pulse' : ''}>
                                        {status === 'analyzing' ? '●' : '○'}
                                    </span>
                                    <span className={status === 'analyzing' ? 'text-[var(--text-main)]' : ''}>Build recap timeline</span>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="failed"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center bg-[var(--bg-card)] border border-[var(--studio-red)]/10 p-6 rounded-3xl"
                        >
                            <AlertTriangle className="w-12 h-12 text-[var(--studio-red)] mb-4" />
                            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2">Recap Failed</h3>
                            <p className="text-[var(--text-secondary)] text-sm mb-2 max-w-xs">
                                {selectedSession.museError || 'Analysis failed.'}
                            </p>
                            <p className="text-[var(--text-tertiary)] text-xs mb-6 max-w-xs">
                                Your audio is safe on device.
                            </p>

                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    onClick={() => onRetryAnalysis(selectedSession.id)}
                                    className="w-full bg-[var(--accent)] text-[var(--bg-main)] font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Retry AI Analysis</span>
                                </button>
                                <button
                                    onClick={() => setSelectedSessionId(null)}
                                    className="w-full bg-[var(--bg-hover)] text-[var(--text-main)] py-3 px-4 rounded-xl hover:bg-[var(--bg-elevated)] transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // 3. RECAP / DETAIL STATE
    if (selectedSession) {
        const recap = selectedSession.museRecap;
        const segments = selectedSession.museSegments || [];
        const isCurrentlyPlayingThis = activeSessionId === selectedSession.id;

        return (
            <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 pb-28">
                {/* Header Back Button */}
                <button
                    onClick={() => setSelectedSessionId(null)}
                    className="self-start flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all text-sm mb-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Sessions</span>
                </button>

                {/* Recap Hero details */}
                <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/5 blur-[80px] rounded-full pointer-events-none" />
                    
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                        <div>
                            <span className="text-xs font-semibold tracking-wider text-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 rounded-full uppercase">
                                Muse AI Recap
                            </span>
                            <h2 className="text-2xl font-bold text-[var(--text-main)] mt-2">
                                {recap?.title || selectedSession.name || 'Studio Session'}
                            </h2>
                            <div className="flex items-center gap-4 text-[var(--text-secondary)] text-xs mt-1">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {formatDate(selectedSession.timestamp)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {formatTime(selectedSession.duration || 0)}
                                </span>
                            </div>
                        </div>

                        {/* Play Full Session Button */}
                        <button
                            onClick={() => {
                                if (isCurrentlyPlayingThis && isPlaying) {
                                    onPauseSession();
                                } else {
                                    onPlaySession(selectedSession.id, 0);
                                }
                            }}
                            className="bg-[var(--accent)] text-[var(--bg-main)] w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                        >
                            {isCurrentlyPlayingThis && isPlaying ? (
                                <Pause className="w-5 h-5 fill-current" />
                            ) : (
                                <Play className="w-5 h-5 fill-current translate-x-0.5" />
                            )}
                        </button>
                    </div>

                    {/* Interactive Timeline */}
                    <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
                        <h4 className="text-xs font-bold text-[var(--text-tertiary)] mb-2 uppercase tracking-wide">Interactive Timeline</h4>
                        {renderInteractiveTimeline(selectedSession)}
                    </div>

                    {/* Proportional Duration Bar */}
                    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                        <h4 className="text-xs font-bold text-[var(--text-tertiary)] mb-2 uppercase tracking-wide">Category breakdown</h4>
                        {renderProportionalBar(selectedSession)}
                        
                        {/* Legend */}
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                            {Object.entries(recap?.stats || {}).map(([k, val]) => {
                                const type = k as MuseSegmentType;
                                const dur = val || 0;
                                if (dur === 0) return null;
                                return (
                                    <div key={type} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ backgroundColor: MUSE_TYPE_META[type].color }}
                                        />
                                        <span>{MUSE_TYPE_META[type].name} ({formatTime(dur)})</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* AI Executive Summary */}
                    {recap?.summary && (
                        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 mt-6">
                            <p className="text-[var(--text-secondary)] text-sm leading-relaxed italic">
                                &ldquo;{recap.summary}&rdquo;
                            </p>
                        </div>
                    )}
                </div>

                {/* Highlights Section */}
                {recap?.highlights && recap.highlights.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-wide flex items-center gap-1.5 px-1">
                            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                            <span>Highlights & Sparks</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {recap.highlights.map((hl, idx) => {
                                // Find matching segment for details
                                const matchedSeg = segments.find(s => s.id === hl.segmentId);
                                const color = matchedSeg ? MUSE_TYPE_META[matchedSeg.type]?.color : 'var(--accent)';
                                const emoji = matchedSeg ? MUSE_TYPE_META[matchedSeg.type]?.emoji : '✨';
                                
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => onPlaySession(selectedSession.id, hl.startTime)}
                                        className="bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-main)] hover:border-[var(--border-strong)] rounded-2xl p-4 text-left transition-all group flex items-start gap-3.5"
                                    >
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                                            style={{ backgroundColor: matchedSeg ? MUSE_TYPE_META[matchedSeg.type]?.bg : 'var(--bg-hover)' }}
                                        >
                                            {emoji}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className="text-xs font-mono font-semibold"
                                                    style={{ color }}
                                                >
                                                    {formatTime(hl.startTime)}
                                                </span>
                                                <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">Jump</span>
                                            </div>
                                            <p className="text-[var(--text-secondary)] text-xs font-medium mt-1 leading-snug">
                                                {hl.reason}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Timeline Section */}
                <div className="flex flex-col gap-4 mt-2">
                    <h3 className="text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-wide px-1">
                        Session Timeline
                    </h3>

                    {segments.length === 0 ? (
                        <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">
                            No segments mapped.
                        </div>
                    ) : (
                        <div className="relative pl-6 border-l border-[var(--border-main)] flex flex-col gap-6">
                            {segments.map((seg, idx) => {
                                const meta = MUSE_TYPE_META[seg.type] || MUSE_TYPE_META.downtime;
                                const isActive = isCurrentlyPlayingThis && activeSegmentIdx === idx;
                                const isSegPlaying = isActive && isPlaying;

                                return (
                                    <div
                                        key={seg.id}
                                        className="relative group"
                                    >
                                        {/* Dot on the rail */}
                                        <div
                                            className="absolute -left-[31px] top-4 w-4 h-4 rounded-full border-2 border-[var(--bg-main)] flex items-center justify-center transition-all"
                                            style={{
                                                backgroundColor: isActive ? meta.color : 'var(--border-strong)',
                                                boxShadow: isActive ? `0 0 10px ${meta.color}` : 'none'
                                            }}
                                        />

                                        {/* Segment block */}
                                        <div
                                            onClick={() => onPlaySession(selectedSession.id, seg.startTime)}
                                            className={`w-full text-left rounded-3xl p-5 border backdrop-blur-xl transition-all flex flex-col md:flex-row md:items-start gap-4 cursor-pointer ${
                                                isActive
                                                    ? 'bg-[var(--bg-hover)] border-[var(--border-strong)] shadow-md shadow-black/20'
                                                    : 'bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border-[var(--border-subtle)] hover:border-[var(--border-main)]'
                                            }`}
                                        >
                                            {/* Left play/pause control — emoji until hovered/active */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isSegPlaying) {
                                                        onPauseSession();
                                                    } else {
                                                        onPlaySession(selectedSession.id, seg.startTime);
                                                    }
                                                }}
                                                aria-label={isSegPlaying ? 'Pause segment' : 'Play segment'}
                                                className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 transition-all hover:scale-105 active:scale-95 group/play"
                                                style={{ backgroundColor: meta.bg }}
                                            >
                                                <span className={`transition-opacity ${isActive ? 'opacity-0' : 'opacity-100 group-hover/play:opacity-0'}`}>
                                                    {meta.emoji}
                                                </span>
                                                <span
                                                    className={`absolute inset-0 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover/play:opacity-100'}`}
                                                    style={{ color: meta.color }}
                                                >
                                                    {isSegPlaying ? (
                                                        <Pause className="w-5 h-5 fill-current" />
                                                    ) : (
                                                        <Play className="w-5 h-5 fill-current translate-x-0.5" />
                                                    )}
                                                </span>
                                            </button>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[10px]"
                                                            style={{
                                                                color: meta.color,
                                                                backgroundColor: meta.bg
                                                            }}
                                                        >
                                                            {meta.name}
                                                        </span>
                                                        <h4 className="text-sm font-bold text-[var(--text-main)] truncate max-w-[200px] md:max-w-sm">
                                                            {seg.label}
                                                        </h4>
                                                    </div>
                                                    <span className="font-mono text-xs text-[var(--text-tertiary)]">
                                                        {formatTime(seg.startTime)} – {formatTime(seg.endTime)}
                                                    </span>
                                                </div>

                                                <p className="text-[var(--text-secondary)] text-xs mt-2 leading-relaxed">
                                                    {seg.summary}
                                                </p>

                                                {seg.quote && (
                                                    <div className="border-l-2 border-[var(--border-main)] pl-3 mt-3">
                                                        <p className="text-[var(--text-tertiary)] text-xs italic">
                                                            &ldquo;{seg.quote}&rdquo;
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            </div>
            </div>
        );
    }

    // 4. IDLE / LIST STATE
    return (
        <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 flex flex-col gap-6">

            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-6 rounded-3xl backdrop-blur-xl">
                <div>
                    <h2 className="text-2xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
                        {onOpenMenu && (
                            <button
                                onClick={onOpenMenu}
                                className="p-2 -ml-2 rounded-xl hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer border-none bg-transparent"
                                title="Open Menu"
                            >
                                <Menu size={20} className="text-[var(--text-secondary)]" />
                            </button>
                        )}
                        <Sparkles className="w-6 h-6 text-[var(--accent)] animate-pulse" />
                        <span>Muse</span>
                    </h2>
                    <p className="text-[var(--text-secondary)] text-xs mt-1 max-w-sm leading-relaxed">
                        Always-on capture. AI maps your whole session automatically.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Upload Button */}
                    <input
                        ref={uploadInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadFile(file);
                            e.target.value = '';
                        }}
                    />
                    <button
                        onClick={() => uploadInputRef.current?.click()}
                        disabled={isUploading}
                        className="bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-main)] text-[var(--text-main)] font-semibold px-5 py-3 rounded-2xl flex items-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                    >
                        {isUploading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Upload className="w-5 h-5" />
                        )}
                        <span>Upload</span>
                    </button>

                    {/* Record Button */}
                    <button
                        onClick={handleStartRecording}
                        className="bg-[var(--studio-red)] hover:opacity-90 text-white font-semibold px-5 py-3 rounded-2xl flex items-center gap-2 active:scale-95 shadow-lg shadow-[var(--studio-red)]/10 hover:shadow-[var(--studio-red)]/20 transition-all"
                    >
                        <Mic className="w-5 h-5" />
                        <span>Record</span>
                    </button>
                </div>
            </div>

            {/* Crash Recovery banner */}
            {recoveryManifests.map((manifest) => (
                <div
                    key={manifest.id}
                    className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-3"
                >
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-[var(--text-main)]">Unfinished Session</h4>
                            <p className="text-xs text-[var(--text-secondary)]">
                                Interrupted {formatDate(manifest.startedAt)}.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleTriggerRecovery(manifest)}
                            disabled={isRecovering === manifest.id}
                            className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-500/50 text-black font-semibold text-xs px-4 py-2 rounded-xl transition-all"
                        >
                            {isRecovering === manifest.id ? 'Assembling...' : 'Assemble & Save'}
                        </button>
                        <button
                            onClick={() => handleDiscardRecovery(manifest.id)}
                            disabled={isRecovering === manifest.id}
                            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}

            {/* Past Sessions List */}
            <div className="flex flex-col gap-6 mt-2">
                <h3 className="text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-wide px-1">
                    Recorded Sessions
                </h3>

                {museSessions.length === 0 ? (
                    <div className="text-center py-20 bg-[var(--bg-card)] border border-dashed border-[var(--border-main)] rounded-3xl flex flex-col items-center justify-center">
                        <FileAudio className="w-12 h-12 text-[var(--text-tertiary)] mb-3" />
                        <h4 className="text-[var(--text-secondary)] font-semibold text-sm">No sessions yet</h4>
                        <p className="text-[var(--text-tertiary)] text-xs mt-1 max-w-xs">
                            Tap Record to start capturing, or upload an audio file.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {groupedSessions.map((group) => (
                            <div key={group.label} className="flex flex-col gap-3">
                                <h4 className="text-xs font-semibold text-[var(--text-tertiary)] px-1">{group.label}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {group.sessions.map((session) => {
                                        const dateLabel = formatDate(session.timestamp);
                                        const isFailed = session.museStatus === 'failed';
                                        const isProcessing = session.museStatus === 'uploading' || session.museStatus === 'analyzing';
                                        const canPlay = !isFailed && !isProcessing;
                                        const isThisPlaying = activeSessionId === session.id && isPlaying;

                                        return (
                                            <div
                                                key={session.id}
                                                className="group relative bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-main)] rounded-3xl p-5 backdrop-blur-xl transition-all flex flex-col justify-between"
                                            >
                                                {/* Card click link wrapper */}
                                                <button
                                                    onClick={() => setSelectedSessionId(session.id)}
                                                    className="absolute inset-0 z-0 rounded-3xl"
                                                />
                                                
                                                <div className="z-10 relative flex justify-between items-start gap-4">
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors truncate">
                                                            {session.name || 'Studio Session'}
                                                        </h4>
                                                        
                                                        <div className="flex items-center gap-3 text-[var(--text-tertiary)] text-[11px] font-medium mt-1">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                {formatTime(session.duration || 0)}
                                                            </span>
                                                            <span>•</span>
                                                            <span>{dateLabel}</span>
                                                        </div>
                                                    </div>

                                                    {/* Controls (relative z-20 to avoid bubbling into the card overlay) */}
                                                    <div className="z-20 relative flex items-center gap-1 flex-shrink-0">
                                                        {canPlay && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (isThisPlaying) {
                                                                        onPauseSession();
                                                                    } else {
                                                                        onPlaySession(session.id, 0);
                                                                    }
                                                                }}
                                                                aria-label={isThisPlaying ? 'Pause session' : 'Play session'}
                                                                className="bg-[var(--accent)] text-[var(--bg-main)] w-9 h-9 rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
                                                            >
                                                                {isThisPlaying ? (
                                                                    <Pause className="w-4 h-4 fill-current" />
                                                                ) : (
                                                                    <Play className="w-4 h-4 fill-current translate-x-0.5" />
                                                                )}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm('Delete this session?')) {
                                                                    onDeleteSession(session.id);
                                                                }
                                                            }}
                                                            aria-label="Delete session"
                                                            className="text-[var(--text-tertiary)] hover:text-[var(--studio-red)] p-2 rounded-xl hover:bg-[var(--bg-card)] transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="z-10 relative mt-4">
                                                    {isFailed ? (
                                                        <div className="flex items-center justify-between gap-3 bg-[var(--studio-red)]/10 border border-[var(--studio-red)]/20 px-3 py-2 rounded-xl">
                                                            <span className="text-[var(--studio-red)] text-xs font-semibold">Analysis failed</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onRetryAnalysis(session.id);
                                                                }}
                                                                className="z-20 text-[var(--accent)] hover:text-[var(--text-main)] text-xs font-bold transition-all"
                                                            >
                                                                Retry
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        renderProportionalBar(session)
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </div>
        </div>
    );
}
