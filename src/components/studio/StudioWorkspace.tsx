"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { TextEditor } from "@/components/studio/TextEditor";
import { AudioPlayer } from "@/components/studio/AudioPlayer";
import { CreativeSidebar } from "@/components/studio/CreativeSidebar";
import { VaultBrowser } from "@/components/studio/VaultBrowser";
import { updateProjectStudio } from "@/app/actions";
import { cn } from "@/lib/utils";
import { Music, FileText, Sparkles, ChevronLeft, LayoutGrid } from "lucide-react";
import Link from "next/link";

interface StudioWorkspaceProps {
    project: any;
}

// Framer Motion Variants for Cinematic Entry
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1,
        },
    },
};

const panelVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: "easeOut" as any,
        },
    },
};

const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.4,
            ease: "easeOut" as any,
        },
    },
};

export function StudioWorkspace({ project }: StudioWorkspaceProps) {
    const [currentTrack, setCurrentTrack] = useState<string | undefined>(undefined);
    const [studioQuery, setStudioQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"vault" | "pad" | "engine">("pad");

    const saveLyrics = async (content: string) => {
        await updateProjectStudio(project.id, content);
    };

    const handleSelection = (text: string) => {
        setStudioQuery(text);
    };

    return (
        <main className="flex h-screen w-full flex-col overflow-hidden bg-vibecode-dark text-foreground">
            {/* Top Bar / Navigation - Cinematic Slide Down */}
            <motion.header
                variants={headerVariants}
                initial="hidden"
                animate="visible"
                className="flex h-14 items-center justify-between border-b border-vibecode-border bg-vibecode-dark/80 backdrop-blur-xl px-6 relative z-50"
            >
                <div className="flex items-center gap-4">
                    <Link href="/" className="md:hidden text-zinc-500 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </Link>
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring", stiffness: 500 }}
                        className="h-2 w-2 rounded-full bg-vibecode-primary shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                    />
                    <h1 className="font-serif text-[12px] md:text-lg italic tracking-tight text-white group cursor-default transition-all duration-700">
                        {project.title} <span className="font-mono text-[9px] not-italic tracking-[0.3em] font-normal text-white/20 ml-4 group-hover:text-vibecode-primary/40 transition-colors uppercase">{project.status}</span>
                    </h1>

                </div>
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.3 }}
                    className="flex items-center gap-2 md:gap-4 text-[8px] md:text-[10px] font-mono text-muted"
                >
                    <span className="px-2 md:px-3 py-1 bg-white/5 rounded-sm border border-white/5 uppercase tracking-tighter">
                        {project.bpm || 140} BPM
                    </span>
                    <span className="hidden sm:inline px-3 py-1 bg-white/5 rounded-sm border border-white/5 uppercase tracking-tighter">
                        {project.key || "C MIN"}
                    </span>
                </motion.div>

                {/* 1px Edge Light Header */}
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </motion.header>

            {/* Main Workspace - Staggered Panel Reveal */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid flex-1 grid-cols-1 md:grid-cols-12 overflow-hidden bg-vibecode-dark relative p-0 md:p-3 gap-3"
            >

                {/* Mobile Tab Container - Left: Audio & Vault */}
                <motion.div
                    variants={panelVariants}
                    className={cn(
                        "col-span-1 md:col-span-3 glass-panel flex flex-col overflow-hidden rounded-[16px]",
                        activeTab !== "vault" ? "hidden md:flex" : "flex"
                    )}
                >

                    <div className="p-4 border-b border-vibecode-border/50">
                        <h2 className="mb-4 text-[9px] font-bold uppercase tracking-[0.3em] text-muted">
                            01 // Master Monitor
                        </h2>
                        <AudioPlayer src={currentTrack} className="h-44 md:h-56 shadow-2xl" />
                    </div>

                    <div className="flex-1 p-4 overflow-hidden">
                        <h2 className="mb-4 text-[9px] font-bold uppercase tracking-[0.3em] text-muted">
                            02 // The Vault
                        </h2>
                        <VaultBrowser
                            projectId={project.id}
                            onSelectTrack={(url) => setCurrentTrack(url)}
                            className="h-[calc(100%-40px)]"
                        />
                    </div>
                </motion.div>

                {/* Center: The Pad */}
                <motion.div
                    variants={panelVariants}
                    className={cn(
                        "col-span-1 md:col-span-6 glass-panel relative overflow-hidden rounded-[16px]",
                        activeTab !== "pad" ? "hidden md:block" : "block"
                    )}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-vibecode-primary/[0.03] to-transparent pointer-events-none" />
                    <TextEditor
                        initialContent={project.description || ""}
                        onSave={saveLyrics}
                        onSelectionChange={handleSelection}
                        className="h-full"
                    />
                </motion.div>


                {/* Right: Creative Tools */}
                <motion.div
                    variants={panelVariants}
                    className={cn(
                        "col-span-1 md:col-span-3 h-full glass-panel overflow-hidden rounded-[16px]",
                        activeTab !== "engine" ? "hidden md:block" : "block"
                    )}
                >
                    <CreativeSidebar externalQuery={studioQuery} />
                </motion.div>

            </motion.div>

            {/* Mobile Bottom Navigation Bar */}
            <nav className="md:hidden flex h-20 border-t border-vibecode-border bg-vibecode-dark/95 backdrop-blur-2xl px-4 items-center justify-around z-50">
                <button
                    onClick={() => setActiveTab("vault")}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300",
                        activeTab === "vault" ? "text-vibecode-primary" : "text-zinc-600"
                    )}
                >
                    <div className={cn("p-2 rounded-xl transition-all", activeTab === "vault" ? "bg-vibecode-primary/10" : "bg-transparent")}>
                        <Music size={20} />
                    </div>
                    <span className="text-[9px] font-mono font-bold tracking-widest uppercase">Vault</span>
                </button>

                <button
                    onClick={() => setActiveTab("pad")}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300",
                        activeTab === "pad" ? "text-vibecode-primary" : "text-zinc-600"
                    )}
                >
                    <div className={cn("p-2 rounded-xl transition-all", activeTab === "pad" ? "bg-vibecode-primary/10" : "bg-transparent")}>
                        <FileText size={20} />
                    </div>
                    <span className="text-[9px] font-mono font-bold tracking-widest uppercase">The Pad</span>
                </button>

                <button
                    onClick={() => setActiveTab("engine")}
                    className={cn(
                        "flex flex-col items-center gap-1.5 transition-all duration-300",
                        activeTab === "engine" ? "text-vibecode-primary" : "text-zinc-600"
                    )}
                >
                    <div className={cn("p-2 rounded-xl transition-all", activeTab === "engine" ? "bg-vibecode-primary/10" : "bg-transparent")}>
                        <Sparkles size={20} />
                    </div>
                    <span className="text-[9px] font-mono font-bold tracking-widest uppercase">Engine</span>
                </button>
            </nav>
        </main>
    );
}
