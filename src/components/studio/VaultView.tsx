"use client";

import React, { useMemo } from 'react';
import {
    Activity, Play, Pause, Library, LayoutGrid, Clock, CheckCircle2, Music
} from 'lucide-react';
import { LyricScrap, RecordingSession, Beat, RitualStat } from '../../types';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        <div className="relative flex flex-col h-full bg-background text-foreground overflow-hidden">
            {/* Header */}
            <header className="px-6 pt-12 pb-6 border-b border-border flex flex-col gap-4 bg-gradient-to-b from-primary/10 to-transparent z-10 glass">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Library size={14} className="text-primary" />
                            <h2 className="text-metadata text-primary">The Vault</h2>
                        </div>
                        <h1 className="text-2xl font-medium tracking-tight text-foreground">{titleDisplay}</h1>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* Stats Section */}
                <section>
                    <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                        <Activity size={16} /> Ritual Stats
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-secondary border border-border rounded-2xl p-6 flex flex-col justify-between">
                            <span className="text-metadata mb-2 flex items-center gap-1"><CheckCircle2 size={12}/> Completed</span>
                            <span className="text-3xl font-light">{ritualStats.length}</span>
                        </div>
                        <div className="bg-secondary border border-border rounded-2xl p-6 flex flex-col justify-between">
                            <span className="text-metadata mb-2 flex items-center gap-1"><Clock size={12}/> Time Spent</span>
                            <span className="text-3xl font-light">{Math.floor(totalRitualMinutes / 60)}<span className="text-lg text-muted-foreground ml-1">hrs</span> {totalRitualMinutes % 60}<span className="text-lg text-muted-foreground ml-1">m</span></span>
                        </div>
                    </div>
                </section>

                {/* Project Assets */}
                <section>
                    <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                        <LayoutGrid size={16} /> Project Assets
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-secondary border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-muted-foreground">
                                <Activity size={18} />
                            </div>
                            <div>
                                <div className="text-xl font-medium">{sessions.length}</div>
                                <div className="text-xs text-muted-foreground">Recordings</div>
                            </div>
                        </div>
                        <div className="bg-secondary border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-muted-foreground">
                                <LayoutGrid size={18} />
                            </div>
                            <div>
                                <div className="text-xl font-medium">{scraps.length}</div>
                                <div className="text-xs text-muted-foreground">Ideas</div>
                            </div>
                        </div>
                        <div className="bg-secondary border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-muted-foreground">
                                <Music size={18} />
                            </div>
                            <div>
                                <div className="text-xl font-medium">{beats.length}</div>
                                <div className="text-xs text-muted-foreground">Beats</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Recent Activity */}
                {mostRecentSession && (
                    <section>
                        <h3 className="text-sm font-medium text-muted-foreground mb-4">Recent Recording</h3>
                        <div className="bg-secondary border border-border rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="font-medium text-sm text-foreground">{mostRecentSession.name || 'Untitled Take'}</div>
                                    <div className="text-metadata">{formatRelativeTime(mostRecentSession.timestamp)}</div>
                                </div>
                                <Button
                                    size="icon"
                                    onClick={() => onPlaySession(mostRecentSession.id)}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                                        isVaultPlaying ? 'bg-primary text-primary-foreground' : 'bg-background border border-border hover:border-muted-foreground'
                                    )}
                                >
                                    {isVaultPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-1" />}
                                </Button>
                            </div>
                            {/* Audio Progress */}
                            <div className="relative h-1.5 bg-background rounded-full overflow-hidden mt-4">
                                <div
                                    className="absolute top-0 left-0 h-full bg-primary transition-all duration-100"
                                    style={{ width: `${audioProgress}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-2 text-metadata">
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
