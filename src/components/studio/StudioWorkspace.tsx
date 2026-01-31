"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SandboxView } from "@/components/studio/SandboxView";
import { LyricCard } from "@/components/studio/LyricCard";
import { BeatUploader } from "@/components/studio/BeatUploader";
import { CreativeSidebar } from "@/components/studio/CreativeSidebar";
import { PuzzleView } from "@/components/studio/PuzzleView";
import { RecorderDrawer } from "@/components/studio/RecorderDrawer";
import { updateProjectStudio } from "@/app/actions";
import { cn } from "@/lib/utils";
import { LyricSection, LyricScrap, SectionType } from "@/types/studio";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    Sparkles,
    Plus,
    Download,
    X,
    Search,
    Library,
    PenTool,
    LayoutGrid,
    Mic
} from "lucide-react";

interface StudioWorkspaceProps {
    project: any;
}

type StudioMode = "flow" | "structure";
type ViewMode = "studio" | "board";

// Framer Motion variants
const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
};

const slideUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function StudioWorkspace({ project }: StudioWorkspaceProps) {
    const router = useRouter();

    // View state
    const [viewMode, setViewMode] = useState<ViewMode>("studio");
    const [showRecorder, setShowRecorder] = useState(false);

    // Studio content state
    const [studioMode, setStudioMode] = useState<StudioMode>("flow");
    const [sandboxText, setSandboxText] = useState("");
    const [sections, setSections] = useState<LyricSection[]>([]);

    // Board content state
    const [scraps, setScraps] = useState<LyricScrap[]>([]);

    // Session metadata
    const [title, setTitle] = useState(project.title || "Untitled");
    const [bpm, setBpm] = useState(project.bpm?.toString() || "140");
    const [songKey, setSongKey] = useState(project.key || "C min");

    // Media state
    const [beatSrc, setBeatSrc] = useState<string | null>(null);

    // UI state
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [studioQuery, setStudioQuery] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // Tap tempo
    const [tapTimes, setTapTimes] = useState<number[]>([]);

    // Load saved data on mount
    useEffect(() => {
        if (project.description) {
            setSandboxText(project.description);
        }
    }, [project]);

    // Auto-save content
    const saveLyrics = useCallback(async () => {
        const content = studioMode === "flow"
            ? sandboxText
            : sections.map(s => `[${s.type.toUpperCase()}]\n${s.text}`).join("\n\n");
        await updateProjectStudio(project.id, content);
    }, [project.id, studioMode, sandboxText, sections]);

    // Promote sandbox text to structure
    const promoteToSection = useCallback(() => {
        if (sandboxText.trim().length > 0) {
            const newSection: LyricSection = {
                id: Date.now().toString(),
                type: "verse",
                repeats: 1,
                text: sandboxText.trim(),
            };
            setSections(prev => [...prev, newSection]);
            setSandboxText("");
            setStudioMode("structure");
        }
    }, [sandboxText]);

    // Section CRUD
    const addSection = () => {
        const newSection: LyricSection = {
            id: Date.now().toString(),
            type: "verse",
            repeats: 1,
            text: "",
        };
        setSections(prev => [...prev, newSection]);
    };

    const updateSection = (id: string, updates: Partial<LyricSection>) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const deleteSection = (id: string) => {
        setSections(prev => prev.filter(s => s.id !== id));
    };

    const moveSection = (id: string, direction: "up" | "down") => {
        setSections(prev => {
            const idx = prev.findIndex(s => s.id === id);
            if (idx === -1) return prev;
            const newIdx = direction === "up" ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const arr = [...prev];
            [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
            return arr;
        });
    };

    // Scraps CRUD
    const addScrap = (text: string, type: SectionType) => {
        const newScrap: LyricScrap = {
            id: Date.now().toString(),
            text,
            type,
            createdAt: new Date().toISOString()
        };
        setScraps(prev => [newScrap, ...prev]);
    };

    const updateScrapType = (id: string, type: SectionType) => {
        setScraps(prev => prev.map(s => s.id === id ? { ...s, type } : s));
    };

    const handleBeatUpload = (file: File) => {
        const url = URL.createObjectURL(file);
        setBeatSrc(url);
    };

    const handleRecorderSave = (blob: Blob, duration: number) => {
        // In a real app, upload blob and get URL
        console.log("Recorded blob:", blob, "Duration:", duration);
        // For now, maybe just visually acknowledge
    };

    const handleTapTempo = () => {
        const now = Date.now();
        const newTaps = [...tapTimes, now].slice(-4);
        setTapTimes(newTaps);

        if (newTaps.length >= 2) {
            const intervals = [];
            for (let i = 1; i < newTaps.length; i++) {
                intervals.push(newTaps[i] - newTaps[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const calculatedBpm = Math.round(60000 / avgInterval);
            if (calculatedBpm >= 40 && calculatedBpm <= 300) {
                setBpm(calculatedBpm.toString());
            }
        }
    };

    return (
        <main className="h-screen w-full bg-[var(--bg-main)] text-[var(--text-primary)] flex flex-col items-center overflow-hidden select-none relative">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none opacity-20 mix-blend-screen z-0">
                <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-[var(--accent-primary)]/30 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[300px] h-[300px] bg-[var(--accent-cta)]/20 rounded-full blur-[80px]" />
            </div>

            {/* Mobile-first container */}
            <div className="relative w-full max-w-[440px] lg:max-w-none h-full flex flex-col border-x border-[var(--border-subtle)]/50 shadow-2xl bg-[var(--bg-main)] z-10">

                {/* Session Header - Only show in Studio Mode */}
                {viewMode === 'studio' && (
                    <motion.header
                        variants={fadeIn}
                        initial="hidden"
                        animate="visible"
                        className="px-4 pt-safe-top border-b border-[var(--border-subtle)] bg-[var(--bg-main)]/80 backdrop-blur-md z-20"
                    >
                        {/* Top row: Back + Title + Actions */}
                        <div className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => router.push('/')}
                                    className="p-2 -ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-transparent text-[17px] font-semibold tracking-tight text-[var(--text-primary)] focus:outline-none border-none w-full max-w-[200px] truncate"
                                    placeholder="Untitled"
                                />
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setShowAiPanel(true)}
                                    className={cn(
                                        "p-2 rounded-lg transition-all cursor-pointer",
                                        showAiPanel
                                            ? "text-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                                    )}
                                    title="AI Assistant"
                                >
                                    <Sparkles size={18} />
                                </button>
                                <button
                                    onClick={saveLyrics}
                                    className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-lg transition-all cursor-pointer"
                                    title="Export"
                                >
                                    <Download size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Session metadata row */}
                        <div className="flex items-center gap-3 pb-3">
                            {/* BPM */}
                            <button
                                onClick={handleTapTempo}
                                className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-elevated)] rounded-md border border-[var(--border-subtle)] hover:border-[var(--text-muted)] transition-colors cursor-pointer group"
                                title="Tap Tempo"
                            >
                                <span className="text-[9px] font-mono uppercase text-[var(--text-muted)] tracking-wider">BPM</span>
                                <input
                                    type="text"
                                    value={bpm}
                                    onChange={(e) => setBpm(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-8 bg-transparent text-[11px] font-mono text-[var(--text-primary)] text-center focus:outline-none"
                                />
                            </button>

                            {/* Key */}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-elevated)] rounded-md border border-[var(--border-subtle)]">
                                <span className="text-[9px] font-mono uppercase text-[var(--text-muted)] tracking-wider">KEY</span>
                                <input
                                    type="text"
                                    value={songKey}
                                    onChange={(e) => setSongKey(e.target.value)}
                                    className="w-12 bg-transparent text-[11px] font-mono text-[var(--text-primary)] text-center focus:outline-none"
                                />
                            </div>

                            <div className="flex-1" />

                            {/* Mode toggle */}
                            <div className="flex bg-[var(--bg-elevated)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
                                <button
                                    onClick={() => setStudioMode("flow")}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all cursor-pointer",
                                        studioMode === "flow"
                                            ? "bg-[var(--text-primary)] text-[var(--bg-main)]"
                                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    )}
                                >
                                    Flow
                                </button>
                                <button
                                    onClick={() => setStudioMode("structure")}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all cursor-pointer",
                                        studioMode === "structure"
                                            ? "bg-[var(--text-primary)] text-[var(--bg-main)]"
                                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    )}
                                >
                                    Structure
                                </button>
                            </div>
                        </div>

                        {/* Beat uploader */}
                        <div className="pb-3">
                            <BeatUploader
                                audioSrc={beatSrc}
                                onUpload={handleBeatUpload}
                                onClear={() => setBeatSrc(null)}
                            />
                        </div>
                    </motion.header>
                )}

                {/* Main content area */}
                <div className="flex-1 overflow-hidden relative">
                    <AnimatePresence mode="wait">
                        {viewMode === 'board' ? (
                            <motion.div
                                key="board"
                                variants={fadeIn}
                                initial="hidden"
                                animate="visible"
                                exit="hidden"
                                className="h-full"
                            >
                                <PuzzleView scraps={scraps} onAdd={addScrap} onUpdateType={updateScrapType} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="studio"
                                variants={fadeIn}
                                initial="hidden"
                                animate="visible"
                                exit="hidden"
                                className="h-full"
                            >
                                {studioMode === "flow" ? (
                                    <div className="h-full px-4 pt-4 pb-32 overflow-y-auto scrollbar-hide">
                                        <SandboxView
                                            text={sandboxText}
                                            onChange={setSandboxText}
                                            onPromote={promoteToSection}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-full px-4 pt-4 pb-32 overflow-y-auto scrollbar-hide">
                                        <div className="space-y-6">
                                            {sections.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                                    <p className="text-[var(--text-muted)] text-sm mb-4">
                                                        No sections yet. Add your first one.
                                                    </p>
                                                    <button
                                                        onClick={addSection}
                                                        className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-main)] rounded-full text-[10px] font-mono uppercase tracking-wider hover:opacity-90 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                                                    >
                                                        <Plus size={12} /> Add Section
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    {sections.map((section) => (
                                                        <LyricCard
                                                            key={section.id}
                                                            section={section}
                                                            onUpdate={updateSection}
                                                            onDelete={deleteSection}
                                                            onMove={moveSection}
                                                            availableTakes={[]} // Removed mock takes
                                                        />
                                                    ))}

                                                    <button
                                                        onClick={addSection}
                                                        className="w-full py-3 border border-dashed border-[var(--border-subtle)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-wider cursor-pointer"
                                                    >
                                                        <Plus size={12} /> Add Section
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Recorder Drawer Overlay */}
                <AnimatePresence>
                    {showRecorder && (
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="absolute bottom-0 left-0 right-0 z-50 rounded-t-xl overflow-hidden"
                            style={{ maxHeight: '80%' }}
                        >
                            <RecorderDrawer onClose={() => setShowRecorder(false)} onSave={handleRecorderSave} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom Navigation Dock - Redesigned */}
                <div className="absolute bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none">
                    <nav className="pointer-events-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-5 py-3 flex items-center gap-5 shadow-2xl">
                        {/* Library Button */}
                        <button
                            onClick={() => router.push('/')}
                            className="group flex flex-col items-center justify-center transition-all duration-300"
                        >
                            <div className="w-10 h-10 rounded-full border-[1.5px] border-white/30 group-hover:border-white/80 p-[9px] flex items-center justify-center transition-colors">
                                <Library className="w-full h-full text-white/70 group-hover:text-white" strokeWidth={2} />
                            </div>
                        </button>

                        {/* Studio Button */}
                        <button
                            onClick={() => setViewMode('studio')}
                            className="group flex flex-col items-center justify-center transition-all duration-300"
                        >
                            <div className={cn(
                                "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                                viewMode === 'studio' ? "bg-white/10" : "hover:bg-white/5"
                            )}>
                                <div className={cn(
                                    "w-1.5 h-1.5 rounded-full bg-white absolute -bottom-1 transition-opacity",
                                    viewMode === 'studio' ? "opacity-100" : "opacity-0"
                                )} />
                                <PenTool className={cn("w-5 h-5 transition-colors", viewMode === 'studio' ? "text-white" : "text-white/50 group-hover:text-white/80")} strokeWidth={2} />
                            </div>
                        </button>

                        {/* Mic Button (Center) */}
                        <button
                            onClick={() => setShowRecorder(true)}
                            className="relative -top-1 w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/10 hover:scale-105 active:scale-95 transition-all text-black"
                        >
                            <Mic size={24} strokeWidth={2.5} />
                        </button>

                        {/* Grid/Board Button */}
                        <button
                            onClick={() => setViewMode('board')}
                            className="group flex flex-col items-center justify-center transition-all duration-300"
                        >
                            <div className={cn(
                                "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                                viewMode === 'board' ? "bg-white/10" : "hover:bg-white/5"
                            )}>
                                <LayoutGrid className={cn("w-5 h-5 transition-colors", viewMode === 'board' ? "text-white" : "text-white/50 group-hover:text-white/80")} strokeWidth={2} />
                            </div>
                        </button>

                        {/* Search Button */}
                        <button
                            onClick={() => setShowSearch(true)}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-all"
                        >
                            <Search className="w-5 h-5 text-white/50 hover:text-white transition-colors" strokeWidth={2} />
                        </button>
                    </nav>
                </div>

                {/* AI Panel Overlay ... same as before ... */}
                <AnimatePresence>
                    {showAiPanel && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowAiPanel(false)}
                                className="fixed inset-0 bg-black/60 z-50"
                            />
                            <motion.div
                                initial={{ x: "100%" }}
                                animate={{ x: 0 }}
                                exit={{ x: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed top-0 right-0 bottom-0 w-full max-w-[360px] bg-[var(--bg-card)] border-l border-[var(--border-default)] z-[60] flex flex-col shadow-2xl"
                            >
                                <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} className="text-[var(--accent-primary)]" />
                                        <h2 className="text-sm font-semibold">AI Assistant</h2>
                                    </div>
                                    <button
                                        onClick={() => setShowAiPanel(false)}
                                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <CreativeSidebar externalQuery={studioQuery} />
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Search Overlay */}
                <AnimatePresence>
                    {showSearch && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 bg-[var(--bg-main)]/95 backdrop-blur-md p-4 pt-safe-top"
                        >
                            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-2xl overflow-hidden mt-16 animate-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center px-4 py-4">
                                    <Search size={16} className="text-[var(--text-secondary)] mr-3" />
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Search lyrics, takes..."
                                        className="bg-transparent text-[var(--text-primary)] focus:outline-none text-sm w-full font-sans placeholder:text-[var(--text-muted)]"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <button
                                        onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                                        className="p-1 hover:bg-[var(--bg-surface)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
