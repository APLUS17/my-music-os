import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Scissors, Trash2, Mic, Wand2, Heart, GitMerge, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
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
    onUpdateSession: (id: string, updates: Partial<RecordingSession>) => void;
    onDeleteSession: (id: string) => void;
    onUpdateSection: (sessionId: string, sectionId: string, updates: Partial<AutoSection>) => void;
    onOpenSplitEditor: (sessionId: string) => void;
}

export const RecordingThread: React.FC<RecordingThreadProps> = ({
    sessions,
    activeSessionId,
    onSelectSession,
    onUpdateSession,
    onDeleteSession,
    onUpdateSection,
    onOpenSplitEditor,
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
    onOpenSplitEditor
}: {
    session: RecordingSession;
    isActive: boolean;
    onSelect: () => void;
    onUpdate: (updates: Partial<RecordingSession>) => void;
    onDelete: () => void;
    onUpdateSection: (sectionId: string, updates: Partial<AutoSection>) => void;
    onOpenSplitEditor: () => void;
}) => {
    const [isPlayingAll, setIsPlayingAll] = useState(false);
    const [playingSectionId, setPlayingSectionId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [progress, setProgress] = useState(0);

    const activePlaybackSection = session.sections.find(s => s.id === playingSectionId);

    useEffect(() => {
        if (session.audioUrl && audioRef.current) {
            audioRef.current.src = session.audioUrl;
        }
    }, [session.audioUrl]);

    // Handle Time Updates specifically for playing single sections
    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
        const audio = e.currentTarget;
        const dur = session.duration || 0;

        if (dur > 0) setProgress(audio.currentTime / dur);

        if (playingSectionId && activePlaybackSection) {
            if (audio.currentTime >= activePlaybackSection.endTime) {
                audio.pause();
                setPlayingSectionId(null);
                setIsPlayingAll(false);
            }
        }
    };

    const togglePlayAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current) {
            if (isPlayingAll && !playingSectionId) {
                audioRef.current.pause();
                setIsPlayingAll(false);
            } else {
                // If a section was playing, just reset to play all from current time, or from 0
                setPlayingSectionId(null);
                audioRef.current.play();
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
                setPlayingSectionId(null);
                setIsPlayingAll(false);
            } else {
                audioRef.current.currentTime = sec.startTime;
                audioRef.current.play();
                setPlayingSectionId(sec.id);
                setIsPlayingAll(false);
                onSelect();
            }
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "group relative flex flex-col p-4 gap-4 rounded-2xl overflow-hidden transition-all duration-300",
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
                                <Badge variant="outline" className="h-5 px-1.5 ml-1 text-[9px] bg-white/5 text-white/80 border-white/10 uppercase tracking-wide">
                                    LOOP
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onOpenSplitEditor(); }}
                        className="w-10 h-10 rounded-full text-white/40 hover:text-white hover:bg-white/10"
                    >
                        <Scissors size={18} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this session?')) onDelete();
                        }}
                        className="w-10 h-10 rounded-full text-white/40 hover:text-red-400 hover:bg-red-400/10"
                    >
                        <Trash2 size={18} />
                    </Button>
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
                                <div className="absolute -left-[35px] w-6 h-6 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center text-[10px] shadow-sm z-10">
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
                                        <span className="text-[10px] text-white/40 font-mono tracking-tighter mt-0.5">
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
            </motion.div>

        </motion.div>
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
