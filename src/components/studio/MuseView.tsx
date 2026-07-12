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
    MessageSquare,
    Lightbulb,
    FileAudio,
    Dribbble,
    UserCheck,
    Coffee,
    X
} from 'lucide-react';
import { RecordingSession, MuseSegment, MuseRecap, MuseSegmentType, MuseManifest } from '@/types';
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
    onRecoverSession
}: MuseViewProps) {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [recoveryManifests, setRecoveryManifests] = useState<MuseManifest[]>([]);
    const [isRecovering, setIsRecovering] = useState<string | null>(null);

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

    // Proportional bar calculation
    const renderProportionalBar = (session: RecordingSession) => {
        const stats = session.museRecap?.stats || {};
        const total = Object.values(stats).reduce((acc: number, val) => acc + (val || 0), 0);
        if (total === 0) return null;

        return (
            <div className="h-2 w-full rounded-full overflow-hidden flex bg-white/[0.04] mt-3">
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
                        className="absolute inset-0 rounded-full bg-red-500/20 blur-xl"
                    />
                    
                    {/* Circular Level meter */}
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                        <circle
                            cx="96"
                            cy="96"
                            r="80"
                            className="stroke-white/[0.03] fill-none"
                            strokeWidth="6"
                        />
                        <motion.circle
                            cx="96"
                            cy="96"
                            r="80"
                            className="stroke-red-500 fill-none"
                            strokeWidth="8"
                            strokeDasharray={2 * Math.PI * 80}
                            strokeDashoffset={2 * Math.PI * 80 * (1 - recorder.level)}
                            transition={{ ease: "easeOut", duration: 0.1 }}
                        />
                    </svg>

                    <div className="z-10 flex flex-col items-center">
                        <Mic className="w-10 h-10 text-red-500 mb-2 animate-pulse" />
                        <span className="font-mono text-3xl font-bold tracking-wider text-white">
                            {formatTime(recorder.elapsedSec)}
                        </span>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">Studio Session Active</h2>
                <p className="text-white/60 text-sm max-w-sm mb-6">
                    Muse is recording everything. Freestyles, ideas, playbacks, and dialogue will be automatically split.
                </p>

                {recorder.wakeLockActive && (
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-4 py-2 mb-8 text-yellow-500 text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Keep screen on — recording pauses if the phone locks.</span>
                    </div>
                )}

                <div className="flex items-center gap-6">
                    <button
                        onClick={recorder.discard}
                        disabled={recorder.status === 'stopping'}
                        className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl text-white/50 hover:text-white/80 hover:bg-white/[0.03] transition-all"
                    >
                        <Trash2 className="w-5 h-5" />
                        <span className="text-xs">Discard</span>
                    </button>

                    <button
                        onClick={handleStopRecording}
                        disabled={recorder.status === 'stopping'}
                        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20 active:scale-95 transition-all text-white"
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
                    className="self-start flex items-center gap-2 text-white/60 hover:text-white mb-12 text-sm transition-all"
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
                                    className="absolute inset-0 border-t-2 border-r-2 border-t-[#7fff00] border-r-purple-500 rounded-full"
                                />
                                <Sparkles className="w-8 h-8 text-[#7fff00] animate-pulse" />
                            </div>

                            <h3 className="text-xl font-bold text-white mb-3">Processing Session</h3>
                            <p className="text-white/60 text-sm mb-6">
                                {status === 'uploading'
                                    ? 'Uploading audio to studio cloud (this is fast)...'
                                    : 'Analyzing your session with Gemini AI (takes 1-3 minutes for long files)...'}
                            </p>

                            <div className="flex flex-col items-start gap-3 w-64 bg-white/[0.02] border border-white/[0.04] p-4 rounded-2xl text-left text-xs text-white/50">
                                <div className="flex items-center gap-2 text-white">
                                    <span className="text-[#7fff00]">✓</span>
                                    <span>Saved safely on device</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={status === 'uploading' ? 'text-[#7fff00] animate-pulse' : 'text-[#7fff00]'}>
                                        {status === 'uploading' ? '●' : '✓'}
                                    </span>
                                    <span className={status === 'uploading' ? 'text-white' : ''}>Upload to analyzer</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={status === 'analyzing' ? 'text-[#7fff00] animate-pulse' : ''}>
                                        {status === 'analyzing' ? '●' : '○'}
                                    </span>
                                    <span className={status === 'analyzing' ? 'text-white' : ''}>Segment and recap timeline</span>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="failed"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center bg-white/[0.02] border border-red-500/10 p-6 rounded-3xl"
                        >
                            <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">Recap Failed to Generate</h3>
                            <p className="text-white/60 text-sm mb-6 max-w-xs">
                                The AI analysis route failed or timed out. But don&apos;t worry — your session audio is safe locally.
                            </p>

                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    onClick={() => onRetryAnalysis(selectedSession.id)}
                                    className="w-full bg-[#7fff00] text-black font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#8eff24] active:scale-[0.98] transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Retry AI Analysis</span>
                                </button>
                                <button
                                    onClick={() => setSelectedSessionId(null)}
                                    className="w-full bg-white/[0.04] text-white py-3 px-4 rounded-xl hover:bg-white/[0.08] transition-all"
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
            <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 pb-28">
                {/* Header Back Button */}
                <button
                    onClick={() => setSelectedSessionId(null)}
                    className="self-start flex items-center gap-2 text-white/60 hover:text-white transition-all text-sm mb-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Sessions</span>
                </button>

                {/* Recap Hero details */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#7fff00]/5 blur-[80px] rounded-full pointer-events-none" />
                    
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                        <div>
                            <span className="text-xs font-semibold tracking-wider text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full uppercase">
                                Muse AI Recap
                            </span>
                            <h2 className="text-2xl font-bold text-white mt-2">
                                {recap?.title || selectedSession.name || 'Studio Session'}
                            </h2>
                            <div className="flex items-center gap-4 text-white/50 text-xs mt-1">
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
                            className="bg-[#7fff00] text-black w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                        >
                            {isCurrentlyPlayingThis && isPlaying ? (
                                <Pause className="w-5 h-5 fill-current" />
                            ) : (
                                <Play className="w-5 h-5 fill-current translate-x-0.5" />
                            )}
                        </button>
                    </div>

                    {/* Proportional Duration Bar */}
                    <div className="mt-6 pt-4 border-t border-white/[0.04]">
                        <h4 className="text-xs font-bold text-white/40 mb-2 uppercase tracking-wide">Timeline breakdown</h4>
                        {renderProportionalBar(selectedSession)}
                        
                        {/* Legend */}
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                            {Object.entries(recap?.stats || {}).map(([k, val]) => {
                                const type = k as MuseSegmentType;
                                const dur = val || 0;
                                if (dur === 0) return null;
                                return (
                                    <div key={type} className="flex items-center gap-1.5 text-xs text-white/60">
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
                        <div className="bg-white/[0.01] border border-white/[0.03] rounded-2xl p-4 mt-6">
                            <p className="text-white/80 text-sm leading-relaxed italic">
                                &ldquo;{recap.summary}&rdquo;
                            </p>
                        </div>
                    )}
                </div>

                {/* Highlights Section */}
                {recap?.highlights && recap.highlights.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-white/40 uppercase tracking-wide flex items-center gap-1.5 px-1">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span>Highlights & Sparks</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {recap.highlights.map((hl, idx) => {
                                // Find matching segment for details
                                const matchedSeg = segments.find(s => s.id === hl.segmentId);
                                const color = matchedSeg ? MUSE_TYPE_META[matchedSeg.type]?.color : '#7fff00';
                                const emoji = matchedSeg ? MUSE_TYPE_META[matchedSeg.type]?.emoji : '✨';
                                
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => onPlaySession(selectedSession.id, hl.startTime)}
                                        className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl p-4 text-left transition-all group flex items-start gap-3.5"
                                    >
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                                            style={{ backgroundColor: matchedSeg ? MUSE_TYPE_META[matchedSeg.type]?.bg : 'rgba(255,255,255,0.05)' }}
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
                                                <span className="text-[10px] text-white/30 uppercase tracking-wide">Jump</span>
                                            </div>
                                            <p className="text-white/80 text-xs font-medium mt-1 leading-snug">
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
                    <h3 className="text-sm font-bold text-white/40 uppercase tracking-wide px-1">
                        Session Timeline
                    </h3>

                    {segments.length === 0 ? (
                        <div className="text-center py-12 text-white/40 text-sm">
                            No segments mapped.
                        </div>
                    ) : (
                        <div className="relative pl-6 border-l border-white/10 flex flex-col gap-6">
                            {segments.map((seg, idx) => {
                                const meta = MUSE_TYPE_META[seg.type] || MUSE_TYPE_META.downtime;
                                const isActive = isCurrentlyPlayingThis && activeSegmentIdx === idx;
                                
                                return (
                                    <div
                                        key={seg.id}
                                        className="relative group"
                                    >
                                        {/* Dot on the rail */}
                                        <div
                                            className="absolute -left-[31px] top-4 w-4 h-4 rounded-full border-2 border-black flex items-center justify-center transition-all"
                                            style={{
                                                backgroundColor: isActive ? meta.color : 'rgba(255,255,255,0.1)',
                                                boxShadow: isActive ? `0 0 10px ${meta.color}` : 'none'
                                            }}
                                        />

                                        {/* Segment block */}
                                        <button
                                            onClick={() => onPlaySession(selectedSession.id, seg.startTime)}
                                            className={`w-full text-left rounded-3xl p-5 border backdrop-blur-xl transition-all flex flex-col md:flex-row md:items-start gap-4 ${
                                                isActive
                                                    ? 'bg-white/[0.04] border-white/20 shadow-md shadow-black/20'
                                                    : 'bg-white/[0.01] hover:bg-white/[0.03] border-white/[0.04] hover:border-white/[0.08]'
                                            }`}
                                        >
                                            {/* Left Icon circle */}
                                            <div
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                                                style={{ backgroundColor: meta.bg }}
                                            >
                                                {meta.emoji}
                                            </div>

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
                                                        <h4 className="text-sm font-bold text-white truncate max-w-[200px] md:max-w-sm">
                                                            {seg.label}
                                                        </h4>
                                                    </div>
                                                    <span className="font-mono text-xs text-white/40">
                                                        {formatTime(seg.startTime)} – {formatTime(seg.endTime)}
                                                    </span>
                                                </div>

                                                <p className="text-white/60 text-xs mt-2 leading-relaxed">
                                                    {seg.summary}
                                                </p>

                                                {seg.quote && (
                                                    <div className="border-l-2 border-white/10 pl-3 mt-3">
                                                        <p className="text-white/40 text-xs italic">
                                                            &ldquo;{seg.quote}&rdquo;
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 4. IDLE / LIST STATE
    return (
        <div className="max-w-4xl mx-auto p-4 flex flex-col gap-6">
            
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4 bg-white/[0.01] border border-white/[0.03] p-6 rounded-3xl backdrop-blur-xl">
                <div>
                    <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-[#7fff00] animate-pulse" />
                        <span>Muse Logger</span>
                    </h2>
                    <p className="text-white/50 text-xs mt-1 max-w-sm leading-relaxed">
                        Automatic, always-on songwriting capture. AI maps taking, practicing, conversations, and highlights.
                    </p>
                </div>
                
                {/* Record Button */}
                <button
                    onClick={handleStartRecording}
                    className="relative group overflow-hidden bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 font-semibold px-6 py-3 rounded-2xl flex items-center gap-2 active:scale-95 shadow-lg shadow-red-500/10 hover:shadow-red-500/20 transition-all"
                >
                    <Mic className="w-5 h-5 text-white/95" />
                    <span>Record Session</span>
                </button>
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
                            <h4 className="text-sm font-bold text-white">Unfinished Session Detected</h4>
                            <p className="text-xs text-white/50">
                                Session crashed or browser closed from {formatDate(manifest.startedAt)}.
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
                            className="text-white/40 hover:text-white/60 p-2 rounded-xl hover:bg-white/[0.04] transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}

            {/* Past Sessions List */}
            <div className="flex flex-col gap-6 mt-2">
                <h3 className="text-sm font-bold text-white/40 uppercase tracking-wide px-1">
                    Recorded Sessions
                </h3>

                {museSessions.length === 0 ? (
                    <div className="text-center py-20 bg-white/[0.01] border border-dashed border-white/[0.05] rounded-3xl flex flex-col items-center justify-center">
                        <FileAudio className="w-12 h-12 text-white/10 mb-3" />
                        <h4 className="text-white/70 font-semibold text-sm">No studio sessions yet</h4>
                        <p className="text-white/40 text-xs mt-1 max-w-xs">
                            Tap &quot;Record Session&quot; to begin your first always-on logging stream.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {groupedSessions.map((group) => (
                            <div key={group.label} className="flex flex-col gap-3">
                                <h4 className="text-xs font-semibold text-white/30 px-1">{group.label}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {group.sessions.map((session) => {
                                        const dateLabel = formatDate(session.timestamp);
                                        const isFailed = session.museStatus === 'failed';
                                        
                                        return (
                                            <div
                                                key={session.id}
                                                className="group relative bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] rounded-3xl p-5 backdrop-blur-xl transition-all flex flex-col justify-between"
                                            >
                                                {/* Card click link wrapper */}
                                                <button
                                                    onClick={() => setSelectedSessionId(session.id)}
                                                    className="absolute inset-0 z-0 rounded-3xl"
                                                />
                                                
                                                <div className="z-10 relative flex justify-between items-start gap-4">
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-bold text-white group-hover:text-[#7fff00] transition-colors truncate">
                                                            {session.name || 'Studio Session'}
                                                        </h4>
                                                        
                                                        <div className="flex items-center gap-3 text-white/40 text-[11px] font-medium mt-1">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                {formatTime(session.duration || 0)}
                                                            </span>
                                                            <span>•</span>
                                                            <span>{dateLabel}</span>
                                                        </div>
                                                    </div>

                                                    {/* Delete button (must be relative z-20 to avoid bubbling) */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm('Delete this session?')) {
                                                                onDeleteSession(session.id);
                                                            }
                                                        }}
                                                        className="z-20 text-white/30 hover:text-red-400 p-2 rounded-xl hover:bg-white/[0.03] transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="z-10 relative mt-4">
                                                    {isFailed ? (
                                                        <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
                                                            <span className="text-red-400 text-xs font-semibold">Analysis failed</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onRetryAnalysis(session.id);
                                                                }}
                                                                className="z-20 text-[#7fff00] hover:text-white text-xs font-bold transition-all"
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
    );
}
