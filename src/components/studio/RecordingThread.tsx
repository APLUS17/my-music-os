import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Scissors, Trash2, Mic, Wand2, Heart, GitMerge, ChevronDown, Layers, Plus, Volume2, VolumeX } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { RecordingSession, AutoSection, RecordingLayer } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface RecordingThreadProps {
    sessions: RecordingSession[];
    activeSessionId: string | null;
    onSelectSession: (id: string) => void;
    onUpdateSession: (id: string, updates: Partial<RecordingSession>) => void;
    onDeleteSession: (id: string) => void;
    onUpdateSection: (sessionId: string, sectionId: string, updates: Partial<AutoSection>) => void;
    onOpenSplitEditor: (sessionId: string) => void;
    onAddLayer?: (sessionId: string) => void;  // Open recorder in layer mode for this session
    beatSrc?: string | null;
    beatVolume?: number;
    onBeatPlaybackChange?: (isPlaying: boolean) => void;
}

export const RecordingThread: React.FC<RecordingThreadProps> = ({
    sessions,
    activeSessionId,
    onSelectSession,
    onUpdateSession,
    onDeleteSession,
    onUpdateSection,
    onOpenSplitEditor,
    onAddLayer,
    beatSrc,
    beatVolume = 1,
    onBeatPlaybackChange,
}) => {
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <div className="flex flex-col gap-6 p-4 pb-32 max-w-3xl mx-auto w-full">
            {sortedSessions.map((session) => (
                <SessionCard
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={() => onSelectSession(session.id)}
                    onUpdate={(updates) => onUpdateSession(session.id, updates)}
                    onDelete={() => onDeleteSession(session.id)}
                    onUpdateSection={(sectionId, updates) => onUpdateSection(session.id, sectionId, updates)}
                    onOpenSplitEditor={() => onOpenSplitEditor(session.id)}
                    onAddLayer={() => onAddLayer?.(session.id)}
                    beatSrc={beatSrc}
                    beatVolume={beatVolume}
                    onBeatPlaybackChange={onBeatPlaybackChange}
                />
            ))}

            {sortedSessions.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 text-[var(--text-secondary)] border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                    <Mic size={32} className="mb-4 opacity-40" />
                    <p className="text-center font-medium text-sm">No recordings yet</p>
                    <p className="text-center text-xs opacity-60 mt-1">Tap the record button to start session capturing</p>
                </div>
            )}
        </div>
    );
};

// ────────────────────────────────────────────────────
// Session Card (Dubnote Threaded View)
// ────────────────────────────────────────────────────

const SessionCard = ({
    session,
    isActive,
    onSelect,
    onUpdate,
    onDelete,
    onUpdateSection,
    onOpenSplitEditor,
    onAddLayer,
    beatSrc,
    beatVolume = 1,
    onBeatPlaybackChange
}: {
    session: RecordingSession;
    isActive: boolean;
    onSelect: () => void;
    onUpdate: (updates: Partial<RecordingSession>) => void;
    onDelete: () => void;
    onUpdateSection: (sectionId: string, updates: Partial<AutoSection>) => void;
    onOpenSplitEditor: () => void;
    onAddLayer: () => void;
    beatSrc?: string | null;
    beatVolume?: number;
    onBeatPlaybackChange?: (isPlaying: boolean) => void;
}) => {
    const [isPlayingAll, setIsPlayingAll] = useState(false);
    const [playingSectionId, setPlayingSectionId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const beatAudioRef = useRef<HTMLAudioElement | null>(null);
    const [progress, setProgress] = useState(0);
    const vocalAudioCtxRef = useRef<AudioContext | null>(null);

    const activePlaybackSection = session.sections.find(s => s.id === playingSectionId);

    useEffect(() => {
        if (session.audioUrl && audioRef.current) {
            audioRef.current.src = session.audioUrl;
        }
    }, [session.audioUrl]);

    // Route vocal audio through Web Audio API so mono recording plays in both ears
    // Create context lazily on first play to avoid hitting browser AudioContext limit
    const initAudioContext = () => {
        if (vocalAudioCtxRef.current) return; // Already initialized

        const audio = audioRef.current;
        if (!audio) return;

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass() as AudioContext;
        vocalAudioCtxRef.current = ctx;

        const source = ctx.createMediaElementSource(audio);
        const merger = ctx.createChannelMerger(2);
        source.connect(merger, 0, 0); // mono → left
        source.connect(merger, 0, 1); // mono → right
        merger.connect(ctx.destination);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (vocalAudioCtxRef.current) {
                vocalAudioCtxRef.current.close();
                vocalAudioCtxRef.current = null;
            }
        };
    }, []);

    // Sync beat and vocal playback (play/pause only, not constant time syncing)
    useEffect(() => {
        const vocal = audioRef.current;
        const beat = beatAudioRef.current;

        if (!vocal || !beat || !beatSrc) return;

        if (isPlayingAll || playingSectionId) {
            // Initialize audio context lazily on first play
            initAudioContext();
            vocalAudioCtxRef.current?.resume();
            vocal.play().catch(() => { });
            // If beat isn't already playing (e.g. this effect fires before the click handler),
            // align its position to the vocal + beatOffset before starting it.
            if (beat.paused) {
                beat.currentTime = vocal.currentTime + (session.beatOffset || 0);
            }
            beat.play().catch(() => { });
            onBeatPlaybackChange?.(true);
        } else {
            vocal.pause();
            beat.pause();
            onBeatPlaybackChange?.(false);
        }
    }, [isPlayingAll, playingSectionId, beatSrc, onBeatPlaybackChange]);

    // Update beat volume when beatVolume changes
    useEffect(() => {
        if (beatAudioRef.current) {
            beatAudioRef.current.volume = beatVolume;
        }
    }, [beatVolume]);

    // Handle Time Updates specifically for playing single sections
    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
        const audio = e.currentTarget;
        const dur = session.duration || 0;

        if (dur > 0) setProgress(audio.currentTime / dur);

        if (playingSectionId && activePlaybackSection) {
            if (audio.currentTime >= activePlaybackSection.endTime) {
                audio.pause();
                if (beatAudioRef.current) beatAudioRef.current.pause();
                setPlayingSectionId(null);
                setIsPlayingAll(false);
                onBeatPlaybackChange?.(false);
            }
        }
    };

    const togglePlayAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current) {
            if (isPlayingAll && !playingSectionId) {
                audioRef.current.pause();
                if (beatAudioRef.current) beatAudioRef.current.pause();
                setIsPlayingAll(false);
            } else {
                // If a section was playing, just reset to play all from current time, or from 0
                setPlayingSectionId(null);
                vocalAudioCtxRef.current?.resume();
                audioRef.current.play();
                if (beatAudioRef.current) {
                    // Align beat to vocal's position + the offset captured at recording start
                    beatAudioRef.current.currentTime = audioRef.current.currentTime + (session.beatOffset || 0);
                    beatAudioRef.current.play().catch(() => { });
                }
                onSelect();
                setIsPlayingAll(true);
            }
        }
    };

    const playSection = (sec: AutoSection, e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current) {
            if (playingSectionId === sec.id && !audioRef.current.paused) {
                audioRef.current.pause();
                if (beatAudioRef.current) beatAudioRef.current.pause();
                setPlayingSectionId(null);
                setIsPlayingAll(false);
            } else {
                audioRef.current.currentTime = sec.startTime;
                vocalAudioCtxRef.current?.resume();
                audioRef.current.play();
                if (beatAudioRef.current) {
                    // Section time is vocal-relative; beat must be offset by beatOffset
                    beatAudioRef.current.currentTime = sec.startTime + (session.beatOffset || 0);
                    beatAudioRef.current.play().catch(() => { });
                }
                setPlayingSectionId(sec.id);
                setIsPlayingAll(false);
                onSelect();
            }
        }
    };

    const x = useMotionValue(0);
    const backgroundScale = useTransform(x, [-100, 0], [1, 0.8]);
    const backgroundOpacity = useTransform(x, [-100, -20], [1, 0]);

    return (
        <div className="relative">
            {/* Delete Background Layer - Only visible after entry animation to prevent initial red flash */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ opacity: backgroundOpacity }}
                className="absolute inset-0 bg-red-500 rounded-2xl flex items-center justify-end px-6 overflow-hidden"
            >
                <motion.div style={{ scale: backgroundScale }}>
                    <Trash2 className="text-white" size={24} />
                </motion.div>
            </motion.div>

            <motion.div
                layout
                style={{ x }}
                drag="x"
                dragConstraints={{ left: -100, right: 0 }}
                dragElastic={0.05}
                onDragEnd={(_, info) => {
                    if (info.offset.x < -80) {
                        if (confirm('Permanently delete this recording?')) {
                            onDelete();
                        }
                    }
                }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                    "group relative flex flex-col p-4 gap-4 rounded-2xl overflow-hidden",
                    "bg-[#111] border border-white/10",
                    isActive ? "ring-1 ring-white/20 shadow-lg" : "opacity-90 hover:opacity-100 hover:border-white/15"
                )}
                onClick={onSelect}
            >
                <audio
                    ref={audioRef}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => { setIsPlayingAll(false); setPlayingSectionId(null); setProgress(0); }}
                />
                {beatSrc && <audio ref={beatAudioRef} src={beatSrc} crossOrigin="anonymous" />}

                {/* Header: Master Controls & Metadata */}
                <div className="flex items-start gap-4">
                    <Button
                        onClick={togglePlayAll}
                        size="icon"
                        className={cn(
                            "w-12 h-12 rounded-full shrink-0 transition-all shadow-sm border border-white/10",
                            (isPlayingAll && !playingSectionId)
                                ? "bg-white text-black hover:bg-white/90"
                                : "bg-[#222] text-white hover:bg-[#333]"
                        )}
                    >
                        {(isPlayingAll && !playingSectionId) ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                    </Button>

                    <div className="flex flex-col flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2 group/title">
                            <Input
                                type="text"
                                value={session.name || 'Untitled Recording'}
                                onChange={(e) => onUpdate({ name: e.target.value })}
                                onClick={(e) => e.stopPropagation()}
                                className="h-auto p-0 -ml-1 bg-transparent border-none text-lg font-semibold text-white outline-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-white/30"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                                className="w-6 h-6 rounded-full text-white/20 hover:text-white hover:bg-white/10 transition-transform duration-300"
                                style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                            >
                                <ChevronDown size={14} />
                            </Button>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-2 text-xs text-white/50 font-medium">
                                <span>{new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span>{(session.duration || 0).toFixed(1)}s</span>
                                {session.isLoopSession && (
                                    <Badge variant="outline" className="h-5 px-1.5 ml-1 text-xs bg-white/5 text-white/80 border-white/10 uppercase tracking-wide">
                                        LOOP
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 transition-opacity">
                        {/* Icons removed as per request (Scissors non-functional, Trash replaced by swipe) */}
                    </div>
                </div>

                <motion.div
                    initial={false}
                    animate={{
                        height: isExpanded ? 'auto' : 0,
                        opacity: isExpanded ? 1 : 0,
                        marginTop: isExpanded ? 0 : -16 // Reduce gap when collapsed
                    }}
                    className="overflow-hidden flex flex-col gap-4"
                >
                    {/* Master Progress Bar */}
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                        <motion.div
                            className="h-full bg-white/80 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress * 100}%` }}
                            transition={{ duration: 0.1, ease: "linear" }}
                        />
                    </div>

                    {/* Threaded Sections */}
                    <div className="mt-2 pl-[22px] border-l-2 border-white/[0.05] ml-[22px] flex flex-col gap-3 pb-2">
                        {session.sections.length > 0 ? session.sections.map((sec, idx) => {
                            const isThisSectionPlaying = playingSectionId === sec.id;

                            return (
                                <div key={sec.id} className="relative flex items-center group/sec">
                                    {/* Emoji Node on thread line */}
                                    <div className="absolute -left-[35px] w-6 h-6 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center text-xs shadow-sm z-10">
                                        {sec.emojiTag || getEmojiForType(sec.type)}
                                    </div>

                                    {/* Section Content Card */}
                                    <div
                                        onClick={(e) => playSection(sec, e)}
                                        className={cn(
                                            "flex-1 flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer",
                                            isThisSectionPlaying
                                                ? "bg-white/10 border-white/20 shadow-inner"
                                                : "bg-black/20 border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10"
                                        )}
                                    >
                                        <div className="flex flex-col min-w-0 pr-4">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-sm font-semibold truncate transition-colors",
                                                    isThisSectionPlaying ? "text-white" : "text-white/80 group-hover/sec:text-white"
                                                )}>
                                                    {sec.label || sec.type}
                                                </span>
                                                {sec.isBest && <Heart size={10} className="text-white/60" />}
                                            </div>
                                            <span className="text-xs text-white/40 font-mono tracking-tighter mt-0.5">
                                                {sec.startTime.toFixed(1)}s - {sec.endTime.toFixed(1)}s
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onUpdateSection(sec.id, { isBest: !sec.isBest });
                                                }}
                                                className={cn("w-8 h-8 rounded-full", sec.isBest ? "text-red-400 hover:text-red-300 hover:bg-red-400/10" : "text-white/30 hover:text-white hover:bg-white/10")}
                                            >
                                                <Heart size={14} fill={sec.isBest ? "currentColor" : "none"} />
                                            </Button>

                                            <div className={cn(
                                                "flex justify-center items-center w-8 h-8 rounded-full border transition-all",
                                                isThisSectionPlaying
                                                    ? "bg-white text-black border-transparent"
                                                    : "bg-[#222] text-white border-white/10 group-hover/sec:bg-[#333]"
                                            )}>
                                                {isThisSectionPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-xs text-white/30 italic py-2">
                                Processing sections...
                            </div>
                        )}

                        {session.sections.length > 0 && (
                            <div className="relative mt-2">
                                <div className="absolute -left-[27px] w-2 h-2 rounded-full border border-white/20 bg-[#111] z-10" />
                            </div>
                        )}
                    </div>

                    {/* Layers Section */}
                    {(session.layers && session.layers.length > 0) || true && (
                        <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.05]">
                            <div className="flex items-center gap-2 px-1">
                                <Layers size={14} className="text-[var(--accent)]" />
                                <span className="text-xs font-semibold text-white/70">
                                    LAYERS
                                </span>
                                {session.layers && session.layers.length > 0 && (
                                    <span className="text-[10px] text-white/40 ml-auto">
                                        {session.layers.filter(l => !l.isMuted).length} active
                                    </span>
                                )}
                            </div>

                            {/* Layer List */}
                            {session.layers?.length ? (
                                <div className="flex flex-col gap-1.5">
                                    {session.layers.map((layer, layerIdx) => (
                                        <div
                                            key={layer.id}
                                            className={cn(
                                                "flex items-center gap-2 p-2 rounded-lg border transition-all",
                                                layer.isMuted
                                                    ? "bg-black/20 border-white/[0.05] opacity-50"
                                                    : "bg-white/[0.05] border-white/10 hover:bg-white/[0.08]"
                                            )}
                                        >
                                            {/* Layer waveform bars - stable heights */}
                                            <div className="flex items-center gap-0.5 flex-1 h-4">
                                                {[...Array(8)].map((_, i) => {
                                                    const seed = 12345 + layerIdx;
                                                    const seededRandom = (idx: number) => {
                                                        const x = Math.sin(seed + idx * 9999) * 10000;
                                                        return x - Math.floor(x);
                                                    };
                                                    const height = seededRandom(i) * 70 + 30;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                "flex-1 rounded-full transition-colors",
                                                                layer.isMuted
                                                                    ? "bg-white/10"
                                                                    : "bg-[var(--accent)]"
                                                            )}
                                                            style={{
                                                                height: `${height}%`
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </div>

                                            {/* Layer name and duration */}
                                            <div className="flex flex-col items-end min-w-0">
                                                <span className={cn(
                                                    "text-xs font-medium truncate",
                                                    layer.isMuted ? "text-white/40" : "text-white/80"
                                                )}>
                                                    {layer.name || `Layer ${layerIdx + 1}`}
                                                </span>
                                                {layer.duration && (
                                                    <span className="text-[10px] text-white/30">
                                                        {layer.duration.toFixed(1)}s
                                                    </span>
                                                )}
                                            </div>

                                            {/* Mute Toggle Button */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    if (!session.layers) return;
                                                    const updatedLayers = session.layers.map(l =>
                                                        l.id === layer.id ? { ...l, isMuted: !l.isMuted } : l
                                                    );
                                                    onUpdate({ layers: updatedLayers });
                                                }}
                                                className="w-7 h-7 rounded-full shrink-0 transition-colors"
                                            >
                                                {layer.isMuted ? (
                                                    <VolumeX size={13} className="text-white/30" />
                                                ) : (
                                                    <Volume2 size={13} className="text-[var(--accent)]" />
                                                )}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {/* Add Layer Button */}
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddLayer();
                                }}
                                className="w-full mt-1 py-2 px-3 rounded-lg bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/20 text-[var(--accent)] transition-colors flex items-center justify-center gap-2"
                                variant="ghost"
                            >
                                <Plus size={14} />
                                <span className="text-xs font-semibold">ADD LAYER</span>
                            </Button>
                        </div>
                    )}
                </motion.div>

            </motion.div>
        </div>
    );
};

// Helper for default emojis based on type
function getEmojiForType(type: string): string {
    switch (type) {
        case 'vocal': return '🎤';
        case 'speech': return '💬';
        case 'instrumental': return '🎸';
        case 'silence': return '⏸️';
        default: return '🎵';
    }
}
