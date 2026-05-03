"use client";

/**
 * FacilitatorView — "Second Brain" studio assistant.
 *
 * Morning-after dashboard: Session Digest, Idea Vault, Song Story, Action Plan,
 * plus a chat input. Replaces the disabled MuseDrawer as Lyriq's AI surface.
 *
 * v1 wires real session/scrap/beat data from StudioWorkspace. Chat replies and
 * Song Story themes remain heuristic/mocked — LLM integration is a follow-up.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { chatWithFacilitator, type FacilitatorContext } from '../../app/actions';
import {
    Mic, Play, Pause, CheckCircle2, Circle,
    ArrowUpRight, MoreVertical, Plus, Send, Zap,
    Sparkles, History, Quote, Activity,
} from 'lucide-react';
import { LyricSection, LyricScrap, RecordingSession, Beat } from '../../types';

interface FacilitatorViewProps {
    sessions: RecordingSession[];
    scraps: LyricScrap[];
    beats: Beat[];
    sections: LyricSection[];
    projectTitle: string;
    onPlaySession: (id: string) => void;
    playingSessionId: string | null;
    currentTime: number;
    duration: number;
}

type FacilitatorMessage = {
    id: string;
    type: 'user' | 'ai';
    content?: string;
    component?: 'vault' | 'story' | 'actionPlan';
    label?: string;
    action?: string;
};

type Task = { id: number; text: string; completed: boolean };

const formatRelativeTime = (iso: string): string => {
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return 'recently';
    const diffMs = Date.now() - ts;
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
};

const formatDuration = (seconds: number): string => {
    if (!seconds || !Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatTotalTime = (seconds: number): string => {
    if (!seconds || seconds < 60) return `${Math.round(seconds)} seconds`;
    const min = Math.round(seconds / 60);
    if (min < 60) return `${min} minute${min === 1 ? '' : 's'}`;
    const hr = Math.floor(min / 60);
    const rem = min % 60;
    return rem ? `${hr}h ${rem}m` : `${hr}h`;
};

export const FacilitatorView: React.FC<FacilitatorViewProps> = ({
    sessions,
    scraps,
    sections,
    projectTitle,
    onPlaySession,
    playingSessionId,
    currentTime,
    duration,
}) => {
    const [messages, setMessages] = useState<FacilitatorMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement | null>(null);

    // --- Derived real data ---
    const mostRecentSession = useMemo(() => {
        if (!sessions.length) return null;
        return [...sessions].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )[0];
    }, [sessions]);

    const mostRecentScrap = useMemo(() => {
        if (!scraps.length) return null;
        return scraps[scraps.length - 1];
    }, [scraps]);

    const totalDuration = useMemo(
        () => sessions.reduce((acc, s) => acc + (s.duration ?? 0), 0),
        [sessions],
    );

    const titleDisplay = projectTitle?.trim() || 'this song';

    // TODO(llm): replace static themes with Gemini-derived themes from session transcripts.
    const storyThemes = ['Late-night thoughts', 'Moving on', 'Distance'];
    const storyMood = mostRecentSession ? 'Atmospheric / Reflective' : 'Yet to find';

    // TODO(persistence): store tasks per-project in localStorage so they survive reload.
    const seedTasks = useMemo<Task[]>(() => {
        const empties = sections.filter((s) => !s.text.trim()).slice(0, 2);
        const seeded: Task[] = empties.map((s, i) => ({
            id: i + 1,
            text: `Finish the ${s.type}`,
            completed: false,
        }));
        if (seeded.length < 3) {
            seeded.push({
                id: seeded.length + 1,
                text: mostRecentSession
                    ? 'Review your latest take and pin the best line'
                    : 'Lay down a first take',
                completed: false,
            });
        }
        if (seeded.length < 3) {
            seeded.push({ id: seeded.length + 1, text: 'Bounce a rough mix', completed: false });
        }
        return seeded;
    }, [sections, mostRecentSession]);

    const [tasks, setTasks] = useState<Task[]>(seedTasks);
    useEffect(() => {
        setTasks(seedTasks);
        // Re-seed when underlying data changes; user edits within a session are preserved
        // until the underlying sections/sessions list changes shape.
    }, [seedTasks]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const toggleTask = (id: number) => {
        setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
    };

    const handleUseScrapForBridge = () => {
        if (!mostRecentScrap) return;
        handleUserSubmission(`I want to use "${mostRecentScrap.text}" for the bridge.`);
    };

    const handleUserSubmission = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const userMsg: FacilitatorMessage = { id: `u-${Date.now()}`, type: 'user', content: trimmed };
        setMessages((prev) => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        const context: FacilitatorContext = {
            projectTitle,
            sections: sections.map(s => ({ type: s.type, text: s.text })),
            scraps: scraps.map(s => ({ text: s.text })),
            recentSessions: sessions.slice(-3).map(s => ({
                name: s.name || 'Untitled',
                duration: s.duration || 0,
                timestamp: s.timestamp
            }))
        };

        const response = await chatWithFacilitator(trimmed, context);

        const aiResponse: FacilitatorMessage = { id: `a-${Date.now()}`, type: 'ai', content: response.reply };

        // Keep the action plan injection feature if the user talks about tasks
        if (trimmed.toLowerCase().includes('add step') || trimmed.toLowerCase().includes('task')) {
             setTasks((prev) => [...prev, { id: Date.now(), text: 'Review new vocal takes', completed: false }]);
        }

        setMessages((prev) => [...prev, aiResponse]);
        setIsTyping(false);
    };

    // Audio progress derived from real playback state
    const isVaultPlaying = mostRecentSession ? playingSessionId === mostRecentSession.id : false;
    const audioProgress = isVaultPlaying && duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
    const vaultDurationSecs = mostRecentSession?.duration ?? 0;

    const lastSessionLabel = mostRecentSession
        ? formatRelativeTime(mostRecentSession.timestamp)
        : 'No session yet';

    return (
        <div className="relative flex flex-col h-full bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden">
            {/* Header */}
            <header className="px-4 pt-12 pb-4 border-b border-[var(--border-main)] flex flex-col gap-4 bg-gradient-to-b from-[var(--accent)]/10 to-transparent z-10">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Activity size={14} className="text-[var(--accent)]" />
                            <h2 className="text-[10px] mono uppercase tracking-widest text-[var(--accent)] font-bold">Second Brain</h2>
                        </div>
                        <h1 className="text-2xl font-medium tracking-tight text-[var(--text-main)]">{titleDisplay}</h1>
                        <p className="text-xs text-[var(--text-tertiary)] font-medium">Session Digest • {lastSessionLabel}</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-full transition-colors" aria-label="More">
                            <MoreVertical size={18} className="text-[var(--text-secondary)]" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Chat / message stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-48 scroll-smooth">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                        {msg.label && (
                            <span className="text-[10px] mono uppercase tracking-widest text-[var(--text-tertiary)] mb-2 ml-1 font-bold">
                                {msg.label}
                            </span>
                        )}

                        <div
                            className={`max-w-[92%] rounded-2xl p-4 shadow-sm ${
                                msg.type === 'user'
                                    ? 'bg-[var(--accent)] text-[var(--bg-main)] rounded-tr-sm'
                                    : 'bg-[var(--bg-card)] border border-[var(--border-main)] rounded-tl-sm'
                            }`}
                        >
                            {msg.content && (
                                <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                                    {msg.content.split(/(\*\*.*?\*\*)/).map((part, i) =>
                                        part.startsWith('**') && part.endsWith('**') ? (
                                            <span key={i} className="font-bold">{part.slice(2, -2)}</span>
                                        ) : (
                                            <React.Fragment key={i}>{part}</React.Fragment>
                                        ),
                                    )}
                                </div>
                            )}

                            {/* Idea Vault */}
                            {msg.component === 'vault' && (
                                <div className="space-y-3 mt-1">
                                    {mostRecentSession ? (
                                        <div
                                            className="bg-[var(--bg-secondary)] rounded-xl p-3 flex items-center gap-3 border border-[var(--border-main)] hover:border-[var(--accent)]/30 transition-colors cursor-pointer"
                                            onClick={() => onPlaySession(mostRecentSession.id)}
                                        >
                                            <button
                                                className="w-10 h-10 bg-[var(--accent)] shrink-0 rounded-full flex items-center justify-center text-[var(--bg-main)] shadow-lg hover:scale-105 transition-transform"
                                                aria-label={isVaultPlaying ? 'Pause' : 'Play'}
                                            >
                                                {isVaultPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                                            </button>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-sm font-semibold text-[var(--text-main)] truncate">
                                                    {mostRecentSession.name ?? 'Latest Take'}
                                                </p>
                                                <p className="text-[11px] text-[var(--text-secondary)] truncate">
                                                    {formatRelativeTime(mostRecentSession.timestamp)} · {formatDuration(vaultDurationSecs)}
                                                </p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-[9px] text-[var(--text-tertiary)] mono w-8">
                                                        {formatDuration(isVaultPlaying ? currentTime : 0)}
                                                    </span>
                                                    <div className="h-1 flex-1 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                                                        <div className="h-full bg-[var(--accent)] rounded-full transition-[width]" style={{ width: `${audioProgress}%` }} />
                                                    </div>
                                                    <span className="text-[9px] text-[var(--text-tertiary)] mono w-8">
                                                        {formatDuration(vaultDurationSecs)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-dashed border-[var(--border-main)]">
                                            <p className="text-sm text-[var(--text-secondary)]">No takes yet &mdash; record one and it&rsquo;ll show up here.</p>
                                        </div>
                                    )}

                                    {mostRecentScrap && (
                                        <div className="bg-[var(--bg-secondary)] rounded-xl p-3 border border-[var(--border-main)]">
                                            <div className="flex items-center gap-2 mb-2 text-[var(--accent)]">
                                                <Quote size={12} fill="currentColor" />
                                                <span className="text-[10px] mono uppercase tracking-wider font-bold">Lyric Fragment</span>
                                            </div>
                                            <p className="text-sm italic text-[var(--text-main)] mb-3">&ldquo;{mostRecentScrap.text}&rdquo;</p>
                                            <button
                                                onClick={handleUseScrapForBridge}
                                                className="text-[11px] py-1.5 px-3 bg-[var(--bg-card)] hover:bg-[var(--accent)] hover:text-[var(--bg-main)] rounded-md text-[var(--text-secondary)] font-semibold transition-colors flex items-center gap-1"
                                            >
                                                Use for Bridge <ArrowUpRight size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Song Story */}
                            {msg.component === 'story' && (
                                <div className="space-y-3 mt-1">
                                    <div className="flex flex-wrap gap-2">
                                        {storyThemes.map((t) => (
                                            <span
                                                key={t}
                                                className="px-3 py-1.5 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-full text-[10px] mono font-bold text-[var(--accent)] uppercase tracking-wide"
                                            >
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="p-3 bg-[var(--bg-secondary)] rounded-xl border-l-2 border-l-[var(--accent)]">
                                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
                                            Mood: <span className="text-[var(--text-main)]">{storyMood}</span>. Focus on the &ldquo;Distance&rdquo; between who you were last session vs. who you are now.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Action Plan */}
                            {msg.component === 'actionPlan' && (
                                <div className="space-y-1 mt-1">
                                    {tasks.map((task) => (
                                        <div
                                            key={task.id}
                                            onClick={() => toggleTask(task.id)}
                                            className="flex items-start gap-3 p-2.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer group"
                                        >
                                            {task.completed ? (
                                                <CheckCircle2 size={18} className="text-[var(--accent)] mt-0.5 shrink-0" />
                                            ) : (
                                                <Circle size={18} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] mt-0.5 shrink-0 transition-colors" />
                                            )}
                                            <span
                                                className={`text-sm leading-snug transition-all ${
                                                    task.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-main)]'
                                                }`}
                                            >
                                                {task.text}
                                            </span>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => handleUserSubmission('Add a new task to my list')}
                                        className="w-full mt-2 py-2.5 border border-dashed border-[var(--border-main)] hover:border-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg text-xs mono font-bold text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all flex items-center justify-center gap-1"
                                    >
                                        <Plus size={14} /> Add Step
                                    </button>
                                </div>
                            )}

                            {/* Action button */}
                            {msg.action && (
                                <button
                                    onClick={() => mostRecentSession && onPlaySession(mostRecentSession.id)}
                                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 rounded-full text-xs font-bold transition-opacity"
                                >
                                    <Play size={12} fill="currentColor" /> {msg.action}
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex items-start animate-in fade-in">
                        <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl rounded-tl-sm p-4 flex gap-1 items-center h-[52px]">
                            <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" />
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} className="h-4" />
            </div>

            {/* Footer — sits above the bottom navbar (~80px) */}
            <div className="absolute bottom-20 left-0 right-0 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)] to-transparent pt-8 pb-4 px-4 z-20 pointer-events-none">
                <div className="pointer-events-auto">
                    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                        {[
                            { icon: <History size={14} className="text-[var(--accent)]" />, text: 'Recall a line' },
                            { icon: <Zap size={14} className="text-[var(--accent)]" />, text: 'Need a bridge' },
                            { icon: <Sparkles size={14} className="text-[var(--accent)]" />, text: "Rhyme 'Distance'" },
                            { icon: <Mic size={14} className="text-[var(--accent)]" />, text: 'Arm vocal booth' },
                        ].map((chip, i) => (
                            <button
                                key={i}
                                onClick={() => handleUserSubmission(chip.text)}
                                className="whitespace-nowrap px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-main)] hover:border-[var(--text-secondary)] rounded-full text-xs font-medium flex items-center gap-2 transition-colors shrink-0 shadow-lg"
                            >
                                {chip.icon}
                                <span className="text-[var(--text-main)]">{chip.text}</span>
                            </button>
                        ))}
                    </div>

                    <div className="relative flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-main)] focus-within:border-[var(--accent)] rounded-2xl p-2 pl-4 shadow-2xl transition-colors">
                        <input
                            type="text"
                            placeholder="Ask the Facilitator..."
                            className="flex-1 bg-transparent border-none outline-none text-[15px] py-1.5 placeholder:text-[var(--text-tertiary)] text-[var(--text-main)]"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUserSubmission(inputValue);
                            }}
                        />
                        <button className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors" aria-label="Voice input">
                            <Mic size={20} />
                        </button>
                        <button
                            onClick={() => handleUserSubmission(inputValue)}
                            disabled={!inputValue.trim()}
                            className="p-2.5 bg-[var(--accent)] disabled:opacity-50 rounded-xl text-[var(--bg-main)] shadow-lg transition-all hover:opacity-90"
                            aria-label="Send"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FacilitatorView;
