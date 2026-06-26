import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useMotionValue, animate, PanInfo } from 'framer-motion';
import { CheckCircle2, Clock, Zap, ArrowLeft, MoreVertical, ChevronDown, ChevronUp, Sparkles, ArrowRight, RefreshCw } from 'lucide-react';
import { Ritual, RitualStat, RitualExercise } from '../../types';
import { MASTER_RITUALS } from '../../lib/data/rituals';
import { getRandomPrompt, getMethodById } from '../../lib/creative/SongwritingKnowledge';
import { creative } from '../../lib/services/creative';
import { chatWithFacilitator } from '../../app/actions';
import { formatTime } from '@/lib/utils/time';

interface RitualsViewProps {
    stats: RitualStat[];
    onCompleteRitual: (stat: RitualStat) => void;
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

const CARD_META: Record<string, {
    gradient: string;
    accentColor: string;
    label: string;
}> = {
    'Technique': {
        gradient: 'radial-gradient(ellipse at 20% 85%, #c8f5e0 0%, #e0d8ff 45%, #ffd6eb 80%, #fffbd4 100%)',
        accentColor: '#4ade80',
        label: 'TECHNIQUE',
    },
    'Idea Curation': {
        gradient: 'radial-gradient(ellipse at 75% 20%, #e0d8ff 0%, #ffd6eb 50%, #d6f0ff 100%)',
        accentColor: '#c084fc',
        label: 'CURATION',
    },
    'Idea Generation': {
        gradient: 'radial-gradient(ellipse at 20% 20%, #ffd6eb 0%, #ffe4d6 45%, #fffbd4 100%)',
        accentColor: '#fb923c',
        label: 'GENERATION',
    },
    'Idea Development': {
        gradient: 'radial-gradient(ellipse at 80% 80%, #d6f0ff 0%, #c8f5e0 50%, #fffbd4 100%)',
        accentColor: '#38bdf8',
        label: 'DEVELOPMENT',
    },
    'Idea Review': {
        gradient: 'radial-gradient(ellipse at 50% 10%, #fffbd4 0%, #ffd6eb 50%, #e0d8ff 100%)',
        accentColor: '#facc15',
        label: 'REVIEW',
    },
    'Optimization': {
        gradient: 'radial-gradient(ellipse at 80% 20%, #c8f5e0 0%, #d6f0ff 50%, #e0d8ff 100%)',
        accentColor: '#34d399',
        label: 'OPTIMIZATION',
    },
};

// ─── SVG illustrations (one per category) ─────────────────────────────────────

const StaircaseIllustration = () => (
    <svg viewBox="0 0 220 130" fill="none" className="w-full h-full">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <rect
                key={i}
                x={22 + i * 27}
                y={105 - i * 15}
                width={22 + i * 1.5}
                height={9}
                rx={4.5}
                fill={`rgba(0,0,0,${0.10 + i * 0.11})`}
            />
        ))}
    </svg>
);

const SparkIllustration = () => {
    const points = [
        { x: 40, y: 100, r: 5, o: 0.15 }, { x: 65, y: 88, r: 4, o: 0.2 },
        { x: 55, y: 70, r: 3.5, o: 0.25 }, { x: 90, y: 78, r: 5.5, o: 0.28 },
        { x: 80, y: 55, r: 4, o: 0.35 }, { x: 110, y: 65, r: 6, o: 0.38 },
        { x: 100, y: 42, r: 4.5, o: 0.45 }, { x: 135, y: 50, r: 7, o: 0.5 },
        { x: 125, y: 28, r: 5, o: 0.58 }, { x: 160, y: 35, r: 8, o: 0.65 },
        { x: 150, y: 15, r: 5.5, o: 0.72 }, { x: 185, y: 22, r: 9, o: 0.8 },
    ];
    return (
        <svg viewBox="0 0 220 130" fill="none" className="w-full h-full">
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={`rgba(0,0,0,${p.o})`} />
            ))}
        </svg>
    );
};

const BranchIllustration = () => (
    <svg viewBox="0 0 220 130" fill="none" className="w-full h-full">
        <circle cx={110} cy={110} r={7} fill="rgba(0,0,0,0.55)" />
        <line x1={110} y1={103} x2={70} y2={72} stroke="rgba(0,0,0,0.25)" strokeWidth={2} strokeLinecap="round" />
        <line x1={110} y1={103} x2={150} y2={72} stroke="rgba(0,0,0,0.25)" strokeWidth={2} strokeLinecap="round" />
        <circle cx={70} cy={65} r={6} fill="rgba(0,0,0,0.45)" />
        <circle cx={150} cy={65} r={6} fill="rgba(0,0,0,0.45)" />
        <line x1={70} y1={59} x2={45} y2={32} stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} strokeLinecap="round" />
        <line x1={70} y1={59} x2={95} y2={32} stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} strokeLinecap="round" />
        <line x1={150} y1={59} x2={125} y2={32} stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} strokeLinecap="round" />
        <line x1={150} y1={59} x2={175} y2={32} stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} strokeLinecap="round" />
        {[45, 95, 125, 175].map((x, i) => (
            <circle key={i} cx={x} cy={25} r={4.5} fill={`rgba(0,0,0,${0.28 + i * 0.04})`} />
        ))}
    </svg>
);

const StackIllustration = () => (
    <svg viewBox="0 0 220 130" fill="none" className="w-full h-full">
        {[0, 1, 2, 3].map(i => (
            <rect
                key={i}
                x={35 + i * 6}
                y={30 + i * 22}
                width={150 - i * 12}
                height={16}
                rx={8}
                fill={`rgba(0,0,0,${0.55 - i * 0.1})`}
            />
        ))}
    </svg>
);

const ConcentricsIllustration = () => (
    <svg viewBox="0 0 220 130" fill="none" className="w-full h-full">
        {[48, 36, 24, 14, 6].map((r, i) => (
            <circle
                key={i}
                cx={110}
                cy={65}
                r={r}
                stroke={`rgba(0,0,0,${0.15 + i * 0.12})`}
                strokeWidth={i === 4 ? 6 : 2}
                fill="none"
            />
        ))}
    </svg>
);

const WaveIllustration = () => {
    const pts = [20, 45, 70, 95, 120, 145, 170, 195];
    const ys = [80, 50, 75, 40, 70, 45, 80, 55];
    const d = pts.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
    return (
        <svg viewBox="0 0 220 130" fill="none" className="w-full h-full">
            <path d={d} stroke="rgba(0,0,0,0.18)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((x, i) => (
                <circle key={i} cx={x} cy={ys[i]} r={5} fill={`rgba(0,0,0,${0.2 + i * 0.08})`} />
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

const SegmentedRingIcon = ({ color }: { color: string }) => {
    const segments = 8;
    const r = 10;
    const cx = 14;
    const cy = 14;
    const segAngle = (2 * Math.PI) / segments;
    const gap = 0.45;

    return (
        <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
            {Array.from({ length: segments }, (_, i) => {
                const start = i * segAngle - Math.PI / 2;
                const end = start + segAngle - gap;
                const x1 = cx + r * Math.cos(start);
                const y1 = cy + r * Math.sin(start);
                const x2 = cx + r * Math.cos(end);
                const y2 = cy + r * Math.sin(end);
                return (
                    <path
                        key={i}
                        d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`}
                        stroke={color}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                    />
                );
            })}
        </svg>
    );
};

// ─── Exercise Panel ───────────────────────────────────────────────────────────

interface ExercisePanelProps {
    exercise: RitualExercise;
    index: number;
}

const ExercisePanel: React.FC<ExercisePanelProps> = ({ exercise, index }) => {
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const setAnswer = (i: number, val: string) =>
        setAnswers(prev => ({ ...prev, [i]: val }));

    return (
        <div className="border border-[var(--border-main)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[var(--bg-hover)]">
                <span className="text-xs text-[var(--accent)] font-mono uppercase tracking-wider mr-2">
                    Exercise {index + 1}
                </span>
                <span className="text-sm font-medium">{exercise.title}</span>
            </div>
            <div className="px-4 py-3 space-y-3">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{exercise.instruction}</p>
                {exercise.inputFields && exercise.inputFields.length > 0 ? (
                    <div className="space-y-2">
                        {exercise.inputFields.map((label, i) => (
                            <div key={i}>
                                <label className="text-xs text-[var(--text-tertiary)] mb-1 block">{label}</label>
                                <textarea
                                    rows={2}
                                    value={answers[i] ?? ''}
                                    onChange={e => setAnswer(i, e.target.value)}
                                    placeholder="Write here..."
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-main)] rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <textarea
                        rows={4}
                        value={answers[0] ?? ''}
                        onChange={e => setAnswer(0, e.target.value)}
                        placeholder="Write here..."
                        className="w-full bg-[var(--bg-main)] border border-[var(--border-main)] rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                )}
            </div>
        </div>
    );
};

// ─── Live Tools Panel ─────────────────────────────────────────────────────────

interface LiveToolsPanelProps {
    ritual: Ritual;
}

const LiveToolsPanel: React.FC<LiveToolsPanelProps> = ({ ritual }) => {
    const [wordInput, setWordInput] = useState('');
    const [results, setResults] = useState<string[]>([]);
    const [aiResult, setAiResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeToolType, setActiveToolType] = useState<'rhyme' | 'synonym' | null>(null);

    const wordTool = ritual.liveTools?.find(t => t.type === 'rhyme' || t.type === 'synonym') ?? null;
    const geminiTool = ritual.liveTools?.find(t => t.type === 'gemini-prompt') ?? null;

    const handleWordLookup = useCallback(async () => {
        if (!wordInput.trim() || !wordTool) return;
        setLoading(true);
        setResults([]);
        setActiveToolType(wordTool.type as 'rhyme' | 'synonym');
        try {
            const res = wordTool.type === 'rhyme'
                ? await creative.getRhymes(wordInput.trim())
                : await creative.getSynonyms(wordInput.trim());
            setResults(res.slice(0, 16));
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [wordInput, wordTool]);

    const handleGeminiSuggest = useCallback(async () => {
        if (!geminiTool) return;
        setLoading(true);
        setAiResult('');
        setActiveToolType(null);
        try {
            const { reply } = await chatWithFacilitator(
                `I'm doing a "${ritual.title}" session. Give me one specific songwriting action I can take right now based on the methods for this ritual.`,
                {
                    projectTitle: '',
                    sections: [],
                    scraps: [],
                    recentSessions: [],
                    activeView: 'rituals',
                    ritualContext: `${ritual.title} — ${ritual.description}`,
                    sessionPhase: 'starting',
                }
            );
            setAiResult(reply);
        } catch {
            setAiResult('Could not reach the AI. Try again in a moment.');
        } finally {
            setLoading(false);
        }
    }, [ritual, geminiTool]);

    if (!wordTool && !geminiTool) return null;

    return (
        <div className="w-full max-w-md space-y-3">
            <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-1">
                Live Tools
            </h3>
            {wordTool && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-xl p-4 space-y-3">
                    <p className="text-xs text-[var(--text-secondary)]">{wordTool.label}</p>
                    <div className="flex gap-2">
                        <input
                            value={wordInput}
                            onChange={e => setWordInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleWordLookup()}
                            placeholder="Enter a word..."
                            className="flex-1 bg-[var(--bg-main)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />
                        <button
                            onClick={handleWordLookup}
                            disabled={loading || !wordInput.trim()}
                            className="px-3 py-2 bg-[var(--accent)] text-[var(--bg-main)] rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity flex items-center gap-1"
                        >
                            {loading && activeToolType ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                        </button>
                    </div>
                    {results.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {results.map((r, i) => (
                                <button
                                    key={i}
                                    onClick={() => navigator.clipboard.writeText(r)}
                                    title="Copy"
                                    className="px-2.5 py-1 rounded-full bg-[var(--bg-main)] border border-[var(--border-main)] text-xs hover:border-[var(--accent)] transition-colors active:scale-95"
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {geminiTool && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                            <Sparkles size={12} className="text-[var(--accent)]" />
                            {geminiTool.label}
                        </p>
                        <button
                            onClick={handleGeminiSuggest}
                            disabled={loading}
                            className="px-3 py-1.5 bg-[var(--accent)] text-[var(--bg-main)] rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity flex items-center gap-1.5"
                        >
                            {loading && !activeToolType ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Suggest
                        </button>
                    </div>
                    {aiResult && (
                        <p className="text-sm text-[var(--text-main)] leading-relaxed border-l-2 border-[var(--accent)] pl-3">
                            {aiResult}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Songstarter Prompt Button ────────────────────────────────────────────────

const PromptButton: React.FC<{ categoryId: string }> = ({ categoryId }) => {
    const [prompt, setPrompt] = useState('');
    return (
        <div className="w-full max-w-md">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={12} className="text-[var(--accent)]" />
                        Writing Prompt
                    </h3>
                    <button
                        onClick={() => setPrompt(getRandomPrompt(categoryId))}
                        className="px-3 py-1.5 border border-[var(--border-main)] hover:border-[var(--accent)] rounded-lg text-xs transition-colors flex items-center gap-1"
                    >
                        {prompt ? <RefreshCw size={11} /> : <Sparkles size={11} className="text-[var(--accent)]" />}
                        {prompt ? 'New prompt' : 'Get a prompt'}
                    </button>
                </div>
                {prompt && (
                    <p className="text-sm text-[var(--text-main)] leading-relaxed italic border-l-2 border-[var(--accent)] pl-3">
                        {prompt}
                    </p>
                )}
            </div>
        </div>
    );
};

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
                        <button
                            onClick={() => setExpanded(isOpen ? null : id)}
                            className={`px-3 py-1 rounded-full text-xs border transition-all ${
                                isOpen
                                    ? 'bg-[var(--accent)] text-[var(--bg-main)] border-[var(--accent)]'
                                    : 'border-[var(--border-main)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                            }`}
                        >
                            {method.name}
                        </button>
                        {isOpen && (
                            <div className="mt-2 max-w-xs bg-[var(--bg-secondary)] border border-[var(--accent)]/30 rounded-xl p-3 text-left space-y-1.5 z-10">
                                <p className="text-xs text-[var(--accent)] font-medium">{method.tagline}</p>
                                <p className="text-xs text-[var(--text-secondary)]">
                                    <span className="text-[var(--text-tertiary)]">Formula: </span>{method.formula}
                                </p>
                                <p className="text-xs text-[var(--text-tertiary)]">
                                    <span className="text-[var(--text-secondary)]">Use when: </span>{method.when}
                                </p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Stacked Card Deck ────────────────────────────────────────────────────────

const PEEK_HEIGHT = 66;
const CARD_INSET = 13;
const NUM_BACK = 4;

interface CardDeckProps {
    onSelectCategory: (category: string) => void;
    ritualStats: RitualStat[];
}

const CardDeck: React.FC<CardDeckProps> = ({ onSelectCategory, ritualStats }) => {
    const [frontIndex, setFrontIndex] = useState(0);
    const y = useMotionValue(0);
    const isDragging = useRef(false);

    const getCard = (offset: number) =>
        CARD_ORDER[(frontIndex + offset) % CARD_ORDER.length];

    const advanceCard = () => {
        animate(y, -700, { duration: 0.32, ease: [0.4, 0, 0.2, 1] }).then(() => {
            setFrontIndex(i => (i + 1) % CARD_ORDER.length);
            y.set(0);
        });
    };

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y < -55 || info.velocity.y < -350) {
            advanceCard();
        } else {
            animate(y, 0, { type: 'spring', stiffness: 380, damping: 30 });
        }
        isDragging.current = false;
    };

    const frontCategory = getCard(0);
    const frontMeta = CARD_META[frontCategory];
    const Illustration = ILLUSTRATIONS[frontCategory];
    const ritualCount = MASTER_RITUALS.filter(r => r.category === frontCategory).length;
    const completedToday = ritualStats.filter(s =>
        MASTER_RITUALS.find(r => r.id === s.ritualId && r.category === frontCategory) &&
        new Date(s.completedAt).toDateString() === new Date().toDateString()
    ).length;

    return (
        <div className="flex flex-col items-center justify-end h-full pb-8 px-5 select-none">
            {/* Swipe hint */}
            <p className="text-[10px] tracking-widest uppercase text-[var(--text-tertiary)] mb-5 opacity-60">
                swipe up to browse · tap to start
            </p>

            {/* Stack container */}
            <div
                className="relative w-full"
                style={{ height: 400 + NUM_BACK * PEEK_HEIGHT }}
            >
                {/* Back cards — rendered bottom-to-top (farthest first) */}
                {Array.from({ length: NUM_BACK }, (_, i) => {
                    const backPos = NUM_BACK - 1 - i; // 3,2,1,0 — farthest to closest
                    const category = getCard(backPos + 1);
                    const meta = CARD_META[category];
                    const inset = (backPos + 1) * CARD_INSET;
                    const topOffset = (NUM_BACK - 1 - backPos) * PEEK_HEIGHT;

                    return (
                        <div
                            key={`${category}-${backPos}`}
                            className="absolute rounded-3xl overflow-hidden"
                            style={{
                                top: topOffset,
                                left: inset,
                                right: inset,
                                height: 400,
                                zIndex: 5 + backPos,
                                background: '#f8f7ff',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                            }}
                        >
                            <div className="flex items-center gap-2.5 px-5 py-5">
                                <SegmentedRingIcon color={meta.accentColor} />
                                <span
                                    className="text-sm font-semibold tracking-widest"
                                    style={{ color: '#9ca3af' }}
                                >
                                    {meta.label}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Front card */}
                <motion.div
                    drag="y"
                    dragConstraints={{ bottom: 0, top: -20 }}
                    dragElastic={{ top: 0.35, bottom: 0 }}
                    onDragStart={() => { isDragging.current = true; }}
                    onDragEnd={handleDragEnd}
                    style={{ y, zIndex: 30, top: NUM_BACK * PEEK_HEIGHT }}
                    className="absolute left-0 right-0 rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing"
                    onClick={() => {
                        if (!isDragging.current) onSelectCategory(frontCategory);
                    }}
                    whileTap={{ scale: 0.985 }}
                >
                    <div
                        className="w-full flex flex-col"
                        style={{
                            height: 400,
                            background: frontMeta.gradient,
                            boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
                        }}
                    >
                        {/* Card header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-2">
                            <div className="flex items-center gap-2.5">
                                <SegmentedRingIcon color={frontMeta.accentColor} />
                                <span
                                    className="text-sm font-semibold tracking-widest"
                                    style={{ color: frontMeta.accentColor }}
                                >
                                    {frontMeta.label}
                                </span>
                            </div>
                            {completedToday > 0 && (
                                <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-black/10 text-black/50">
                                    <CheckCircle2 size={11} />
                                    {completedToday} done
                                </div>
                            )}
                        </div>

                        {/* Illustration */}
                        <div className="flex-1 flex items-center justify-center px-6 py-2">
                            <div className="w-full h-32">
                                <Illustration />
                            </div>
                        </div>

                        {/* Card footer */}
                        <div className="px-5 pb-6 pt-2">
                            <p className="text-[22px] font-bold text-black/80 leading-tight">
                                {frontCategory}
                            </p>
                            <p className="text-sm text-black/40 mt-1">
                                {ritualCount} ritual{ritualCount !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Dot indicators */}
            <div className="flex gap-1.5 mt-6">
                {CARD_ORDER.map((_, i) => (
                    <div
                        key={i}
                        className="rounded-full transition-all duration-300"
                        style={{
                            width: i === frontIndex % CARD_ORDER.length ? 16 : 6,
                            height: 6,
                            background: i === frontIndex % CARD_ORDER.length
                                ? 'var(--accent)'
                                : 'var(--border-main)',
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const RitualsView: React.FC<RitualsViewProps> = ({ stats, onCompleteRitual }) => {
    const [activeRitual, setActiveRitual] = useState<Ritual | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [prepStepsOpen, setPrepStepsOpen] = useState(false);
    const [exercisesOpen, setExercisesOpen] = useState(true);
    const [ritualNotes, setRitualNotes] = useState('');

    useEffect(() => {
        if (endTime === null) return;
        const timer = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) setEndTime(null);
        }, 1000);
        return () => clearInterval(timer);
    }, [endTime]);

    const handleStartRitual = (ritual: Ritual) => {
        setActiveRitual(ritual);
        setTimeLeft(ritual.durationMinutes * 60);
        setEndTime(Date.now() + ritual.durationMinutes * 60 * 1000);
        setCompletedSteps(new Set());
        setRitualNotes('');
        setPrepStepsOpen(true);
        setExercisesOpen(true);
    };

    const handleCompleteRitual = () => {
        if (activeRitual) {
            onCompleteRitual({
                ritualId: activeRitual.id,
                completedAt: new Date().toISOString(),
                durationMinutes: activeRitual.durationMinutes,
            });
            setActiveRitual(null);
            setTimeLeft(null);
            setEndTime(null);
        }
    };

    const toggleStep = (index: number) => {
        setCompletedSteps(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
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

        return (
            <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
                <header className="px-6 py-4 border-b border-[var(--border-main)] flex items-center justify-between sticky top-0 z-10 surface">
                    <button
                        onClick={() => setActiveRitual(null)}
                        className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors -ml-2"
                    >
                        <ArrowLeft size={20} className="text-[var(--text-secondary)]" />
                    </button>
                    <div className="text-center">
                        <h2 className="text-sm font-medium">{activeRitual.title}</h2>
                        <div className="text-xs text-[var(--text-tertiary)] flex items-center justify-center gap-1 mt-0.5">
                            <Clock size={12} />
                            {activeRitual.durationMinutes}m Session
                        </div>
                    </div>
                    <div className="w-9" />
                </header>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-4">
                    <div className="my-4 text-center space-y-2">
                        <div className="text-6xl font-light tracking-tighter font-mono">
                            {timeLeft !== null ? formatTime(timeLeft) : '0:00'}
                        </div>
                        <p className="text-[var(--text-secondary)] text-sm">{activeRitual.description}</p>
                    </div>

                    {(activeRitual.methods?.length ?? 0) > 0 && (
                        <MethodChips methodIds={activeRitual.methods!} />
                    )}

                    <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setPrepStepsOpen(!prepStepsOpen)}
                            className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
                        >
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-[var(--accent)]" />
                                Prep Steps
                            </h3>
                            {prepStepsOpen ? <ChevronUp size={16} className="text-[var(--text-secondary)]" /> : <ChevronDown size={16} className="text-[var(--text-secondary)]" />}
                        </button>
                        {prepStepsOpen && (
                            <div className="px-4 pb-4 space-y-2">
                                {activeRitual.prepSteps.map((step, idx) => {
                                    const isDone = completedSteps.has(idx);
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => toggleStep(idx)}
                                            className={`w-full flex items-start gap-3 text-left p-3 rounded-xl transition-all ${isDone ? 'bg-[var(--bg-main)] text-[var(--text-tertiary)] line-through opacity-70' : 'hover:bg-[var(--bg-hover)]'}`}
                                        >
                                            <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-[var(--accent)] border-[var(--accent)] text-black' : 'border-[var(--text-tertiary)]'}`}>
                                                {isDone && <CheckCircle2 size={12} />}
                                            </div>
                                            <span className="text-sm">{step}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {hasExercises && (
                        <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl overflow-hidden">
                            <button
                                onClick={() => setExercisesOpen(!exercisesOpen)}
                                className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
                            >
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <Sparkles size={16} className="text-[var(--accent)]" />
                                    Exercises
                                </h3>
                                {exercisesOpen ? <ChevronUp size={16} className="text-[var(--text-secondary)]" /> : <ChevronDown size={16} className="text-[var(--text-secondary)]" />}
                            </button>
                            {exercisesOpen && (
                                <div className="px-4 pb-4 space-y-3">
                                    {activeRitual.exercises!.map((ex, i) => (
                                        <ExercisePanel key={i} exercise={ex} index={i} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {hasPromptCategory && <PromptButton categoryId={activeRitual.promptCategory!} />}
                    {hasLiveTools && <LiveToolsPanel ritual={activeRitual} />}

                    <div className="w-full max-w-md flex flex-col min-h-[180px]">
                        <h3 className="text-xs font-medium mb-2 text-[var(--text-tertiary)] uppercase tracking-wider px-1">
                            {activeRitual.category?.includes('Idea') ? 'Scratchpad' : 'Session Notes'}
                        </h3>
                        <textarea
                            value={ritualNotes}
                            onChange={e => setRitualNotes(e.target.value)}
                            placeholder={activeRitual.category?.includes('Idea')
                                ? 'Capture lyrics, ideas, and song thoughts here...'
                                : 'Jot down technical notes, practice insights, or progress...'}
                            className="flex-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl p-4 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors min-h-[180px]"
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-[var(--border-main)] surface">
                    <button
                        onClick={handleCompleteRitual}
                        className="w-full py-4 rounded-xl font-medium bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 transition-opacity"
                    >
                        Mark Complete
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
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors -ml-2"
                    >
                        <ArrowLeft size={20} className="text-[var(--text-secondary)]" />
                    </button>
                    <div className="flex items-center gap-2">
                        {meta && <SegmentedRingIcon color={meta.accentColor} />}
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
                            <button
                                key={ritual.id}
                                onClick={() => handleStartRitual(ritual)}
                                className="text-left bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl p-5 hover:border-[var(--text-tertiary)] transition-colors group flex flex-col relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-medium">{ritual.title}</h3>
                                    {isCompletedToday && <CheckCircle2 size={16} className="text-green-400 shrink-0" />}
                                </div>
                                <p className="text-sm text-[var(--text-secondary)] mb-4 flex-1">
                                    {ritual.description}
                                </p>
                                {hasExtras && (
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {(ritual.exercises?.length ?? 0) > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                                                {ritual.exercises!.length} exercise{ritual.exercises!.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {!!ritual.promptCategory && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-tertiary)]">
                                                prompts
                                            </span>
                                        )}
                                        {(ritual.liveTools?.length ?? 0) > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-tertiary)]">
                                                live tools
                                            </span>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 mt-auto">
                                    <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] bg-[var(--bg-main)] px-2 py-1 rounded-md">
                                        <Clock size={12} />
                                        {ritual.durationMinutes}m
                                    </span>
                                    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${getEnergyColor(ritual.energyLevel)}`}>
                                        <Zap size={10} className="fill-current" />
                                        {ritual.energyLevel}
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
    return (
        <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
            <header className="px-6 pt-8 pb-4">
                <h1 className="text-2xl font-medium tracking-tight">Rituals</h1>
                <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                    {stats.filter(s => new Date(s.completedAt).toDateString() === new Date().toDateString()).length} completed today
                </p>
            </header>

            <div className="flex-1 overflow-hidden">
                <CardDeck
                    onSelectCategory={setSelectedCategory}
                    ritualStats={stats}
                />
            </div>
        </div>
    );
};
