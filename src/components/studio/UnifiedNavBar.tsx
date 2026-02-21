'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Library, PenTool, LayoutGrid, Search,
    ArrowLeft, Zap, Type, BookOpen,
} from 'lucide-react';
import { useFlow } from './flow/FlowContext';
import type { ToolType } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'collection' | 'studio' | 'board';

interface NavSlot {
    key: string;
    icon: React.ReactNode;
    label?: string;
    active?: boolean;
    onClick: () => void;
    /** If true this slot dims when another tool is active */
    isToolSlot?: boolean;
}

interface Props {
    viewMode: ViewMode;
    setViewMode: (v: ViewMode) => void;
    showSearch: boolean;
    setShowSearch: (v: boolean) => void;
    showRecorder: boolean;
    recorderMinimized: boolean;
    onRecordPress: () => void;
    isFocusMode?: boolean;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const iconVariants = {
    initial: { opacity: 0, scale: 0.6, y: 6 },
    animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
    exit: { opacity: 0, scale: 0.5, y: -6, transition: { duration: 0.12 } },
};

const labelVariants = {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0, transition: { delay: 0.06, duration: 0.2 } },
    exit: { opacity: 0, y: -4, transition: { duration: 0.1 } },
};

// ─── Record dot (center anchor — never changes) ────────────────────────────

const RecordButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
    <motion.button
        onClick={onPress}
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.08 }}
        className="w-11 h-11 rounded-xl flex items-center justify-center mx-1"
        style={{
            background: 'var(--accent)',
            boxShadow: '0 0 18px rgba(165,139,255,0.35)',
        }}
        aria-label="Record"
    >
        <motion.div
            className="w-3 h-3 rounded-full"
            style={{ background: 'var(--bg-main)' }}
        />
    </motion.button>
);

// ─── Single nav/tool slot ─────────────────────────────────────────────────────

const Slot: React.FC<{
    slotKey: string;
    icon: React.ReactNode;
    label?: string;
    active: boolean;
    dimmed: boolean;
    onClick: () => void;
}> = ({ slotKey, icon, label, active, dimmed, onClick }) => (
    <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.88 }}
        className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl"
        style={{ minWidth: 44, opacity: dimmed ? 0.35 : 1, transition: 'opacity 200ms' }}
        aria-label={label}
    >
        <AnimatePresence mode="wait" initial={false}>
            <motion.span
                key={slotKey}
                variants={iconVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{
                    color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {icon}
            </motion.span>
        </AnimatePresence>

        {/* Active dot */}
        <AnimatePresence>
            {active && (
                <motion.div
                    key="dot"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        position: 'absolute',
                        bottom: 2,
                    }}
                />
            )}
        </AnimatePresence>
    </motion.button>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const UnifiedNavBar: React.FC<Props> = ({
    viewMode,
    setViewMode,
    showSearch,
    setShowSearch,
    showRecorder,
    recorderMinimized,
    onRecordPress,
    isFocusMode = false,
}) => {
    const { activeTool, setActiveTool } = useFlow();
    const isStudio = viewMode === 'studio';
    const isRecorderOpen = showRecorder && !recorderMinimized;

    // ---- Slot definitions -----------------------------------------------

    // Left slot — back arrow in studio, Library icon otherwise
    const leftSlot: NavSlot = isStudio
        ? {
            key: 'nav-back',
            icon: <ArrowLeft size={20} strokeWidth={1.8} />,
            label: 'Back',
            active: false,
            onClick: () => { setActiveTool(null); setViewMode('collection'); },
        }
        : {
            key: 'nav-library',
            icon: <Library size={20} strokeWidth={1.8} />,
            label: 'Library',
            active: viewMode === 'collection',
            onClick: () => setViewMode('collection'),
        };

    // Left-center slot — Suggest tool in studio
    const leftCenterSlot: NavSlot = isStudio
        ? {
            key: 'tool-suggest',
            icon: <Zap size={20} strokeWidth={1.8} />,
            label: 'Suggest',
            active: activeTool === 'suggestions',
            onClick: () => setActiveTool(activeTool === 'suggestions' ? null : 'suggestions' as ToolType),
            isToolSlot: true,
        }
        : {
            key: 'nav-studio',
            icon: <PenTool size={20} strokeWidth={1.8} />,
            label: 'Studio',
            active: false,
            onClick: () => setViewMode('studio'),
        };

    // Right-center slot — Rhymes tool in studio
    const rightCenterSlot: NavSlot = isStudio
        ? {
            key: 'tool-rhymes',
            icon: <Type size={20} strokeWidth={1.8} />,
            label: 'Rhymes',
            active: activeTool === 'rhymes',
            onClick: () => setActiveTool(activeTool === 'rhymes' ? null : 'rhymes' as ToolType),
            isToolSlot: true,
        }
        : {
            key: 'nav-board',
            icon: <LayoutGrid size={20} strokeWidth={1.8} />,
            label: 'Board',
            active: viewMode === 'board',
            onClick: () => setViewMode('board'),
        };

    // Right slot — Words tool in studio
    const rightSlot: NavSlot = isStudio
        ? {
            key: 'tool-words',
            icon: <BookOpen size={20} strokeWidth={1.8} />,
            label: 'Words',
            active: activeTool === 'words',
            onClick: () => setActiveTool(activeTool === 'words' ? null : 'words' as ToolType),
            isToolSlot: true,
        }
        : {
            key: 'nav-search',
            icon: <Search size={20} strokeWidth={1.8} />,
            label: 'Search',
            active: showSearch,
            onClick: () => setShowSearch(true),
        };

    const slots = [leftSlot, leftCenterSlot, rightCenterSlot, rightSlot];
    const hasActiveTool = !!activeTool;

    return (
        <motion.nav
            layout
            className="fixed bottom-6 left-1/2 z-[110]"
            style={{ translateX: '-50%' }}
            animate={{
                y: isRecorderOpen || hasActiveTool || isFocusMode ? 120 : 0,
                opacity: isRecorderOpen || hasActiveTool || isFocusMode ? 0 : 1,
                pointerEvents: hasActiveTool || isFocusMode ? 'none' : 'auto',
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        >
            <motion.div
                layout
                className="glass-nav flex items-center px-2 py-2 rounded-2xl shadow-2xl border border-[var(--border-main)] backdrop-blur-3xl"
                style={{
                    borderColor: isStudio
                        ? 'rgba(165,139,255,0.18)'
                        : 'var(--border-main)',
                    transition: 'border-color 400ms',
                }}
            >
                {/* Left 2 slots */}
                {slots.slice(0, 2).map((slot, i) => (
                    <Slot
                        key={`slot-${i}`}
                        slotKey={slot.key}
                        icon={slot.icon}
                        label={slot.label}
                        active={!!slot.active}
                        dimmed={hasActiveTool && !!slot.isToolSlot && !slot.active}
                        onClick={slot.onClick}
                    />
                ))}

                {/* Divider */}
                <div className="w-px h-6 bg-[var(--border-main)] mx-1" />

                {/* Record anchor */}
                <RecordButton onPress={onRecordPress} />

                {/* Divider */}
                <div className="w-px h-6 bg-[var(--border-main)] mx-1" />

                {/* Right 2 slots */}
                {slots.slice(2).map((slot, i) => (
                    <Slot
                        key={`slot-${i + 2}`}
                        slotKey={slot.key}
                        icon={slot.icon}
                        label={slot.label}
                        active={!!slot.active}
                        dimmed={hasActiveTool && !!slot.isToolSlot && !slot.active}
                        onClick={slot.onClick}
                    />
                ))}
            </motion.div>
        </motion.nav>
    );
};
