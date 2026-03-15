"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LyricSection, LyricScrap, RecordingSession, AutoSection, SectionType, Beat, SavedProject } from '../../types';
import { randomId } from '@/lib/utils/id';
import { LyricCard } from './LyricCard';
import { RecorderDrawer } from './RecorderDrawer';
import { MusicPlayer } from './MusicPlayer';
import { PuzzleView } from './PuzzleView';
import { BeatUploader } from './BeatUploader';
import { FeedbackModal } from './FeedbackModal';
import { OnboardingTour } from './OnboardingTour';
import { RecordingThread } from './RecordingThread';
import { SplitEditor } from './SplitEditor';
import { analyzeAudioAndSplit } from '@/lib/audio/smartSplit';
import { analyzeAudioWithGemini } from '@/lib/audio/audioIntelligence';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutGrid,
    PenTool,
    Library,
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
    Save,
    Mic,
    FileMusic,
    History,
    Type
} from 'lucide-react';
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

type ViewMode = 'collection' | 'studio' | 'board' | 'settings';
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
        title={label}
        className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${active
            ? 'bg-[var(--bg-secondary)] text-[var(--text-main)] border border-[var(--border-main)] shadow-sm scale-100 opacity-100'
            : 'text-[var(--text-secondary)] border border-transparent hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] scale-90 opacity-60 hover:opacity-100 hover:scale-100'
            }`}
    >
        {icon}
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
                    <p className="text-[10px] mono text-[var(--text-tertiary)]">{project.lastModified}</p>
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
                        <p className="text-[10px] mono text-[var(--text-tertiary)]">{beat.duration}</p>
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onWrite(); }} className="px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] text-[10px] mono uppercase tracking-wider text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] transition-all">Write</button>
            </div>
        </div>
    );
};

const MISSION_PROJECT: SavedProject = {
    id: 'mission-001',
    name: 'Mission: Flow to Write',
    lastModified: new Date().toLocaleDateString(),
    sections: [
        { id: 'mission-v1', type: 'verse', repeats: 1, text: "" }
    ],
    scraps: [],
    sessions: [],
    beats: []
};

const StudioWorkspace: React.FC = () => {
    const [theme, setTheme] = useState<Theme>('dark');
    const [viewMode, setViewMode] = useState<ViewMode>('studio');
    const [libraryTab, setLibraryTab] = useState<LibraryTab>('songs');

    const [showRecorder, setShowRecorder] = useState(false);
    const [recorderMinimized, setRecorderMinimized] = useState(false);
    const [recorderAutoStart, setRecorderAutoStart] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [showMusicPlayer, setShowMusicPlayer] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
    const [uploadedBeat, setUploadedBeat] = useState<string | null>(null);
    const [uploadedBeatName, setUploadedBeatName] = useState<string>("");
    const [saveIndicator, setSaveIndicator] = useState<'idle' | 'saving' | 'saved'>('idle');

    const [fabOpen, setFabOpen] = useState(false);
    const fabInputRef = useRef<HTMLInputElement>(null);
    const beatAudioRef = useRef<HTMLAudioElement>(null);

    const [projectTitle, setProjectTitle] = useState("");
    const [projectBpm, setProjectBpm] = useState("120");
    const [projectKey, setProjectKey] = useState("C Min");

    const [sections, setSections] = useState<LyricSection[]>([
        { id: 'init-verse', type: 'verse', repeats: 1, text: '' }
    ]);
    const [scraps, setScraps] = useState<LyricScrap[]>([]);


    const [recordingTargetLineId, setRecordingTargetLineId] = useState<string | null>(null);

    const [sessions, setSessions] = useState<RecordingSession[]>([]);
    const [activeTab, setActiveTab] = useState<'lyrics' | 'recordings'>('lyrics');
    const [splitEditorOpen, setSplitEditorOpen] = useState(false);
    const [recordingToSplit, setRecordingToSplit] = useState<string | null>(null);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [playingSessionId, setPlayingSessionId] = useState<string | null>(null);

    const [beats, setBeats] = useState<Beat[]>([]);
    const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
    const [playingBeatId, setPlayingBeatId] = useState<string | null>(null);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const globalAudioRef = useRef<HTMLAudioElement | null>(null);

    // Persistent Beat Playback State (Lifted from BeatUploader)
    const [isBeatPlaying, setIsBeatPlaying] = useState(false);
    const [beatVolume, setBeatVolume] = useState(1);
    const [beatLoopStart, setBeatLoopStart] = useState<number | null>(null);
    const [beatLoopEnd, setBeatLoopEnd] = useState<number | null>(null);
    const [isBeatLooping, setIsBeatLooping] = useState(true);

    const [showTour, setShowTour] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && !localStorage.getItem('lyriq-tour-completed')) {
            setShowTour(true);
        }
    }, []);

    const handleTourComplete = () => {
        localStorage.setItem('lyriq-tour-completed', 'true');
        setShowTour(false);
        setViewMode('studio');
        setSections([{ id: 'fresh-start', type: 'verse', repeats: 1, text: '' }]);
        setProjectTitle('');
    };

    // Persistence Load
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const loadState = async () => {
            const savedData = localStorage.getItem('studio-pro-data-v2');
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);

                    // Migration: clear old mock text from mission project
                    if (parsed.sections && parsed.sections.some((s: LyricSection) =>
                        s.text.includes("Hit play on the beat") || s.text.includes("switch to 'Studio' mode")
                    )) {
                        // Old mock text detected, reset to empty
                        setSections([{ id: 'fresh-start', type: 'verse', repeats: 1, text: '' }]);
                        setProjectTitle('');
                    } else if (parsed.sections && parsed.sections.some((s: LyricSection) => s.text.trim().length > 0)) {
                        setSections(parsed.sections);
                        if (parsed.projectTitle !== undefined) setProjectTitle(parsed.projectTitle);
                    } else {
                        // Default to empty project
                        setSections(MISSION_PROJECT.sections);
                        setProjectTitle('');
                    }
                    if (parsed.scraps) setScraps(parsed.scraps);

                    let loadedProjects: SavedProject[] = parsed.savedProjects || [];
                    // Also clean mission project from saved list if it has old mock text
                    loadedProjects = loadedProjects.filter((p: SavedProject) =>
                        !(p.id === 'mission-001' && p.sections?.some(s =>
                            s.text.includes("Hit play on the beat") || s.text.includes("switch to 'Studio' mode")
                        ))
                    );
                    if (!loadedProjects.find((p: SavedProject) => p.id === MISSION_PROJECT.id)) {
                        loadedProjects = [MISSION_PROJECT, ...loadedProjects];
                    }
                    setSavedProjects(loadedProjects);

                    if (parsed.projectBpm) setProjectBpm(parsed.projectBpm);
                    if (parsed.projectKey) setProjectKey(parsed.projectKey);

                    if (parsed.sessions) {
                        const loadedSessions = await Promise.all(parsed.sessions.map(async (t: RecordingSession) => {
                            try {
                                const b64 = await getAudioData(t.id);
                                const url = b64 ? URL.createObjectURL(await base64ToBlob(b64)) : undefined;
                                return { ...t, base64: b64, audioUrl: url };
                            } catch (e) {
                                console.error(`Failed to load audio for session ${t.id}`, e);
                                return t;
                            }
                        }));
                        setSessions(loadedSessions);
                    } else if (parsed.takes) {
                        // Migration handle
                        setSessions([]);
                    }

                    if (parsed.beats) {
                        const loadedBeats = await Promise.all(parsed.beats.map(async (b: Beat) => {
                            try {
                                const b64 = await getAudioData(b.id);
                                const url = b64 ? URL.createObjectURL(await base64ToBlob(b64)) : undefined;
                                return { ...b, base64: b64, audioUrl: url };
                            } catch (e) {
                                console.error(`Failed to load audio for beat ${b.id}`, e);
                                return b;
                            }
                        }));
                        setBeats(loadedBeats);
                    }
                    if (parsed.activeProjectId) setActiveProjectId(parsed.activeProjectId);
                } catch (e) { console.error("Failed to load saved state", e); }
            }
        };
        loadState();
    }, []);

    // Persistence Save with indicator
    const saveTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        setSaveIndicator('saving');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const sessionsToSave = sessions.map(({ audioUrl: _aUrl, base64: _b64, ...rest }) => rest);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const beatsToSave = beats.map(({ audioUrl: _aUrl, base64: _b64, ...rest }) => rest);
        const dataToSave = {
            sections, scraps, savedProjects,
            projectTitle, projectBpm, projectKey,
            sessions: sessionsToSave, beats: beatsToSave,
            activeProjectId
        };
        try { localStorage.setItem('studio-pro-data-v2', JSON.stringify(dataToSave)); }
        catch (e) { console.error("Storage full or error", e); }
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = window.setTimeout(() => setSaveIndicator('saved'), 300);
    }, [sections, scraps, savedProjects, projectTitle, projectBpm, projectKey, sessions, beats, activeProjectId]);

    const handleRecordStart = (lineId?: string) => {
        setRecordingTargetLineId(lineId || null);
        setRecorderMinimized(true);
        setShowRecorder(true);
    };

    const handleSaveRecordingSession = async (blob: Blob, duration: number, beatOffset?: number) => {
        const url = URL.createObjectURL(blob);
        const base64 = await blobToBase64(blob);
        const id = randomId().substring(0, 6).toUpperCase();
        await saveAudioData(id, base64);

        const timestamp = new Date().toISOString();

        let sections: AutoSection[] = [];
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            const isLoopSession = isBeatLooping && beatLoopStart !== null && beatLoopEnd !== null;
            const passes = isLoopSession && beatLoopStart !== null && beatLoopEnd !== null
                ? Math.max(1, Math.ceil(duration / (beatLoopEnd - beatLoopStart)))
                : 1;

            sections = await analyzeAudioAndSplit(audioBuffer, {
                isLoopSession,
                loopStart: beatLoopStart || 0,
                loopEnd: beatLoopEnd || 0,
                passCount: Math.ceil(passes)
            });
        } catch (err) {
            console.error("Failed to split recording automatically", err);
        }

        const newSession: RecordingSession = {
            id, name: `Recording ${sessions.length + 1}`, timestamp, duration, audioUrl: url, base64: base64, beatOffset: beatOffset,
            isLoopSession: !!uploadedBeat && isBeatLooping,
            sections,
            loopStart: beatLoopStart || undefined,
            loopEnd: beatLoopEnd || undefined
        };
        setSessions(prev => [newSession, ...prev]);

        if (recordingTargetLineId) {
            setRecordingTargetLineId(null);
        }

        const hasApiKey = !!process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

        if (hasApiKey) {
            toast.success('Recording saved! AI analyzing...');
            // Background AI refinement
            analyzeAudioWithGemini(base64).then(aiResult => {
                if (aiResult) {
                    setSessions(prev => prev.map(s => {
                        if (s.id === id) {
                            return {
                                ...s,
                                transcription: aiResult.transcription || s.transcription,
                                sections: aiResult.sections.length > 0
                                    ? aiResult.sections.map(ais => ({
                                        id: randomId(),
                                        startTime: ais.startTime,
                                        endTime: ais.endTime,
                                        type: ais.type,
                                        label: ais.label,
                                        emojiTag: ais.emojiTag,
                                        isBest: false,
                                        isFavorited: false
                                    }))
                                    : s.sections
                            };
                        }
                        return s;
                    }));
                    toast.success('✨ AI refined your recording!');
                }
            }).catch(err => {
                console.error("AI refinement failed:", err);
            });
        } else {
            // No toast message here anymore
        }
    };



    const handlePlaySession = (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return;
        if (playingSessionId === sessionId) {
            globalAudioRef.current?.pause();
            setPlayingSessionId(null);
        } else {
            if (globalAudioRef.current) globalAudioRef.current.pause();
            const audio = new Audio(session.audioUrl || session.base64);
            audio.onended = () => setPlayingSessionId(null);
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
            if (isBeatLooping) {
                const start = beatLoopStart ?? 0;
                const end = beatLoopEnd ?? audio.duration;
                if (audio.currentTime >= end && end > 0) {
                    audio.currentTime = start;
                }
            }
        };

        const onEnded = () => {
            if (isBeatLooping) {
                audio.currentTime = beatLoopStart ?? 0;
                audio.play().catch(console.error);
            } else {
                setIsBeatPlaying(false);
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', onEnded);
        audio.volume = beatVolume;

        if (isBeatPlaying) {
            if (audio.paused && audio.src) {
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
    }, [isBeatPlaying, isBeatLooping, beatLoopStart, beatLoopEnd, beatVolume, uploadedBeat]);

    const archiveCurrentProject = () => {
        if (sections.length === 0 && scraps.length === 0) return;
        const newProject: SavedProject = {
            id: randomId(),
            name: projectTitle || "Untitled Project",
            lastModified: new Date().toLocaleDateString(),
            sections, scraps, sessions, beats: []
        };
        setSavedProjects(prev => [newProject, ...prev]);
    };

    const handleStartFromScrap = (text: string, type: SectionType) => {
        if (sections.length > 1 || sections[0].text.trim() !== '') {
            if (confirm("Start new project with this section? Current work will be saved to library.")) {
                archiveCurrentProject();
            } else {
                return;
            }
        }

        setSections([{
            id: randomId(),
            type: type,
            repeats: 1,
            text: text
        }]);

        setSessions([]);
        setActiveSessionId(null);
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
            setSections([{ id: randomId(), type: 'verse', repeats: 1, text: "" }]);
            setScraps([]);
            setSessions([]);
            setActiveSessionId(null);
            setProjectTitle("");
            setUploadedBeat(null);
            setActiveProjectId(null);
        }
    };

    const handleNewProject = () => {
        if (confirm("Start a clean project? Current work will be archived.")) {
            archiveCurrentProject();
            setSections([{ id: randomId(), type: 'verse', repeats: 1, text: "" }]);
            setScraps([]);
            setSessions([]);
            setActiveSessionId(null);
            setProjectTitle("");
            setUploadedBeat(null);
            setActiveProjectId(null);
            setViewMode('studio');
        }
    };

    const loadProject = (p: SavedProject) => {
        if (window.confirm(`Load "${p.name}"? Workspace will sync.`)) {
            setSections(p.sections || []);
            setScraps(p.scraps || []);
            setSessions(p.sessions || []);
            setActiveSessionId(null);
            setProjectTitle(p.name === "Untitled Project" ? "" : p.name);
            setUploadedBeat(p.beats?.[0]?.audioUrl || null);
            setUploadedBeatName(p.beats?.[0]?.name || "");
            setActiveProjectId(p.id);
            setViewMode('studio');
            setShowSearch(false);
        }
    };

    const handleStartProjectFromBeat = (beat: Beat) => {
        if (globalAudioRef.current) globalAudioRef.current.pause();
        setPlayingBeatId(null);
        archiveCurrentProject();
        setSections([{ id: randomId(), type: 'verse', repeats: 1, text: "" }]);
        setScraps([]);
        setSessions([]);
        setActiveSessionId(null);
        setProjectTitle(beat.name);
        setUploadedBeat(beat.audioUrl || null);
        setUploadedBeatName(beat.name);
        setActiveProjectId(null);
        setViewMode('studio');
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

        if (searchFilter === 'all' || searchFilter === 'songs') {
            savedProjects.forEach(p => {
                const nameMatch = p.name.toLowerCase().includes(q);
                const lyricsMatch = p.sections.some(s => s.text.toLowerCase().includes(q));
                if (nameMatch || lyricsMatch) {
                    const matchedLine = lyricsMatch && !nameMatch
                        ? p.sections.find(s => s.text.toLowerCase().includes(q))?.text.split('\n').find(l => l.toLowerCase().includes(q))
                        : undefined;
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
                if (s.text.toLowerCase().includes(q)) {
                    const matchedLine = s.text.split('\n').find(l => l.toLowerCase().includes(q)) || '';
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
                            <h1 className="text-2xl font-medium tracking-tight text-[var(--text-main)] display">Settings</h1>
                        </div>
                        <div className="space-y-8 overflow-y-auto pb-20">
                            <section>
                                <h2 className="text-[10px] mono uppercase tracking-widest text-[var(--text-secondary)] mb-4">Appearance</h2>
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
                                <h2 className="text-[10px] mono uppercase tracking-widest text-[var(--text-secondary)] mb-4">Help</h2>
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
            case 'collection':
                return (
                    <div className="h-full flex flex-col pt-12">
                        <div className="px-6 mb-8 flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-medium tracking-tight text-[var(--text-main)] mb-6 display">Library</h1>
                                <div className="flex border-b border-[var(--border-main)]">
                                    <button onClick={() => setLibraryTab('songs')} className={`pb-3 pr-6 text-[11px] mono uppercase tracking-wider transition-all ${libraryTab === 'songs' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Projects</button>
                                    <button onClick={() => setLibraryTab('beats')} className={`pb-3 px-6 text-[11px] mono uppercase tracking-wider transition-all ${libraryTab === 'beats' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Beats</button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowFeedback(true)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--accent)] bg-[var(--bg-secondary)] border border-[var(--border-main)] transition-all shadow-sm active:scale-95"><MessageSquare size={16} fill="currentColor" /></button>
                                <button onClick={() => setViewMode('settings')} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"><Settings size={18} /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 space-y-2 pb-32 scrollbar-hide">
                            {libraryTab === 'beats' && (
                                <div className="space-y-4">
                                    {beats.map((beat, index) => (
                                        <motion.div
                                            key={beat.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05, duration: 0.2 }}
                                        >
                                            <SwipeableBeatCard
                                                beat={beat}
                                                isPlaying={playingBeatId === beat.id}
                                                onPlay={() => handlePlayBeat(beat.id)}
                                                onWrite={() => handleStartProjectFromBeat(beat)}
                                                onDelete={() => handleDeleteBeat(beat.id)}
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                            {libraryTab === 'songs' && (
                                <div className="space-y-4">
                                    {savedProjects.map((p, index) => (
                                        <motion.div
                                            key={p.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05, duration: 0.2 }}
                                        >
                                            <SwipeableProjectCard project={p} onClick={() => loadProject(p)} onDelete={() => deleteProject(p.id)} />
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="absolute bottom-24 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
                            <div className="pointer-events-auto flex flex-col items-end gap-3">
                                <div className={`flex flex-col items-end gap-3 transition-all duration-300 ease-out origin-bottom-right ${fabOpen ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-8 scale-95 pointer-events-none'}`}>
                                    <button onClick={handleNewProject} className="flex items-center gap-3 group">
                                        <span className={`bg-[var(--bg-card)] border border-[var(--border-main)] px-2 py-1.5 rounded text-[10px] mono uppercase tracking-wider text-[var(--text-main)] shadow-lg transition-transform duration-300 ${fabOpen ? 'translate-x-0 opacity-100 delay-100' : 'translate-x-4 opacity-0'}`}>New Project</span>
                                        <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shadow-lg border border-[var(--border-main)] group-hover:bg-[var(--bg-hover)] group-active:scale-95 transition-all"><FilePlus size={16} /></div>
                                    </button>
                                    <button onClick={() => fabInputRef.current?.click()} className="flex items-center gap-3 group">
                                        <span className={`bg-[var(--bg-card)] border border-[var(--border-main)] px-2 py-1.5 rounded text-[10px] mono uppercase tracking-wider text-[var(--text-main)] shadow-lg transition-transform duration-300 ${fabOpen ? 'translate-x-0 opacity-100 delay-75' : 'translate-x-4 opacity-0'}`}>Import Beat</span>
                                        <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shadow-lg border border-[var(--border-main)] group-hover:bg-[var(--bg-hover)] group-active:scale-95 transition-all"><Music size={16} /></div>
                                        <input ref={fabInputRef} type="file" accept="audio/*, .mp3, .wav" className="hidden" onChange={handleLibraryBeatUpload} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => setFabOpen(!fabOpen)}
                                    className="w-14 h-14 bg-[var(--accent)] text-[var(--bg-main)] rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
                                >
                                    {fabOpen ? <X size={28} strokeWidth={2.5} /> : <Plus size={28} strokeWidth={2.5} />}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'board':
                return (
                    <PuzzleView
                        scraps={scraps}
                        onAdd={(text, type) => setScraps([{ id: String(Date.now()), text, type }, ...scraps])}
                        onUpdateType={(id, type) => setScraps(prev => prev.map(s => s.id === id ? { ...s, type } : s))}
                        onStartProject={(text, type) => handleStartFromScrap(text, type)}
                        onSendToStudio={(text) => {
                            setSections(prev => [...prev, { id: randomId(), type: 'verse', repeats: 1, text }]);
                            setViewMode('studio');
                            toast.success('Idea added to your current project.');
                        }}
                        onUpdateTags={(id, tags) => setScraps(prev => prev.map(s => s.id === id ? { ...s, tags } : s))}
                    />
                );
            case 'studio':
                return (
                    <div className="h-full flex flex-col relative">
                        <div className="glass z-20 sticky top-0 border-b border-[var(--border-main)]">
                            <div className="px-6 py-4">
                                <div className="flex items-center justify-between gap-4">
                                    {/* Left: Title and Save Status */}
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="max-w-[240px] flex-1">
                                            <input
                                                value={projectTitle}
                                                onChange={(e) => setProjectTitle(e.target.value)}
                                                className="bg-transparent border-none text-xl font-bold text-[var(--text-main)] focus:outline-none w-full placeholder:text-[var(--text-tertiary)] truncate"
                                                placeholder="Untitled Project"
                                            />
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
                                            onUpload={async (file) => {
                                                const url = URL.createObjectURL(file);
                                                setUploadedBeat(url);
                                                const name = file.name.replace(/\.\w+$/, '');
                                                setUploadedBeatName(name);

                                                // Also add to Library beats
                                                const base64 = await blobToBase64(file);
                                                const id = randomId();
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
                                                        if (prev.some(b => b.name === name)) return prev;
                                                        return [newBeat, ...prev];
                                                    });
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
                            <div className="flex border-b border-[var(--border-main)] sticky top-0 bg-[var(--bg-main)] z-10 px-6">
                                <button onClick={() => setActiveTab('lyrics')} className={`pb-3 pr-6 pt-3 text-[11px] mono uppercase tracking-wider transition-all ${activeTab === 'lyrics' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Lyrics</button>
                                <button onClick={() => setActiveTab('recordings')} className={`pb-3 px-6 pt-3 text-[11px] mono uppercase tracking-wider transition-all ${activeTab === 'recordings' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Recordings</button>
                            </div>

                            <div className="absolute inset-0 overflow-y-auto px-6 py-8 pb-40 scrollbar-hide bg-[var(--bg-main)] mt-12">
                                <div className="max-w-2xl mx-auto space-y-12">
                                    {activeTab === 'lyrics' ? (
                                        <>
                                            {sections.map((section, idx) => (
                                                <motion.div key={section.id} id={idx === 0 ? 'tour-lyric-card' : undefined} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                                                    <LyricCard
                                                        section={section}
                                                        onUpdate={updateSection}
                                                        onDelete={deleteSection}
                                                        onMove={moveSection}
                                                    />
                                                </motion.div>
                                            ))}
                                            <button
                                                onClick={addSection}
                                                className="w-full py-6 flex items-center justify-center gap-4 text-[11px] mono uppercase tracking-[0.3em] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all group relative active:scale-95 focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] rounded-lg"
                                            >
                                                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[var(--border-main)] to-[var(--border-focus)] opacity-30 group-hover:opacity-100 transition-all duration-500" />
                                                <span className="px-4 group-hover:scale-110 group-hover:tracking-[0.4em] transition-all duration-500 font-medium">+ Add Section</span>
                                                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[var(--border-main)] to-[var(--border-focus)] opacity-30 group-hover:opacity-100 transition-all duration-500" />
                                            </button>
                                        </>
                                    ) : (
                                        <RecordingThread
                                            sessions={sessions}
                                            activeSessionId={activeSessionId}
                                            onSelectSession={(id) => setActiveSessionId(prev => prev === id ? null : id)}
                                            onUpdateSession={(id, updates) => setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))}
                                            onUpdateSection={(sessionId, sectionId, updates) => setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, sections: s.sections?.map(sec => sec.id === sectionId ? { ...sec, ...updates } : sec) } : s))}
                                            onOpenSplitEditor={(id) => {
                                                setRecordingToSplit(id);
                                                setSplitEditorOpen(true);
                                            }}
                                            onDeleteSession={handleDeleteSession}
                                            beatSrc={uploadedBeat}
                                            beatVolume={beatVolume}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default: return null;
        }
    };


    return (
        <div className="h-screen w-full bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col items-center overflow-hidden select-none transition-colors duration-500" data-theme={theme}>
            <main
                className="w-full flex-1 max-w-lg relative bg-[var(--bg-main)] border-x border-[var(--border-main)] shadow-2xl transition-all duration-500 ease-out"
            >
                {/* Persistent Studio Beat Audio */}
                <audio ref={beatAudioRef} src={uploadedBeat || undefined} className="hidden" />

                {getActiveView()}


                {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

                {showSearch && (
                    <div className="absolute inset-0 z-[100] bg-[var(--bg-main)] animate-in fade-in zoom-in-95 duration-300">
                        <div className="max-w-lg mx-auto h-full flex flex-col">
                            <div className="px-6 pt-12 pb-6 flex items-center gap-4">
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
                                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="text-[var(--text-secondary)]"><X size={20} /></button>
                            </div>

                            <div className="px-6 flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                                {['all', 'songs', 'sections', 'recordings', 'beats'].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setSearchFilter(f as SearchFilter)}
                                        className={`px-4 py-1.5 rounded-full text-[10px] mono uppercase tracking-wider border transition-all whitespace-nowrap ${searchFilter === f ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--bg-main)]' : 'bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-secondary)]'}`}
                                    >{f}</button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-2">
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
                                                <span className="text-[9px] mono px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--accent)] uppercase">{res.type}</span>
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

                <nav className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] transition-all duration-500 ${showRecorder && !recorderMinimized ? 'opacity-0 scale-90 translate-y-12' : 'opacity-100 scale-100 translate-y-0'}`}>
                    <div className="glass-nav px-2 py-2 rounded-2xl flex items-center gap-1 shadow-2xl border border-[var(--border-main)] backdrop-blur-3xl">
                        <NavBtn id="tour-nav-library" active={viewMode === 'collection'} onClick={() => setViewMode('collection')} icon={<Library size={20} />} label="Library" />
                        <NavBtn id="tour-nav-studio" active={viewMode === 'studio'} onClick={() => setViewMode('studio')} icon={<PenTool size={20} />} label="Studio" />
                        <div className="w-[1px] h-6 bg-[var(--border-main)] mx-1" />
                        <button
                            id="tour-nav-record"
                            onClick={() => {
                                setShowRecorder(true);
                                setRecorderMinimized(true);
                                setRecorderAutoStart(isBeatPlaying);
                            }}
                            className="w-12 h-12 bg-[var(--accent)] text-[var(--bg-main)] rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all mx-1"
                        >
                            <div className="w-3 h-3 rounded-full bg-current" />
                        </button>
                        <div className="w-[1px] h-6 bg-[var(--border-main)] mx-1" />
                        <NavBtn id="tour-nav-board" active={viewMode === 'board'} onClick={() => setViewMode('board')} icon={<LayoutGrid size={20} />} label="Board" />
                        <NavBtn active={showSearch} onClick={() => setShowSearch(true)} icon={<Search size={20} />} label="Search" />
                    </div>
                </nav>
            </main>

            {showRecorder && (
                <RecorderDrawer
                    onClose={() => { setShowRecorder(false); setRecorderAutoStart(false); }}
                    onSave={handleSaveRecordingSession}
                    isMinimized={recorderMinimized}
                    onMinimizeToggle={() => setRecorderMinimized(!recorderMinimized)}
                    backingTrackSrc={uploadedBeat}
                    backingAudioRef={beatAudioRef}
                    autoStart={recorderAutoStart}
                />
            )}

            {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

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

            {showSearch && (
                <div className="fixed inset-0 z-[100] bg-[var(--bg-main)] animate-in fade-in zoom-in-95 duration-300">
                    <div className="max-w-lg mx-auto h-full flex flex-col">
                        <div className="px-6 pt-12 pb-6 flex items-center gap-4">
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
                            <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="text-[var(--text-secondary)]"><X size={20} /></button>
                        </div>

                        <div className="px-6 flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                            {['all', 'songs', 'sections', 'recordings', 'beats'].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setSearchFilter(f as SearchFilter)}
                                    className={`px-4 py-1.5 rounded-full text-[10px] mono uppercase tracking-wider border transition-all whitespace-nowrap ${searchFilter === f ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--bg-main)]' : 'bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-secondary)]'}`}
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
                                            <span className="text-[9px] mono px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--accent)] uppercase">{res.type}</span>
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
