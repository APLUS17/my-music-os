"use client";

import { useState } from "react";
import Link from "next/link";

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

// Mock data for verses and takes
const mockVerses = [
    { id: "v1", title: "Midnight Thoughts - Verse 1", project: "Midnight Session", updatedAt: "2h ago" },
    { id: "v2", title: "Golden Hour - Hook", project: "Golden Hour", updatedAt: "5h ago" },
    { id: "v3", title: "Neon Dreams - Bridge", project: "Neon Dreams", updatedAt: "Yesterday" },
];

const mockTakes = [
    { id: "t1", title: "Vocal Demo Take 1", duration: "2:35", updatedAt: "2h ago" },
    { id: "t2", title: "Freestyle Session", duration: "4:12", updatedAt: "5h ago" },
    { id: "t3", title: "Melody Idea", duration: "0:45", updatedAt: "Yesterday" },
];

export function LibraryScreen({ projects, createAction }: LibraryScreenProps) {
    const [activeTab, setActiveTab] = useState<"songs" | "verses" | "takes">("songs");

    // Find the most recently updated project as "active session"
    const activeProject = projects.length > 0 ? projects[0] : null;
    const otherProjects = projects.slice(1);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
            {/* Status Bar Spacer */}
            <div className="h-12 w-full"></div>

            {/* Header */}
            <div className="px-6 mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-medium tracking-tight text-[#e5e5e5] mb-6">Library</h1>

                    {/* Tab Navigation - Underline Style */}
                    <div className="flex border-b border-[#262626]">
                        <button
                            onClick={() => setActiveTab('songs')}
                            className={`pb-3 pr-6 text-[11px] uppercase tracking-wider transition-all technical-font ${activeTab === 'songs'
                                    ? 'text-[#e5e5e5] border-b-2 border-[#ff5545]'
                                    : 'text-[#525252] hover:text-[#737373]'
                                }`}
                        >
                            Songs
                        </button>
                        <button
                            onClick={() => setActiveTab('verses')}
                            className={`pb-3 px-6 text-[11px] uppercase tracking-wider transition-all technical-font ${activeTab === 'verses'
                                    ? 'text-[#e5e5e5] border-b-2 border-[#ff5545]'
                                    : 'text-[#525252] hover:text-[#737373]'
                                }`}
                        >
                            Verses
                        </button>
                        <button
                            onClick={() => setActiveTab('takes')}
                            className={`pb-3 px-6 text-[11px] uppercase tracking-wider transition-all technical-font ${activeTab === 'takes'
                                    ? 'text-[#e5e5e5] border-b-2 border-[#ff5545]'
                                    : 'text-[#525252] hover:text-[#737373]'
                                }`}
                        >
                            Takes
                        </button>
                    </div>
                </div>

                {/* Settings Button */}
                <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#1a1a1a] text-[#737373] transition-colors">
                    <span className="material-symbols-outlined text-[20px]">settings</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 space-y-2 pb-32">

                {/* SONGS TAB */}
                {activeTab === 'songs' && (
                    <SongsView
                        activeProject={activeProject}
                        otherProjects={otherProjects}
                        createAction={createAction}
                    />
                )}

                {/* VERSES TAB */}
                {activeTab === 'verses' && (
                    <VersesView verses={mockVerses} />
                )}

                {/* TAKES TAB */}
                {activeTab === 'takes' && (
                    <TakesView takes={mockTakes} />
                )}
            </div>

            {/* Floating Action Button */}
            <div className="fixed bottom-24 right-6 z-40">
                <button className="w-14 h-14 bg-[#1a1a1a] border border-[#262626] rounded-full flex items-center justify-center shadow-lg shadow-black/40 hover:bg-[#262626] transition-all active:scale-95">
                    <span className="material-symbols-outlined text-[#e5e5e5] text-[24px]">add</span>
                </button>
            </div>

            {/* Bottom Navigation - Simplified for now */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-8 pt-3 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[#1a1a1a]">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <button className="flex flex-col items-center gap-1.5 text-[#e5e5e5]">
                        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>library_music</span>
                        <span className="text-[9px] font-medium tracking-wide">Library</span>
                    </button>
                    <button className="flex flex-col items-center gap-1.5 text-[#525252] hover:text-[#737373] transition-colors">
                        <span className="material-symbols-outlined text-[24px]">edit_note</span>
                        <span className="text-[9px] tracking-wide">Write</span>
                    </button>
                    <button className="flex flex-col items-center gap-1.5 text-[#525252] hover:text-[#737373] transition-colors">
                        <span className="material-symbols-outlined text-[24px]">mic</span>
                        <span className="text-[9px] tracking-wide">Record</span>
                    </button>
                    <button className="flex flex-col items-center gap-1.5 text-[#525252] hover:text-[#737373] transition-colors">
                        <span className="material-symbols-outlined text-[24px]">grid_view</span>
                        <span className="text-[9px] tracking-wide">Browse</span>
                    </button>
                    <button className="flex flex-col items-center gap-1.5 text-[#525252] hover:text-[#737373] transition-colors">
                        <span className="material-symbols-outlined text-[24px]">search</span>
                        <span className="text-[9px] tracking-wide">Search</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}

// ============================================
// SONGS VIEW
// ============================================
function SongsView({
    activeProject,
    otherProjects,
    createAction
}: {
    activeProject: Project | null;
    otherProjects: Project[];
    createAction: (formData: FormData) => Promise<void>;
}) {
    return (
        <div className="space-y-3">
            {/* Active Session Card */}
            {activeProject && (
                <Link
                    href={`/project/${activeProject.id}`}
                    className="bg-[#141414] border border-[#262626] rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-[#404040] transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center text-[#e5e5e5] group-hover:bg-[#262626] transition-colors">
                            <span className="material-symbols-outlined text-[20px]">edit_note</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-[#e5e5e5] mb-1">{activeProject.title}</h3>
                            <p className="text-[10px] technical-font text-[#ff5545] uppercase tracking-wider">Active Session</p>
                        </div>
                    </div>
                    <span className="material-symbols-outlined text-[#404040] text-[18px] group-hover:text-[#737373] transition-colors">chevron_right</span>
                </Link>
            )}

            {/* Other Projects */}
            {otherProjects.map((project) => (
                <Link
                    key={project.id}
                    href={`/project/${project.id}`}
                    className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4 flex items-center justify-between cursor-pointer opacity-80 hover:opacity-100 hover:border-[#262626] transition-all group"
                >
                    <div>
                        <h3 className="text-sm font-medium text-[#e5e5e5] mb-1">{project.title}</h3>
                        <p className="text-[10px] technical-font text-[#525252] uppercase tracking-wider">
                            {getTimeAgo(new Date(project.updatedAt))} • {project.status}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[#404040] text-[18px] group-hover:text-[#737373] transition-colors">chevron_right</span>
                </Link>
            ))}

            {/* Create New Project */}
            <form action={createAction}>
                <div className="border border-dashed border-[#262626] rounded-xl p-4 flex items-center gap-4 hover:border-[#404040] transition-all cursor-pointer group">
                    <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#404040] group-hover:text-[#737373] transition-colors">
                        <span className="material-symbols-outlined text-[20px]">add</span>
                    </div>
                    <input
                        name="title"
                        placeholder="New song title..."
                        className="flex-grow bg-transparent text-sm text-[#e5e5e5] placeholder-[#404040] focus:outline-none"
                        required
                    />
                    <button type="submit" className="text-[#ff5545] hover:text-[#ff7565] transition-colors">
                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </button>
                </div>
            </form>

            {/* Empty State */}
            {projects.length === 0 && (
                <div className="text-center py-16 text-[#525252]">
                    <span className="material-symbols-outlined text-[48px] mb-4 block opacity-30">library_music</span>
                    <p className="text-[14px]">No songs yet. Create your first one!</p>
                </div>
            )}
        </div>
    );
}

// ============================================
// VERSES VIEW
// ============================================
function VersesView({ verses }: { verses: typeof mockVerses }) {
    return (
        <div className="space-y-3">
            {verses.map((verse) => (
                <div
                    key={verse.id}
                    className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-[#262626] transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center text-[#737373]">
                            <span className="material-symbols-outlined text-[20px]">article</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-[#e5e5e5] mb-1">{verse.title}</h3>
                            <p className="text-[10px] technical-font text-[#525252] uppercase tracking-wider">
                                {verse.project} • {verse.updatedAt}
                            </p>
                        </div>
                    </div>
                    <span className="material-symbols-outlined text-[#404040] text-[18px] group-hover:text-[#737373] transition-colors">chevron_right</span>
                </div>
            ))}

            {verses.length === 0 && (
                <div className="text-center py-16 text-[#525252]">
                    <span className="material-symbols-outlined text-[48px] mb-4 block opacity-30">article</span>
                    <p className="text-[14px]">No verses yet. Start writing!</p>
                </div>
            )}
        </div>
    );
}

// ============================================
// TAKES VIEW
// ============================================
function TakesView({ takes }: { takes: typeof mockTakes }) {
    return (
        <div className="space-y-3">
            {takes.map((take) => (
                <div
                    key={take.id}
                    className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-[#262626] transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center text-[#737373]">
                            <span className="material-symbols-outlined text-[20px]">mic</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-[#e5e5e5] mb-1">{take.title}</h3>
                            <p className="text-[10px] technical-font text-[#525252] uppercase tracking-wider">
                                {take.duration} • {take.updatedAt}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-[#e5e5e5] hover:bg-[#262626] transition-colors">
                            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                        </button>
                        <span className="material-symbols-outlined text-[#404040] text-[18px] group-hover:text-[#737373] transition-colors">chevron_right</span>
                    </div>
                </div>
            ))}

            {takes.length === 0 && (
                <div className="text-center py-16 text-[#525252]">
                    <span className="material-symbols-outlined text-[48px] mb-4 block opacity-30">mic</span>
                    <p className="text-[14px]">No takes yet. Start recording!</p>
                </div>
            )}
        </div>
    );
}

// ============================================
// HELPERS
// ============================================
function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
