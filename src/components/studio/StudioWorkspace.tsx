"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LyricSection, LyricScrap, RecordingSession, AutoSection, SectionType, Beat, SavedProject, RecordingLayer, RitualStat } from '../../types';
import { randomId } from '@/lib/utils/id';
import { LyricCard } from './LyricCard';
import { countSyllables } from '@/lib/utils/syllable';
import { RecorderDrawer } from './RecorderDrawer';
import { MusicPlayer } from './MusicPlayer';
import { RitualsView } from "./RitualsView";
import { VaultView } from "./VaultView";
import { BeatUploader } from './BeatUploader';
import { OnboardingTour } from './OnboardingTour';
import { RecordingThread } from './RecordingThread';
import { PlayerTab } from './PlayerTab';
import { FXPanel, FXSettings, defaultFXSettings } from './FXPanel';
import { useVocalFX } from '@/hooks/useVocalFX';
import { analyzeAudioAndSplit } from '@/lib/audio/smartSplit';
import { transcribeAudio } from '@/lib/audio/audioIntelligence';
import { analyzeAudioStructure } from '@/app/actions';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    PenTool,
    Search,
    X,
    ChevronRight,
    Settings,
    Check,
    Plus,
    Music,
    FilePlus,
    Play,
    Pause,
    Trash2,
    MessageSquare,
    House,
    ListMusic,
    Library,
    Disc,
    History
} from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChevronDown, CheckCircle2 } from 'lucide-react';

// --- Database Logic Inline (to avoid module resolution errors) ---
const DB_NAME = 'StudioProDB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_assets';

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return;
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

const saveAudioData = async (id: string, data: string) => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(data, id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const getAudioData = async (id: string): Promise<string | undefined> => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const deleteAudioData = async (id: string) => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

type ViewMode = 'collection' | 'studio' | 'rituals' | 'vault' | 'settings';
type LibraryTab = 'songs' | 'beats';
type Theme = 'dark' | 'light' | 'midnight' | 'matrix' | 'sonar';
type SearchFilter = 'all' | 'songs' | 'sections' | 'recordings' | 'takes' | 'beats';

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const base64ToBlob = (base64: string): Promise<Blob> => {
    return fetch(base64).then(res => res.blob());
};

interface NavBtnProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    id?: string;
}

const NavBtn = ({ active, onClick, icon, label, id }: NavBtnProps) => (
    <button
        id={id}
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 transition-all duration-300 relative ${active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
    >
        <div className={`p-2 rounded-xl transition-all duration-300 ${active ? 'bg-[var(--accent)]/10' : 'hover:bg-white/5'}`}>
            {icon}
        </div>
        <span className="text-[8px] mono uppercase tracking-[0.1em] font-bold">{label}</span>
        {active && (
            <motion.div 
                layoutId="nav-pill" 
                className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" 
            />
        )}
    </button>
);

interface SwipeableProjectCardProps {
    project: SavedProject;
    onClick: () => void;
    onDelete: () => void;
}

const SwipeableProjectCard = ({ project, onClick, onDelete }: SwipeableProjectCardProps) => {
    const [offset, setOffset] = useState(0);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const startX = useRef<number | null>(null);
    const startOffset = useRef<number>(0);
    const hasMoved = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        startX.current = e.clientX;
        startOffset.current = offset;
        hasMoved.current = false;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (startX.current === null) return;
        const diff = e.clientX - startX.current;
        if (Math.abs(diff) > 5) hasMoved.current = true;
        const proposed = Math.min(0, Math.max(-140, startOffset.current + diff));
        setOffset(proposed);
        if (confirmDelete && Math.abs(diff) > 5) {
            setConfirmDelete(false);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (startX.current === null) return;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        startX.current = null;
        if (offset < -60) {
            setOffset(-100);
        } else {
            setOffset(0);
            setConfirmDelete(false);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (hasMoved.current) {
            e.stopPropagation();
            return;
        }
        if (offset < -10) {
            setOffset(0);
            setConfirmDelete(false);
            e.stopPropagation();
        } else {
            onClick();
        }
    };

    return (
        <div className="relative mb-2 select-none overflow-hidden rounded-lg">
            <div className="absolute inset-0 flex items-center justify-end bg-red-500/10 rounded-lg pr-4 z-0">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (confirmDelete) {
                            onDelete();
                        } else {
                            setConfirmDelete(true);
                        }
                    }}
                    className={`flex items-center justify-center rounded-full shadow-sm border transition-all duration-200 cursor-pointer ${confirmDelete
                        ? 'w-20 h-10 bg-red-500 text-[var(--bg-main)] border-red-600'
                        : 'w-10 h-10 bg-[var(--bg-card)] text-red-500 border-red-500/20 active:scale-95 hover:bg-red-50'
                        }`}
                >
                    {confirmDelete ? <span className="text-xs font-bold">Confirm</span> : <Trash2 size={18} />}
                </button>
            </div>
            <div
                className="relative z-10 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg p-4 flex items-center justify-between transition-transform duration-200 ease-out touch-pan-y"
                style={{ transform: `translateX(${offset}px)` }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={handleClick}
            >
                <div>
                    <h3 className="text-sm font-medium text-[var(--text-main)] mb-1">{project.name || "Untitled Project"}</h3>
                    <p className="text-xs mono text-[var(--text-tertiary)]">{project.lastModified}</p>
                </div>
                <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
            </div>
        </div>
    );
};

interface SwipeableBeatCardProps {
    beat: Beat;
    isPlaying: boolean;
    onPlay: () => void;
    onWrite: () => void;
    onDelete: () => void;
}

const SwipeableBeatCard = ({ beat, isPlaying, onPlay, onWrite, onDelete }: SwipeableBeatCardProps) => {
    const [offset, setOffset] = useState(0);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const startX = useRef<number | null>(null);
    const startOffset = useRef<number>(0);
    const hasMoved = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        // Don't start swipe if clicking buttons
        if ((e.target as HTMLElement).closest('button')) return;
        startX.current = e.clientX;
        startOffset.current = offset;
        hasMoved.current = false;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (startX.current === null) return;
        const diff = e.clientX - startX.current;
        if (Math.abs(diff) > 5) hasMoved.current = true;
        const proposed = Math.min(0, Math.max(-140, startOffset.current + diff));
        setOffset(proposed);
        if (confirmDelete && Math.abs(diff) > 5) {
            setConfirmDelete(false);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (startX.current === null) return;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        startX.current = null;
        if (offset < -60) {
            setOffset(-100);
        } else {
            setOffset(0);
            setConfirmDelete(false);
        }
    };

    return (
        <div className="relative mb-2 select-none overflow-hidden rounded-lg">
            <div className="absolute inset-0 flex items-center justify-end bg-red-500/10 rounded-lg pr-4 z-0">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (confirmDelete) {
                            onDelete();
                        } else {
                            setConfirmDelete(true);
                        }
                    }}
                    className={`flex items-center justify-center rounded-full shadow-sm border transition-all duration-200 cursor-pointer ${confirmDelete
                        ? 'w-20 h-10 bg-red-500 text-[var(--bg-main)] border-red-600'
                        : 'w-10 h-10 bg-[var(--bg-card)] text-red-500 border-red-500/20 active:scale-95 hover:bg-red-50'
                        }`}
                >
                    {confirmDelete ? <span className="text-xs font-bold">Confirm</span> : <Trash2 size={18} />}
                </button>
            </div>
            <div
                className={`relative z-10 bg-[var(--bg-card)] border ${isPlaying ? 'border-[var(--accent)]' : 'border-[var(--border-main)]'} rounded-lg p-3 flex items-center justify-between transition-transform duration-200 ease-out touch-pan-y`}
                style={{ transform: `translateX(${offset}px)` }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <button onClick={(e) => { e.stopPropagation(); onPlay(); }} className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all">
                        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <div className="min-w-0 pointer-events-none">
                        <h4 className="text-sm font-medium text-[var(--text-main)] truncate">{beat.name}</h4>
                        <p className="text-xs mono text-[var(--text-tertiary)]">{beat.duration}</p>
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onWrite(); }} className="px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] text-xs mono uppercase tracking-wider text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] transition-all">Write</button>
            </div>
        </div>
    );
};


const CATEGORIES = [
    'Notes',
    'Song Titles',
    'Song Ideas + Concepts',
    'Arrangement',
    'Sample This',
    'Moods',
    'BPM',
    'Genre/Style',
    'Epiphanies',
    'Chord Progressions',
    'Lyrics'
];

const StudioWorkspace: React.FC = () => {
    const [latencyCompensation, setLatencyCompensation] = useState<number>(50); // ms
    const [theme, setTheme] = useState<Theme>('dark');
    const [viewMode, setViewMode] = useState<ViewMode>('studio');
    const [ritualStats, setRitualStats] = useState<RitualStat[]>([]);
    const handleCompleteRitual = (stat: RitualStat) => {
        setRitualStats(prev => [...prev, stat]);
        toast.success("Ritual completed!");
    };
    const [libraryTab, setLibraryTab] = useState<LibraryTab>('songs');

    const [showRecorder, setShowRecorder] = useState(false);
    const [recorderMinimized, setRecorderMinimized] = useState(false);
    const [recorderAutoStart, setRecorderAutoStart] = useState(false);
    const [layerModeSessionId, setLayerModeSessionId] = useState<string | null>(null);
    const [showSearch, setShowSearch] = useState(false);
    const [showMusicPlayer, setShowMusicPlayer] = useState(false);
    const [showFXPanel, setShowFXPanel] = useState(false);
    const [fxSettings, setFxSettings] = useState<FXSettings>(defaultFXSettings);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
    const [uploadedBeat, setUploadedBeat] = useState<string | null>(null);
    const [uploadedBeatName, setUploadedBeatName] = useState<string>("");
    const [uploadedBeatId, setUploadedBeatId] = useState<string | null>(null);
    const [saveIndicator, setSaveIndicator] = useState<'idle' | 'saving' | 'saved'>('idle');

    const [fabOpen, setFabOpen] = useState(false);
    const fabInputRef = useRef<HTMLInputElement>(null);
    const beatAudioRef = useRef<HTMLAudioElement>(null);
    const beatAudioCtxRef = useRef<AudioContext | null>(null);
    const beatGainRef = useRef<GainNode | null>(null);

    const [showPillOptions, setShowPillOptions] = useState(false);
    const [projectTitle, setProjectTitle] = useState("");
    const [projectBpm, setProjectBpm] = useState("120");
    const [projectKey, setProjectKey] = useState("C Min");

    const [sections, setSections] = useState<LyricSection[]>([
        { id: 'init-verse', type: 'verse', repeats: 1, text: '' }
    ]);
    const [scraps, setScraps] = useState<LyricScrap[]>([]);

    const [activeCategory, setActiveCategory] = useState<string>('Notes');
    const [categorySections, setCategorySections] = useState<Record<string, LyricSection[]>>({});
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);


    const [recordingTargetLineId, setRecordingTargetLineId] = useState<string | null>(null);

    const [sessions, setSessions] = useState<RecordingSession[]>([]);
    const [studioMode, setStudioMode] = useState<'flow' | 'write'>(sections.length > 0 ? 'write' : 'flow');
    const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'lyrics' | 'takes' | 'player'>('lyrics');
    const [showSyllables, setShowSyllables] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('lyriq_show_syllables') === 'true';
        }
        return false;
    });

    useEffect(() => {
        localStorage.setItem('lyriq_show_syllables', String(showSyllables));
    }, [showSyllables]);

    // Sync sections edits to categorySections
    useEffect(() => {
        setCategorySections(prev => ({
            ...prev,
            [activeCategory]: sections
        }));
    }, [sections, activeCategory]);

    const handleSelectCategory = (newCategory: string) => {
        if (newCategory === activeCategory) {
            setIsCategoryDropdownOpen(false);
            return;
        }

        const newSections = categorySections[newCategory] && categorySections[newCategory].length > 0
            ? categorySections[newCategory]
            : [{ id: randomId(), type: 'verse' as SectionType, repeats: 1, text: "" }];

        setSections(newSections);
        setActiveCategory(newCategory);
        setIsCategoryDropdownOpen(false);
    };

    const totalSyllables = useMemo(() => {
        return sections.reduce((sum, s) => sum + countSyllables(s.text), 0);
    }, [sections]);

    const totalLines = useMemo(() => {
        return sections.reduce((sum, s) => {
            if (!s.text) return sum;
            return sum + s.text.split('\n').length;
        }, 0);
    }, [sections]);

    const [splitEditorOpen, setSplitEditorOpen] = useState(false);
    const [recordingToSplit, setRecordingToSplit] = useState<string | null>(null);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [playingSessionId, setPlayingSessionId] = useState<string | null>(null);

    const [beats, setBeats] = useState<Beat[]>([]);
    const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
    const [playingBeatId, setPlayingBeatId] = useState<string | null>(null);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const globalAudioRef = useRef<HTMLAudioElement | null>(null);
    const vocalAudioRef = useRef<HTMLAudioElement | null>(null);

    // Persistent Audio State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);

    // Vocal FX - only initialize when panel is open
    useVocalFX(vocalAudioRef, fxSettings, showFXPanel, isPlaying, currentTime);
    const [duration, setDuration] = useState(0);

    const displaySessions = useMemo(() =>
        sessions.filter(s =>
            !s.projectId ||  // Show sessions without projectId (floating/old)
            s.projectId === activeProjectId  // Show sessions for current project
        ),
        [sessions, activeProjectId]
    );

    // Stable refs so the RAF loop reads current values without restarting
    const animFrameRef = useRef<number | null>(null);
    const sessionsRef = useRef(sessions);
    const activeSessionIdRef = useRef(activeSessionId);
    useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
    useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

    // Pending resume after session switch — consumed by onLoadedMetadata
    const pendingPlayRef = useRef(false);
    const pendingSeekRef = useRef<number | null>(null);

    // Persistent Beat Playback State (Lifted from BeatUploader)
    const [isBeatPlaying, setIsBeatPlaying] = useState(false);
    const [beatVolume, setBeatVolume] = useState(1);
    const [beatMuted, setBeatMuted] = useState(false);
    const [beatLoopStart, setBeatLoopStart] = useState<number | null>(null);
    const [beatLoopEnd, setBeatLoopEnd] = useState<number | null>(null);
    const [isBeatLooping, setIsBeatLooping] = useState(false);
    const [analyzingVocalCount, setAnalyzingVocalCount] = useState(0);
    const isAnalyzingVocal = analyzingVocalCount > 0;
    const [isAnalyzingBeat, setIsAnalyzingBeat] = useState(false);

    const [showTour, setShowTour] = useState(false);

    // Select a session, pausing playback first if needed (used by card taps)
    const handleSelectSession = (id: string) => {
        const newId = activeSessionId === id ? null : id;
        if (isPlaying && newId !== null && newId !== activeSessionId) {
            vocalAudioRef.current?.pause();
            beatAudioRef.current?.pause();
            beatAudioCtxRef.current?.suspend();
            setIsPlaying(false);
            setIsBeatPlaying(false);
            pendingPlayRef.current = true;
        }
        setActiveSessionId(newId);
    };

    // Select a session and start playing once it loads (used by play buttons)
    const handleSelectSessionAndPlay = (id: string, seekTime?: number) => {
        if (isPlaying) {
            vocalAudioRef.current?.pause();
            beatAudioRef.current?.pause();
            beatAudioCtxRef.current?.suspend();
            setIsPlaying(false);
            setIsBeatPlaying(false);
        }
        pendingPlayRef.current = true;
        if (seekTime !== undefined) pendingSeekRef.current = seekTime;
        setActiveSessionId(id);
    };

    // Sync Vocal and Beat
    const togglePlayback = (play?: boolean) => {
        const shouldPlay = play !== undefined ? play : !isPlaying;

        if (shouldPlay) {
            beatAudioCtxRef.current?.resume();
            
            // 1. Play Vocal if available
            const hasVocals = sessions.length > 0 && vocalAudioRef.current;
            if (hasVocals) {
                vocalAudioRef.current?.play().catch(console.error);
            }

            // 2. Play Beat if available
            if (uploadedBeat && beatAudioRef.current) {
                const session = sessions.find(s => s.id === activeSessionId) ?? sessions[0];
                if (session && vocalAudioRef.current) {
                    const offset = session.beatOffset || 0;
                    const beat = beatAudioRef.current;
                    if (beat.readyState >= 1) beat.currentTime = vocalAudioRef.current.currentTime + offset;
                }
                beatAudioRef.current.play().catch(console.error);
                setIsBeatPlaying(true);
            }
            
            setIsPlaying(true);
        } else {
            vocalAudioRef.current?.pause();
            beatAudioRef.current?.pause();
            beatAudioCtxRef.current?.suspend();
            setIsBeatPlaying(false);
            setIsPlaying(false);
        }
    };

    const seekTo = (time: number) => {
        const clamped = Math.max(0, Math.min(duration || 0, time));
        if (vocalAudioRef.current) vocalAudioRef.current.currentTime = clamped;

        if (beatAudioRef.current) {
            const beat = beatAudioRef.current;
            const session = sessions.find(s => s.id === activeSessionId) ?? sessions[0];
            if (beat.readyState >= 1) {
                if (session) {
                    beat.currentTime = clamped + (session.beatOffset || 0);
                } else if (!vocalAudioRef.current || sessions.length === 0) {
                    beat.currentTime = clamped;
                }
            }
        }
        setCurrentTime(clamped);
    };

    const handleBeatSeek = (beatTime: number) => {
        if (!beatAudioRef.current) return;
        
        const session = sessions.find(s => s.id === activeSessionId);
        if (session && vocalAudioRef.current) {
            const offset = session.beatOffset || 0;
            const vocalTime = Math.max(0, beatTime - offset);
            vocalAudioRef.current.currentTime = vocalTime;
            setCurrentTime(vocalTime);
        } else {
            setCurrentTime(beatTime);
        }
    };

    // RAF loop: drives currentTime at ~16fps and corrects beat drift every 2s
    useEffect(() => {
        if (!isPlaying) {
            if (animFrameRef.current !== null) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
            return;
        }

        const TIME_INTERVAL = 60;        // ~16fps React updates
        const DRIFT_INTERVAL = 2000;     // beat re-sync check every 2s
        const DRIFT_THRESHOLD = 0.05;    // 50ms drift tolerance
        let lastTimeUpdate = 0;
        let lastDriftCheck = 0;

        const tick = (timestamp: number) => {
            // Update currentTime state at ~16fps
            if (timestamp - lastTimeUpdate >= TIME_INTERVAL) {
                lastTimeUpdate = timestamp;
                const vocalTime = vocalAudioRef.current?.currentTime;
                const beatTime = beatAudioRef.current?.currentTime;
                
                if (vocalTime !== undefined && sessions.length > 0) {
                    setCurrentTime(vocalTime);
                } else if (beatTime !== undefined) {
                    setCurrentTime(beatTime);
                }
            }

            // Periodic beat drift correction
            if (uploadedBeat && timestamp - lastDriftCheck >= DRIFT_INTERVAL) {
                lastDriftCheck = timestamp;
                const vocal = vocalAudioRef.current;
                const beat = beatAudioRef.current;
                if (vocal && beat && !beat.paused && sessionsRef.current.length > 0) {
                    const session = sessionsRef.current.find(s => s.id === activeSessionIdRef.current);
                    if (session) {
                        const offset = session.beatOffset ?? 0;
                        const expected = vocal.currentTime + offset;
                        const drift = Math.abs(beat.currentTime - expected);
                        if (drift > DRIFT_THRESHOLD) {
                            console.log(`[BeatSync] Correcting ${(drift * 1000).toFixed(0)}ms drift`);
                            beat.currentTime = expected;
                        }
                    }
                }
            }

            animFrameRef.current = requestAnimationFrame(tick);
        };

        animFrameRef.current = requestAnimationFrame(tick);
        return () => {
            if (animFrameRef.current !== null) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        };
    }, [isPlaying, uploadedBeat]);

    // Wire beat audio through Web Audio API so iOS respects volume changes
    useEffect(() => {
        const audio = beatAudioRef.current;
        if (!audio) return;
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass() as AudioContext;
        beatAudioCtxRef.current = ctx;
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1;
        beatGainRef.current = gainNode;
        const source = ctx.createMediaElementSource(audio);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        return () => {
            ctx.close();
            beatAudioCtxRef.current = null;
            beatGainRef.current = null;
        };
    }, []);

    // NOTE: audio.load() is intentionally omitted here.
    // React updates the <audio src> attribute via JSX, which triggers load() automatically.
    // Calling load() manually while playing causes a playback interrupt.

    // Update Beat Volume
    useEffect(() => {
        if (beatGainRef.current) {
            beatGainRef.current.gain.value = beatMuted ? 0 : beatVolume;
        }
    }, [beatVolume, beatMuted]);

    useEffect(() => {
        if (typeof window !== 'undefined' && !localStorage.getItem('lyriq-tour-completed')) {
            setShowTour(true);
        }
    }, []);

    const handleTourComplete = () => {
        localStorage.setItem('lyriq-tour-completed', 'true');
        setShowTour(false);
        setViewMode('studio');
        setSections([]); // Blank canvas for new users
        setProjectTitle('');
        setStudioMode('flow');
    };

    // Persistence Load
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        // Keep track of object URLs created to revoke them later
        const createdUrls: string[] = [];

        const loadState = async () => {
            const savedData = localStorage.getItem('studio-pro-data-v2');
            const savedRitualStats = localStorage.getItem('lyriq_ritual_stats');
            if (savedRitualStats) {
                try {
                    setRitualStats(JSON.parse(savedRitualStats));
                } catch (error) {
                    console.warn('Failed to parse ritual stats from localStorage, clearing corrupted data', error);
                    localStorage.removeItem('lyriq_ritual_stats');
                }
            }
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);

                    const activeCat = parsed.activeCategory || 'Notes';
                    setActiveCategory(activeCat);

                    let activeCatSections = parsed.sections || [];
                    if (parsed.categorySections) {
                        setCategorySections(parsed.categorySections);
                        activeCatSections = parsed.categorySections[activeCat] || [];
                    } else {
                        const newCategorySections: Record<string, LyricSection[]> = {};
                        CATEGORIES.forEach(cat => {
                            if (cat === 'Lyrics') {
                                newCategorySections[cat] = parsed.sections || [];
                            } else {
                                 newCategorySections[cat] = [{ id: randomId(), type: 'verse' as SectionType, repeats: 1, text: "" }];
                            }
                        });
                        setCategorySections(newCategorySections);
                        activeCatSections = newCategorySections[activeCat] || [];
                    }

                    // Migration: clear old mock text from mission project
                    if (parsed.sections && parsed.sections.some((s: LyricSection) =>
                        s.text.includes("Hit play on the beat") || s.text.includes("switch to 'Studio' mode")
                    )) {
                        // Old mock text detected, reset to empty
                        setSections([{ id: 'fresh-start', type: 'verse', repeats: 1, text: '' }]);
                        setProjectTitle('');
                        setActiveCategory('Notes');
                        setCategorySections({});
                    } else if (parsed.sections && parsed.sections.some((s: LyricSection) => s.text.trim().length > 0)) {
                        setSections(activeCatSections);
                        if (parsed.projectTitle !== undefined) setProjectTitle(parsed.projectTitle);
                    } else {
                        // Default to empty project
                        setSections([{ id: 'fresh-start', type: 'verse', repeats: 1, text: '' }]);
                        setProjectTitle('');
                    }
                    if (parsed.scraps) setScraps(parsed.scraps);

                    let loadedProjects: SavedProject[] = parsed.savedProjects || [];
                    // Remove mission project if it exists
                    loadedProjects = loadedProjects.filter((p: SavedProject) => p.id !== 'mission-001');
                    setSavedProjects(loadedProjects);

                    if (parsed.projectBpm) setProjectBpm(parsed.projectBpm);
                    if (parsed.projectKey) setProjectKey(parsed.projectKey);

                    if (parsed.sessions) {
                        const loadedSessions = await Promise.all(parsed.sessions.map(async (t: RecordingSession) => {
                            try {
                                const b64 = await getAudioData(t.id);
                                if (!b64) return t;
                                const blob = await base64ToBlob(b64);
                                const url = URL.createObjectURL(blob);
                                createdUrls.push(url);
                                return { ...t, base64: b64, audioUrl: url };
                            } catch (e) {
                                console.error(`Failed to load audio for session ${t.id}`, e);
                                return t;
                            }
                        }));
                        setSessions(loadedSessions);
                    }

                    if (parsed.beats) {
                        const loadedBeats = await Promise.all(parsed.beats.map(async (b: Beat) => {
                            try {
                                const b64 = await getAudioData(b.id);
                                if (!b64) return b;
                                const blob = await base64ToBlob(b64);
                                const url = URL.createObjectURL(blob);
                                createdUrls.push(url);
                                return { ...b, base64: b64, audioUrl: url };
                            } catch (e) {
                                console.error(`Failed to load audio for beat ${b.id}`, e);
                                return b;
                            }
                        }));
                        setBeats(loadedBeats);
                        if (loadedBeats.length > 0 && !uploadedBeat) {
                            setUploadedBeat(loadedBeats[0].audioUrl || null);
                            setUploadedBeatName(loadedBeats[0].name || "Untitled Beat");
                            setUploadedBeatId(parsed.uploadedBeatId || loadedBeats[0].id);
                        }
                    }
                    if (parsed.activeProjectId) setActiveProjectId(parsed.activeProjectId);
                } catch (e) { console.error("Failed to load saved state", e); }
            }
        };
        loadState();

        return () => {
            createdUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, []);

    // Persistence Save with indicator
    const saveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const saveState = () => {
            setSaveIndicator('saving');
            const sessionsToSave = sessions.map(({ audioUrl: _aUrl, base64: _b64, ...rest }) => rest);
            const beatsToSave = beats.map(({ audioUrl: _aUrl, base64: _b64, ...rest }) => rest);
            
            const currentCategorySections = {
                ...categorySections,
                [activeCategory]: sections
            };

            const dataToSave = {
                sections, scraps, savedProjects,
                projectTitle, projectBpm, projectKey,
                sessions: sessionsToSave, beats: beatsToSave,
                activeProjectId, uploadedBeatId,
                categorySections: currentCategorySections,
                activeCategory
            };
            try { localStorage.setItem('studio-pro-data-v2', JSON.stringify(dataToSave)); }
            catch (e) { console.error("Storage full or error", e); }
            try { localStorage.setItem('lyriq_ritual_stats', JSON.stringify(ritualStats)); }
            catch (e) { console.error("Rituals Storage error", e); }
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = window.setTimeout(() => setSaveIndicator('saved'), 300);
        };

        const timeoutId = setTimeout(saveState, 1000); // Debounce by 1s
        return () => clearTimeout(timeoutId);
    }, [sections, scraps, savedProjects, projectTitle, projectBpm, projectKey, sessions, beats, activeProjectId, ritualStats, categorySections, activeCategory]);

    const handleRecordStart = (lineId?: string) => {
        setRecordingTargetLineId(lineId || null);
        setRecorderMinimized(true);
        setShowRecorder(true);
    };

    const handleSaveRecordingSession = async (blob: Blob, duration: number, beatOffset?: number, isLayer?: boolean) => {
        const url = URL.createObjectURL(blob);
        const base64 = await blobToBase64(blob);
        const id = randomId().substring(0, 6).toUpperCase();

        const compensatedOffset = beatOffset !== undefined ? Math.max(0, beatOffset - (latencyCompensation / 1000)) : undefined;

        // Increment counter and kick off transcription immediately — runs in parallel with IndexedDB save and smartSplit
        setAnalyzingVocalCount(c => c + 1);
        const transcriptionPromise = process.env.NEXT_PUBLIC_GROQ_ENABLED === 'true'
            ? transcribeAudio(base64)
            : Promise.resolve(null);

        const lyricsSections = categorySections['Lyrics'] || sections;
        const lyricsContextString = lyricsSections.map(s => `[${s.type}]: ${s.text}`).join('\n');
        const structurePromise = analyzeAudioStructure(base64, lyricsContextString);

        await saveAudioData(id, base64);

        const timestamp = new Date().toISOString();

        let initialSections: AutoSection[] = [];
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                const isLoopSession = isBeatLooping && beatLoopStart !== null && beatLoopEnd !== null;
                const passes = isLoopSession && beatLoopStart !== null && beatLoopEnd !== null
                    ? Math.max(1, Math.ceil(duration / (beatLoopEnd - beatLoopStart)))
                    : 1;

                initialSections = await analyzeAudioAndSplit(audioBuffer, {
                    isLoopSession,
                    loopStart: beatLoopStart || 0,
                    loopEnd: beatLoopEnd || 0,
                    startOffset: compensatedOffset || 0,
                    passCount: Math.ceil(passes)
                });
            } finally {
                audioCtx.close().catch(() => {});
            }
        } catch (err) {
            console.error("Failed to split recording automatically", err);
        }

        // If this is a layer being added to an existing session
        if (isLayer && layerModeSessionId) {
            const newLayer: RecordingLayer = {
                id,
                audioUrl: url,
                base64,
                duration,
                isMuted: false,
                gain: 0.8
            };

            const targetSessionId = layerModeSessionId;
            setSessions(prev => prev.map(s => {
                if (s.id === targetSessionId) {
                    return {
                        ...s,
                        layers: [...(s.layers || []), newLayer]
                    };
                }
                return s;
            }));

            toast.success('Layer added');
            setLayerModeSessionId(null);
            const layerToastId = toast.loading('Transcribing lyrics...');
            transcriptionPromise.then(aiResult => {
                setAnalyzingVocalCount(c => Math.max(0, c - 1));
                toast.dismiss(layerToastId);
                if (aiResult) {
                    setSessions(prev => prev.map(s => {
                        if (s.id === targetSessionId) {
                            return {
                                ...s,
                                layers: (s.layers || []).map(l =>
                                    l.id === id
                                        ? { ...l, transcription: aiResult.transcription, lines: aiResult.lines }
                                        : l
                                )
                            };
                        }
                        return s;
                    }));
                }
            }).catch((err: Error) => {
                setAnalyzingVocalCount(c => Math.max(0, c - 1));
                toast.error(err.message, { id: layerToastId });
            });
        } else {
            // Create new session (original behavior)
            const newSession: RecordingSession = {
                id, name: `Recording ${sessions.length + 1}`, timestamp, duration, audioUrl: url, base64: base64, beatOffset: compensatedOffset,
                isLoopSession: !!uploadedBeat && isBeatLooping,
                sections: initialSections,
                loopStart: beatLoopStart || undefined,
                loopEnd: beatLoopEnd || undefined,
                projectId: activeProjectId || undefined
            };
            setSessions(prev => [newSession, ...prev]);
            setActiveSessionId(id); // Auto-select the latest take

            if (recordingTargetLineId) {
                setRecordingTargetLineId(null);
            }

            toast.success('Recording saved');
            const recordingToastId = toast.loading('Processing audio intelligence...');

            // Wait for both Gemini structure and Groq transcription
            Promise.all([transcriptionPromise, structurePromise]).then(([aiResult, structureResult]) => {
                setAnalyzingVocalCount(c => Math.max(0, c - 1));
                toast.dismiss(recordingToastId);

                setSessions(prev => prev.map(s => {
                    if (s.id === id) {
                        let finalSections = s.sections;
                        let newName = s.name;

                        if (structureResult.success && structureResult.sections && structureResult.sections.length > 0) {
                            finalSections = structureResult.sections.map(gs => ({
                                id: randomId(),
                                startTime: gs.startTime,
                                endTime: gs.endTime,
                                type: gs.type,
                                label: gs.label,
                                emojiTag: gs.emoji,
                                summary: gs.summary,
                                isBest: false,
                                isFavorited: false
                            }));

                            // Auto-name based on the first major section found
                            const firstSection = structureResult.sections.find(sec => sec.type === 'vocal') || structureResult.sections[0];
                            if (firstSection) {
                                newName = `${firstSection.emoji} ${firstSection.label} Take`;
                            }
                        }

                        return {
                            ...s,
                            name: newName,
                            transcription: aiResult?.transcription || s.transcription,
                            lines: aiResult?.lines || s.lines,
                            sections: finalSections
                        };
                    }
                    return s;
                }));
            }).catch((err: Error) => {
                setAnalyzingVocalCount(c => Math.max(0, c - 1));
                toast.error(err.message, { id: recordingToastId });
            });
        }
    };



    const handlePlaySession = (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return;
        
        if (playingSessionId === sessionId) {
            globalAudioRef.current?.pause();
            if (beatAudioRef.current) {
                beatAudioRef.current.pause();
                setIsBeatPlaying(false);
            }
            setPlayingSessionId(null);
        } else {
            if (globalAudioRef.current) globalAudioRef.current.pause();
            
            const audio = new Audio(session.audioUrl || session.base64);
            
            audio.onended = () => {
                // Only clear if this specific session is still the one marked as playing
                setPlayingSessionId(prev => {
                    if (prev === sessionId) {
                        if (beatAudioRef.current) {
                            beatAudioRef.current.pause();
                            setIsBeatPlaying(false);
                        }
                        return null;
                    }
                    return prev;
                });
            };
            
            // Sync with beat if available
            if (uploadedBeat && session.beatOffset !== undefined && beatAudioRef.current) {
                // Account for latency compensation already being in beatOffset
                beatAudioRef.current.currentTime = session.beatOffset;
                if (beatGainRef.current) beatGainRef.current.gain.value = beatVolume;
                beatAudioCtxRef.current?.resume();
                beatAudioRef.current.play().catch(console.error);
                setIsBeatPlaying(true);
            }
            
            audio.play().catch(console.error);
            globalAudioRef.current = audio;
            setPlayingSessionId(sessionId);
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm("Permanently delete this recording?")) return;

        // Stop playback if deleting current
        if (playingSessionId === sessionId) {
            globalAudioRef.current?.pause();
            setPlayingSessionId(null);
        }

        // Remove from sessions list
        setSessions(prev => prev.filter(s => s.id !== sessionId));

        // Delete from DB
        try {
            await deleteAudioData(sessionId);
        } catch (e) {
            console.error("Failed to delete audio data", e);
        }
    };

    const handlePlayBeat = (beatId: string) => {
        const beat = beats.find(b => b.id === beatId);
        if (!beat) return;
        if (playingBeatId === beatId) {
            globalAudioRef.current?.pause();
            setPlayingBeatId(null);
        } else {
            if (globalAudioRef.current) globalAudioRef.current.pause();
            const audio = new Audio(beat.audioUrl || beat.base64);
            audio.onended = () => setPlayingBeatId(null);
            audio.play().catch(console.error);
            globalAudioRef.current = audio;
            setPlayingBeatId(beatId);
        }
    };

    const handleDeleteBeat = async (beatId: string) => {
        if (!confirm("Permanently delete this beat?")) return;

        if (playingBeatId === beatId) {
            globalAudioRef.current?.pause();
            setPlayingBeatId(null);
        }

        setBeats(prev => prev.filter(b => b.id !== beatId));

        try {
            await deleteAudioData(beatId);
        } catch (e) {
            console.error("Failed to delete beat data", e);
        }
    };

    // Persistent Audio Logic for Studio Beat
    useEffect(() => {
        const audio = beatAudioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            if (!audio) return;
            if (isBeatLooping && beatLoopEnd && beatLoopStart !== null) {
                // Only seek if we've actually exceeded the end by a significant margin (more than 10ms)
                // This prevents excessive seeking that causes dropouts
                if (audio.currentTime >= beatLoopEnd + 0.01) {
                    audio.currentTime = beatLoopStart;
                }
            }
        };

        const onEnded = () => {
            if (isBeatLooping) {
                audio.currentTime = beatLoopStart ?? 0;
                beatAudioCtxRef.current?.resume();
                audio.play().catch(console.error);
            } else {
                setIsBeatPlaying(false);
            }
        };

        // Only attach listeners if audio element has a valid source
        if (audio.src) {
            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('ended', onEnded);
        }

        // Volume/mute is handled by the dedicated gain effect below — do not set here.
        // Setting it here would cause this effect to re-run on every volume change,
        // which calls audio.play() on an already-playing element and causes a glitch.

        if (isBeatPlaying) {
            if (audio.paused && audio.src) {
                beatAudioCtxRef.current?.resume();
                audio.play().catch(() => setIsBeatPlaying(false));
            }
        } else {
            if (!audio.paused) {
                audio.pause();
            }
        }

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', onEnded);
        };
    }, [isBeatPlaying, isBeatLooping, beatLoopStart, beatLoopEnd]);

    const archiveCurrentProject = () => {
        if (sections.length === 0 && scraps.length === 0) return;
        const projectSessions = sessions.filter(s => !s.projectId || s.projectId === activeProjectId);

        // Keep categorySections up to date with the latest active sections before archiving
        const updatedCategorySections = {
            ...categorySections,
            [activeCategory]: sections
        };

        // Always save the 'Lyrics' sections in the root sections property for compatibility
        const primarySections = updatedCategorySections['Lyrics'] || [];

        const newProject: SavedProject = {
            id: activeProjectId || randomId(),
            name: projectTitle || "Untitled Project",
            lastModified: new Date().toLocaleDateString(),
            sections: primarySections,
            scraps,
            sessions: projectSessions,
            beats: [],
            categorySections: updatedCategorySections,
            activeCategory: activeCategory
        };

        setSavedProjects(prev => {
            const index = prev.findIndex(p => p.id === newProject.id);
            if (index !== -1) {
                const updated = [...prev];
                updated[index] = newProject;
                return updated;
            } else {
                return [newProject, ...prev];
            }
        });
    };

    const handleStartFromScrap = (text: string, type: SectionType) => {
        if (sections.length > 1 || sections[0].text.trim() !== '') {
            if (confirm("Start new project with this section? Current work will be saved to library.")) {
                archiveCurrentProject();
            } else {
                return;
            }
        }

        // Stop all audio playback before clearing
        vocalAudioRef.current?.pause();
        beatAudioRef.current?.pause();
        setIsPlaying(false);
        setIsBeatPlaying(false);

        setSections([{
            id: randomId(),
            type: type,
            repeats: 1,
            text: text
        }]);

        setSessions([]);
        setActiveSessionId(null);
        setPlayingSessionId(null);
        setProjectTitle("");
        setProjectBpm("120");
        setProjectKey("C Min");
        setUploadedBeat(null);
        setActiveProjectId(null);
        setViewMode('studio');
    };

    const deleteProject = (id: string) => {
        setSavedProjects(prev => prev.filter(p => p.id !== id));
        // If the project being deleted is the one currently loaded, reset the workspace
        if (id === activeProjectId) {
            // Stop all audio playback before clearing
            vocalAudioRef.current?.pause();
            beatAudioRef.current?.pause();
            setIsPlaying(false);
            setIsBeatPlaying(false);

            setSections([{ id: randomId(), type: 'verse' as SectionType, repeats: 1, text: "" }]);
            setScraps([]);
            setSessions([]);
            setActiveSessionId(null);
            setPlayingSessionId(null);
            setProjectTitle("");
            setUploadedBeat(null);
            setActiveProjectId(null);

            setActiveCategory('Notes');
            setCategorySections({});
            setIsCategoryDropdownOpen(false);
        }
    };

    const handleNewProject = () => {
        if (window.confirm("Start a new project? Current work will be archived.")) {
            // Stop all audio playback before clearing
            vocalAudioRef.current?.pause();
            beatAudioRef.current?.pause();
            setIsPlaying(false);
            setIsBeatPlaying(false);

            archiveCurrentProject();
            
            // Reset workspace
            setSections([]); // Empty for Flow mode
            setScraps([]);
            setSessions([]);
            setActiveSessionId(null);
            setPlayingSessionId(null);
            setProjectTitle("");
            setUploadedBeat(null);
            setUploadedBeatName("");
            setActiveProjectId(null);
            
            setActiveCategory('Notes');
            setCategorySections({});
            setIsCategoryDropdownOpen(false);

            setViewMode('studio');
            setStudioMode('flow');
            setFabOpen(false);
        }
    };

    const loadProject = (p: SavedProject) => {
        if (window.confirm(`Load "${p.name}"? Workspace will sync.`)) {
            // Stop all audio playback before loading new project
            vocalAudioRef.current?.pause();
            beatAudioRef.current?.pause();
            setIsPlaying(false);
            setIsBeatPlaying(false);

            const activeCat = p.activeCategory || 'Notes';
            setActiveCategory(activeCat);

            const initialCategorySections = p.categorySections || {};
            CATEGORIES.forEach(cat => {
                if (!initialCategorySections[cat]) {
                    if (cat === 'Lyrics' && p.sections && p.sections.length > 0) {
                        initialCategorySections[cat] = p.sections;
                    } else {
                        initialCategorySections[cat] = [{ id: randomId(), type: 'verse' as SectionType, repeats: 1, text: "" }];
                    }
                }
            });

            setCategorySections(initialCategorySections);
            setSections(initialCategorySections[activeCat]);

            setScraps(p.scraps || []);
            setSessions(p.sessions || []);
            setActiveSessionId(null);
            setPlayingSessionId(null);
            setProjectTitle(p.name === "Untitled Project" ? "" : p.name);
            setUploadedBeat(p.beats?.[0]?.audioUrl || null);
            setUploadedBeatName(p.beats?.[0]?.name || "");
            setActiveProjectId(p.id);
            setViewMode('studio');
            setStudioMode(initialCategorySections[activeCat]?.length > 0 ? 'write' : 'flow');
            setShowSearch(false);
        }
    };

    const handleStartProjectFromBeat = (beat: Beat) => {
        if (globalAudioRef.current) globalAudioRef.current.pause();
        // Stop all audio playback before loading beat project
        vocalAudioRef.current?.pause();
        beatAudioRef.current?.pause();
        setIsPlaying(false);
        setIsBeatPlaying(false);

        setPlayingBeatId(null);
        archiveCurrentProject();
        setSections([]); // Blank canvas for Flow mode
        setScraps([]);
        setSessions([]);
        setActiveSessionId(null);
        setPlayingSessionId(null);
        setProjectTitle(beat.name);
        setUploadedBeat(beat.audioUrl || null);
        setUploadedBeatName(beat.name);
        setUploadedBeatId(beat.id);
        setActiveProjectId(null);
        setViewMode('studio');
        setStudioMode('flow');

        // Beat structure detection disabled — interferes with transcription flow
    };

    const handleLibraryBeatUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const base64 = await blobToBase64(file);
        const id = randomId();

        const audio = new Audio(url);
        audio.onloadedmetadata = () => {
            const duration = audio.duration;
            const mins = Math.floor(duration / 60);
            const secs = Math.floor(duration % 60);
            const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

            const newBeat: Beat = {
                id,
                name: file.name.replace(/\.\w+$/, ''),
                duration: durationStr,
                audioUrl: url,
                base64: base64,
                date: new Date().toLocaleDateString()
            };

            setBeats(prev => [newBeat, ...prev]);
            setFabOpen(false);
        };

        e.target.value = '';
    };


    interface SearchResult {
        id: string;
        type: string;
        title: string;
        desc: string;
        date: string;
        raw: SavedProject;
    }

    const searchResults = useMemo((): SearchResult[] => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        const results: SearchResult[] = [];

        const findMatchedLine = (text: string, query: string) => {
            const lowerText = text.toLowerCase();
            const index = lowerText.indexOf(query);
            if (index === -1) return '';
            const start = text.lastIndexOf('\n', index);
            const end = text.indexOf('\n', index);
            return text.substring(
                start === -1 ? 0 : start + 1,
                end === -1 ? text.length : end
            );
        };

        if (searchFilter === 'all' || searchFilter === 'songs') {
            savedProjects.forEach(p => {
                const nameMatch = p.name.toLowerCase().includes(q);
                let matchedLine: string | undefined;

                if (!nameMatch) {
                    const sectionWithMatch = p.sections.find(s => s.text.toLowerCase().includes(q));
                    if (sectionWithMatch) {
                        matchedLine = findMatchedLine(sectionWithMatch.text, q);
                    }
                }

                if (nameMatch || matchedLine !== undefined) {
                    results.push({
                        id: p.id, type: 'song', title: p.name,
                        desc: matchedLine ? `"...${matchedLine.trim().substring(0, 50)}..."` : `${p.sections.length} sections`,
                        date: p.lastModified, raw: p
                    });
                }
            });
        }

        if (searchFilter === 'all' || searchFilter === 'sections') {
            sections.forEach(s => {
                const matchedLine = findMatchedLine(s.text, q);
                if (matchedLine) {
                    results.push({
                        id: s.id, type: 'section', title: `${s.type} (current project)`,
                        desc: `"...${matchedLine.trim().substring(0, 50)}..."`,
                        date: '', raw: { id: 'current', name: projectTitle || 'Current Project', lastModified: '', sections, scraps, sessions: [], beats: [] }
                    });
                }
            });
        }

        if (searchFilter === 'all' || searchFilter === 'recordings') {
            sessions.forEach(t => {
                const nameMatch = (t.name || `Recording ${t.id}`).toLowerCase().includes(q);
                const transMatch = (t.transcription || '').toLowerCase().includes(q);
                const sectionMatch = t.sections.some(s => (s.label || '').toLowerCase().includes(q));

                if (nameMatch || transMatch || sectionMatch) {
                    let desc = `${t.duration?.toFixed(1) || '0.0'}s - ${new Date(t.timestamp).toLocaleDateString()}`;
                    if (transMatch) desc = `"...${t.transcription?.substring(0, 50)}..."`;
                    else if (sectionMatch) desc = `Contains: ${t.sections.find(s => (s.label || '').toLowerCase().includes(q))?.label}`;

                    results.push({
                        id: t.id, type: 'recording', title: t.name || `Recording ${t.id}`,
                        desc,
                        date: t.timestamp, raw: { id: 'current', name: '', lastModified: '', sections: [], scraps: [], sessions: [], beats: [] }
                    });
                }
            });
        }


        if (searchFilter === 'all' || searchFilter === 'beats') {
            beats.forEach(b => {
                if (b.name.toLowerCase().includes(q)) {
                    results.push({
                        id: b.id, type: 'beat', title: b.name,
                        desc: b.duration,
                        date: b.date, raw: { id: 'current', name: '', lastModified: '', sections: [], scraps: [], sessions: [], beats: [] }
                    });
                }
            });
        }

        return results;
    }, [searchQuery, searchFilter, savedProjects, sections, sessions, beats, scraps, projectTitle]);

    const updateSection = (id: string, updates: Partial<LyricSection>) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const moveSection = (id: string, direction: 'up' | 'down') => {
        const index = sections.findIndex(s => s.id === id);
        if (index === -1) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= sections.length) return;
        const newSections = [...sections];
        [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
        setSections(newSections);
    };

    const deleteSection = (id: string) => setSections(prev => prev.filter(s => s.id !== id));

    const addSection = () => {
        setSections(prev => [...prev, {
            id: randomId(),
            type: 'verse',
            repeats: 1,
            text: ""
        }]);
        if (studioMode === 'flow') setStudioMode('write');
    };

    const promoteToSection = (text: string) => {
        if (text.trim()) {
            const newSection: LyricSection = {
                id: randomId(),
                type: 'verse',
                repeats: 1,
                text: text
            };
            setSections(prev => [...prev, newSection]);
        }
    };

    const getActiveView = () => {
        switch (viewMode) {
            case 'settings':
                return (
                    <div className="h-full flex flex-col pt-12 animate-in fade-in duration-500 px-6">
                        <div className="flex items-center gap-3 mb-8">
                            <button onClick={() => setViewMode('collection')} className="text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
                                <ChevronRight size={20} className="rotate-180" />
                            </button>
                            <h1 className="text-2xl font-medium tracking-tight text-[var(--text-main)]">Settings</h1>
                        </div>
                        <div className="space-y-8 overflow-y-auto pb-20">
                            <section>
                                <h2 className="text-xs mono uppercase tracking-wide text-[var(--text-secondary)] mb-4">Appearance</h2>
                                <div className="grid grid-cols-1 gap-3">
                                    {['dark', 'light', 'midnight', 'matrix', 'sonar'].map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTheme(t as Theme)}
                                            className={`p-4 rounded-lg border flex items-center justify-between transition-all capitalize ${theme === t ? 'bg-[var(--bg-card)] border-[var(--accent)]' : 'bg-[var(--bg-card)] border-[var(--border-main)] hover:border-[var(--text-secondary)]'}`}
                                        >
                                            <span className="text-sm font-medium text-[var(--text-main)]">{t}</span>
                                            {theme === t && <Check size={16} className="text-[var(--accent)]" />}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className="pt-4">
                                <h2 className="text-xs mono uppercase tracking-wide text-[var(--text-secondary)] mb-4">Audio Engineering</h2>
                                <div className="p-4 rounded-lg border bg-[var(--bg-card)] border-[var(--border-main)] space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-medium text-[var(--text-main)]">Latency Compensation</h3>
                                            <p className="text-xs text-[var(--text-tertiary)] max-w-[200px]">Adjust if your recordings feel slightly delayed compared to the beat.</p>
                                        </div>
                                        <div className="text-sm font-bold text-[var(--accent)] mono">{latencyCompensation}ms</div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="500"
                                        step="5"
                                        value={latencyCompensation}
                                        onChange={(e) => setLatencyCompensation(parseInt(e.target.value))}
                                        className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                                    />
                                    <div className="flex justify-between text-xs mono text-[var(--text-tertiary)]">
                                        <span>0ms</span>
                                        <span>500ms</span>
                                    </div>
                                </div>
                            </section>
                            <section className="pt-4">
                                <h2 className="text-xs mono uppercase tracking-wide text-[var(--text-secondary)] mb-4">Help</h2>
                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => {
                                            localStorage.removeItem('lyriq-tour-completed');
                                            setShowTour(true);
                                            setViewMode('collection');
                                        }}
                                        className="p-4 rounded-lg border bg-[var(--bg-card)] border-[var(--border-main)] hover:border-[var(--text-secondary)] flex items-center justify-between transition-all"
                                    >
                                        <span className="text-sm font-medium text-[var(--text-main)]">Restart Tour</span>
                                        <ChevronRight size={16} className="text-[var(--text-secondary)]" />
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                );
            case 'collection': {
                const isEmpty = savedProjects.length === 0 && beats.length === 0;

                return (
                    <div className="h-full flex flex-col pt-6 relative text-[var(--text-main)] bg-[var(--bg-main)] select-none">
                        {/* Top Bar Header */}
                        <div className="px-6 py-4 flex items-center justify-between z-30">
                            <span className="text-xl font-black tracking-tight uppercase text-[var(--text-main)]">LYRIQ</span>
                            <button onClick={() => setShowSearch(true)} className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white transition-all">
                                <Search size={20} />
                            </button>
                        </div>

                        {isEmpty ? (
                            // Blank Start / Option States
                            <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
                                <AnimatePresence mode="wait">
                                    {!showPillOptions ? (
                                        <motion.div
                                            key="start-state"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="flex flex-col items-center gap-4 cursor-pointer"
                                            onClick={() => setShowPillOptions(true)}
                                        >
                                            <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl">
                                                <Plus size={36} className="text-white" />
                                            </div>
                                            <span className="text-lg font-bold text-white tracking-wide">Add Your Music</span>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="option-state"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="bg-zinc-900 border border-white/10 rounded-2xl p-1 flex items-center shadow-2xl max-w-sm w-full divide-x divide-white/5"
                                        >
                                            <button
                                                onClick={() => {
                                                    fabInputRef.current?.click();
                                                    setShowPillOptions(false);
                                                }}
                                                className="flex-1 py-4 flex items-center justify-center gap-2 hover:bg-white/5 rounded-l-xl transition-all text-white font-medium text-sm active:scale-98"
                                            >
                                                <Music size={16} />
                                                <span>Import</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleNewProject();
                                                    setShowPillOptions(false);
                                                }}
                                                className="flex-1 py-4 flex items-center justify-center gap-2 hover:bg-white/5 rounded-r-xl transition-all text-white font-medium text-sm active:scale-98"
                                            >
                                                <FilePlus size={16} />
                                                <span>Create</span>
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <input ref={fabInputRef} type="file" accept="audio/*, .mp3, .wav" className="hidden" onChange={handleLibraryBeatUpload} />
                            </div>
                        ) : (
                            // Populated State (Packs Grid View)
                            <div className="flex-1 flex flex-col overflow-hidden px-4">
                                <div className="mb-4">
                                    {/* Segmented Control Switcher */}
                                    <div className="w-full bg-zinc-900/60 backdrop-blur-md border border-white/5 p-1 rounded-full flex gap-1 shadow-inner">
                                        <button
                                            onClick={() => setLibraryTab('songs')}
                                            className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all text-center cursor-pointer active:scale-98 ${libraryTab === 'songs' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                        >
                                            Songs
                                        </button>
                                        <button
                                            onClick={() => setLibraryTab('beats')}
                                            className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all text-center cursor-pointer active:scale-98 ${libraryTab === 'beats' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                        >
                                            Beats
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto pb-32 scrollbar-hide">
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Display Saved Projects as cards when Songs tab is active */}
                                        {libraryTab === 'songs' && savedProjects.map((p, index) => {
                                            // Conic gradient colors based on project ID index to give variation
                                            const gradients = [
                                                'from-purple-900 to-indigo-950',
                                                'from-emerald-900 to-teal-950',
                                                'from-rose-900 to-amber-950',
                                                'from-cyan-900 to-blue-950',
                                                'from-fuchsia-900 to-purple-950'
                                            ];
                                            const gradientClass = gradients[index % gradients.length];

                                            return (
                                                <div key={p.id} className="flex flex-col gap-2 group relative">
                                                    <div
                                                        onClick={() => loadProject(p)}
                                                        className={`aspect-square w-full rounded-2xl bg-gradient-to-tr ${gradientClass} border border-white/5 relative overflow-hidden shadow-lg cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all`}
                                                    >
                                                        {/* Sleek metallic cone/radial reflection mockup using gradient */}
                                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/40 mix-blend-overlay" />
                                                        
                                                        {/* Play Button Overlay */}
                                                        <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-90 transition-all hover:bg-white/25 active:scale-90">
                                                            <Play size={12} fill="currentColor" className="ml-0.5" />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start justify-between px-1">
                                                        <div className="min-w-0">
                                                            <h3 className="text-xs font-semibold text-white truncate">{p.name || "Untitled Project"}</h3>
                                                            <span className="text-[10px] text-zinc-500 font-medium tracking-wide">{p.lastModified}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm(`Delete "${p.name || 'Untitled Project'}"?`)) {
                                                                    deleteProject(p.id);
                                                                }
                                                            }}
                                                            className="text-zinc-500 hover:text-white p-1"
                                                        >
                                                            <span className="text-sm font-bold leading-none">···</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Display Beats as cards when Beats tab is active */}
                                        {libraryTab === 'beats' && beats.map((beat, index) => {
                                            const gradients = [
                                                'from-zinc-900 to-zinc-950',
                                                'from-stone-900 to-zinc-950'
                                            ];
                                            const gradientClass = gradients[index % gradients.length];
                                            const isPlaying = playingBeatId === beat.id;

                                            return (
                                                <div key={beat.id} className="flex flex-col gap-2 group relative">
                                                    <div
                                                        onClick={() => handleStartProjectFromBeat(beat)}
                                                        className="aspect-square w-full relative group"
                                                    >
                                                        {/* Silvery Metallic Vinyl Record */}
                                                        <motion.div
                                                            animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
                                                            transition={isPlaying ? { repeat: Infinity, duration: 4, ease: "linear" } : { duration: 0.5 }}
                                                            className={`w-full h-full rounded-full bg-[conic-gradient(from_0deg,_#a1a1aa,_#e4e4e7,_#71717a,_#e4e4e7,_#a1a1aa)] border ${isPlaying ? 'border-[var(--accent)] shadow-[0_0_15px_rgba(255,255,255,0.15)]' : 'border-white/15'} relative overflow-hidden flex items-center justify-center shadow-2xl cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all`}
                                                        >
                                                            {/* Grooves */}
                                                            <div className="absolute inset-1.5 rounded-full border border-black/15" />
                                                            <div className="absolute inset-4 rounded-full border border-black/15" />
                                                            <div className="absolute inset-7 rounded-full border border-black/10" />
                                                            <div className="absolute inset-10 rounded-full border border-black/10" />
                                                            <div className="absolute inset-13 rounded-full border border-black/5" />
                                                            <div className="absolute inset-16 rounded-full border border-black/5" />
                                                            
                                                            {/* Center Label (Colored vinyl label) */}
                                                            <div className="w-1/3 h-1/3 rounded-full bg-zinc-800 border border-black/30 flex items-center justify-center relative shadow-inner">
                                                                {/* Spindle hole */}
                                                                <div className="w-3 h-3 rounded-full bg-black border border-zinc-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]" />
                                                            </div>
                                                        </motion.div>
                                                        
                                                        {/* Play Button Overlay */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePlayBeat(beat.id);
                                                            }}
                                                            className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 active:scale-90"
                                                        >
                                                            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                                                        </button>
                                                    </div>
                                                    <div className="flex items-start justify-between px-1">
                                                        <div className="min-w-0">
                                                            <h3 className="text-xs font-semibold text-white truncate">{beat.name}</h3>
                                                            <span className="text-[10px] text-zinc-500 font-medium tracking-wide">Beat · {beat.duration}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm(`Delete "${beat.name}"?`)) {
                                                                    handleDeleteBeat(beat.id);
                                                                }
                                                            }}
                                                            className="text-zinc-500 hover:text-white p-1"
                                                        >
                                                            <span className="text-sm font-bold leading-none">···</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Floating Action Menu Trigger */}
                                <div className="absolute bottom-24 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
                                    <div className="pointer-events-auto flex flex-col items-end gap-3">
                                        <AnimatePresence>
                                            {fabOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                                    className="bg-[#e4ece9] text-black border border-white/20 rounded-2xl p-2 flex flex-col gap-1 shadow-2xl min-w-[160px]"
                                                >
                                                    <button
                                                        onClick={() => {
                                                            fabInputRef.current?.click();
                                                            setFabOpen(false);
                                                        }}
                                                        className="flex items-center gap-3 px-3 py-2 hover:bg-black/5 rounded-xl transition-all text-sm font-medium w-full text-left"
                                                    >
                                                        <Music size={16} />
                                                        <span>Upload files</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleNewProject();
                                                            setFabOpen(false);
                                                        }}
                                                        className="flex items-center gap-3 px-3 py-2 hover:bg-black/5 rounded-xl transition-all text-sm font-medium w-full text-left"
                                                    >
                                                        <FilePlus size={16} />
                                                        <span>Create pack</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setViewMode('studio');
                                                            setFabOpen(false);
                                                        }}
                                                        className="flex items-center gap-3 px-3 py-2 hover:bg-black/5 rounded-xl transition-all text-sm font-medium w-full text-left"
                                                    >
                                                        <Disc size={16} />
                                                        <span>Open studio</span>
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <button
                                            onClick={() => setFabOpen(!fabOpen)}
                                            className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
                                        >
                                            {fabOpen ? <X size={28} strokeWidth={2.5} /> : <Plus size={28} strokeWidth={2.5} />}
                                        </button>
                                    </div>
                                </div>
                                <input ref={fabInputRef} type="file" accept="audio/*, .mp3, .wav" className="hidden" onChange={handleLibraryBeatUpload} />
                            </div>
                        )}
                    </div>
                );
            }
            case 'rituals':
                return (
                    <div className="h-full relative">
                        <div className="absolute top-4 right-4 z-[60]">
                            <BeatUploader
                                audioSrc={uploadedBeat}
                                audioRef={beatAudioRef}
                                beatName={uploadedBeatName}
                                isPlaying={isBeatPlaying}
                                setIsPlaying={setIsBeatPlaying}
                                volume={beatVolume}
                                setVolume={setBeatVolume}
                                loopStart={beatLoopStart}
                                setLoopStart={setBeatLoopStart}
                                loopEnd={beatLoopEnd}
                                setLoopEnd={setBeatLoopEnd}
                                onUpload={async (file) => {
                                                const url = URL.createObjectURL(file);
                                                setUploadedBeat(url);
                                                const name = file.name.replace(/\\.w+$/, '');
                                                setUploadedBeatName(name);
                                                const base64 = await blobToBase64(file);
                                                const id = randomId();
                                                setUploadedBeatId(id);
                                                const audio = new Audio(url);
                                                audio.onloadedmetadata = () => {
                                                    const dur = audio.duration;
                                                    const mins = Math.floor(dur / 60);
                                                    const secs = Math.floor(dur % 60);
                                                    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
                                                    const newBeat: Beat = {
                                                        id, name, duration: durationStr,
                                                        audioUrl: url, base64, date: new Date().toLocaleDateString()
                                                    };
                                                    setBeats(prev => [newBeat, ...prev]);
                                                };
                                            }}
                                onClear={() => {
                                                setUploadedBeat(null);
                                                setUploadedBeatName('');
                                                setIsBeatPlaying(false);
                                                setUploadedBeatId(null);
                                            }}
                                isLooping={isBeatLooping}
                                setIsLooping={setIsBeatLooping}
                            />
                        </div>
                        <RitualsView
                            stats={ritualStats}
                            onCompleteRitual={handleCompleteRitual}
                        />
                    </div>
                );
            case 'vault':
                return (
                    <VaultView
                        sessions={sessions}
                        scraps={scraps}
                        beats={beats}

                        projectTitle={projectTitle}
                        onPlaySession={handleSelectSessionAndPlay}
                        playingSessionId={activeSessionId}
                        onPlayBeat={handlePlayBeat}
                        playingBeatId={playingBeatId}
                        currentTime={currentTime}
                        duration={duration}
                        ritualStats={ritualStats}
                    />
                );
            case 'studio':
                return (
                    <div className="h-full flex flex-col relative">
                        <div className="glass z-20 sticky top-0 border-b border-[var(--border-main)]">
                            <div className="px-6 py-4">
                                <div className="flex items-center justify-between gap-4">
                                    {/* Left: Title and Save Status */}
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="group relative flex items-center">
                                            <input
                                                value={projectTitle}
                                                onChange={(e) => setProjectTitle(e.target.value)}
                                                className="bg-transparent border-none text-xl font-bold text-[var(--text-main)] focus:outline-none w-full placeholder:text-[var(--text-tertiary)] truncate pr-8"
                                                placeholder="Untitled Project"
                                            />
                                            <button 
                                                onClick={() => setIsProjectSelectorOpen(!isProjectSelectorOpen)}
                                                className="absolute right-0 p-1 text-[var(--text-tertiary)] hover:text-white transition-colors"
                                            >
                                                <ChevronDown size={18} className={cn("transition-transform", isProjectSelectorOpen && "rotate-180")} />
                                            </button>

                                            <AnimatePresence>
                                                {isProjectSelectorOpen && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                        className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl shadow-2xl p-2 z-[60] backdrop-blur-xl"
                                                    >
                                                        <div className="max-h-60 overflow-y-auto scrollbar-hide py-1">
                                                            <div className="px-3 py-2 text-[10px] mono uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-main)] mb-1">Your Projects</div>
                                                            {savedProjects.length > 0 ? (
                                                                savedProjects.map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        onClick={() => {
                                                                            loadProject(p);
                                                                            setIsProjectSelectorOpen(false);
                                                                        }}
                                                                        className={cn(
                                                                            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group",
                                                                            activeProjectId === p.id ? "bg-[var(--accent)] text-black" : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-white"
                                                                        )}
                                                                    >
                                                                        <span className="truncate">{p.name || "Untitled"}</span>
                                                                        {activeProjectId === p.id && <CheckCircle2 size={14} />}
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                <div className="px-3 py-4 text-xs italic text-[var(--text-tertiary)] text-center">No saved projects</div>
                                                            )}
                                                            <button 
                                                                onClick={() => {
                                                                    handleNewProject();
                                                                    setIsProjectSelectorOpen(false);
                                                                }}
                                                                className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black rounded-lg transition-all"
                                                            >
                                                                <Plus size={14} /> New Project
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                    </div>

                                    {/* Right: Audio Controls */}
                                    <div id="tour-audio-controls" className="flex items-center gap-2">
                                        <BeatUploader
                                            audioSrc={uploadedBeat}
                                            audioRef={beatAudioRef}
                                            beatName={uploadedBeatName}
                                            // Lifted Props
                                            isPlaying={isBeatPlaying}
                                            setIsPlaying={setIsBeatPlaying}
                                            volume={beatVolume}
                                            setVolume={setBeatVolume}
                                            loopStart={beatLoopStart}
                                            setLoopStart={setBeatLoopStart}
                                            loopEnd={beatLoopEnd}
                                            setLoopEnd={setBeatLoopEnd}
                                            isLooping={isBeatLooping}
                                            setIsLooping={setIsBeatLooping}
                                            onSeek={handleBeatSeek}
                                            onUpload={async (file) => {
                                                const url = URL.createObjectURL(file);
                                                setUploadedBeat(url);
                                                const name = file.name.replace(/\.\w+$/, '');
                                                setUploadedBeatName(name);

                                                // Also add to Library beats
                                                const base64 = await blobToBase64(file);
                                                const id = randomId();
                                                setUploadedBeatId(id);
                                                const audio = new Audio(url);
                                                audio.onloadedmetadata = () => {
                                                    const dur = audio.duration;
                                                    const mins = Math.floor(dur / 60);
                                                    const secs = Math.floor(dur % 60);
                                                    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
                                                    const newBeat: Beat = {
                                                        id, name, duration: durationStr,
                                                        audioUrl: url, base64, date: new Date().toLocaleDateString()
                                                    };
                                                    setBeats(prev => {
                                                        // Replace existing beat with same name so sections update correctly
                                                        const filtered = prev.filter(b => b.name !== name);
                                                        return [newBeat, ...filtered];
                                                    });

                                                    // Beat structure detection disabled — interferes with transcription flow
                                                };
                                            }}
                                            onClear={() => { setUploadedBeat(null); setUploadedBeatName(""); }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="tour-workspace" className="flex-1 relative overflow-hidden flex flex-col">
                            {/* Toggle For Tabs */}
                            <div className="flex items-center justify-between border-b border-[var(--border-main)] sticky top-0 bg-[var(--bg-main)] z-10 px-6">
                                <div className="flex items-center">
                                    <button onClick={() => setActiveTab('lyrics')} className={`pb-3 pr-6 pt-3 text-xs mono uppercase tracking-wider transition-all ${activeTab === 'lyrics' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Lyrics</button>
                                    <button onClick={() => setActiveTab('takes')} className={`pb-3 px-6 pt-3 text-xs mono uppercase tracking-wider transition-all ${activeTab === 'takes' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Takes</button>
                                    <button onClick={() => setActiveTab('player')} className={`pb-3 px-6 pt-3 text-xs mono uppercase tracking-wider transition-all ${activeTab === 'player' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Player</button>
                                </div>
                                <button
                                    onClick={() => setShowSyllables(!showSyllables)}
                                    className={cn(
                                        "w-8 h-8 rounded-full border flex items-center justify-center text-xs font-medium transition-all mb-1 hover:brightness-110 active:scale-95",
                                        showSyllables 
                                            ? "bg-[var(--accent)] border-[var(--accent)] text-black font-bold shadow-[0_0_10px_var(--accent)]/30" 
                                            : "bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[var(--text-tertiary)]"
                                    )}
                                    title="Toggle Syllables Editor"
                                >
                                    T
                                </button>
                            </div>

                            {/* Player Tab — full height, no scroll padding */}
                            {activeTab === 'player' && (
                                <div className="absolute inset-0 mt-12 flex flex-col overflow-hidden bg-[var(--bg-main)]">
                                    <PlayerTab
                                        projectTitle={projectTitle || "Untitled Project"}
                                        session={sessions.find(s => s.id === activeSessionId) ?? sessions[0] ?? null}
                                        onOpenFX={() => setShowFXPanel(true)}
                                        sessions={sessions}
                                        beat={beats.find(b => b.id === uploadedBeatId) ?? null}
                                        beatSrc={uploadedBeat}
                                        beatVolume={beatVolume}
                                        beatMuted={beatMuted}
                                        onVolumeChange={setBeatVolume}
                                        onMuteChange={setBeatMuted}
                                        isBeatLooping={isBeatLooping}
                                        beatLoopStart={beatLoopStart}
                                        beatLoopEnd={beatLoopEnd}
                                        lyrics={categorySections['Lyrics'] || []}
                                        isAnalyzingVocal={isAnalyzingVocal}
                                        isAnalyzingBeat={isAnalyzingBeat}

                                        // Shared Audio State
                                        isPlaying={isPlaying}
                                        currentTime={currentTime}
                                        duration={duration}
                                        onTogglePlay={togglePlayback}
                                        onSeek={seekTo}
                                        onSelectSession={setActiveSessionId}

                                        onBeatPlaybackChange={(isP) => {
                                            if (isP && isBeatPlaying && beatAudioRef.current) {
                                                beatAudioRef.current.pause();
                                                beatAudioCtxRef.current?.suspend();
                                                setIsBeatPlaying(false);
                                            }
                                        }}
                                        onSetLoopRegion={(startTime, endTime) => {
                                            setBeatLoopStart(startTime);
                                            setBeatLoopEnd(endTime);
                                            setIsBeatLooping(true);
                                        }}
                                        onClearLoop={() => {
                                            setIsBeatLooping(false);
                                            setBeatLoopStart(null);
                                            setBeatLoopEnd(null);
                                        }}
                                    />
                                </div>
                            )}

                            {/* Lyrics & Takes tabs — scrollable content */}
                            {activeTab !== 'player' && (
                                <div className="absolute inset-0 mt-12 overflow-y-auto scrollbar-hide bg-[var(--bg-main)] px-6 py-8 pb-[calc(10rem+env(safe-area-inset-bottom))]">
                                    <div className="max-w-2xl mx-auto space-y-12">
                                        {activeTab === 'lyrics' ? (
                                            <>
                                                <AnimatePresence mode="wait">
                                                    {studioMode === 'flow' && sections.length === 0 ? (
                                                        <motion.div 
                                                            key="flow-canvas"
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                                                            className="flex flex-col items-center justify-center min-h-[60vh] text-center px-12 relative"
                                                        >
                                                            {/* Abstract Background Shapes */}
                                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[400px] h-[400px] bg-[var(--accent)] opacity-[0.03] blur-[100px] rounded-full" />
                                                            <div className="absolute top-1/4 right-1/4 -z-10 w-[200px] h-[200px] bg-blue-500 opacity-[0.02] blur-[80px] rounded-full animate-pulse" />
                                                            
                                                            <div className="w-32 h-32 rounded-[40px] border border-[var(--border-main)] flex items-center justify-center mb-10 relative overflow-hidden group">
                                                                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)] to-transparent opacity-[0.05] group-hover:opacity-10 transition-opacity" />
                                                                <div className="absolute inset-0 rounded-[40px] border border-white/5" />
                                                                <PenTool size={40} className="text-[var(--accent)] opacity-50 group-hover:scale-110 group-hover:opacity-100 transition-all duration-500" />
                                                                
                                                                {/* Orbiting particles animation */}
                                                                <motion.div 
                                                                    animate={{ rotate: 360 }}
                                                                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                                                    className="absolute inset-0 border border-dashed border-[var(--accent)]/10 rounded-full scale-150 pointer-events-none"
                                                                />
                                                            </div>

                                                            <motion.h2 
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.2 }}
                                                                className="text-4xl font-bold tracking-tight text-white mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
                                                            >
                                                                Capture the Flow
                                                            </motion.h2>
                                                            
                                                            <motion.p 
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.3 }}
                                                                className="text-base text-[var(--text-secondary)] leading-relaxed mb-12 max-w-sm mx-auto"
                                                            >
                                                                Your creative canvas is ready. Start with a loose thought, a hum, or a bold first verse.
                                                            </motion.p>

                                                            <motion.button
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.4 }}
                                                                onClick={addSection}
                                                                className="px-10 h-14 bg-white text-black rounded-full font-bold flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)]"
                                                            >
                                                                <Plus size={20} strokeWidth={3} /> Start Writing
                                                            </motion.button>
                                                            
                                                            {/* Optional quick start types */}
                                                            <motion.div 
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                transition={{ delay: 0.6 }}
                                                                className="mt-16 flex items-center gap-6 text-[var(--text-tertiary)]"
                                                            >
                                                                <span className="text-[10px] mono uppercase tracking-widest">Quick Start:</span>
                                                                <div className="flex gap-4">
                                                                    {['Verse', 'Chorus', 'Idea'].map(type => (
                                                                        <button 
                                                                            key={type}
                                                                            onClick={addSection}
                                                                            className="text-xs hover:text-[var(--accent)] transition-colors"
                                                                        >
                                                                            {type}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </motion.div>
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div 
                                                            key="write-mode"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            className="space-y-12"
                                                        >
                                                            <div className="flex items-center justify-between text-xs mono text-[var(--text-tertiary)] pb-3 border-b border-[var(--border-main)]/30 mb-6 relative">
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                                                        className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer select-none font-bold text-sm text-[var(--text-secondary)] py-1 bg-transparent border-none outline-none"
                                                                    >
                                                                        <span className="text-[var(--text-main)] font-semibold">{activeCategory}</span>
                                                                        <ChevronDown size={14} className={cn("opacity-70 transition-transform duration-300", isCategoryDropdownOpen && "rotate-180")} />
                                                                    </button>
                                                                    
                                                                    {isCategoryDropdownOpen && (
                                                                        <>
                                                                            <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsCategoryDropdownOpen(false)} />
                                                                            <div className="absolute left-0 mt-2 w-64 bg-[#141414]/95 backdrop-blur-md border border-[var(--border-main)] rounded-xl shadow-2xl z-50 overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                                                                <div className="px-3 py-1 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase font-semibold border-b border-[var(--border-main)]/30 mb-1">
                                                                                    Select Category
                                                                                </div>
                                                                                {CATEGORIES.map(category => (
                                                                                    <button
                                                                                        key={category}
                                                                                        onClick={() => handleSelectCategory(category)}
                                                                                        className={cn(
                                                                                            "w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center justify-between cursor-pointer",
                                                                                            activeCategory === category 
                                                                                                ? "text-[var(--accent)] bg-[var(--accent)]/10 font-bold font-semibold" 
                                                                                                : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
                                                                                        )}
                                                                                    >
                                                                                        <span>{category}</span>
                                                                                        {activeCategory === category && (
                                                                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                                                                                        )}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div className="tabular-nums font-bold">
                                                                    {showSyllables ? `${totalSyllables} syllables · ` : ''}{totalLines} lines
                                                                </div>
                                                            </div>
                                                            {sections.map((section, idx) => (
                                                                <motion.div key={section.id} id={idx === 0 ? 'tour-lyric-card' : undefined} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                                                                    <LyricCard
                                                                        section={section}
                                                                        onUpdate={updateSection}
                                                                        onDelete={deleteSection}
                                                                        onMove={moveSection}
                                                                        showSyllables={showSyllables}
                                                                    />
                                                                </motion.div>
                                                            ))}
                                                            <button
                                                                onClick={addSection}
                                                                className="w-full py-6 flex items-center justify-center gap-4 text-xs mono uppercase tracking-[0.3em] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all group relative active:scale-95 focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] rounded-lg"
                                                            >
                                                                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[var(--border-main)] to-[var(--border-focus)] opacity-30 group-hover:opacity-100 transition-all duration-500" />
                                                                <span className="px-4 group-hover:scale-110 group-hover:tracking-[0.4em] transition-all duration-500 font-medium">+ Add Section</span>
                                                                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[var(--border-main)] to-[var(--border-focus)] opacity-30 group-hover:opacity-100 transition-all duration-500" />
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </>
                                        ) : activeTab === 'takes' ? (
                                            <RecordingThread
                                                sessions={displaySessions}
                                                activeSessionId={activeSessionId}
                                                onSelectSession={handleSelectSession}
                                                onPlaySession={handleSelectSessionAndPlay}
                                                onUpdateSession={(id, updates) => setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))}
                                                onUpdateSection={(sessionId, sectionId, updates) => setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, sections: s.sections?.map(sec => sec.id === sectionId ? { ...sec, ...updates } : sec) } : s))}
                                                onOpenSplitEditor={(id) => {
                                                    setRecordingToSplit(id);
                                                    setSplitEditorOpen(true);
                                                }}

                                                onDeleteSession={handleDeleteSession}
                                                beatSrc={uploadedBeat}
                                                beatVolume={beatVolume}
                                                onBeatPlaybackChange={(isP) => {
                                                    if (isP && isBeatPlaying && beatAudioRef.current) {
                                                        beatAudioRef.current.pause();
                                                        beatAudioCtxRef.current?.suspend();
                                                        setIsBeatPlaying(false);
                                                    }
                                                }}

                                                // Shared Audio State
                                                isPlaying={isPlaying}
                                                currentTime={currentTime}
                                                onTogglePlay={togglePlayback}
                                                onSeek={seekTo}
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            default: return null;
        }
    };


    return (
        <div className="h-[100dvh] w-full bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col items-center overflow-hidden select-none transition-colors duration-500" data-theme={theme}>
            <main
                className="w-full flex-1 max-w-lg overflow-hidden bg-[var(--bg-main)] border-x border-[var(--border-main)] shadow-2xl transition-all duration-500 ease-out flex flex-col"
            >
                {/* Persistent Studio Beat Audio */}
                <audio ref={beatAudioRef} src={uploadedBeat || undefined} className="hidden" crossOrigin="anonymous" />

                {/* Persistent Vocal Session Audio */}
                <audio
                    ref={vocalAudioRef}
                    src={sessions.length > 0 ? (sessions.find(s => s.id === activeSessionId)?.audioUrl || sessions.find(s => s.id === activeSessionId)?.base64 || sessions[0]?.audioUrl || sessions[0]?.base64 || undefined) : undefined}
                    onLoadedMetadata={e => {
                        setDuration(e.currentTarget.duration);
                        if (pendingPlayRef.current) {
                            pendingPlayRef.current = false;
                            const seekTime = pendingSeekRef.current;
                            pendingSeekRef.current = null;
                            if (seekTime !== null) seekTo(seekTime);
                            togglePlayback(true);
                        }
                    }}
                    onEnded={() => {
                        setIsPlaying(false);
                        setIsBeatPlaying(false);
                        beatAudioCtxRef.current?.suspend();
                        if (beatAudioRef.current) {
                            beatAudioRef.current.pause();
                            const session = sessionsRef.current.find(s => s.id === activeSessionIdRef.current)
                                ?? sessionsRef.current[0];
                            if (beatAudioRef.current.readyState >= 1) {
                                beatAudioRef.current.currentTime = session?.beatOffset ?? 0;
                            }
                        }
                    }}
                    className="hidden"
                />

                <div className="flex-1 overflow-hidden">
                    {getActiveView()}
                </div>

                <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] transition-all duration-500 bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-2.5 rounded-full flex items-center gap-8 shadow-[0_12px_40px_rgba(0,0,0,0.6)] ${showRecorder && !recorderMinimized ? 'opacity-0 translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                    <button
                        onClick={() => setViewMode('collection')}
                        className={`p-2 rounded-full transition-all active:scale-95 ${viewMode === 'collection' ? 'text-[var(--accent)]' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Library"
                    >
                        <Library className="h-6 w-6" />
                    </button>
                    {viewMode === 'studio' ? (
                        <button
                            onClick={() => {
                                setShowRecorder(true);
                                setRecorderMinimized(true);
                                setRecorderAutoStart(isBeatPlaying);
                            }}
                            className="p-2 rounded-full transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                            title="Record"
                        >
                            <div className="w-6 h-6 rounded-full border-2 border-red-500 flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
                            </div>
                        </button>
                    ) : (
                        <button
                            onClick={() => setViewMode('studio')}
                            className="p-2 rounded-full transition-all active:scale-95 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                            title="Studio"
                        >
                            <Disc className="h-6 w-6" />
                        </button>
                    )}
                    <button
                        onClick={() => setViewMode('vault')}
                        className={`p-2 rounded-full transition-all active:scale-95 ${viewMode === 'vault' ? 'text-[var(--accent)]' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Virtual Vault"
                    >
                        <History className="h-6 w-6" />
                    </button>
                </nav>
            </main>

            {showRecorder && (
                <RecorderDrawer
                    onClose={() => { setShowRecorder(false); setRecorderAutoStart(false); setLayerModeSessionId(null); }}
                    onSave={handleSaveRecordingSession}
                    isMinimized={recorderMinimized}
                    onMinimizeToggle={() => setRecorderMinimized(!recorderMinimized)}
                    backingTrackSrc={uploadedBeat}
                    backingAudioRef={beatAudioRef}
                    onResumeBeatAudio={() => { beatAudioCtxRef.current?.resume(); setIsBeatPlaying(true); }}
                    autoStart={recorderAutoStart}
                    latencyCompensation={latencyCompensation}
                    beatVolume={beatVolume}
                    loopStart={beatLoopStart}
                    loopEnd={beatLoopEnd}
                    isLooping={isBeatLooping}
                    layerMode={!!layerModeSessionId}
                    existingLayers={layerModeSessionId ? sessions.find(s => s.id === layerModeSessionId)?.layers || [] : []}
                    parentAudioUrl={layerModeSessionId ? sessions.find(s => s.id === layerModeSessionId)?.audioUrl || null : null}
                />
            )}

            {/* Music Player Modal */}
            <AnimatePresence>
                {showMusicPlayer && (
                    <MusicPlayer
                        onClose={() => setShowMusicPlayer(false)}
                        beatSrc={uploadedBeat}
                        vocalSessions={sessions}
                        projectTitle={projectTitle || "Untitled"}
                    />
                )}
            </AnimatePresence>

            {/* Vocal FX Panel */}
            <AnimatePresence>
                {showFXPanel && (
                    <FXPanel
                        onClose={() => setShowFXPanel(false)}
                        settings={fxSettings}
                        onUpdate={(key, value) => setFxSettings(prev => ({ ...prev, [key]: value }))}
                    />
                )}
            </AnimatePresence>

            {showSearch && (
                <div className="fixed inset-0 z-[200] bg-[var(--bg-main)]/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                    <div className="max-w-lg mx-auto h-full flex flex-col pt-[env(safe-area-inset-top)]">
                        <div className="px-6 pt-8 pb-6 flex items-center gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={18} />
                                <input
                                    autoFocus
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search songs, lyrics, recordings, beats..."
                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-[var(--accent)] transition-all"
                                />
                            </div>
                                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-[var(--text-secondary)]"><X size={20} /></button>
                        </div>

                        <div className="px-6 flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                            {['all', 'songs', 'sections', 'recordings', 'beats'].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setSearchFilter(f as SearchFilter)}
                                    className={`px-4 py-1.5 rounded-full text-xs mono uppercase tracking-wider border transition-all whitespace-nowrap ${searchFilter === f ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--bg-main)]' : 'bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-secondary)]'}`}
                                >{f}</button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 pb-20 space-y-2">
                            {searchResults.map((res) => (
                                <button
                                    key={`${res.type}-${res.id}`}
                                    onClick={() => {
                                        if (res.type === 'song') loadProject(res.raw);
                                        if (res.type === 'recording') handlePlaySession(res.id);
                                        if (res.type === 'beat') handlePlayBeat(res.id);
                                        if (res.type === 'section') { setViewMode('studio'); }
                                        setShowSearch(false);
                                    }}
                                    className="w-full text-left bg-[var(--bg-card)] border border-[var(--border-main)] p-4 rounded-xl hover:bg-[var(--bg-hover)] transition-all flex items-center justify-between group"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs mono px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--accent)] uppercase">{res.type}</span>
                                            <h4 className="text-sm font-medium text-[var(--text-main)] truncate">{res.title}</h4>
                                        </div>
                                        <p className="text-xs text-[var(--text-secondary)] line-clamp-1">{res.desc}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}


            {showTour && (
                <OnboardingTour
                    onComplete={handleTourComplete}
                    setViewMode={setViewMode}
                    setShowRecorder={setShowRecorder}
                    setRecorderMinimized={setRecorderMinimized}
                    viewMode={viewMode}
                />
            )}
        </div>
    );
};

export default StudioWorkspace;
