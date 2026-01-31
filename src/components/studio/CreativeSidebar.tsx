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
        { id: "rel_rhy", label: "Perfect", icon: "offline_bolt" },
        { id: "rel_nry", label: "Slant", icon: "cloud" },
        { id: "ml", label: "Vibe", icon: "explore" },
    ];

    return (
        <div className={cn("flex h-full flex-col bg-transparent", className)}>
            <div className="p-5 border-b border-white/5">
                <div className="flex items-center gap-2 mb-6 opacity-30">
                    <span className="material-symbols-outlined text-[18px] text-pink-500 animate-pulse">auto_awesome</span>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                        Engine
                    </h3>
                </div>

                <div className="relative mb-6 group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-[18px] transition-colors group-hover:text-pink-500/50">search</span>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="SEARCH ENGINE"
                        className="w-full rounded-2xl bg-white/5 border border-white/5 py-4 pl-10 pr-4 text-[13px] font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-white/10 focus:bg-white/10 transition-all"
                    />
                </div>

                <div className="flex gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/5">
                    {modes.map((m) => (
                        <button
                            key={m.id}
                            onClick={() => {
                                setMode(m.id as SearchMode);
                                fetchResults(query, m.id as SearchMode);
                            }}
                            className={cn(
                                "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-300",
                                mode === m.id
                                    ? "bg-white text-black shadow-lg shadow-white/5"
                                    : "text-white/30 hover:text-white/50 hover:bg-white/5"
                            )}
                        >
                            <span className={cn("material-symbols-outlined text-[18px]", mode === m.id && "fill-current")}>
                                {m.icon}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest">{m.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                {loading ? (
                    <div className="flex h-32 items-center justify-center opacity-30">
                        <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
                    </div>
                ) : results.length > 0 ? (
                    <div className="space-y-1">
                        {results.map((item, index) => (
                            <motion.div
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.02 }}
                                key={item.word}
                                className="group flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all"
                            >
                                <span className="text-[14px] font-medium text-white/50 group-hover:text-white transition-colors">
                                    {item.word.toLowerCase()}
                                </span>
                                {item.numSyllables && (
                                    <span className="text-[9px] font-mono font-bold text-white/20 uppercase tracking-tighter">
                                        {item.numSyllables} SYL
                                    </span>
                                )}
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-48 py-10 opacity-20">
                        <span className="material-symbols-outlined text-[32px] mb-4">analytics</span>
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-center">
                            {query ? "Null_Result" : "Engine_Idle"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

