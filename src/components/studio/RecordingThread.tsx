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

    // Shared State
    isPlaying: boolean;
    currentTime: number;
    onTogglePlay: (play?: boolean) => void;
    onSeek: (time: number) => void;
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
    isPlaying,
    currentTime,
    onTogglePlay,
    onSeek,
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
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    onTogglePlay={onTogglePlay}
                    onSeek={onSeek}
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
    onBeatPlaybackChange,
    isPlaying,
    currentTime,
    onTogglePlay,
    onSeek,
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
    isPlaying: boolean;
    currentTime: number;
    onTogglePlay: (play?: boolean) => void;
    onSeek: (time: number) => void;
}) => {
    const [playingSectionId, setPlayingSectionId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const layerAudioRefs = useRef<(HTMLAudioElement | null)[]>([]);

    const progress = (session.duration || 0) > 0 ? (isActive ? currentTime / (session.duration || 0) : 0) : 0;
    const isThisSessionPlaying = isActive && isPlaying;

    // Handle section auto-stop
    useEffect(() => {
        if (playingSectionId && isActive) {
            const sec = session.sections.find(s => s.id === playingSectionId);
            if (sec && currentTime >= sec.endTime) {
                onTogglePlay(false);
                setPlayingSectionId(null);
            }
        }
    }, [currentTime, playingSectionId, isActive, onTogglePlay, session.sections]);

    // Handle Layer Sync
    useEffect(() => {
        if (isThisSessionPlaying) {
            layerAudioRefs.current.forEach((audio, idx) => {
                const layer = session.layers?.[idx];
                if (!audio || !layer || layer.isMuted) return;

                // Keep layers in sync with main clock
                if (Math.abs(audio.currentTime - currentTime) > 0.1) {
                    audio.currentTime = currentTime;
                }

                audio.volume = layer.gain ?? 0.8;
                audio.play().catch(() => { });
            });
        } else {
            layerAudioRefs.current.forEach(audio => audio?.pause());
        }
    }, [isThisSessionPlaying, currentTime, session.layers]);

    const togglePlayAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isActive) {
            onSelect();
            // Need a tiny delay for StudioWorkspace to update the src of vocalAudioRef
            setTimeout(() => onTogglePlay(true), 50);
        } else {
            onTogglePlay();
        }
        setPlayingSectionId(null);
    };

    const playSection = (sec: AutoSection, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isActive) {
            onSelect();
            setTimeout(() => {
                onSeek(sec.startTime);
                onTogglePlay(true);
                setPlayingSectionId(sec.id);
            }, 50);
        } else {
            if (playingSectionId === sec.id && isPlaying) {
                onTogglePlay(false);
                setPlayingSectionId(null);
            } else {
                onSeek(sec.startTime);
                onTogglePlay(true);
                setPlayingSectionId(sec.id);
            }
        }
    };

    const x = useMotionValue(0);
    const backgroundScale = useTransform(x, [-100, 0], [1, 0.8]);
    const backgroundOpacity = useTransform(x, [-100, -20], [1, 0]);

    return (
        <div className="relative">
            {/* Delete Background Layer */}
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
                {session.layers?.map((layer, i) => (
                    <audio
                        key={layer.id}
                        ref={el => { layerAudioRefs.current[i] = el; }}
                        src={layer.audioUrl || layer.base64}
                        preload="auto"
                    />
                ))}

                {/* Header: Master Controls & Metadata */}
                <div className="flex items-start gap-4">
                    <Button
                        onClick={togglePlayAll}
                        size="icon"
                        className={cn(
                            "w-12 h-12 rounded-full shrink-0 transition-all shadow-sm border border-white/10",
                            (isThisSessionPlaying && !playingSectionId)
                                ? "bg-white text-black hover:bg-white/90"
                                : "bg-[#222] text-white hover:bg-[#333]"
                        )}
                    >
                        {(isThisSessionPlaying && !playingSectionId) ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
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
                </div>

                <motion.div
                    initial={false}
                    animate={{
                        height: isExpanded ? 'auto' : 0,
                        opacity: isExpanded ? 1 : 0,
                        marginTop: isExpanded ? 0 : -16
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
                            const isThisSectionPlaying = playingSectionId === sec.id && isPlaying;

                            return (
                                <div key={sec.id} className="relative flex items-center group/sec">
                                    <div className="absolute -left-[35px] w-6 h-6 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center text-xs shadow-sm z-10">
                                        {sec.emojiTag || getEmojiForType(sec.type)}
                                    </div>

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
                    </div>

                    {/* Layers Section */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.05]">
                        {session.layers && session.layers.length > 0 && (
                            <>
                                <div className="flex items-center gap-2 px-1">
                                    <Layers size={14} className="text-[var(--accent)]" />
                                    <span className="text-xs font-semibold text-white/70">
                                        LAYERS
                                    </span>
                                    <span className="text-[10px] text-white/40 ml-auto">
                                        {session.layers.filter(l => !l.isMuted).length} active
                                    </span>
                                </div>

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
                            </>
                        )}

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
                </motion.div>
            </motion.div>
        </div>
    );
};

function getEmojiForType(type: string): string {
    switch (type) {
        case 'vocal': return '🎤';
        case 'speech': return '💬';
        case 'instrumental': return '🎸';
        case 'silence': return '⏸️';
        default: return '🎵';
    }
}
