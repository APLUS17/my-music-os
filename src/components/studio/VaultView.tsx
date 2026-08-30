"use client";

import React, { useMemo, memo, useState } from 'react';
import {
    Library, Music, FileText, Play, Pause,
    LayoutGrid, List as ListIcon, ChevronRight, MessageSquare, Menu, Trash2
} from 'lucide-react';
import { Button } from "../ui/button";
import { LyricScrap, RecordingSession, Beat, RitualStat } from '../../types';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type LayoutMode = "grid" | "list";

const formatTime = (seconds: number = 0) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// --- Progress Slider ---

const CustomSlider = ({
  value,
  className,
}: {
  value: number;
  className?: string;
}) => (
  <div className={cn("relative w-full h-1 bg-[var(--bg-hover)] rounded-full", className)}>
    <motion.div
      className="absolute top-0 left-0 h-full bg-[var(--text-main)] rounded-full"
      animate={{ width: `${value}%` }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    />
  </div>
);

// --- Audio Card ---

const VaultAudioCard = ({
    id,
    title,
    type,
    isPlaying,
    onPlay,
    onDelete,
    currentTime,
    duration,
    compact = false
}: {
    id: string;
    title: string;
    type: 'session' | 'beat';
    isPlaying: boolean;
    onPlay: (id: string) => void;
    onDelete?: (id: string) => void;
    currentTime: number;
    duration: number;
    compact?: boolean;
}) => {
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <motion.div
            className={cn(
                "relative flex flex-col mx-auto rounded-3xl overflow-hidden bg-[var(--bg-card)] shadow-[0_0_20px_rgba(0,0,0,0.1)] p-3 w-full h-full border border-[var(--border-main)] group",
                compact && "h-auto"
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            layout
        >
            {onDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-[var(--studio-red)] opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                    title="Delete"
                >
                    <Trash2 size={13} />
                </button>
            )}
            <div className="flex flex-col relative h-full justify-between">
                <div className={cn(
                    "bg-[var(--bg-secondary)] overflow-hidden rounded-[16px] w-full relative flex items-center justify-center",
                    compact ? "h-[120px]" : "h-[160px]"
                )}>
                    <div className="flex flex-col items-center gap-2 opacity-30 text-[var(--text-secondary)]">
                        {type === 'session' ? <FileText size={compact ? 32 : 48} /> : <Music size={compact ? 32 : 48} />}
                    </div>
                    {isPlaying && (
                        <div className="absolute inset-x-0 bottom-0 h-10 flex items-end gap-0.5 px-4 pb-2">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="bg-[var(--accent)]/60 w-1 rounded-full"
                                    animate={{ height: [`${20 + Math.random() * 40}%`, `${60 + Math.random() * 40}%`, `${20 + Math.random() * 40}%`] }}
                                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.05 }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col w-full gap-y-2 mt-2">
                    <h3 className="text-[var(--text-main)] font-bold text-xs text-center truncate px-2">{title}</h3>

                    <div className="flex flex-col gap-y-1">
                        <CustomSlider value={isPlaying ? progress : 0} className="w-full" />
                        <div className="flex items-center justify-between px-0.5">
                            <span className="text-[var(--text-secondary)] text-[9px] mono">{isPlaying ? formatTime(currentTime) : "0:00"}</span>
                            <span className="text-[var(--text-secondary)] text-[9px] mono">{isPlaying ? formatTime(duration) : "0:00"}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center w-full">
                        <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-[12px] p-1 border border-[var(--border-main)]">
                            <Button
                                onClick={(e) => { e.stopPropagation(); onPlay(id); }}
                                variant="ghost"
                                size="icon"
                                className="text-[var(--bg-main)] bg-[var(--text-main)] hover:bg-[var(--text-main)]/90 h-7 w-7 rounded-full transition-all"
                            >
                                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// --- Sticky Note ---

const VaultStickyNote = ({ scrap, compact = false }: { scrap: LyricScrap; compact?: boolean }) => (
    <div className={cn(
        "h-full bg-yellow-200/90 shadow-xl rotate-[-1deg] flex flex-col justify-between rounded-sm border-t-2 border-yellow-300",
        compact ? "p-3" : "p-5"
    )}>
        <p className="text-sm text-yellow-900 font-medium leading-relaxed italic">
            &ldquo;{scrap.text}&rdquo;
        </p>
        <div className="flex justify-between items-center mt-4 border-t border-yellow-900/10 pt-3">
            <div className="flex items-center gap-1.5 opacity-40">
                <FileText size={12} className="text-yellow-900" />
                <span className="text-[10px] font-bold text-yellow-900 uppercase">Scrap</span>
            </div>
            <span className="text-[9px] mono text-yellow-900/40 uppercase tracking-widest">{scrap.id.substring(0, 4)}</span>
        </div>
    </div>
);

// --- List View ---

const VaultListView = ({
    items,
    playingSessionId,
    isSessionPlaying,
    playingBeatId,
    onPlaySession,
    onPlayBeat,
    onDeleteBeat,
    currentTime,
    duration
}: {
    items: { type: 'session' | 'scrap' | 'beat'; data: RecordingSession | LyricScrap | Beat }[];
    playingSessionId: string | null;
    isSessionPlaying: boolean;
    playingBeatId: string | null;
    onPlaySession: (id: string) => void;
    onPlayBeat: (id: string) => void;
    onDeleteBeat?: (id: string) => void;
    currentTime: number;
    duration: number;
}) => (
    <div className="flex flex-col w-full divide-y divide-[var(--border-main)]">
        {items.map((item, idx) => {
            const d = item.data as any;
            const isPlaying = (item.type === 'session' && isSessionPlaying && playingSessionId === d.id) ||
                              (item.type === 'beat' && playingBeatId === d.id);

            const title = item.type === 'session' ? (d.name || 'Untitled Recording')
                        : item.type === 'beat' ? d.name
                        : (d.text?.length > 50 ? d.text.substring(0, 50) + '…' : d.text) || 'Note';

            const date = item.type === 'session' ? new Date(d.timestamp).toLocaleDateString()
                       : item.type === 'beat' ? d.date
                       : 'Just now';

            const durationStr = item.type === 'session' ? formatTime(d.duration)
                              : item.type === 'beat' ? d.duration
                              : '';

            return (
                <motion.div
                    key={`${item.type}-${d.id}-${idx}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => item.type === 'session' ? onPlaySession(d.id) : item.type === 'beat' ? onPlayBeat(d.id) : null}
                    className={cn(
                        "group flex items-center justify-between py-4 px-2 hover:bg-[var(--bg-secondary)] transition-all cursor-pointer",
                        isPlaying && "bg-[var(--accent)]/5"
                    )}
                >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all",
                            isPlaying ? "bg-[var(--accent)] text-black" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                        )}>
                            {isPlaying ? <Pause size={16} fill="currentColor" />
                             : item.type === 'session' ? <FileText size={18} />
                             : item.type === 'beat' ? <Music size={18} />
                             : <MessageSquare size={18} />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className={cn(
                                "text-sm font-semibold truncate transition-colors",
                                isPlaying ? "text-[var(--accent)]" : "text-[var(--text-main)]"
                            )}>{title}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] mono text-[var(--text-tertiary)] uppercase">{date}</span>
                                {item.type === 'session' && d.transcription && (
                                    <MessageSquare size={10} className="text-[var(--text-tertiary)]" />
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pl-4">
                        {durationStr && <span className="text-xs mono text-[var(--text-secondary)]">{durationStr}</span>}
                        {item.type === 'beat' && onDeleteBeat && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteBeat(d.id); }}
                                className="text-[var(--text-tertiary)] hover:text-[var(--studio-red)] p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                        <ChevronRight size={14} className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </motion.div>
            );
        })}
    </div>
);

// --- Main Component ---

interface VaultViewProps {
    sessions: RecordingSession[];
    scraps: LyricScrap[];
    beats: Beat[];
    projectTitle: string;
    onPlaySession: (id: string) => void;
    playingSessionId: string | null;
    isSessionPlaying: boolean;
    onPlayBeat: (id: string) => void;
    playingBeatId: string | null;
    onDeleteBeat?: (id: string) => void;
    currentTime: number;
    duration: number;
    ritualStats: RitualStat[];
    onOpenSidebar?: () => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
    sessions, scraps, beats,
    projectTitle, onPlaySession, playingSessionId, isSessionPlaying,
    onPlayBeat, playingBeatId, onDeleteBeat,
    currentTime, duration, onOpenSidebar
}) => {
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');

    const items = useMemo(() => [
        ...sessions.map(s => ({ type: 'session' as const, data: s })),
        ...scraps.map(s => ({ type: 'scrap' as const, data: s })),
        ...beats.map(b => ({ type: 'beat' as const, data: b }))
    ], [sessions, scraps, beats]);

    return (
        <div className="relative flex flex-col h-full bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-6 z-[60] pointer-events-none flex justify-between items-start bg-gradient-to-b from-[var(--bg-main)] via-[var(--bg-main)]/70 to-transparent">
                {/* Left: hamburger + title */}
                <div className="pointer-events-auto flex items-start gap-3">
                    {onOpenSidebar && (
                        <button
                            onClick={onOpenSidebar}
                            className="mt-0.5 p-2 rounded-xl hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors active:scale-95 cursor-pointer"
                        >
                            <Menu size={20} />
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                            <h2 className="text-[10px] mono uppercase tracking-[0.2em] text-[var(--accent)] font-bold">The Vault</h2>
                        </div>
                        <h1 className="text-2xl font-medium tracking-tight text-[var(--text-main)]">{projectTitle || 'All Captures'}</h1>
                    </div>
                </div>

                {/* Right: layout toggle + count */}
                <div className="flex flex-col items-end gap-3 pointer-events-auto">
                    <div className="flex bg-[var(--bg-secondary)] p-1 rounded-full border border-[var(--border-main)] backdrop-blur-md">
                        <button
                            onClick={() => setLayoutMode('grid')}
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                layoutMode === 'grid' ? "bg-[var(--text-main)] text-[var(--bg-main)] shadow-md" : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                            )}
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setLayoutMode('list')}
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                layoutMode === 'list' ? "bg-[var(--text-main)] text-[var(--bg-main)] shadow-md" : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                            )}
                        >
                            <ListIcon size={16} />
                        </button>
                    </div>
                    <span className="text-[10px] mono text-[var(--text-secondary)] uppercase tracking-widest">{items.length} Elements</span>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {items.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-[var(--bg-main)]"
                    >
                        <div className="w-20 h-20 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-tertiary)] mb-6 border border-[var(--border-main)]">
                            <Library size={40} strokeWidth={1} />
                        </div>
                        <h3 className="text-[var(--text-main)] font-medium tracking-tight text-lg">Your vault is empty</h3>
                        <p className="text-[10px] mono text-[var(--text-secondary)] mt-3 uppercase tracking-[0.3em]">Record, write, and experiment to fill it</p>
                    </motion.div>
                ) : layoutMode === 'grid' ? (
                    <motion.div
                        key="grid"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 overflow-y-auto px-6 pt-36 pb-32 scrollbar-hide bg-[var(--bg-main)]"
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {items.map((item, idx) => (
                                <div key={`${item.type}-${idx}`}>
                                    {item.type === 'session' && (
                                        <VaultAudioCard
                                            id={(item.data as RecordingSession).id}
                                            title={(item.data as RecordingSession).name || 'Untitled Take'}
                                            type="session"
                                            isPlaying={isSessionPlaying && playingSessionId === (item.data as RecordingSession).id}
                                            onPlay={onPlaySession}
                                            currentTime={isSessionPlaying && playingSessionId === (item.data as RecordingSession).id ? currentTime : 0}
                                            duration={isSessionPlaying && playingSessionId === (item.data as RecordingSession).id ? duration : 0}
                                            compact
                                        />
                                    )}
                                    {item.type === 'scrap' && (
                                        <div className="h-[180px]">
                                            <VaultStickyNote scrap={item.data as LyricScrap} compact />
                                        </div>
                                    )}
                                    {item.type === 'beat' && (
                                        <VaultAudioCard
                                            id={(item.data as Beat).id}
                                            title={(item.data as Beat).name}
                                            type="beat"
                                            isPlaying={playingBeatId === (item.data as Beat).id}
                                            onPlay={onPlayBeat}
                                            onDelete={onDeleteBeat}
                                            currentTime={playingBeatId === (item.data as Beat).id ? currentTime : 0}
                                            duration={playingBeatId === (item.data as Beat).id ? duration : 0}
                                            compact
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 overflow-y-auto px-6 pt-36 pb-32 scrollbar-hide bg-[var(--bg-main)]"
                    >
                        <VaultListView
                            items={items}
                            playingSessionId={playingSessionId}
                            isSessionPlaying={isSessionPlaying}
                            playingBeatId={playingBeatId}
                            onPlaySession={onPlaySession}
                            onPlayBeat={onPlayBeat}
                            onDeleteBeat={onDeleteBeat}
                            currentTime={currentTime}
                            duration={duration}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
