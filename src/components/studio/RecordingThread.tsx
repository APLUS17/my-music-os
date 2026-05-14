import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Scissors, Trash2, Mic, Wand2, Heart, GitMerge, ChevronDown, Plus, Volume2 } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { RecordingSession, AutoSection } from '@/types';
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
    onPlaySession?: (id: string, seekTime?: number) => void;
    onUpdateSession: (id: string, updates: Partial<RecordingSession>) => void;
    onDeleteSession: (id: string) => void;
    onUpdateSection: (sessionId: string, sectionId: string, updates: Partial<AutoSection>) => void;
    onOpenSplitEditor: (sessionId: string) => void;

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
    onPlaySession,
    onUpdateSession,
    onDeleteSession,
    onUpdateSection,
    onOpenSplitEditor,

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
                    onPlaySession={onPlaySession ? (seekTime) => onPlaySession(session.id, seekTime) : undefined}
                    onUpdate={(updates) => onUpdateSession(session.id, updates)}
                    onDelete={() => onDeleteSession(session.id)}
                    onUpdateSection={(sectionId, updates) => onUpdateSection(session.id, sectionId, updates)}
                    onOpenSplitEditor={() => onOpenSplitEditor(session.id)}

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
                <div className="flex flex-col items-center justify-center p-12 text-[var(--text-secondary)] border border-dashed border-[var(--border-subtle)] rounded-2xl bg-white/[0.02]">
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
    onPlaySession,
    onUpdate,
    onDelete,
    onUpdateSection,
    onOpenSplitEditor,

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
    onPlaySession?: (seekTime?: number) => void;
    onUpdate: (updates: Partial<RecordingSession>) => void;
    onDelete: () => void;
    onUpdateSection: (sectionId: string, updates: Partial<AutoSection>) => void;
    onOpenSplitEditor: () => void;

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



    const togglePlayAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isActive) {
            if (onPlaySession) {
                onPlaySession(); // handleSelectSessionAndPlay handles pause + resume via onLoadedMetadata
            } else {
                onSelect();
                setTimeout(() => onTogglePlay(true), 150);
            }
        } else {
            onTogglePlay();
        }
        setPlayingSectionId(null);
    };

    const playSection = (sec: AutoSection, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isActive) {
            if (onPlaySession) {
                onPlaySession(sec.startTime);
                setPlayingSectionId(sec.id);
            } else {
                onSelect();
                setTimeout(() => {
                    onSeek(sec.startTime);
                    onTogglePlay(true);
                    setPlayingSectionId(sec.id);
                }, 150);
            }
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
                    "bg-[#111] border border-[var(--border-subtle)]",
                    isActive ? "ring-1 ring-white/20 shadow-lg" : "opacity-90 hover:opacity-100 hover:border-white/15"
                )}
                onClick={onSelect}
            >


                {/* Header: Master Controls & Metadata */}
                <div className="flex items-start gap-4">
                    <Button
                        onClick={togglePlayAll}
                        size="icon"
                        className={cn(
                            "w-12 h-12 rounded-full shrink-0 transition-all shadow-sm border border-[var(--border-subtle)]",
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
                                className="w-6 h-6 rounded-full text-white/20 hover:text-white hover:bg-[var(--bg-hover)] transition-transform duration-300"
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
                                    <Badge variant="outline" className="h-5 px-1.5 ml-1 text-xs bg-[var(--bg-soft)] text-white/80 border-[var(--border-subtle)] uppercase tracking-wide">
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
                    <div className="w-full h-1 bg-[var(--bg-soft)] rounded-full overflow-hidden mt-2">
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
                                    <div className="absolute -left-[35px] w-6 h-6 rounded-full bg-[#1A1A1A] border border-[var(--border-subtle)] flex items-center justify-center text-xs shadow-sm z-10">
                                        {sec.emojiTag || getEmojiForType(sec.type)}
                                    </div>

                                    <div
                                        onClick={(e) => playSection(sec, e)}
                                        className={cn(
                                            "flex-1 flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                                            isThisSectionPlaying
                                                ? "bg-[var(--bg-hover)] border-[var(--border-strong)] shadow-inner"
                                                : "bg-[var(--bg-elevated)] border-white/[0.05] hover:bg-white/[0.04] hover:border-[var(--border-subtle)]"
                                        )}
                                    >
                                        <div className="flex flex-col min-w-0 pr-4">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-sm font-bold truncate transition-colors",
                                                    isThisSectionPlaying ? "text-white" : "text-white/90 group-hover/sec:text-white"
                                                )}>
                                                    {sec.label || sec.type}
                                                </span>
                                                {sec.isBest && <Heart size={10} className="text-red-400 fill-red-400" />}
                                            </div>
                                            {sec.summary && (
                                                <p className="text-[10px] text-white/50 line-clamp-1 mb-1 italic">
                                                    {sec.summary}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-white/30 font-mono tracking-tighter">
                                                    {sec.startTime.toFixed(1)}s - {sec.endTime.toFixed(1)}s
                                                </span>
                                                <span className="text-[10px] text-white/20 px-1 border border-[var(--border-subtle)] rounded uppercase">
                                                    {sec.type}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onUpdateSection(sec.id, { isBest: !sec.isBest });
                                                }}
                                                className={cn("w-8 h-8 rounded-full", sec.isBest ? "text-red-400 hover:text-red-300 hover:bg-red-400/10" : "text-white/30 hover:text-white hover:bg-[var(--bg-hover)]")}
                                            >
                                                <Heart size={14} fill={sec.isBest ? "currentColor" : "none"} />
                                            </Button>

                                            <div className={cn(
                                                "flex justify-center items-center w-8 h-8 rounded-full border transition-all",
                                                isThisSectionPlaying
                                                    ? "bg-white text-black border-transparent"
                                                    : "bg-[#222] text-white border-[var(--border-subtle)] group-hover/sec:bg-[#333]"
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
