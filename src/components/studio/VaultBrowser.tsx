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

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from("assets")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from("assets")
                .getPublicUrl(filePath);

            // 3. Register in DB
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
            // 1. Delete from DB
            await supabase.from("tracks").delete().eq("id", asset.id);

            // 2. Delete from Storage (optional but good practice)
            // Note: We need the path from the URL or store it in DB. For now just DB cleanup.

            setAssets(assets.filter((a: Asset) => a.id !== asset.id));
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-vibecode-dark/20 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm", className)}>
            <div className="flex items-center justify-between p-4 border-b border-vibecode-border/40 bg-white/5">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                    <HardDrive size={14} className="text-vibecode-primary" />
                    Archive_01 // THE_VAULT
                </h3>

                <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={handleUpload} accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/wave" disabled={uploading} />
                    <div className="flex items-center gap-2 text-[9px] font-mono font-bold uppercase tracking-widest bg-vibecode-primary hover:bg-opacity-90 transition-all rounded px-4 py-2 text-white shadow-[0_4px_12px_rgba(249,115,22,0.2)]">
                        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        In_Put
                    </div>
                </label>
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {loading ? (
                    <div className="flex h-32 items-center justify-center">
                        <Loader2 className="animate-spin text-vibecode-primary/40" size={24} />
                    </div>
                ) : assets.length > 0 ? (
                    <div className="space-y-1.5">
                        <AnimatePresence mode="popLayout">
                            {assets.map((asset: Asset, index: number) => (
                                <motion.div
                                    key={asset.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="group flex items-center justify-between p-3 rounded bg-white/[0.02] hover:bg-white/[0.05] transition-all border border-white/5 hover:border-vibecode-primary/20"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="h-9 w-9 shrink-0 rounded bg-black/60 border border-white/5 flex items-center justify-center text-zinc-500 group-hover:text-vibecode-primary transition-colors">
                                            <Music size={16} />
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-xs font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                                                {asset.name.toLowerCase()}
                                            </span>
                                            <span className="text-[8px] text-zinc-600 uppercase font-mono tracking-tighter">
                                                ID: {asset.id.slice(0, 8)} // DATA_LOADED
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-vibecode-primary hover:bg-vibecode-primary/10"
                                            onClick={() => onSelectTrack?.(asset.file_url)}
                                        >
                                            <Play size={14} fill="currentColor" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-zinc-600 hover:text-red-400 hover:bg-red-400/10"
                                            onClick={() => handleDelete(asset)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-48 py-10">
                        <div className="h-12 w-12 rounded-full border border-dashed border-zinc-800 flex items-center justify-center mb-6">
                            <Music size={20} className="text-zinc-800" />
                        </div>
                        <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest text-center px-10 leading-relaxed">
                            STORAGE_EMPTY // NO_SIGNALS_DETECTED
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
