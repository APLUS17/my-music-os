"use client";

import React, { useMemo } from 'react';
import {
    Activity, Play, Pause, Library, LayoutGrid, Clock, CheckCircle2, Music
} from 'lucide-react';
import { LyricScrap, RecordingSession, Beat, RitualStat } from '../../types';
import { BentoGrid, BentoGridItem } from '../ui/bento-grid';
import { NumberTicker } from '../ui/number-ticker';

interface VaultViewProps {
    sessions: RecordingSession[];
    scraps: LyricScrap[];
    beats: Beat[];

    projectTitle: string;
    onPlaySession: (id: string) => void;
    playingSessionId: string | null;
    currentTime: number;
    duration: number;
    ritualStats: RitualStat[];
}

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

export const VaultView: React.FC<VaultViewProps> = ({
    sessions,
    scraps,
    beats,

    projectTitle,
    onPlaySession,
    playingSessionId,
    currentTime,
    duration,
    ritualStats
}) => {
    const mostRecentSession = useMemo(() => {
        if (!sessions.length) return null;
        return [...sessions].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )[0];
    }, [sessions]);

    const titleDisplay = projectTitle || 'Untitled Project';

    const isVaultPlaying = mostRecentSession ? playingSessionId === mostRecentSession.id : false;
    const audioProgress = isVaultPlaying && duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
    const vaultDurationSecs = mostRecentSession?.duration ?? 0;

    const totalRitualMinutes = ritualStats.reduce((acc, stat) => acc + stat.durationMinutes, 0);

    return (
        <div className="relative flex flex-col h-full bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden">
            {/* Header */}
            <header className="px-6 pt-12 pb-6 border-b border-[var(--border-main)] flex flex-col gap-4 bg-gradient-to-b from-[var(--accent)]/10 to-transparent z-10 glass">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Library size={14} className="text-[var(--accent)]" />
                            <h2 className="text-[10px] mono uppercase tracking-widest text-[var(--accent)] font-bold">The Vault</h2>
                        </div>
                        <h1 className="text-2xl font-medium tracking-tight text-[var(--text-main)]">{titleDisplay}</h1>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* Bento Dashboard */}
                <BentoGrid className="mb-8 max-w-full">
                    {/* Time Spent (Large) */}
                    <BentoGridItem
                        className="md:col-span-2"
                        title={<><NumberTicker value={Math.floor(totalRitualMinutes / 60)} /><span className="text-sm text-[var(--text-tertiary)] ml-1">hrs</span> <NumberTicker value={totalRitualMinutes % 60} /><span className="text-sm text-[var(--text-tertiary)] ml-1">m</span></>}
                        description="Total Time in Rituals"
                        icon={<Clock size={16} />}
                    />
                    
                    {/* Completed Rituals */}
                    <BentoGridItem
                        className="md:col-span-1"
                        title={<NumberTicker value={ritualStats.length} />}
                        description="Rituals Completed"
                        icon={<CheckCircle2 size={16} className="text-[var(--accent)]" />}
                    />

                    {/* Recordings */}
                    <BentoGridItem
                        className="md:col-span-1"
                        title={<NumberTicker value={sessions.length} />}
                        description="Vocal Takes"
                        icon={<Activity size={16} />}
                    />

                    {/* Ideas */}
                    <BentoGridItem
                        className="md:col-span-1"
                        title={<NumberTicker value={scraps.length} />}
                        description="Lyric Scraps"
                        icon={<LayoutGrid size={16} />}
                    />

                    {/* Beats */}
                    <BentoGridItem
                        className="md:col-span-1"
                        title={<NumberTicker value={beats.length} />}
                        description="Instrumentals"
                        icon={<Music size={16} />}
                    />
                </BentoGrid>

                {/* Recent Activity */}
                {mostRecentSession && (
                    <section>
                        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Recent Recording</h3>
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="font-medium text-sm">{mostRecentSession.name || 'Untitled Take'}</div>
                                    <div className="text-xs text-[var(--text-tertiary)]">{formatRelativeTime(mostRecentSession.timestamp)}</div>
                                </div>
                                <button
                                    onClick={() => onPlaySession(mostRecentSession.id)}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                        isVaultPlaying ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-main)] border border-[var(--border-main)] hover:border-[var(--text-secondary)]'
                                    }`}
                                >
                                    {isVaultPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-1" />}
                                </button>
                            </div>
                            {/* Audio Progress */}
                            <div className="relative h-1.5 bg-[var(--bg-main)] rounded-full overflow-hidden mt-4">
                                <div
                                    className="absolute top-0 left-0 h-full bg-[var(--accent)] transition-all duration-100"
                                    style={{ width: `${audioProgress}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-2 text-[10px] text-[var(--text-tertiary)] font-mono">
                                <span>{isVaultPlaying ? formatDuration(currentTime) : '0:00'}</span>
                                <span>{formatDuration(vaultDurationSecs)}</span>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};
