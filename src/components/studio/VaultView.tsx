"use client";

import React, { useMemo, memo, useContext, useEffect, useRef, useState, createContext } from 'react';
import {
    Library, Music, FileText, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
    LayoutGrid, Maximize2, List
} from 'lucide-react';
import { Button } from "../ui/button";
import { LyricScrap, RecordingSession, Beat, RitualStat } from '../../types';
import {
  animate,
  cubicBezier,
  motion,
  useMotionValue,
  wrap,
  AnimatePresence,
} from "framer-motion";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// --- Types & Context ---
type GridVariant = "default" | "masonry" | "premium";
type LayoutMode = "infinite" | "grid";
const GridVariantContext = createContext<GridVariant | undefined>(undefined);

const formatTime = (seconds: number = 0) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// --- Sub-Components (Gallery Cards) ---

const CustomSlider = ({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) => {
  return (
    <motion.div
      className={cn(
        "relative w-full h-1 bg-white/10 rounded-full cursor-pointer",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        onChange(Math.min(Math.max(percentage, 0), 100));
      }}
    >
      <motion.div
        className="absolute top-0 left-0 h-full bg-white rounded-full"
        style={{ width: `${value}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </motion.div>
  );
};

const VaultAudioCard = ({ 
    id, 
    title, 
    type,
    isPlaying, 
    onPlay,
    currentTime,
    duration,
    cover,
    compact = false
}: { 
    id: string, 
    title: string, 
    type: 'session' | 'beat',
    isPlaying: boolean, 
    onPlay: (id: string) => void,
    currentTime: number,
    duration: number,
    cover?: string,
    compact?: boolean
}) => {
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <motion.div
            className={cn(
                "relative flex flex-col mx-auto rounded-3xl overflow-hidden bg-[#11111198] shadow-[0_0_20px_rgba(0,0,0,0.2)] backdrop-blur-md p-3 w-full h-full border border-white/5",
                compact && "h-auto"
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            layout
        >
            <motion.div className="flex flex-col relative h-full justify-between" layout>
                {/* Cover Area */}
                <motion.div className={cn(
                    "bg-white/5 overflow-hidden rounded-[16px] w-full relative flex items-center justify-center",
                    compact ? "h-[120px]" : "h-[160px]"
                )}>
                    {cover ? (
                        <img src={cover} alt="cover" className="object-cover w-full h-full" />
                    ) : (
                        <div className="flex flex-col items-center gap-2 opacity-20">
                            {type === 'session' ? <FileText size={compact ? 32 : 48} /> : <Music size={compact ? 32 : 48} />}
                        </div>
                    )}
                    {isPlaying && (
                        <div className="absolute inset-x-0 bottom-0 h-10 flex items-end gap-0.5 px-4 pb-2">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <motion.div 
                                    key={i} 
                                    className="bg-white/40 w-1 rounded-full" 
                                    animate={{ height: [`${20 + Math.random() * 40}%`, `${60 + Math.random() * 40}%`, `${20 + Math.random() * 40}%`] }}
                                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.05 }}
                                />
                            ))}
                        </div>
                    )}
                </motion.div>

                <motion.div className="flex flex-col w-full gap-y-2 mt-2">
                    <motion.h3 className="text-white font-bold text-xs text-center truncate px-2">
                        {title}
                    </motion.h3>

                    <motion.div className="flex flex-col gap-y-1">
                        <CustomSlider
                            value={isPlaying ? progress : 0}
                            onChange={() => {}}
                            className="w-full"
                        />
                        <div className="flex items-center justify-between px-0.5">
                            <span className="text-white/40 text-[9px] mono">
                                {isPlaying ? formatTime(currentTime) : "0:00"}
                            </span>
                            <span className="text-white/40 text-[9px] mono">
                                {isPlaying ? formatTime(duration) : "0:00"}
                            </span>
                        </div>
                    </motion.div>

                    <motion.div className="flex items-center justify-center w-full">
                        <div className="flex items-center gap-1 bg-white/5 rounded-[12px] p-1 border border-white/5">
                            <Button variant="ghost" size="icon" className="text-white/40 hover:text-white h-6 w-6 rounded-full">
                                <Shuffle size={12} />
                            </Button>
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPlay(id);
                                }}
                                variant="ghost"
                                size="icon"
                                className="text-white bg-white/10 hover:bg-white hover:text-black h-7 w-7 rounded-full transition-all"
                            >
                                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="text-white/40 hover:text-white h-6 w-6 rounded-full">
                                <Repeat size={12} />
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            </motion.div>
        </motion.div>
    );
};

const VaultStickyNote = ({ scrap }: { scrap: LyricScrap }) => (
    <div className="h-full bg-yellow-200/90 p-5 shadow-xl rotate-[-1deg] flex flex-col justify-between rounded-sm border-t-2 border-yellow-300">
        <p className="text-sm text-yellow-900 font-medium leading-relaxed italic">
            "{scrap.text}"
        </p>
        <div className="flex justify-between items-center mt-4 border-t border-yellow-900/10 pt-3">
            <div className="flex items-center gap-1.5 opacity-40">
                <FileText size={12} className="text-yellow-900" />
                <span className="text-[10px] font-bold text-yellow-900 uppercase">Scrap</span>
            </div>
            <span className="text-[9px] mono text-yellow-900/40 uppercase tracking-widest">{scrap.id.substring(0, 4)}</span>
        </div>
    </div>
);

// --- Motion Variants for Grid ---
const rowVariants = {
  initial: { opacity: 0, scale: 0.8, y: 20 },
  animate: () => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: Math.random() * 0.2,
      duration: 0.6,
      ease: cubicBezier(0.18, 0.71, 0.11, 1),
    },
  }),
};

// --- Gallery Logic Components ---

const DraggableContainer = ({
  className,
  children,
  variant = "premium",
}: {
  className?: string;
  children: React.ReactNode;
  variant?: GridVariant;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const container = ref.current?.getBoundingClientRect();
    if (!container) return;
    const { width, height } = container;

    const xDrag = x.on("change", (latest) => {
      x.set(wrap(-(width / 2), 0, latest));
    });
    const yDrag = y.on("change", (latest) => {
      y.set(wrap(-(height / 2), 0, latest));
    });

    const handleWheelScroll = (event: WheelEvent) => {
      if (!isDragging) {
        animate(y, y.get() - event.deltaY * 2.7, {
          type: "tween",
          duration: 1.2,
          ease: cubicBezier(0.18, 0.71, 0.11, 1),
        });
      }
    };

    window.addEventListener("wheel", handleWheelScroll);
    return () => {
      xDrag();
      yDrag();
      window.removeEventListener("wheel", handleWheelScroll);
    };
  }, [x, y, isDragging]);

  return (
    <GridVariantContext.Provider value={variant}>
      <div className="h-full w-full overflow-hidden relative cursor-grab active:cursor-grabbing">
        <motion.div
          className={cn(
            "grid h-fit w-fit grid-cols-[repeat(2,1fr)] bg-[#0a0a0a] will-change-transform",
            className,
          )}
          drag
          dragMomentum={true}
          dragTransition={{
            timeConstant: 200,
            power: 0.2,
            restDelta: 0.5,
            bounceStiffness: 0,
          }}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          style={{ x, y }}
          ref={ref}
        >
          {children}
        </motion.div>
      </div>
    </GridVariantContext.Provider>
  );
};

const GridItem = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const variant = useContext(GridVariantContext);
  const gridItemStyles = cva(
    "overflow-hidden hover:cursor-pointer w-[280px] h-[360px] will-change-transform",
    {
      variants: {
        variant: {
          default: "rounded-sm",
          masonry: "even:mt-[60%] rounded-sm ",
          premium: "transition-all duration-500 even:mt-[30%]",
        },
      },
      defaultVariants: { variant: "premium" },
    },
  );

  return (
    <motion.div
      className={cn(gridItemStyles({ variant, className }))}
      variants={rowVariants}
      initial="initial"
      animate="animate"
    >
      {children}
    </motion.div>
  );
};

const GridBody = memo(({ children, className }: { children: React.ReactNode; className?: string }) => {
    const variant = useContext(GridVariantContext);
    const gridBodyStyles = cva("grid grid-cols-[repeat(6,1fr)] h-fit w-fit", {
      variants: {
        variant: {
          default: "gap-14 p-7 md:gap-28 md:p-14",
          masonry: "gap-x-14 px-7 md:gap-x-28 md:px-14",
          premium: "gap-x-14 px-10 md:gap-x-20 md:px-20 py-20",
        },
      },
      defaultVariants: { variant: "premium" },
    });

    return (
      <>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={cn(gridBodyStyles({ variant, className }))}>
            {children}
          </div>
        ))}
      </>
    );
});

GridBody.displayName = "GridBody";

// --- Main Component ---

interface VaultViewProps {
    sessions: RecordingSession[];
    scraps: LyricScrap[];
    beats: Beat[];
    projectTitle: string;
    onPlaySession: (id: string) => void;
    playingSessionId: string | null;
    onPlayBeat: (id: string) => void;
    playingBeatId: string | null;
    currentTime: number;
    duration: number;
    ritualStats: RitualStat[];
}

export const VaultView: React.FC<VaultViewProps> = ({
    sessions, scraps, beats,
    projectTitle, onPlaySession, playingSessionId,
    onPlayBeat, playingBeatId,
    currentTime, duration, ritualStats
}) => {
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('infinite');
    const titleDisplay = projectTitle || 'Untitled Project';

    const items = useMemo(() => {
        return [
            ...sessions.map(s => ({ type: 'session' as const, data: s })),
            ...scraps.map(s => ({ type: 'scrap' as const, data: s })),
            ...beats.map(b => ({ type: 'beat' as const, data: b }))
        ];
    }, [sessions, scraps, beats]);

    const infiniteItems = useMemo(() => {
        let displayItems = [...items];
        if (displayItems.length > 0) {
            while (displayItems.length < 12) {
                displayItems = [...displayItems, ...items];
            }
        }
        return displayItems;
    }, [items]);

    return (
        <div className="relative flex flex-col h-full bg-[#0a0a0a] text-[var(--text-main)] overflow-hidden">
            {/* Subtle Overlay HUD for Context */}
            <div className="absolute top-0 left-0 right-0 p-6 z-[60] pointer-events-none flex justify-between items-start bg-gradient-to-b from-black/90 to-transparent">
                <div className="pointer-events-auto">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                        <h2 className="text-[10px] mono uppercase tracking-[0.2em] text-[var(--accent)] font-bold">The Archive</h2>
                    </div>
                    <h1 className="text-2xl font-medium tracking-tight text-white">{titleDisplay}</h1>
                </div>
                <div className="flex flex-col items-end gap-3 pointer-events-auto">
                    <div className="flex bg-white/5 p-1 rounded-full border border-white/10 backdrop-blur-md">
                        <button 
                            onClick={() => setLayoutMode('infinite')}
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                layoutMode === 'infinite' ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
                            )}
                        >
                            <Maximize2 size={16} />
                        </button>
                        <button 
                            onClick={() => setLayoutMode('grid')}
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                layoutMode === 'grid' ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
                            )}
                        >
                            <LayoutGrid size={16} />
                        </button>
                    </div>
                    <span className="text-[10px] mono text-white/40 uppercase tracking-widest">{items.length} Elements</span>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {items.length === 0 ? (
                    <motion.div 
                        key="empty"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center text-center p-10"
                    >
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white/10 mb-6 border border-white/5">
                            <Library size={40} strokeWidth={1} />
                        </div>
                        <h3 className="text-white/60 font-medium tracking-tight text-lg">Your vault is a blank canvas</h3>
                        <p className="text-[10px] mono text-white/20 mt-3 uppercase tracking-[0.3em]">Record, write, and experiment to fill the void</p>
                    </motion.div>
                ) : layoutMode === 'infinite' ? (
                    <motion.div 
                        key="infinite"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="h-full w-full"
                    >
                        <DraggableContainer variant="premium" className="pt-32">
                            <GridBody>
                                {infiniteItems.map((item, idx) => (
                                    <GridItem key={`${item.type}-${idx}`}>
                                        {item.type === 'session' && (
                                            <VaultAudioCard 
                                                id={(item.data as RecordingSession).id}
                                                title={(item.data as RecordingSession).name || 'Untitled Take'}
                                                type="session"
                                                isPlaying={playingSessionId === (item.data as RecordingSession).id}
                                                onPlay={onPlaySession}
                                                currentTime={playingSessionId === (item.data as RecordingSession).id ? currentTime : 0}
                                                duration={playingSessionId === (item.data as RecordingSession).id ? duration : 0}
                                            />
                                        )}
                                        {item.type === 'scrap' && (
                                            <VaultStickyNote scrap={item.data as LyricScrap} />
                                        )}
                                        {item.type === 'beat' && (
                                            <VaultAudioCard 
                                                id={(item.data as Beat).id}
                                                title={(item.data as Beat).name}
                                                type="beat"
                                                isPlaying={playingBeatId === (item.data as Beat).id}
                                                onPlay={onPlayBeat}
                                                currentTime={playingBeatId === (item.data as Beat).id ? currentTime : 0}
                                                duration={playingBeatId === (item.data as Beat).id ? duration : 0}
                                            />
                                        )}
                                    </GridItem>
                                ))}
                            </GridBody>
                        </DraggableContainer>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="grid"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 overflow-y-auto px-6 pt-32 pb-32 scrollbar-hide"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {items.map((item, idx) => (
                                <div key={`${item.type}-${idx}`}>
                                    {item.type === 'session' && (
                                        <VaultAudioCard 
                                            id={(item.data as RecordingSession).id}
                                            title={(item.data as RecordingSession).name || 'Untitled Take'}
                                            type="session"
                                            isPlaying={playingSessionId === (item.data as RecordingSession).id}
                                            onPlay={onPlaySession}
                                            currentTime={playingSessionId === (item.data as RecordingSession).id ? currentTime : 0}
                                            duration={playingSessionId === (item.data as RecordingSession).id ? duration : 0}
                                            compact={true}
                                        />
                                    )}
                                    {item.type === 'scrap' && (
                                        <div className="h-[200px]">
                                            <VaultStickyNote scrap={item.data as LyricScrap} />
                                        </div>
                                    )}
                                    {item.type === 'beat' && (
                                        <VaultAudioCard 
                                            id={(item.data as Beat).id}
                                            title={(item.data as Beat).name}
                                            type="beat"
                                            isPlaying={playingBeatId === (item.data as Beat).id}
                                            onPlay={onPlayBeat}
                                            currentTime={playingBeatId === (item.data as Beat).id ? currentTime : 0}
                                            duration={playingBeatId === (item.data as Beat).id ? duration : 0}
                                            compact={true}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Instruction Overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 text-[9px] mono uppercase tracking-[0.2em] text-white/40 pointer-events-none z-50 shadow-2xl">
                {layoutMode === 'infinite' ? 'Infinite Canvas Grid' : 'Standard Grid View'}
            </div>
        </div>
    );
};
