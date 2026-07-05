import React, { useState, useMemo, useCallback, memo } from 'react';
import { Mic, Music, MessageSquare, Play, Pause, Star, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecordingSession, AutoSection } from '@/types';
import { cn } from '@/lib/utils';

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

    isPlaying: boolean;
    currentTime: number;
    onTogglePlay: (play?: boolean) => void;
    onSeek: (time: number) => void;
}

interface ThreadItem {
    id: string;
    sessionId: string;
    type: 'vocal' | 'instrumental' | 'speech' | 'silence' | 'melody' | 'freestyle';
    time: string;
    label: string;
    status: 'main' | 'variant' | 'note';
    section: AutoSection;
    children: ThreadItem[];
}

// Transform sessions into hierarchical thread structure
const transformSessionsToThreadItems = (sessions: RecordingSession[]): ThreadItem[] => {
    const items: ThreadItem[] = [];

    const sortedSessions = [...sessions].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    for (const session of sortedSessions) {
        if (!session.sections || session.sections.length === 0) continue;

        // Display each section as its own lane/thread item
        for (const section of session.sections) {
            const parent: ThreadItem = {
                id: section.id,
                sessionId: session.id,
                type: section.type as any,
                time: `${section.startTime.toFixed(2)}-${section.endTime.toFixed(2)}`,
                label: section.label || session.name || 'Untitled Section',
                status: 'main',
                section: section,
                children: [] // In this view, we'll keep it linear per session sections
            };

            items.push(parent);
        }
    }

    return items;
};

const getEmojiForType = (type: string): string => {
    switch (type) {
        case 'vocal': return '🎤';
        case 'speech': return '💬';
        case 'melody': return '✨';
        case 'freestyle': return '🔥';
        case 'instrumental': return '🎸';
        case 'silence': return '🔇';
        default: return '🎵';
    }
};

const getIconForType = (type: string) => {
    switch (type) {
        case 'vocal': return <Mic size={14} />;
        case 'speech': return <MessageSquare size={14} />;
        case 'melody': return <Mic size={14} className="text-purple-400" />;
        case 'freestyle': return <Mic size={14} className="text-orange-400" />;
        case 'instrumental': return <Music size={14} />;
        default: return <Music size={14} />;
    }
};

// Memoized thread item component
const ThreadItemComponent = memo<{
    item: ThreadItem;
    expanded: Record<string, boolean>;
    toggleExpand: (id: string) => void;
    isParentActive: boolean;
    isPlaying: boolean;
    currentTime: number;
    onPlaySection: (section: AutoSection, e: React.MouseEvent) => void;
    onSelectSession: (id: string) => void;
    onUpdateSection: (sessionId: string, sectionId: string, updates: Partial<AutoSection>) => void;
    onDeleteSession: (id: string) => void;
}>(({
    item,
    expanded,
    toggleExpand,
    isParentActive,
    isPlaying,
    currentTime,
    onPlaySection,
    onSelectSession,
    onUpdateSection,
    onDeleteSession
}) => {
    const isPlaying_this = isParentActive && isPlaying && currentTime >= item.section.startTime && currentTime < item.section.endTime;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative"
        >
            <div className="relative pl-6 border-l border-white/8">
                {/* Timeline dot */}
                <div className={cn(
                    "absolute -left-[7px] top-5 w-3 h-3 rounded-full transition-all duration-300",
                    isPlaying_this ? "bg-[var(--accent)] scale-125 shadow-[0_0_8px_var(--accent)]" : "bg-white/20"
                )} />

                {/* Main item card */}
                <div
                    onClick={() => onSelectSession(item.sessionId)}
                    className={cn(
                        "p-4 rounded-xl cursor-pointer transition-all border group/card",
                        isPlaying_this
                            ? "bg-[var(--accent)]/5 border-[var(--accent)]/40 shadow-[0_0_20px_rgba(165,139,255,0.05)]"
                            : "bg-slate-900/40 hover:bg-slate-900/60 border-white/8 hover:border-white/12"
                    )}
                >
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {item.children.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpand(item.id);
                                    }}
                                    className="text-white/60 hover:text-white transition-colors"
                                >
                                    {expanded[item.id] ? (
                                        <ChevronDown size={14} />
                                    ) : (
                                        <ChevronRight size={14} />
                                    )}
                                </button>
                            )}
                            {!item.children.length && <div className="w-[14px]" />}
                            <span className="text-[10px] mono uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                                {getIconForType(item.type)}
                                {(item.section.emojiTag || item.section.emoji) && <span className="text-xs">{item.section.emojiTag || item.section.emoji}</span>}
                                {item.type}
                            </span>
                        </div>
                        {item.status === 'main' && (
                            <Star size={14} className="text-amber-500" fill="currentColor" />
                        )}
                    </div>

                    {/* Content row */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <span className="font-medium text-sm block truncate mb-0.5">{item.label}</span>
                            {item.section.summary && (
                                <p className="text-[10px] text-white/40 line-clamp-1 italic">
                                    {item.section.summary}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={(e) => onPlaySection(item.section, e)}
                            className={cn(
                                "p-2 rounded-full transition-all active:scale-95 shrink-0",
                                isPlaying_this
                                    ? "bg-[var(--accent)] text-black"
                                    : "bg-white/8 hover:bg-white/12 text-white"
                            )}
                        >
                            {isPlaying_this ? (
                                <Pause size={16} fill="currentColor" />
                            ) : (
                                <Play size={16} fill="currentColor" className="ml-0.5" />
                            )}
                        </button>
                    </div>

                    {/* Time and type footer */}
                    <p className="text-[10px] mt-2 opacity-50">
                        {item.time}
                    </p>
                </div>

                {/* Children (variants/notes) */}
                <AnimatePresence>
                    {expanded[item.id] && item.children.length > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="pl-6 pt-2 overflow-hidden space-y-2"
                        >
                            {item.children.map((child) => (
                                <motion.div
                                    key={child.id}
                                    initial={{ x: -10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                    className="relative"
                                >
                                    {/* Variant dot */}
                                    <div className="absolute -left-[7px] top-3 w-2 h-2 rounded-full bg-white/25" />

                                    <div
                                        onClick={() => onSelectSession(item.sessionId)}
                                        className="p-3 rounded-lg border border-white/6 bg-slate-900/20 hover:bg-slate-900/40 transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-white/60">{child.label}</span>
                                            <button
                                                onClick={(e) => onPlaySection(child.section, e)}
                                                className="bg-white/6 p-1.5 rounded-full hover:bg-white/10 transition-all active:scale-95"
                                            >
                                                <Play size={12} className="text-white ml-0.5" />
                                            </button>
                                        </div>
                                        <p className="text-[9px] opacity-40">{child.time}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
});

ThreadItemComponent.displayName = 'ThreadItem';

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
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // Memoized transformation of sessions to thread items
    const threadItems = useMemo(() => {
        return transformSessionsToThreadItems(sessions);
    }, [sessions]);

    // Memoized toggle handler
    const toggleExpand = useCallback((id: string) => {
        setExpanded(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    }, []);

    // Memoized section play handler
    const playSection = useCallback((section: AutoSection, e: React.MouseEvent) => {
        e.stopPropagation();

        const sessionId = sessions.find(s =>
            s.sections.some(sec => sec.id === section.id)
        )?.id;

        if (!sessionId) return;

        if (activeSessionId !== sessionId) {
            if (onPlaySession) {
                onPlaySession(sessionId, section.startTime);
            } else {
                onSelectSession(sessionId);
                setTimeout(() => {
                    onSeek(section.startTime);
                    onTogglePlay(true);
                }, 150);
            }
        } else {
            onSeek(section.startTime);
            onTogglePlay(true);
        }
    }, [sessions, activeSessionId, onPlaySession, onSelectSession, onSeek, onTogglePlay]);

    return (
        <div className="flex flex-col gap-6 p-4 pb-8 max-w-3xl mx-auto w-full">
            <AnimatePresence mode="popLayout">
                {threadItems.map((item) => (
                    <ThreadItemComponent
                        key={item.id}
                        item={item}
                        expanded={expanded}
                        toggleExpand={toggleExpand}
                        isParentActive={activeSessionId === item.sessionId}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        onPlaySection={playSection}
                        onSelectSession={onSelectSession}
                        onUpdateSection={onUpdateSection}
                        onDeleteSession={onDeleteSession}
                    />
                ))}
            </AnimatePresence>

            {threadItems.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 text-white/40 border border-dashed border-white/8 rounded-2xl bg-slate-900/20">
                    <Mic size={32} className="mb-4 opacity-30" />
                    <p className="text-center font-medium text-sm">No recordings yet</p>
                    <p className="text-center text-xs opacity-50 mt-1">Tap the record button to start capturing</p>
                </div>
            )}
        </div>
    );
};
