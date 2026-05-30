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
    type: 'vocal' | 'instrumental' | 'speech' | 'silence';
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

        // Group sections by type for hierarchical display
        const groupedByType: Record<string, AutoSection[]> = {};
        for (const section of session.sections) {
            if (!groupedByType[section.type]) {
                groupedByType[section.type] = [];
            }
            groupedByType[section.type].push(section);
        }

        // Create parent items with children (variants)
        for (const [type, sections] of Object.entries(groupedByType)) {
            if (sections.length === 0) continue;

            const mainSection = sections[0]; // First is main
            const variantSections = sections.slice(1); // Rest are variants

            const parent: ThreadItem = {
                id: mainSection.id,
                sessionId: session.id,
                type: mainSection.type as any,
                time: `${mainSection.startTime.toFixed(2)}-${mainSection.endTime.toFixed(2)}`,
                label: session.name || 'Untitled Recording',
                status: 'main',
                section: mainSection,
                children: variantSections.map((sec, idx) => ({
                    id: sec.id,
                    sessionId: session.id,
                    type: sec.type as any,
                    time: `${sec.startTime.toFixed(2)}-${sec.endTime.toFixed(2)}`,
                    label: `Variant ${idx + 1}`,
                    status: 'variant' as const,
                    section: sec,
                    children: []
                }))
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
        case 'instrumental': return '🎸';
        case 'silence': return '🔇';
        default: return '🎵';
    }
};

const getIconForType = (type: string) => {
    switch (type) {
        case 'vocal': return <Mic size={14} />;
        case 'speech': return <MessageSquare size={14} />;
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
        >
            <div className="relative pl-6 border-l border-white/10">
                {/* Timeline dot */}
                <div className="absolute -left-[7px] top-5 w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30" />

                {/* Main item card */}
                <div
                    onClick={() => onSelectSession(item.sessionId)}
                    className={cn(
                        "p-4 rounded-xl cursor-pointer transition-all border",
                        isPlaying_this
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-slate-900/50 hover:bg-slate-800/50 border-white/5"
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
                            <span className="text-xs uppercase opacity-70 flex items-center gap-1">
                                {getIconForType(item.type)} {item.type}
                            </span>
                        </div>
                        {item.status === 'main' && (
                            <Star size={14} className="text-amber-500" fill="currentColor" />
                        )}
                    </div>

                    {/* Content row */}
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{item.label}</span>
                        <button
                            onClick={(e) => onPlaySection(item.section, e)}
                            className="bg-white/5 p-2 rounded-full hover:bg-white/10 transition-transform active:scale-95"
                        >
                            {isPlaying_this ? (
                                <Pause size={16} className="text-white" />
                            ) : (
                                <Play size={16} className="text-white ml-0.5" />
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
                            className="pl-6 pt-2 overflow-hidden space-y-2"
                        >
                            {item.children.map((child) => (
                                <motion.div
                                    key={child.id}
                                    initial={{ x: -10 }}
                                    animate={{ x: 0 }}
                                    className="relative"
                                >
                                    {/* Variant dot */}
                                    <div className="absolute -left-[7px] top-3 w-2 h-2 rounded-full bg-slate-500" />

                                    <div
                                        onClick={() => onSelectSession(item.sessionId)}
                                        className="p-3 rounded-lg border border-white/5 bg-slate-900/30 hover:bg-slate-900/50 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-white/60">{child.label}</span>
                                            <button
                                                onClick={(e) => onPlaySection(child.section, e)}
                                                className="bg-white/5 p-1.5 rounded-full hover:bg-white/10 transition-transform"
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
        <div className="flex flex-col gap-6 p-4 pb-32 max-w-3xl mx-auto w-full">
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
                <div className="flex flex-col items-center justify-center p-12 text-white/50 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                    <Mic size={32} className="mb-4 opacity-40" />
                    <p className="text-center font-medium text-sm">No recordings yet</p>
                    <p className="text-center text-xs opacity-60 mt-1">Tap the record button to start capturing</p>
                </div>
            )}

            {/* FAB - preserved from original */}
            <motion.button
                whileTap={{ scale: 0.9 }}
                className="fixed bottom-6 right-6 bg-emerald-500 p-4 rounded-full shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"
            >
                <Mic size={24} className="text-black" />
            </motion.button>
        </div>
    );
};
