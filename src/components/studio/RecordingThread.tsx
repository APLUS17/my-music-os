import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Scissors, Trash2, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import { RecordingSession, AutoSection } from '@/types';
import { cn } from '@/lib/utils';

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
        <div className="flex flex-col gap-4 p-4 pb-32 max-w-2xl mx-auto w-full">
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
                    <p className="text-center text-xs opacity-60 mt-1">Tap the record button to start</p>
                </div>
            )}
        </div>
    );
};

// ────────────────────────────────────────────────────
// Session Card
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
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (session.audioUrl && audioRef.current) {
            audioRef.current.src = session.audioUrl;
        }
    }, [session.audioUrl]);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
                onSelect();
            }
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "group flex flex-col bg-[var(--bg-card)] border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer",
                isActive
                    ? "border-[var(--accent)]/50 shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_15px_rgba(255,255,255,0.03)] ring-1 ring-[var(--accent)]/20"
                    : "border-white/10 opacity-70 hover:opacity-100 hover:border-white/20 hover:translate-y-[-2px]"
            )}
            onClick={onSelect}
        >
            <audio
                ref={audioRef}
                onTimeUpdate={(e) => {
                    const dur = session.duration || 0;
                    if (dur > 0) setProgress(e.currentTarget.currentTime / dur);
                }}
                onEnded={() => { setIsPlaying(false); setProgress(0); }}
            />

            {/* Header */}
            <div className={cn(
                "flex items-center justify-between p-4 pb-3 transition-colors",
                isActive ? "bg-gradient-to-br from-white/[0.05] to-transparent" : "bg-black/20"
            )}>
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <button
                        onClick={togglePlay}
                        className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-lg",
                            isPlaying
                                ? "bg-[var(--accent)] text-black scale-105"
                                : "bg-white/10 text-white hover:bg-white/20 hover:scale-110 active:scale-95 border border-white/5"
                        )}
                    >
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                    </button>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={session.name || 'Untitled Recording'}
                                onChange={(e) => onUpdate({ name: e.target.value })}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-transparent text-base font-semibold text-[var(--text-main)] outline-none border-b border-transparent focus:border-[var(--accent)]/50 transition-all w-full max-w-[200px] tracking-tight"
                            />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-[var(--text-tertiary)] mono uppercase tracking-widest font-medium flex items-center gap-1.5">
                                {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                {(session.duration || 0).toFixed(1)}s
                                {session.isLoopSession && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-white/20" />
                                        <span className="text-[var(--accent)]/80">Loop</span>
                                    </>
                                )}
                            </span>
                        </div>
                        {session.transcription && (
                            <span className="text-[11px] text-[var(--text-secondary)] italic line-clamp-1 mt-1.5 opacity-60 leading-relaxed font-serif tracking-tight pr-4">
                                &ldquo;{session.transcription}&rdquo;
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenSplitEditor(); }}
                        className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-white/10 transition-all active:scale-90"
                        title="Split/Merge Editor"
                    >
                        <Scissors size={15} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this recording?')) onDelete();
                        }}
                        className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-all active:scale-90"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {/* Timeline Mini-map */}
            <div className="h-2 bg-black/60 relative w-full overflow-hidden mx-4 w-[calc(100%-32px)] rounded-full mb-3 border border-white/[0.03]">
                <div
                    className="absolute left-0 top-0 bottom-0 bg-[var(--accent)] transition-all duration-300 ease-out z-10 opacity-60 shadow-[0_0_10px_var(--accent)]"
                    style={{ width: `${progress * 100}%` }}
                />
                <div className="absolute inset-0 z-0 flex gap-[2px]">
                    {Array.from({ length: 40 }).map((_, i) => (
                        <div key={i} className="flex-1 h-full bg-white/[0.03]" />
                    ))}
                </div>
                {session.sections.map(sec => {
                    const dur = session.duration || 1;
                    const secLeft = (sec.startTime / dur) * 100;
                    const secWidth = ((sec.endTime - sec.startTime) / dur) * 100;
                    return (
                        <div
                            key={sec.id}
                            className={cn(
                                "absolute top-[2px] bottom-[2px] rounded-full transition-all duration-500 z-2",
                                sec.isBest ? "bg-white/40 shadow-[0_0_4px_white]" : "bg-white/5"
                            )}
                            style={{
                                left: `${secLeft}%`,
                                width: `${Math.max(secWidth, 1)}%`,
                            }}
                        />
                    );
                })}
            </div>

            {/* Sections List */}
            <div className={cn(
                "flex flex-col p-3 pt-2 gap-1.5 transition-all",
                isActive ? "bg-black/20" : "bg-black/10"
            )}>
                <div className="flex items-center justify-between px-1 mb-1">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)] font-bold mono">
                        {session.isLoopSession ? `Takes (${session.sections.length})` : `Sections (${session.sections.length})`}
                    </div>
                </div>
                <div className="flex flex-col gap-1.5 px-0.5">
                    {session.sections.map((sec, idx) => (
                        <motion.div
                            key={sec.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04, duration: 0.3 }}
                        >
                            <SectionItem
                                section={sec}
                                duration={session.duration || 0}
                                onToggleBest={() => {
                                    if (session.isLoopSession) {
                                        onUpdateSection(sec.id, { isBest: true });
                                    } else {
                                        onUpdateSection(sec.id, { isBest: !sec.isBest });
                                    }
                                }}
                                isLoopMode={session.isLoopSession}
                            />
                        </motion.div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};

// ────────────────────────────────────────────────────
// Section Item
// ────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, string> = {
    vocal: "bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20",
    speech: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20",
    instrumental: "bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/20",
    silence: "bg-gray-500/10 text-gray-400 ring-1 ring-white/10"
};

const SectionItem = ({ section, duration, onToggleBest, isLoopMode }: {
    section: AutoSection;
    duration: number;
    onToggleBest: () => void;
    isLoopMode?: boolean;
}) => {
    const sectionLabel = section.label
        || (isLoopMode
            ? (section.loopPass ? `Take ${section.loopPass}` : `Take`)
            : `${section.startTime.toFixed(1)}s – ${section.endTime.toFixed(1)}s`);

    const isBest = section.isBest;

    return (
        <div
            onClick={(e) => { e.stopPropagation(); onToggleBest(); }}
            className={cn(
                "group/item flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-300 cursor-pointer border",
                isBest
                    ? "bg-white/[0.08] text-[var(--text-main)] border-white/20 shadow-sm"
                    : "bg-white/[0.02] text-[var(--text-secondary)] border-transparent hover:bg-white/[0.05] hover:border-white/10"
            )}
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500 flex-shrink-0",
                    isBest
                        ? "border-[var(--accent)] bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]"
                        : "border-white/10 bg-transparent group-hover/item:border-white/30"
                )}>
                    {isBest && <motion.div layoutId={`best-${section.id}`} className="w-2 h-2 rounded-full bg-black" />}
                </div>

                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        {section.emojiTag && <span className="text-sm flex-shrink-0 animate-in zoom-in-0 duration-500">{section.emojiTag}</span>}
                        <span className={cn(
                            "font-medium text-xs truncate tracking-tight transition-colors",
                            isBest ? "text-white" : "text-[var(--text-secondary)]"
                        )}>{sectionLabel}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <div className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] uppercase tracking-[0.15em] font-bold flex-shrink-0 backdrop-blur-md transition-all",
                    TYPE_STYLES[section.type] || TYPE_STYLES.vocal
                )}>
                    {section.type}
                </div>
            </div>
        </div>
    );
};
