import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { CheckCircle2, Clock, Zap, ArrowLeft, ChevronDown, ChevronUp, Sparkles, ArrowRight, RefreshCw, Menu } from 'lucide-react';
import { Ritual, RitualStat, RitualExercise } from '../../types';
import { MASTER_RITUALS } from '../../lib/data/rituals';
import { getRandomPrompt, getMethodById } from '../../lib/creative/SongwritingKnowledge';
import { creative } from '../../lib/services/creative';
import { chatWithFacilitator } from '../../app/actions';
import { formatTime } from '@/lib/utils/time';

interface RitualsViewProps {
    stats: RitualStat[];
    onCompleteRitual: (stat: RitualStat) => void;
    onOpenSidebar?: () => void;
}

// ─── Card deck config ─────────────────────────────────────────────────────────

const CARD_ORDER = [
    'Technique',
    'Idea Curation',
    'Idea Generation',
    'Idea Development',
    'Idea Review',
    'Optimization',
];

const CARD_META: Record<string, { gradient: string; accentColor: string; label: string; backTint: string }> = {
    'Technique': {
        gradient: 'radial-gradient(ellipse at 15% 85%, #bbf7d0 0%, #ddd6fe 40%, #fbcfe8 75%, #fef9c3 100%)',
        accentColor: '#22c55e',
        label: 'TECHNIQUE',
        backTint: '#f0fdf4',
    },
    'Idea Curation': {
        gradient: 'radial-gradient(ellipse at 80% 15%, #ddd6fe 0%, #fbcfe8 45%, #bae6fd 100%)',
        accentColor: '#a855f7',
        label: 'CURATION',
        backTint: '#faf5ff',
    },
    'Idea Generation': {
        gradient: 'radial-gradient(ellipse at 20% 20%, #fed7aa 0%, #fbcfe8 45%, #fef9c3 100%)',
        accentColor: '#f97316',
        label: 'GENERATION',
        backTint: '#fff7ed',
    },
    'Idea Development': {
        gradient: 'radial-gradient(ellipse at 85% 85%, #bae6fd 0%, #bbf7d0 50%, #fef9c3 100%)',
        accentColor: '#0ea5e9',
        label: 'DEVELOPMENT',
        backTint: '#f0f9ff',
    },
    'Idea Review': {
        gradient: 'radial-gradient(ellipse at 50% 10%, #fef9c3 0%, #fbcfe8 50%, #ddd6fe 100%)',
        accentColor: '#eab308',
        label: 'REVIEW',
        backTint: '#fefce8',
    },
    'Optimization': {
        gradient: 'radial-gradient(ellipse at 75% 25%, #bbf7d0 0%, #bae6fd 50%, #ddd6fe 100%)',
        accentColor: '#10b981',
        label: 'OPTIMIZATION',
        backTint: '#ecfdf5',
    },
};

// ─── SVG Illustrations ────────────────────────────────────────────────────────

const StaircaseIllustration = () => (
    <svg viewBox="0 0 260 160" fill="none" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <rect
                key={i}
                x={18 + i * 28}
                y={130 - i * 16}
                width={26 + i * 2}
                height={11}
                rx={5.5}
                fill={`rgba(0,0,0,${0.08 + i * 0.10})`}
            />
        ))}
    </svg>
);

const SparkIllustration = () => {
    const pts = [
        { x: 30, y: 138, r: 6, o: 0.10 }, { x: 58, y: 122, r: 5, o: 0.14 },
        { x: 50, y: 100, r: 4, o: 0.18 }, { x: 88, y: 110, r: 7, o: 0.22 },
        { x: 78, y: 82, r: 5, o: 0.28 }, { x: 114, y: 92, r: 8, o: 0.33 },
        { x: 104, y: 62, r: 5.5, o: 0.40 }, { x: 144, y: 72, r: 9, o: 0.46 },
        { x: 132, y: 44, r: 6, o: 0.54 }, { x: 170, y: 52, r: 10, o: 0.61 },
        { x: 158, y: 24, r: 7, o: 0.70 }, { x: 200, y: 32, r: 12, o: 0.80 },
    ];
    return (
        <svg viewBox="0 0 260 160" fill="none" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={`rgba(0,0,0,${p.o})`} />
            ))}
        </svg>
    );
};

const BranchIllustration = () => (
    <svg viewBox="0 0 260 160" fill="none" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <circle cx={130} cy={140} r={9} fill="rgba(0,0,0,0.55)" />
        <line x1={130} y1={131} x2={80} y2={96} stroke="rgba(0,0,0,0.22)" strokeWidth={2.5} strokeLinecap="round" />
        <line x1={130} y1={131} x2={180} y2={96} stroke="rgba(0,0,0,0.22)" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={80} cy={88} r={8} fill="rgba(0,0,0,0.45)" />
        <circle cx={180} cy={88} r={8} fill="rgba(0,0,0,0.45)" />
        <line x1={80} y1={80} x2={44} y2={50} stroke="rgba(0,0,0,0.18)" strokeWidth={2} strokeLinecap="round" />
        <line x1={80} y1={80} x2={116} y2={50} stroke="rgba(0,0,0,0.18)" strokeWidth={2} strokeLinecap="round" />
        <line x1={180} y1={80} x2={144} y2={50} stroke="rgba(0,0,0,0.18)" strokeWidth={2} strokeLinecap="round" />
        <line x1={180} y1={80} x2={216} y2={50} stroke="rgba(0,0,0,0.18)" strokeWidth={2} strokeLinecap="round" />
        {[44, 116, 144, 216].map((x, i) => (
            <circle key={i} cx={x} cy={40} r={6} fill={`rgba(0,0,0,${0.28 + i * 0.06})`} />
        ))}
    </svg>
);

const StackIllustration = () => (
    <svg viewBox="0 0 260 160" fill="none" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {[0, 1, 2, 3, 4].map(i => (
            <rect
                key={i}
                x={28 + i * 10}
                y={30 + i * 26}
                width={204 - i * 20}
                height={18}
                rx={9}
                fill={`rgba(0,0,0,${0.58 - i * 0.09})`}
            />
        ))}
    </svg>
);

const ConcentricsIllustration = () => (
    <svg viewBox="0 0 260 160" fill="none" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {[68, 52, 36, 22, 10].map((r, i) => (
            <circle
                key={i}
                cx={130}
                cy={80}
                r={r}
                stroke={`rgba(0,0,0,${0.10 + i * 0.12})`}
                strokeWidth={i === 4 ? 9 : 2.5}
                fill="none"
            />
        ))}
    </svg>
);

const WaveIllustration = () => {
    const xs = [20, 52, 84, 116, 148, 180, 212, 244];
    const ys = [110, 68, 100, 52, 90, 58, 105, 72];
    const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
    return (
        <svg viewBox="0 0 260 160" fill="none" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <path d={d} stroke="rgba(0,0,0,0.15)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {xs.map((x, i) => (
                <circle key={i} cx={x} cy={ys[i]} r={6.5} fill={`rgba(0,0,0,${0.14 + i * 0.08})`} />
            ))}
        </svg>
    );
};

const ILLUSTRATIONS: Record<string, React.FC> = {
    'Technique': StaircaseIllustration,
    'Idea Curation': StackIllustration,
    'Idea Generation': SparkIllustration,
    'Idea Development': BranchIllustration,
    'Idea Review': ConcentricsIllustration,
    'Optimization': WaveIllustration,
};

// ─── Segmented ring icon ──────────────────────────────────────────────────────

const SegmentedRingIcon = ({ color, size = 28 }: { color: string; size?: number }) => {
    const segs = 8;
    const r = size * 0.36;
    const c = size / 2;
    const segAngle = (2 * Math.PI) / segs;
    const gap = 0.42;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
            {Array.from({ length: segs }, (_, i) => {
                const a0 = i * segAngle - Math.PI / 2;
                const a1 = a0 + segAngle - gap;
                const x1 = (c + r * Math.cos(a0)).toFixed(2);
                const y1 = (c + r * Math.sin(a0)).toFixed(2);
                const x2 = (c + r * Math.cos(a1)).toFixed(2);
                const y2 = (c + r * Math.sin(a1)).toFixed(2);
                return (
                    <path
                        key={i}
                        d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                        stroke={color}
                        strokeWidth={size * 0.078}
                        strokeLinecap="round"
                    />
                );
            })}
        </svg>
    );
};

// ─── Stacked Card Deck ────────────────────────────────────────────────────────

const PEEK = 54;
const NUM_BACK = 4;
const INSET = 11;

interface CardDeckProps {
    onSelectCategory: (cat: string) => void;
    ritualStats: RitualStat[];
}

const CardDeck: React.FC<CardDeckProps> = ({ onSelectCategory, ritualStats }) => {
    const [frontIdx, setFrontIdx] = useState(0);
    const y = useMotionValue(0);
    const dragging = useRef(false);

    const getCard = (offset: number) => CARD_ORDER[(frontIdx + offset) % CARD_ORDER.length];

    const advance = () => {
        animate(y, -720, { duration: 0.3, ease: [0.4, 0, 0.6, 1] }).then(() => {
            setFrontIdx(i => (i + 1) % CARD_ORDER.length);
            y.set(0);
        });
    };

    const onDragEnd = (_: unknown, info: PanInfo) => {
        if (info.offset.y < -52 || info.velocity.y < -400) {
            advance();
        } else {
            animate(y, 0, { type: 'spring', stiffness: 420, damping: 34 });
        }
        dragging.current = false;
    };

    const frontCat = getCard(0);
    const frontMeta = CARD_META[frontCat];
    const Illus = ILLUSTRATIONS[frontCat];
    const ritualCount = MASTER_RITUALS.filter(r => r.category === frontCat).length;
    const doneToday = ritualStats.filter(s =>
        MASTER_RITUALS.find(r => r.id === s.ritualId && r.category === frontCat) &&
        new Date(s.completedAt).toDateString() === new Date().toDateString()
    ).length;

    return (
        <div className="flex flex-col h-full">
            <p className="text-center text-[9px] tracking-[0.2em] uppercase text-[var(--text-tertiary)] opacity-40 pt-1 pb-2 shrink-0">
                swipe up · tap to open
            </p>

            <div className="relative flex-1 min-h-0 mx-3">
                {/* Back cards */}
                {Array.from({ length: NUM_BACK }, (_, i) => {
                    const stackLevel = NUM_BACK - 1 - i;
                    const category = getCard(stackLevel + 1);
                    const meta = CARD_META[category];
                    const insetPx = (stackLevel + 1) * INSET;
                    const topPx = i * PEEK;

                    return (
                        <div
                            key={`back-${i}`}
                            className="absolute rounded-[28px] overflow-hidden"
                            style={{
                                top: topPx,
                                bottom: 0,
                                left: insetPx,
                                right: insetPx,
                                background: meta.backTint,
                                boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                                zIndex: i + 1,
                            }}
                        >
                            <div className="flex items-center gap-2.5 px-5" style={{ paddingTop: 18, paddingBottom: 14 }}>
                                <SegmentedRingIcon color="#c4c4cc" size={26} />
                                <span className="text-[11px] font-semibold tracking-[0.18em] text-[#a8a8b3]">
                                    {meta.label}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Front card */}
                <motion.div
                    drag="y"
                    dragConstraints={{ bottom: 0, top: -16 }}
                    dragElastic={{ top: 0.28, bottom: 0 }}
                    onDragStart={() => { dragging.current = true; }}
                    onDragEnd={onDragEnd}
                    style={{ y, top: NUM_BACK * PEEK, bottom: 0, left: 0, right: 0, zIndex: NUM_BACK + 2, position: 'absolute' }}
                    className="rounded-[28px] overflow-hidden cursor-grab active:cursor-grabbing"
                    whileTap={{ scale: 0.975 }}
                    transition={{ scale: { type: 'spring', stiffness: 400, damping: 28 } }}
                    onClick={() => { if (!dragging.current) onSelectCategory(frontCat); }}
                >
                    <div
                        className="flex flex-col h-full"
                        style={{
                            background: frontMeta.gradient,
                            boxShadow: '0 8px 48px rgba(0,0,0,0.14)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-0 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <SegmentedRingIcon color={frontMeta.accentColor} size={30} />
                                <span
                                    className="text-[11px] font-semibold tracking-[0.18em]"
                                    style={{ color: frontMeta.accentColor }}
                                >
                                    {frontMeta.label}
                                </span>
                            </div>
                            {doneToday > 0 && (
                                <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-black/10 text-black/40">
                                    <CheckCircle2 size={10} />
                                    {doneToday} done
                                </span>
                            )}
                        </div>

                        {/* Illustration */}
                        <div className="flex-1 flex items-center justify-center px-4 py-2 min-h-0">
                            <div className="w-full" style={{ maxHeight: 160 }}>
                                <Illus />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 pb-6 shrink-0">
                            <p className="text-[26px] font-bold text-black/80 leading-tight tracking-tight">
                                {frontCat}
                            </p>
                            <p className="text-[13px] text-black/35 mt-1 font-medium">
                                {ritualCount} practice{ritualCount !== 1 ? 's' : ''} · tap to explore
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-1.5 py-4 shrink-0">
                {CARD_ORDER.map((_, i) => {
                    const active = i === frontIdx % CARD_ORDER.length;
                    return (
                        <div
                            key={i}
                            className="rounded-full transition-all duration-300"
                            style={{
                                width: active ? 18 : 5,
                                height: 5,
                                background: active
                                    ? CARD_META[CARD_ORDER[frontIdx % CARD_ORDER.length]].accentColor
                                    : 'rgba(128,128,140,0.3)',
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// ─── Exercise Panel ───────────────────────────────────────────────────────────

// ─── Method Chips ─────────────────────────────────────────────────────────────

const MethodChips: React.FC<{ methodIds: string[] }> = ({ methodIds }) => {
    const [expanded, setExpanded] = useState<string | null>(null);
    if (methodIds.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2 justify-center">
            {methodIds.map(id => {
                const method = getMethodById(id);
                if (!method) return null;
                const isOpen = expanded === id;
                return (
                    <div key={id} className="flex flex-col items-center">
                        <button onClick={() => setExpanded(isOpen ? null : id)}
                            className={`px-3 py-1 rounded-full text-xs border transition-all ${isOpen ? 'bg-[var(--accent)] text-[var(--bg-main)] border-[var(--accent)]' : 'border-[var(--border-main)] text-[var(--text-secondary)] hover:border-[var(--accent)]'}`}>
                            {method.name}
                        </button>
                        {isOpen && (
                            <div className="mt-2 max-w-xs bg-[var(--bg-secondary)] border border-[var(--accent)]/30 rounded-xl p-3 text-left space-y-1.5 z-10">
                                <p className="text-xs text-[var(--accent)] font-medium">{method.tagline}</p>
                                <p className="text-xs text-[var(--text-secondary)]"><span className="text-[var(--text-tertiary)]">Formula: </span>{method.formula}</p>
                                <p className="text-xs text-[var(--text-tertiary)]"><span className="text-[var(--text-secondary)]">Use when: </span>{method.when}</p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const RitualsView: React.FC<RitualsViewProps> = ({ stats, onCompleteRitual, onOpenSidebar }) => {
    const [activeRitual, setActiveRitual] = useState<Ritual | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [prepStepsOpen, setPrepStepsOpen] = useState(false);
    const [exercisesOpen, setExercisesOpen] = useState(true);
    const [ritualNotes, setRitualNotes] = useState('');

    // --- Redesigned Active Session States ---
    const [activeMode, setActiveMode] = useState<'guide' | 'sandbox'>('guide');
    const [activeToolTab, setActiveToolTab] = useState<'prompt' | 'ai' | 'dictionary' | null>(null);
    const [currentPrompt, setCurrentPrompt] = useState('');
    const [wordInput, setWordInput] = useState('');
    const [lookupResults, setLookupResults] = useState<string[]>([]);
    const [aiResult, setAiResult] = useState('');
    const [loadingTool, setLoadingTool] = useState(false);
    const [activeToolType, setActiveToolType] = useState<'rhyme' | 'synonym' | null>(null);

    useEffect(() => {
        if (endTime === null) return;
        const timer = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) setEndTime(null);
        }, 1000);
        return () => clearInterval(timer);
    }, [endTime]);

    const handleWordLookup = useCallback(async (wordTool: { type: string; label: string }) => {
        if (!wordInput.trim() || !wordTool) return;
        setLoadingTool(true);
        setLookupResults([]);
        setActiveToolType(wordTool.type as 'rhyme' | 'synonym');
        try {
            const res = wordTool.type === 'rhyme'
                ? await creative.getRhymes(wordInput.trim())
                : await creative.getSynonyms(wordInput.trim());
            setLookupResults(res.slice(0, 16));
        } catch {
            setLookupResults([]);
        } finally {
            setLoadingTool(false);
        }
    }, [wordInput]);

    const handleGeminiSuggest = useCallback(async (ritual: Ritual, geminiTool: { type: string; label: string }) => {
        if (!geminiTool) return;
        setLoadingTool(true);
        setAiResult('');
        setActiveToolType(null);
        try {
            const { reply } = await chatWithFacilitator(
                `I'm doing a "${ritual.title}" session. Give me one specific songwriting action I can take right now based on the methods for this ritual.`,
                { projectTitle: '', sections: [], scraps: [], recentSessions: [], activeView: 'rituals', ritualContext: `${ritual.title} — ${ritual.description}`, sessionPhase: 'starting' }
            );
            setAiResult(reply);
        } catch {
            setAiResult('Could not reach the AI. Try again in a moment.');
        } finally {
            setLoadingTool(false);
        }
    }, []);

    const handleStartRitual = (ritual: Ritual) => {
        setActiveRitual(ritual);
        setTimeLeft(ritual.durationMinutes * 60);
        setEndTime(Date.now() + ritual.durationMinutes * 60 * 1000);
        setCompletedSteps(new Set());
        setRitualNotes('');
        setPrepStepsOpen(true);
        setExercisesOpen(true);
        setActiveMode('guide');

        // Reset sandbox toolkit states
        setCurrentPrompt('');
        setWordInput('');
        setLookupResults([]);
        setAiResult('');

        // Determine first available tab
        const wordTool = ritual.liveTools?.find(t => t.type === 'rhyme' || t.type === 'synonym') ?? null;
        const geminiTool = ritual.liveTools?.find(t => t.type === 'gemini-prompt') ?? null;
        const hasPrompt = !!ritual.promptCategory;
        if (hasPrompt) {
            setActiveToolTab('prompt');
        } else if (geminiTool) {
            setActiveToolTab('ai');
        } else if (wordTool) {
            setActiveToolTab('dictionary');
        } else {
            setActiveToolTab(null);
        }
    };

    const handleCompleteRitual = () => {
        if (!activeRitual) return;
        onCompleteRitual({ ritualId: activeRitual.id, completedAt: new Date().toISOString(), durationMinutes: activeRitual.durationMinutes });
        setActiveRitual(null);
        setTimeLeft(null);
        setEndTime(null);
    };

    const toggleStep = (index: number) => {
        setCompletedSteps(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            
            // Auto collapse when all prep steps are checked
            if (activeRitual && next.size === activeRitual.prepSteps.length) {
                setPrepStepsOpen(false);
            } else {
                setPrepStepsOpen(true);
            }
            return next;
        });
    };

    const getEnergyColor = (level: Ritual['energyLevel']) => {
        switch (level) {
            case 'High': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
            case 'Medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
            case 'Low': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            default: return 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-[var(--border-main)]';
        }
    };

    // ── Active ritual session ─────────────────────────────────────────────────
    if (activeRitual) {
        const hasExercises = (activeRitual.exercises?.length ?? 0) > 0;
        const hasPromptCategory = !!activeRitual.promptCategory;
        const hasLiveTools = (activeRitual.liveTools?.length ?? 0) > 0;
        const wordTool = activeRitual.liveTools?.find(t => t.type === 'rhyme' || t.type === 'synonym') ?? null;
        const geminiTool = activeRitual.liveTools?.find(t => t.type === 'gemini-prompt') ?? null;

        return (
            <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden">
                {/* Header with integrated small timer */}
                <header className="px-6 py-3 border-b border-[var(--border-main)] flex items-center justify-between sticky top-0 z-10 bg-[var(--bg-main)]/90 backdrop-blur-md">
                    <button 
                        onClick={() => setActiveRitual(null)} 
                        className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors -ml-2"
                        title="Go Back"
                    >
                        <ArrowLeft size={18} className="text-[var(--text-secondary)]" />
                    </button>
                    
                    <div className="text-center flex-1 mx-3 min-w-0">
                        <h2 className="text-xs font-semibold tracking-wide truncate uppercase text-[var(--text-secondary)]">
                            {activeRitual.title}
                        </h2>
                        {timeLeft !== null && (
                            <div className="text-sm font-mono tracking-tight font-semibold text-[var(--accent)] flex items-center justify-center gap-1.5 mt-0.5">
                                <Clock size={12} className="text-[var(--text-tertiary)]" />
                                <span>{formatTime(timeLeft)}</span>
                                <span className="text-[var(--text-tertiary)] font-sans font-normal text-xs">/ {activeRitual.durationMinutes}m</span>
                            </div>
                        )}
                    </div>
                    
                    {/* Placeholder matching width of back button to keep title perfectly centered */}
                    <div className="w-9 h-9" />
                </header>

                {/* Sub-header horizontal progress bar */}
                <div className="h-0.5 w-full bg-[var(--border-subtle)] relative shrink-0">
                    <div 
                        className="h-full bg-[var(--accent)] transition-all duration-1000 ease-linear"
                        style={{ 
                            width: `${timeLeft !== null ? (1 - (timeLeft / (activeRitual.durationMinutes * 60))) * 100 : 100}%` 
                        }}
                    />
                </div>

                {/* Main Toggle (Guide vs Workspace) */}
                <div className="px-4 pt-4 shrink-0 max-w-md w-full mx-auto">
                    <div className="flex bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-0.5 rounded-xl">
                        <button
                            onClick={() => setActiveMode('guide')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                activeMode === 'guide'
                                    ? 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] shadow-sm'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-transparent'
                            }`}
                        >
                            Routine Guide
                        </button>
                        <button
                            onClick={() => setActiveMode('sandbox')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                activeMode === 'sandbox'
                                    ? 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] shadow-sm'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-transparent'
                            }`}
                        >
                            Sandbox Workspace
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center gap-4 max-w-md w-full mx-auto pb-24">
                    
                    {/* Method Chips (contextual) */}
                    {(activeRitual.methods?.length ?? 0) > 0 && (
                        <div className="w-full shrink-0 flex justify-center py-1">
                            <MethodChips methodIds={activeRitual.methods!} />
                        </div>
                    )}

                    {activeMode === 'guide' ? (
                        /* ================== ROUTINE GUIDE VIEW ================== */
                        <div className="w-full space-y-4">
                            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-4 shadow-md">
                                <button
                                    onClick={() => setPrepStepsOpen(!prepStepsOpen)}
                                    className="w-full flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 text-left hover:text-[var(--text-main)] transition-colors group focus-visible:outline-none"
                                >
                                    <h3 className="text-[11px] font-medium text-[var(--text-tertiary)] flex items-center gap-2 group-hover:text-[var(--text-secondary)] transition-colors">
                                        warm-up steps
                                        {completedSteps.size === activeRitual.prepSteps.length && (
                                            <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/20 font-normal">
                                                all done
                                            </span>
                                        )}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                                            {completedSteps.size} / {activeRitual.prepSteps.length}
                                        </span>
                                        {prepStepsOpen ? <ChevronUp size={14} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={14} className="text-[var(--text-tertiary)]" />}
                                    </div>
                                </button>

                                {/* Prep steps */}
                                {prepStepsOpen && (
                                    <div className="space-y-1 pt-2">
                                        {activeRitual.prepSteps.map((step, idx) => {
                                            const isDone = completedSteps.has(idx);
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => toggleStep(idx)}
                                                    className={`w-full flex items-start gap-3 text-left p-2.5 rounded-xl transition-all ${
                                                        isDone 
                                                            ? 'text-[var(--text-tertiary)] line-through opacity-60' 
                                                            : 'hover:bg-[var(--bg-hover)]'
                                                    }`}
                                                >
                                                    <div
                                                        className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-200 ${
                                                            isDone
                                                                ? 'bg-[var(--accent)]'
                                                                : 'border border-[var(--text-tertiary)]/50'
                                                        }`}
                                                    />
                                                    <span className="text-xs leading-normal">{step}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Exercises */}
                                {hasExercises && (
                                    <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
                                        <h4 className="text-[11px] font-medium text-[var(--text-tertiary)]">exercises</h4>
                                        <div className="space-y-4">
                                            {activeRitual.exercises!.map((ex, i) => (
                                                <div 
                                                    key={i} 
                                                    className="border-l-2 border-[var(--accent)]/40 pl-3.5 py-1 space-y-2"
                                                >
                                                    <div className="space-y-0.5">
                                                        <span className="text-[9px] text-[var(--accent)]/60 font-mono tracking-widest uppercase">
                                                            {String(i + 1).padStart(2, '0')}
                                                        </span>
                                                        <p className="text-sm font-semibold text-[var(--text-main)] leading-tight">
                                                            {ex.title}
                                                        </p>
                                                    </div>
                                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                                        {ex.instruction}
                                                    </p>
                                                    
                                                    {/* Minimal Exercise input fields */}
                                                    {ex.inputFields && ex.inputFields.length > 0 ? (
                                                        <div className="space-y-4 pt-2">
                                                            {ex.inputFields.map((label, fIdx) => (
                                                                <div key={fIdx} className="space-y-1.5">
                                                                    <label className="text-[10px] text-[var(--text-tertiary)]/70 italic block">
                                                                        {label}
                                                                    </label>
                                                                    <textarea
                                                                        rows={2}
                                                                        placeholder="just write…"
                                                                        className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)]/60 rounded-none px-0 pb-2 pt-0.5 text-xs resize-none focus:outline-none focus:border-b-[var(--accent)] transition-colors text-[var(--text-main)] leading-relaxed placeholder:text-[var(--text-tertiary)]/30 placeholder:italic"
                                                                        style={{ borderBottomWidth: '1px' }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="pt-2">
                                                            <textarea
                                                                rows={3}
                                                                placeholder="whatever comes…"
                                                                className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)]/60 rounded-none px-0 pb-2 pt-0.5 text-xs resize-none focus:outline-none transition-colors text-[var(--text-main)] leading-relaxed placeholder:text-[var(--text-tertiary)]/30 placeholder:italic"
                                                                style={{ borderBottomWidth: '1px' }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* ================== SANDBOX WORKSPACE VIEW ================== */
                        <div className="w-full space-y-4">
                            {/* Tabbed Creative Toolkit */}
                            {(hasPromptCategory || hasLiveTools) && (
                                <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden flex flex-col shadow-md">
                                    {/* Tabs Header */}
                                    <div className="flex bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] px-2">
                                        {hasPromptCategory && (
                                            <button
                                                onClick={() => setActiveToolTab('prompt')}
                                                className={`py-2 px-3 text-xs font-semibold border-b-2 transition-all ${
                                                    activeToolTab === 'prompt'
                                                        ? 'border-[var(--accent)] text-[var(--text-main)] font-semibold'
                                                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                                                }`}
                                            >
                                                Prompt
                                            </button>
                                        )}
                                        {geminiTool && (
                                            <button
                                                onClick={() => setActiveToolTab('ai')}
                                                className={`py-2 px-3 text-xs font-semibold border-b-2 transition-all ${
                                                    activeToolTab === 'ai'
                                                        ? 'border-[var(--accent)] text-[var(--text-main)] font-semibold'
                                                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                                                }`}
                                            >
                                                AI Assist
                                            </button>
                                        )}
                                        {wordTool && (
                                            <button
                                                onClick={() => setActiveToolTab('dictionary')}
                                                className={`py-2 px-3 text-xs font-semibold border-b-2 transition-all ${
                                                    activeToolTab === 'dictionary'
                                                        ? 'border-[var(--accent)] text-[var(--text-main)] font-semibold'
                                                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                                                }`}
                                            >
                                                Lookup
                                            </button>
                                        )}
                                    </div>

                                    {/* Tab Contents */}
                                    <div className="p-4 min-h-[96px] flex flex-col justify-center bg-[var(--bg-card)]">
                                        {activeToolTab === 'prompt' && hasPromptCategory && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-mono">Creative Spark</span>
                                                    <button 
                                                        onClick={() => setCurrentPrompt(getRandomPrompt(activeRitual.promptCategory!))}
                                                        className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1 font-semibold"
                                                    >
                                                        <RefreshCw size={10} className={loadingTool ? 'animate-spin' : ''} />
                                                        {currentPrompt ? 'New Prompt' : 'Generate'}
                                                    </button>
                                                </div>
                                                {currentPrompt ? (
                                                    <p className="text-xs text-[var(--text-main)] italic leading-relaxed border-l border-[var(--accent)]/40 pl-3">
                                                        {currentPrompt}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-[var(--text-tertiary)] italic text-center py-2">
                                                        Tap generate to get a writing prompt
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {activeToolTab === 'ai' && geminiTool && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-mono">Facilitator Suggestions</span>
                                                    <button 
                                                        onClick={() => handleGeminiSuggest(activeRitual, geminiTool)}
                                                        disabled={loadingTool}
                                                        className="text-[10px] text-[var(--accent)] hover:underline disabled:opacity-40 flex items-center gap-1 font-semibold"
                                                    >
                                                        <Sparkles size={10} className={loadingTool ? 'animate-spin' : ''} />
                                                        {loadingTool ? 'Thinking…' : aiResult ? 'Suggest New' : 'Get Suggestion'}
                                                    </button>
                                                </div>
                                                {aiResult ? (
                                                    <p className="text-xs text-[var(--text-main)] leading-relaxed border-l border-[var(--accent)]/40 pl-3">
                                                        {aiResult}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-[var(--text-tertiary)] italic text-center py-2">
                                                        Request an AI-generated actionable suggestion
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {activeToolTab === 'dictionary' && wordTool && (
                                            <div className="space-y-3">
                                                <div className="flex gap-2">
                                                    <input 
                                                        value={wordInput} 
                                                        onChange={e => setWordInput(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleWordLookup(wordTool)} 
                                                        placeholder={`Enter word for ${wordTool.type}s…`}
                                                        className="flex-1 bg-black/15 border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)]"
                                                    />
                                                    <button 
                                                        onClick={() => handleWordLookup(wordTool)} 
                                                        disabled={loadingTool || !wordInput.trim()}
                                                        className="px-3 bg-[var(--accent)] text-[var(--bg-main)] rounded-lg text-xs font-semibold disabled:opacity-40 transition-opacity flex items-center justify-center"
                                                    >
                                                        {loadingTool ? <RefreshCw size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                                                    </button>
                                                </div>
                                                {lookupResults.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 pt-1">
                                                        {lookupResults.map((r, i) => (
                                                            <button 
                                                                key={i} 
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(r);
                                                                }} 
                                                                title="Click to Copy"
                                                                className="px-2.5 py-0.5 rounded-full bg-black/15 border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-main)] transition-colors active:scale-95"
                                                            >
                                                                {r}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Scratchpad Card */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 flex flex-col space-y-3 shadow-md">
                                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                                    <h3 className="text-[11px] font-medium text-[var(--text-tertiary)]">
                                        {activeRitual.category?.includes('Idea') ? 'scratchpad' : 'session notes'}
                                    </h3>
                                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-mono">
                                        {ritualNotes.split(/\s+/).filter(Boolean).length} words
                                    </span>
                                </div>
                                <textarea 
                                    value={ritualNotes} 
                                    onChange={e => setRitualNotes(e.target.value)}
                                    placeholder={activeRitual.category?.includes('Idea') ? 'Capture lyrics, ideas, and song thoughts here…' : 'Jot down technical notes, practice insights, or progress…'}
                                    className="w-full min-h-[220px] bg-black/10 border border-[var(--border-subtle)] rounded-xl p-3 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all text-[var(--text-main)] leading-relaxed" 
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Complete Footer */}
                <div className="p-4 border-t border-[var(--border-main)] bg-[var(--bg-main)]/90 backdrop-blur-md sticky bottom-0 z-10 flex justify-center shrink-0">
                    <button 
                        onClick={handleCompleteRitual} 
                        className="w-full max-w-md py-3.5 rounded-xl font-semibold bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 active:scale-[0.98] transition-all text-sm"
                    >
                        Complete this practice
                    </button>
                </div>
            </div>
        );
    }

    // ── Category ritual list ──────────────────────────────────────────────────
    if (selectedCategory) {
        const categoryRituals = MASTER_RITUALS.filter(r => r.category === selectedCategory);
        const meta = CARD_META[selectedCategory];

        return (
            <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
                <header className="px-6 py-4 border-b border-[var(--border-main)] flex items-center justify-between sticky top-0 z-10 surface">
                    <button onClick={() => setSelectedCategory(null)} className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors -ml-2">
                        <ArrowLeft size={20} className="text-[var(--text-secondary)]" />
                    </button>
                    <div className="flex items-center gap-2">
                        {meta && <SegmentedRingIcon color={meta.accentColor} size={24} />}
                        <h2 className="text-base font-semibold">{selectedCategory}</h2>
                    </div>
                    <div className="w-9" />
                </header>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoryRituals.map(ritual => {
                        const isCompletedToday = stats.some(s =>
                            s.ritualId === ritual.id &&
                            new Date(s.completedAt).toDateString() === new Date().toDateString()
                        );
                        const hasExtras = (ritual.exercises?.length ?? 0) > 0 || !!ritual.promptCategory || (ritual.liveTools?.length ?? 0) > 0;

                        return (
                            <button key={ritual.id} onClick={() => handleStartRitual(ritual)}
                                className="text-left bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl p-5 hover:border-[var(--text-tertiary)] transition-colors flex flex-col relative overflow-hidden h-[200px]">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-medium">{ritual.title}</h3>
                                    {isCompletedToday && <CheckCircle2 size={16} className="text-green-400 shrink-0" />}
                                </div>
                                <p className="text-sm text-[var(--text-secondary)] line-clamp-3">{ritual.description}</p>
                                {hasExtras && (
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {(ritual.exercises?.length ?? 0) > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                                                {ritual.exercises!.length} exercise{ritual.exercises!.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {!!ritual.promptCategory && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-tertiary)]">prompts</span>
                                        )}
                                        {(ritual.liveTools?.length ?? 0) > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-tertiary)]">live tools</span>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 mt-auto">
                                    <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] bg-[var(--bg-main)] px-2 py-1 rounded-md">
                                        <Clock size={12} />{ritual.durationMinutes}m
                                    </span>
                                    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${getEnergyColor(ritual.energyLevel)}`}>
                                        <Zap size={10} className="fill-current" />{ritual.energyLevel}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Card deck main view ───────────────────────────────────────────────────
    const todayCount = stats.filter(s =>
        new Date(s.completedAt).toDateString() === new Date().toDateString()
    ).length;

    return (
        <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden">
            <header className="px-6 py-8 border-b border-[var(--border-main)] surface z-10 sticky top-0 flex items-center gap-3 shrink-0">
                {onOpenSidebar && (
                    <button
                        onClick={onOpenSidebar}
                        className="p-2 -ml-2 rounded-xl hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer"
                        title="Open Menu"
                    >
                        <Menu size={20} />
                    </button>
                )}
                <div>
                    <h1 className="text-2xl font-medium tracking-tight">Practice</h1>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        {todayCount === 0 ? 'None completed today' : `${todayCount} completed today`}
                    </p>
                </div>
            </header>

            <div className="flex-1 min-h-0 pb-1">
                <CardDeck onSelectCategory={setSelectedCategory} ritualStats={stats} />
            </div>
        </div>
    );
};
