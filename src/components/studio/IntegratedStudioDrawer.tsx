'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
    ChevronUp,
    ChevronDown,
    X,
    Zap,
    Type,
    BookOpen,
    Mic,
    Sparkles,
    Library,
    Home,
    Check
} from 'lucide-react';
import { useFlow } from './flow/FlowContext';
import { StudioToolSheet } from './flow/StudioToolSheet';
import { RecorderDrawer } from './RecorderDrawer';
import { MuseDrawer } from './MuseDrawer';

interface IntegratedStudioDrawerProps {
    viewMode: 'collection' | 'studio' | 'board';
    setViewMode: (v: 'collection' | 'studio' | 'board') => void;
    isFocusMode?: boolean;
    onRecordSave?: (blob: Blob, duration: number, beatOffset?: number) => void;
    backingTrackSrc?: string | null;
    backingAudioRef?: React.RefObject<HTMLAudioElement | null>;
}

// Snap heights
const SNAP_MINI = 72; // Just the tab bar
const SNAP_FULL = 480; // Expanded view

export const IntegratedStudioDrawer: React.FC<IntegratedStudioDrawerProps> = ({
    viewMode,
    setViewMode,
    isFocusMode = false,
    onRecordSave,
    backingTrackSrc,
    backingAudioRef
}) => {
    const { activeTool, setActiveTool } = useFlow();
    const [isExpanded, setIsExpanded] = useState(false);
    const [internalTab, setInternalTab] = useState<'suggest' | 'rhymes' | 'words'>('suggest');

    // Drag handling
    const dragY = useMotionValue(0);

    // Sync internal tab with activeTool from context
    useEffect(() => {
        if (activeTool === 'suggestions') setInternalTab('suggest');
        else if (activeTool === 'rhymes') setInternalTab('rhymes');
        else if (activeTool === 'words') setInternalTab('words');
    }, [activeTool]);

    const handleTabClick = (tab: typeof internalTab) => {
        const toolMap: Record<string, any> = {
            suggest: 'suggestions',
            rhymes: 'rhymes',
            words: 'words'
        };
        setActiveTool(toolMap[tab]);
        setInternalTab(tab);
        setIsExpanded(true);
    };

    const handleDragEnd = (_: any, info: any) => {
        if (info.offset.y > 50) {
            setIsExpanded(false);
        } else if (info.offset.y < -50) {
            setIsExpanded(true);
        }
        dragY.set(0);
    };

    const TABS = [
        { id: 'suggest', icon: <Zap size={20} />, label: 'Suggest' },
        { id: 'rhymes', icon: <Type size={20} />, label: 'Rhymes' },
        { id: 'words', icon: <BookOpen size={20} />, label: 'Words' },
    ];

    return (
        <div className="fixed inset-x-0 bottom-0 z-[150] pointer-events-none">
            {/* Dimmed background when expanded */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 pointer-events-auto"
                        onClick={() => setIsExpanded(false)}
                    />
                )}
            </AnimatePresence>

            <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                animate={{
                    y: isFocusMode && !isExpanded ? 100 : 0,
                    height: isExpanded ? SNAP_FULL : SNAP_MINI
                }}
                className="relative w-full max-w-2xl mx-auto glass shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 rounded-t-[2.5rem] pointer-events-auto overflow-hidden flex flex-col"
                style={{ y: dragY }}
            >
                {/* Drag Handle */}
                <div className="w-full h-6 flex items-center justify-center cursor-grab active:cursor-grabbing">
                    <div className="w-12 h-1 bg-white/20 rounded-full" />
                </div>

                {/* Tab Bar / Navigation */}
                <div className="flex items-center justify-around px-8 pb-2">
                    {TABS.map((tab) => {
                        const isActive = internalTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                id={`tour-${tab.id}-tab`}
                                onClick={() => handleTabClick(tab.id as any)}
                                className={`flex flex-col items-center gap-1 transition-all duration-300 relative py-2 px-6 rounded-2xl ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabBg"
                                        className="absolute inset-0 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-2xl"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <div className="relative z-10">{tab.icon}</div>
                                <span className="text-[10px] font-bold uppercase tracking-widest relative z-10">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Dynamic Content Area */}
                <AnimatePresence mode="wait">
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="flex-1 overflow-y-auto px-4 pb-12"
                        >
                            <div className="h-px w-full bg-white/5 mb-6" />

                            {(internalTab === 'suggest' || internalTab === 'rhymes' || internalTab === 'words') && (
                                <StudioToolSheet />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Focus Mode Indicator / Dismiss */}
                {isFocusMode && !isExpanded && (
                    <div className="absolute top-2 right-6">
                        <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    </div>
                )}
            </motion.div>
        </div>
    );
};
