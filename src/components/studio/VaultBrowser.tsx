"use client";

import React, { useState, useEffect } from "react";
import { Folder, Music, FileText, Upload, Trash2, Loader2, Play, HardDrive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/db";

interface Asset {
    id: string;
    name: string;
    file_url: string;
    type: string;
    created_at: string;
}

interface VaultBrowserProps {
    projectId: string;
    className?: string;
    onSelectTrack?: (url: string) => void;
}

export function VaultBrowser({ projectId, className, onSelectTrack }: VaultBrowserProps) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const fetchAssets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("tracks")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false });

        if (!error && data) {
            setAssets(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAssets();
    }, [projectId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split(".").pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `projects/${projectId}/tracks/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("assets")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("assets")
                .getPublicUrl(filePath);

            const { error: dbError } = await supabase
                .from("tracks")
                .insert([{
                    project_id: projectId,
                    name: file.name,
                    file_url: publicUrl,
                    type: "audio"
                }]);

            if (dbError) throw dbError;

            fetchAssets();
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (asset: Asset) => {
        try {
            await supabase.from("tracks").delete().eq("id", asset.id);
            setAssets(assets.filter((a: Asset) => a.id !== asset.id));
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-black/20 rounded-xl overflow-hidden", className)}>
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-white/20 text-[20px]">hard_drive</span>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                        Archive_01
                    </h3>
                </div>

                <label className="cursor-pointer group/upload">
                    <input type="file" className="hidden" onChange={handleUpload} accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/wave" disabled={uploading} />
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white text-black rounded-full px-4 py-2 hover:scale-105 active:scale-95 transition-all shadow-lg group-hover/upload:shadow-white/10">
                        {uploading ? (
                            <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                        ) : (
                            <span className="material-symbols-outlined text-[16px]">upload</span>
                        )}
                        {uploading ? "Busy" : "Load"}
                    </div>
                </label>
            </div>

            <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                {loading ? (
                    <div className="flex h-32 items-center justify-center opacity-30">
                        <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
                    </div>
                ) : assets.length > 0 ? (
                    <div className="space-y-1">
                        <AnimatePresence mode="popLayout">
                            {assets.map((asset: Asset, index: number) => (
                                <motion.div
                                    key={asset.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.03 }}
                                    className="group flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all cursor-default"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="h-10 w-10 shrink-0 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center text-white/20 group-hover:text-pink-500 transition-colors">
                                            <span className="material-symbols-outlined text-[20px]">music_note</span>
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-[13px] font-semibold text-white/80 truncate group-hover:text-white transition-colors">
                                                {asset.name}
                                            </span>
                                            <span className="text-[9px] text-white/20 uppercase font-mono tracking-tighter mt-0.5">
                                                ID: {asset.id.slice(0, 8)} // DATA_LOCKED
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            className="h-8 w-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                            onClick={() => onSelectTrack?.(asset.file_url)}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">play_circle</span>
                                        </button>
                                        <button
                                            className="h-8 w-8 rounded-full flex items-center justify-center text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                            onClick={() => handleDelete(asset)}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-48 py-10 opacity-30">
                        <span className="material-symbols-outlined text-[32px] mb-4">inventory_2</span>
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-center">
                            Archive_Empty // Null_Signal
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

