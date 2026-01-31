"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GlobalNav } from "@/components/navigation/GlobalNav";

interface Project {
    id: string;
    title: string;
    status: string;
    updatedAt: string | Date;
}

interface LibraryScreenProps {
    projects: Project[];
    createAction: (formData: FormData) => Promise<void>;
}

// Mock data
const mockSongs = [
    { id: "s1", title: "Midnight Session", creator: "yoy", updated: "2h ago", isPrivate: true, cover: "from-indigo-500 via-purple-500 to-pink-500" },
    { id: "s2", title: "Golden Hour", creator: "yoy", updated: "5h ago", isPrivate: false, cover: "from-amber-200 via-yellow-400 to-orange-500" },
    { id: "s3", title: "Neon Dreams", creator: "yoy", updated: "Yesterday", isPrivate: true, cover: "from-cyan-400 via-blue-500 to-indigo-600" },
];

const mockBeats = [
    { id: "b1", title: "Cloud Trap", creator: "yoy", updated: "1h ago", isPrivate: true, cover: "from-fuchsia-500 via-pink-600 to-rose-500" },
    { id: "b2", title: "Soul Sample 02", creator: "yoy", updated: "4h ago", isPrivate: true, cover: "from-teal-400 via-emerald-500 to-green-600" },
];

export function LibraryScreen({ projects, createAction }: LibraryScreenProps) {
    const [activeTab, setActiveTab] = useState<"projects" | "songs" | "beats">("projects");
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    return (
        <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] font-sans selection:bg-[var(--accent-primary)]/30">
            {/* Ambient Background Light */}
            <div className="fixed inset-0 pointer-events-none opacity-40 mix-blend-screen">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[var(--accent-primary)]/20 rounded-full blur-[120px]" />
                <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-[var(--accent-cta)]/15 rounded-full blur-[100px]" />
            </div>

            {/* Header - Large Title Style */}
            <header className="sticky top-0 z-[var(--z-sticky)] pt-safe-top transition-all duration-[var(--duration-normal)]">
                <div className="absolute inset-0 glass-nav" />

                <div className="relative px-6 h-[72px] flex items-center justify-between">
                    {!isSearchActive ? (
                        <>
                            <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)] drop-shadow-sm">
                                Library
                            </h1>
                            <div className="flex items-center gap-3">
                                <HeaderIconButton icon="search" onClick={() => setIsSearchActive(true)} />
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-pink-500 p-[2px]">
                                    <div className="w-full h-full rounded-full bg-black/50 backdrop-blur-sm overflow-hidden">
                                        {/* Avatar Placeholder */}
                                        <div className="w-full h-full bg-white/10" />
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                            <div className="flex-1 relative group">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/50 text-[20px]">search</span>
                                <input
                                    autoFocus
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Find in Library"
                                    className="w-full h-10 pl-10 pr-4 bg-white/10 rounded-xl text-[16px] text-white placeholder:text-white/40 outline-none focus:bg-white/15 transition-all"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    setIsSearchActive(false);
                                    setSearchQuery("");
                                }}
                                className="text-[16px] font-medium text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {/* Sub-navigation / Filters */}
                {!isSearchActive && (
                    <div className="relative px-6 pb-4 flex items-center gap-4 overflow-x-auto no-scrollbar">
                        {["projects", "songs", "beats"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={cn(
                                    "text-[15px] font-medium transition-colors duration-[var(--duration-fast)] relative py-2 cursor-pointer",
                                    activeTab === tab
                                        ? "text-[var(--text-primary)]"
                                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                                )}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {activeTab === tab && (
                                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent-primary)] rounded-full shadow-[0_0_12px_var(--accent-primary)]" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="px-6 pt-6 pb-32">
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-6 duration-500 ease-out">
                    {/* Projects Section */}
                    {activeTab === 'projects' && projects.map((p) => (
                        <GridCard
                            key={p.id}
                            title={p.title}
                            subtitle="Project"
                            gradient="from-slate-800 to-slate-700"
                            href={`/project/${p.id}`}
                        />
                    ))}

                    {activeTab === 'songs' && mockSongs.map((s) => (
                        <GridCard
                            key={s.id}
                            title={s.title}
                            subtitle={s.creator}
                            gradient={s.cover}
                            href={`/song/${s.id}`}
                            isPlayable
                        />
                    ))}

                    {activeTab === 'beats' && mockBeats.map((b) => (
                        <GridCard
                            key={b.id}
                            title={b.title}
                            subtitle={b.creator}
                            gradient={b.cover}
                            href={`/beat/${b.id}`}
                            isPlayable
                        />
                    ))}
                </div>

                {/* Updated Empty State */}
                {((activeTab === 'projects' && projects.length === 0)) && (
                    <div className="flex flex-col items-center justify-center py-32 opacity-60">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 backdrop-blur-2xl">
                            <span className="material-symbols-outlined text-[32px] text-white/40">library_add</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">It's quiet here.</h3>
                        <p className="text-white/40 text-sm text-center max-w-[200px]">Start a new project or record something fresh.</p>
                        <button className="mt-6 px-6 py-2.5 bg-white text-black rounded-full font-medium shadow-lg shadow-white/10 hover:scale-105 transition-transform">
                            Create New
                        </button>
                    </div>
                )}
            </main>

            {/* Global Navigation */}
            <GlobalNav />
        </div>
    );
}

// ============================================
// COMPONENT LIBRARY (Local)
// ============================================

function HeaderIconButton({ icon, onClick }: { icon: string, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
        >
            <span className="material-symbols-outlined text-[20px] text-white/80">{icon}</span>
        </button>
    );
}

function GridCard({ title, subtitle, gradient, href, isPlayable }: {
    title: string,
    subtitle: string,
    gradient: string,
    href: string,
    isPlayable?: boolean
}) {
    return (
        <Link href={href} className="group flex flex-col gap-3 active:scale-[0.98] transition-transform duration-300">
            {/* Artwork Container */}
            <div className={`aspect-square rounded-2xl overflow-hidden relative shadow-lg bg-gradient-to-br ${gradient}`}>
                {/* Overlay Gradient for consistency */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />

                {/* Play Button Overlay */}
                {isPlayable && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform">
                            <span className="material-symbols-outlined text-white text-[28px] ml-1">play_arrow</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Metadata */}
            <div className="px-1">
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight truncate group-hover:text-[var(--accent-primary)] transition-colors duration-[var(--duration-fast)]">
                    {title}
                </h3>
                <p className="text-[13px] text-[var(--text-muted)] truncate mt-0.5">
                    {subtitle}
                </p>
            </div>
        </Link>
    );
}
