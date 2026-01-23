"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Loader2, Zap, Cloud, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

interface Rhyme {
    word: string;
    score: number;
    numSyllables: number;
}

type SearchMode = "rel_rhy" | "rel_nry" | "ml";

export interface CreativeSidebarProps {
    className?: string;
    externalQuery?: string;
}

export function CreativeSidebar({ className, externalQuery }: CreativeSidebarProps) {
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState<SearchMode>("rel_rhy");
    const [results, setResults] = useState<Rhyme[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (externalQuery) {
            setQuery(externalQuery);
            fetchResults(externalQuery, mode);
        }
    }, [externalQuery]);

    const fetchResults = async (word: string, currentMode: SearchMode) => {
        if (!word) return;
        setLoading(true);
        try {
            const res = await fetch(`https://api.datamuse.com/words?${currentMode}=${encodeURIComponent(word)}&max=25`);
            const data = await res.json();
            setResults(data);
        } catch (err) {
            console.error("Failed to fetch songwriting data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            fetchResults(query, mode);
        }
    };

    const modes = [
        { id: "rel_rhy", label: "Perfect", icon: Zap },
        { id: "rel_nry", label: "Slant", icon: Cloud },
        { id: "ml", label: "Vibe", icon: Compass },
    ];

    return (
        <div className={cn("flex h-full flex-col border-l border-vibecode-border bg-black/40 backdrop-blur-3xl", className)}>
            <div className="border-b border-white/5 p-5">
                <motion.h3
                    initial="hidden"
                    animate="visible"
                    variants={{
                        visible: { transition: { staggerChildren: 0.05 } }
                    }}
                    className="mb-6 flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.4em] text-white/30"
                >
                    <Sparkles size={11} className="text-vibecode-primary animate-pulse" />
                    {"Creative // Intelligence".split("").map((char, i) => (
                        <motion.span
                            key={i}
                            variants={{
                                hidden: { opacity: 0, y: 10, filter: "blur(5px)" },
                                visible: { opacity: 1, y: 0, filter: "blur(0px)" }
                            }}
                        >
                            {char}
                        </motion.span>
                    ))}
                </motion.h3>


                <div className="relative mb-5 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/5 transition-colors group-hover:text-vibecode-primary/40 truncate" size={13} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="INPUT SIGNAL..."
                        className="w-full rounded-[4px] bg-white/[0.02] border border-white/5 py-3 pl-10 pr-4 text-[11px] font-mono text-white/60 placeholder:text-white/10 focus:outline-none focus:border-vibecode-primary/30 focus:bg-white/[0.04] transition-all uppercase tracking-[0.2em]"
                    />
                </div>

                <div className="flex gap-1.5 p-1 rounded-[6px] bg-white/[0.02] border border-white/5">
                    {modes.map((m) => (
                        <button
                            key={m.id}
                            onClick={() => {
                                setMode(m.id as SearchMode);
                                fetchResults(query, m.id as SearchMode);
                            }}
                            className={cn(
                                "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-[4px] text-[8px] font-mono font-bold uppercase tracking-[0.15em] transition-all duration-300",
                                mode === m.id
                                    ? "bg-vibecode-primary/5 text-vibecode-primary border border-vibecode-primary/10 shadow-[inner_0_0_10px_rgba(249,115,22,0.05)]"
                                    : "text-white/20 hover:text-white/40 hover:bg-white/[0.02]"
                            )}
                        >
                            <m.icon size={11} className={cn("transition-transform", mode === m.id && "scale-110")} />
                            {m.label}
                        </button>
                    ))}
                </div>

            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                {loading ? (
                    <div className="flex h-32 items-center justify-center">
                        <Loader2 className="animate-spin text-vibecode-primary/40" size={24} />
                    </div>
                ) : results.length > 0 ? (
                    <div className="space-y-1.5">
                        {results.map((item) => (
                            <motion.div
                                initial={{ opacity: 0, x: 5 }}
                                animate={{ opacity: 1, x: 0 }}
                                key={item.word}
                                className="group flex cursor-pointer items-center justify-between rounded px-3 py-2.5 hover:bg-vibecode-primary/5 border border-transparent hover:border-vibecode-primary/10 transition-all"
                            >
                                <span className="text-xs font-medium text-zinc-400 group-hover:text-vibecode-primary transition-colors tracking-wide">
                                    {item.word.toLowerCase()}
                                </span>
                                {item.numSyllables && (
                                    <span className="text-[8px] font-mono text-vibecode-primary/40 bg-vibecode-primary/5 px-2 py-0.5 rounded-full border border-vibecode-primary/10 uppercase">
                                        {item.numSyllables} SYL
                                    </span>
                                )}
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-20 text-center px-10">
                        <Compass className="mx-auto mb-5 text-zinc-900" size={40} strokeWidth={1} />
                        <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest leading-relaxed">
                            {query ? "DATA NOT FOUND" : "WAITING FOR INPUT SIGNAL..."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
