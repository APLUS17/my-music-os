"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LyricSection, LyricScrap, VoiceTake, SectionType, SandboxLine, Beat, SavedProject } from '../../types';
import { LyricCard } from './LyricCard';
import { RecorderDrawer } from './RecorderDrawer';
import { SandboxView } from './SandboxView';
import { PuzzleView } from './PuzzleView';
import { VoiceMemoView } from './VoiceMemoView';
import { BeatUploader } from './BeatUploader';
import { MuseDrawer } from './MuseDrawer';
import {
    LayoutGrid,
    Mic,
    PenTool,
    Library,
    Search,
    Zap,
    X,
    ChevronRight,
    Settings,
    Check,
    Plus,
    Music,
    Upload,
    FilePlus,
    Share,
    Hash,
    Lightbulb,
    Disc,
    FileText,
    Play,
    Pause,
    ArrowRight,
    Trash2
} from 'lucide-react';

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

type ViewMode = 'collection' | 'studio' | 'board' | 'settings';
type StudioMode = 'flow' | 'arrange';
type LibraryTab = 'songs' | 'beats';
type Theme = 'dark' | 'light' | 'midnight' | 'cassette' | 'ethereal';
type SearchFilter = 'all' | 'songs' | 'sections' | 'takes' | 'beats';

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
}

const NavBtn = ({ active, onClick, icon, label }: NavBtnProps) => (
    <button
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
                className="relative z-10 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg p-4 flex items-center justify-between transition-transform duration-200 ease-out active:bg-[var(--bg-hover)] touch-pan-y"
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

const StudioWorkspace: React.FC = () => {
    const [theme, setTheme] = useState<Theme>('dark');
    const [viewMode, setViewMode] = useState<ViewMode>('studio');
    const [studioMode, setStudioMode] = useState<StudioMode>('arrange');
    const [libraryTab, setLibraryTab] = useState<LibraryTab>('songs');

    const [showRecorder, setShowRecorder] = useState(false);
    const [recorderMinimized, setRecorderMinimized] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showMuse, setShowMuse] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
    const [uploadedBeat, setUploadedBeat] = useState<string | null>(null);

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

    const [sandboxLines, setSandboxLines] = useState<SandboxLine[]>([{ id: 'init', text: '' }]);
    const [recordingTargetLineId, setRecordingTargetLineId] = useState<string | null>(null);

    const [takes, setTakes] = useState<VoiceTake[]>([]);
    const [beats, setBeats] = useState<Beat[]>([]);
    const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
    const [playingTakeId, setPlayingTakeId] = useState<string | null>(null);
    const [playingBeatId, setPlayingBeatId] = useState<string | null>(null);
    const globalAudioRef = useRef<HTMLAudioElement | null>(null);

    // Persistence Load
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const loadState = async () => {
            const savedData = localStorage.getItem('studio-pro-data-v2');
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);

                    if (parsed.sections && parsed.sections.length > 0) {
                        setSections(parsed.sections);
                    } else {
                        setSections([{ id: 'init-verse', type: 'verse', repeats: 1, text: '' }]);
                    }
                    if (parsed.scraps) setScraps(parsed.scraps);
                    if (parsed.sandboxLines) setSandboxLines(parsed.sandboxLines);
                    if (parsed.savedProjects) setSavedProjects(parsed.savedProjects);
                    if (parsed.projectTitle !== undefined) setProjectTitle(parsed.projectTitle);
                    if (parsed.projectBpm) setProjectBpm(parsed.projectBpm);
                    if (parsed.projectKey) setProjectKey(parsed.projectKey);

                    if (parsed.takes) {
                        const loadedTakes = await Promise.all(parsed.takes.map(async (t: VoiceTake) => {
                            try {
                                const b64 = await getAudioData(t.id);
                                const url = b64 ? URL.createObjectURL(await base64ToBlob(b64)) : undefined;
                                return { ...t, base64: b64, audioUrl: url };
                            } catch (e) {
                                console.error(`Failed to load audio for take ${t.id}`, e);
                                return t;
                            }
                        }));
                        setTakes(loadedTakes);
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
                } catch (e) { console.error("Failed to load saved state", e); }
            }
        };
        loadState();
    }, []);

    // Persistence Save
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const takesToSave = takes.map(({ audioUrl, base64, ...rest }) => rest);
        const beatsToSave = beats.map(({ audioUrl, base64, ...rest }) => rest);
        const dataToSave = {
            sections, scraps, sandboxLines, savedProjects,
            projectTitle, projectBpm, projectKey,
            takes: takesToSave, beats: beatsToSave
        };
        try { localStorage.setItem('studio-pro-data-v2', JSON.stringify(dataToSave)); }
        catch (e) { console.error("Storage full or error", e); }
    }, [sections, scraps, sandboxLines, savedProjects, projectTitle, projectBpm, projectKey, takes, beats]);

    const handleRecordStart = (lineId?: string) => {
        setRecordingTargetLineId(lineId || null);
        setRecorderMinimized(true);
        setShowRecorder(true);
    };

    const handleSaveTake = async (blob: Blob, duration: number, beatOffset?: number) => {
        const url = URL.createObjectURL(blob);
        const base64 = await blobToBase64(blob);
        const id = Math.random().toString(36).substr(2, 6).toUpperCase();
        await saveAudioData(id, base64);

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        const newTake: VoiceTake = {
            id, timestamp, duration: durationStr, transcription: "", associatedLyrics: '',
            isPlaying: false, audioUrl: url, base64: base64, beatOffset: beatOffset
        };
        setTakes(prev => [newTake, ...prev]);

        if (recordingTargetLineId) {
            setSandboxLines(prev => prev.map(line =>
                line.id === recordingTargetLineId ? { ...line, takeId: id } : line
            ));
            setRecordingTargetLineId(null);
        }
    };

    const handlePlayTake = (takeId: string) => {
        const take = takes.find(t => t.id === takeId);
        if (!take) return;
        if (playingTakeId === takeId) {
            globalAudioRef.current?.pause();
            setPlayingTakeId(null);
        } else {
            if (globalAudioRef.current) globalAudioRef.current.pause();
            const audio = new Audio(take.audioUrl || take.base64);
            audio.onended = () => setPlayingTakeId(null);
            audio.play().catch(console.error);
            globalAudioRef.current = audio;
            setPlayingTakeId(takeId);
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

    const archiveCurrentProject = () => {
        if (sections.length === 0 && scraps.length === 0 && sandboxLines.length <= 1) return;
        const newProject: SavedProject = {
            id: Math.random().toString(36).substr(2, 9),
            name: projectTitle || "Untitled Project",
            lastModified: new Date().toLocaleDateString(),
            sections, scraps, takes: [], beats: []
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
            id: Math.random().toString(36).substr(2, 9),
            type: type,
            repeats: 1,
            text: text
        }]);

        setProjectTitle("");
        setProjectBpm("120");
        setProjectKey("C Min");
        setUploadedBeat(null);
        setStudioMode('arrange');
        setViewMode('studio');
    };

    const deleteProject = (id: string) => setSavedProjects(prev => prev.filter(p => p.id !== id));

    const handleNewProject = () => {
        if (confirm("Start a clean project? Current work will be archived.")) {
            archiveCurrentProject();
            setSections([{ id: Math.random().toString(36).substr(2, 9), type: 'verse', repeats: 1, text: "" }]);
            setScraps([]);
            setSandboxLines([{ id: 'init', text: '' }]);
            setProjectTitle("");
            setUploadedBeat(null);
            setViewMode('studio');
        }
    };

    const loadProject = (p: SavedProject) => {
        if (window.confirm(`Load "${p.name}"? Workspace will sync.`)) {
            setSections(p.sections);
            setScraps(p.scraps);
            setProjectTitle(p.name === "Untitled Project" ? "" : p.name);
            setViewMode('studio');
            setShowSearch(false);
        }
    };

    const handleStartProjectFromBeat = (beat: Beat) => {
        if (globalAudioRef.current) globalAudioRef.current.pause();
        setPlayingBeatId(null);
        archiveCurrentProject();
        setSections([{ id: Math.random().toString(36).substr(2, 9), type: 'verse', repeats: 1, text: "" }]);
        setScraps([]);
        setSandboxLines([{ id: 'init', text: '' }]);
        setProjectTitle(beat.name);
        setUploadedBeat(beat.audioUrl || null);
        setStudioMode('arrange');
        setViewMode('studio');
    };

    const handleLibraryBeatUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const base64 = await blobToBase64(file);
        const id = Math.random().toString(36).substr(2, 9);

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


    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        const results: any[] = [];
        if (searchFilter === 'all' || searchFilter === 'songs') {
            savedProjects.forEach(p => {
                if (p.name.toLowerCase().includes(q)) {
                    results.push({ id: p.id, type: 'song', title: p.name, desc: `${p.sections.length} sections`, date: p.lastModified, raw: p });
                }
            });
        }
        return results;
    }, [searchQuery, searchFilter, savedProjects]);

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
                                <h2 className="text-[10px] mono uppercase tracking-widest text-[var(--text-secondary)] mb-4">Appearance</h2>
                                <div className="grid grid-cols-1 gap-3">
                                    {['dark', 'light', 'midnight', 'cassette', 'ethereal'].map((t) => (
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
                        </div>
                    </div>
                );
            case 'collection':
                return (
                    <div className="h-full flex flex-col pt-12">
                        <div className="px-6 mb-8 flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-medium tracking-tight text-[var(--text-main)] mb-6">Library</h1>
                                <div className="flex border-b border-[var(--border-main)]">
                                    <button onClick={() => setLibraryTab('songs')} className={`pb-3 pr-6 text-[11px] mono uppercase tracking-wider transition-all ${libraryTab === 'songs' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Projects</button>
                                    <button onClick={() => setLibraryTab('beats')} className={`pb-3 px-6 text-[11px] mono uppercase tracking-wider transition-all ${libraryTab === 'beats' ? 'text-[var(--text-main)] border-b border-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>Beats</button>
                                </div>
                            </div>
                            <button onClick={() => setViewMode('settings')} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"><Settings size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 space-y-2 pb-32 scrollbar-hide">
                            {libraryTab === 'beats' && (
                                <div className="space-y-4">
                                    {beats.map(beat => {
                                        const isPlaying = playingBeatId === beat.id;
                                        return (
                                            <div key={beat.id} className={`bg-[var(--bg-card)] border ${isPlaying ? 'border-[var(--accent)]' : 'border-[var(--border-main)]'} rounded-lg p-3 flex items-center justify-between transition-all`}>
                                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                                    <button onClick={() => handlePlayBeat(beat.id)} className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                                                        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                                                    </button>
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-medium text-[var(--text-main)] truncate">{beat.name}</h4>
                                                        <p className="text-[10px] mono text-[var(--text-tertiary)]">{beat.duration}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleStartProjectFromBeat(beat)} className="px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] text-[10px] mono uppercase tracking-wider text-[var(--text-secondary)]">Write</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {libraryTab === 'songs' && (
                                <div className="space-y-4">
                                    {savedProjects.map(p => (
                                        <SwipeableProjectCard key={p.id} project={p} onClick={() => loadProject(p)} onDelete={() => deleteProject(p.id)} />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="absolute bottom-24 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
                            <div className="pointer-events-auto flex flex-col items-end gap-3">
                                {fabOpen && (
                                    <div className="flex flex-col items-end gap-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
                                        <button onClick={handleNewProject} className="flex items-center gap-3 group">
                                            <span className="bg-[var(--bg-card)] border border-[var(--border-main)] px-2 py-1.5 rounded text-[10px] mono uppercase tracking-wider text-[var(--text-main)] shadow-lg">New Project</span>
                                            <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shadow-lg border border-[var(--border-main)]"><FilePlus size={16} /></div>
                                        </button>
                                        <button onClick={() => fabInputRef.current?.click()} className="flex items-center gap-3 group">
                                            <span className="bg-[var(--bg-card)] border border-[var(--border-main)] px-2 py-1.5 rounded text-[10px] mono uppercase tracking-wider text-[var(--text-main)] shadow-lg">Import Beat</span>
                                            <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shadow-lg border border-[var(--border-main)]"><Music size={16} /></div>
                                            <input ref={fabInputRef} type="file" accept="audio/*, .mp3, .wav" className="hidden" onChange={handleLibraryBeatUpload} />
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={() => setFabOpen(!fabOpen)}
                                    className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
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
                    />
                );
            case 'studio':
                return (
                    <div className="h-full flex flex-col relative">
                        <div className="glass z-20 sticky top-0 border-b border-[var(--border-main)]">
                            <div className="px-6 pt-12 pb-6 space-y-4">
                                {/* Top Row: Title and Share */}
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <input
                                            value={projectTitle}
                                            onChange={(e) => setProjectTitle(e.target.value)}
                                            className="bg-transparent border-none text-2xl font-medium text-[var(--text-main)] focus:outline-none w-full placeholder:text-[var(--text-tertiary)]"
                                            placeholder="Untitled Project"
                                        />
                                        <div className="flex items-center gap-3 mt-1 text-[10px] mono text-[var(--text-tertiary)] uppercase tracking-widest">
                                            <span>{projectBpm} BPM</span>
                                            <div className="w-1 h-1 rounded-full bg-[var(--border-main)]" />
                                            <span>{projectKey}</span>
                                        </div>
                                    </div>
                                    <button className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)]">
                                        <Share size={18} />
                                    </button>
                                </div>

                                {/* Bottom Row: Toggle and Audio Controls */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-main)]">
                                        <button
                                            onClick={() => setStudioMode('flow')}
                                            className={`px-4 py-1.5 text-[10px] mono uppercase tracking-wider rounded-lg transition-all ${studioMode === 'flow' ? 'bg-[var(--bg-main)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                                        >Flow</button>
                                        <button
                                            onClick={() => setStudioMode('arrange')}
                                            className={`px-4 py-1.5 text-[10px] mono uppercase tracking-wider rounded-lg transition-all ${studioMode === 'arrange' ? 'bg-[var(--bg-main)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                                        >Write</button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <BeatUploader
                                            audioSrc={uploadedBeat}
                                            audioRef={beatAudioRef}
                                            onUpload={(file) => {
                                                const url = URL.createObjectURL(file);
                                                setUploadedBeat(url);
                                            }}
                                            onClear={() => setUploadedBeat(null)}
                                        />
                                        <button
                                            onClick={() => setShowMuse(true)}
                                            className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--accent)] hover:text-[var(--text-main)]"
                                        >
                                            <Zap size={18} fill="currentColor" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-8 pb-40 scrollbar-hide">
                            {studioMode === 'arrange' ? (
                                <div className="max-w-2xl mx-auto space-y-12">
                                    {sections.map((section, idx) => (
                                        <LyricCard
                                            key={section.id}
                                            section={section}
                                            onUpdate={updateSection}
                                            onDelete={deleteSection}
                                            onMove={moveSection}
                                            availableTakes={takes}
                                            beatAudioRef={beatAudioRef}
                                        />
                                    ))}
                                    <button
                                        onClick={addSection}
                                        className="w-full py-6 flex items-center justify-center gap-4 text-[11px] mono uppercase tracking-[0.3em] text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-all group relative"
                                    >
                                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[var(--border-main)] to-[var(--border-focus)] opacity-30 group-hover:opacity-100 transition-all duration-500" />
                                        <span className="px-4 group-hover:scale-110 group-hover:tracking-[0.4em] transition-all duration-500 font-medium">+ Add Section</span>
                                        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[var(--border-main)] to-[var(--border-focus)] opacity-30 group-hover:opacity-100 transition-all duration-500" />
                                    </button>
                                </div>
                            ) : (
                                <SandboxView
                                    lines={sandboxLines}
                                    takes={takes}
                                    onChange={setSandboxLines}
                                    onPromote={promoteToSection}
                                    onRecordStart={handleRecordStart}
                                    onPlayTake={handlePlayTake}
                                    currentlyPlayingTakeId={playingTakeId}
                                />
                            )}
                        </div>
                    </div>
                );
            default: return null;
        }
    };

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
            id: Math.random().toString(36).substr(2, 9),
            type: 'verse',
            repeats: 1,
            text: ""
        }]);
    };

    const promoteToSection = (text: string) => {
        if (text.trim()) {
            const newSection: LyricSection = {
                id: Math.random().toString(36).substr(2, 9),
                type: 'verse',
                repeats: 1,
                text: text
            };
            setSections(prev => [...prev, newSection]);
            setSandboxLines([{ id: Math.random().toString(36).substr(2, 9), text: '' }]);
            setStudioMode('arrange');
        }
    };

    return (
        <div className="h-screen w-full bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col items-center overflow-hidden select-none transition-colors duration-500" data-theme={theme}>
            <main
                className="w-full flex-1 max-w-lg relative bg-[var(--bg-main)] border-x border-[var(--border-main)] shadow-2xl transition-all duration-500 ease-out"
            >
                {getActiveView()}

                <nav className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${showRecorder && !recorderMinimized ? 'opacity-0 scale-90 translate-y-12' : 'opacity-100 scale-100 translate-y-0'}`}>
                    <div className="glass-nav px-2 py-2 rounded-2xl flex items-center gap-1 shadow-2xl border border-[var(--border-main)] backdrop-blur-3xl">
                        <NavBtn active={viewMode === 'collection'} onClick={() => setViewMode('collection')} icon={<Library size={20} />} label="Library" />
                        <NavBtn active={viewMode === 'studio'} onClick={() => setViewMode('studio')} icon={<PenTool size={20} />} label="Studio" />
                        <div className="w-[1px] h-6 bg-[var(--border-main)] mx-1" />
                        <button
                            onClick={() => {
                                setShowRecorder(true);
                                setRecorderMinimized(true);
                            }}
                            className="w-12 h-12 bg-[var(--accent)] text-[var(--bg-main)] rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all mx-1"
                        >
                            <div className="w-3 h-3 rounded-full bg-current" />
                        </button>
                        <div className="w-[1px] h-6 bg-[var(--border-main)] mx-1" />
                        <NavBtn active={viewMode === 'board'} onClick={() => setViewMode('board')} icon={<LayoutGrid size={20} />} label="Board" />
                        <NavBtn active={showSearch} onClick={() => setShowSearch(true)} icon={<Search size={20} />} label="Search" />
                    </div>
                </nav>
            </main>

            {showRecorder && (
                <RecorderDrawer
                    onClose={() => setShowRecorder(false)}
                    onSave={handleSaveTake}
                    isMinimized={recorderMinimized}
                    onMinimizeToggle={() => setRecorderMinimized(!recorderMinimized)}
                    backingTrackSrc={uploadedBeat}
                    backingAudioRef={beatAudioRef}
                />
            )}

            {showMuse && <MuseDrawer onClose={() => setShowMuse(false)} contextText={sections.map(s => s.text).join('\n')} />}

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
                                    placeholder="Search songs, lyrics, takes..."
                                    className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-[var(--accent)] transition-all"
                                />
                            </div>
                            <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="text-[var(--text-secondary)]"><X size={20} /></button>
                        </div>

                        <div className="px-6 flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                            {['all', 'songs', 'sections', 'takes', 'beats'].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setSearchFilter(f as SearchFilter)}
                                    className={`px-4 py-1.5 rounded-full text-[10px] mono uppercase tracking-wider border transition-all whitespace-nowrap ${searchFilter === f ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--bg-main)]' : 'bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-secondary)]'}`}
                                >{f}</button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 pb-20 space-y-2">
                            {searchResults.map((res: any) => (
                                <button
                                    key={`${res.type}-${res.id}`}
                                    onClick={() => {
                                        if (res.type === 'song') loadProject(res.raw);
                                        if (res.type === 'take') handlePlayTake(res.id);
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

            <audio ref={beatAudioRef} src={uploadedBeat || undefined} loop />
        </div>
    );
};

export default StudioWorkspace;
