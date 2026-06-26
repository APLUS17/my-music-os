import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useMotionValue, animate, PanInfo } from 'framer-motion';
import { CheckCircle2, Clock, Zap, ArrowLeft, ChevronDown, ChevronUp, Sparkles, ArrowRight, RefreshCw } from 'lucide-react';
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
                strokeDasharray={i < 4 ? undefined : undefined}
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

const PEEK = 54;   // px of each back card visible above front
const NUM_BACK = 4;
const INSET = 11;  // px narrower per level

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
            {/* Swipe hint */}
            <p className="text-center text-[9px] tracking-[0.2em] uppercase text-[var(--text-tertiary)] opacity-40 pt-1 pb-2 shrink-0">
                swipe up · tap to open
            </p>

            {/* Card stack — fills all remaining space */}
            <div className="relative flex-1 min-h-0 mx-3">

                {/* Back cards: absolutely fill from their top offset down to 0, only header shows */}
                {Array.from({ length: NUM_BACK }, (_, i) => {
                    // i=0 is the FARTHEST (top of stack), i=3 is closest behind front
                    const stackLevel = NUM_BACK - 1 - i; // 3..0 — closer = higher stackLevel
                    const category = getCard(stackLevel + 1);
                    const meta = CARD_META[category];
                    const insetPx = (stackLevel + 1) * INSET;
                    const topPx = i * PEEK; // farther cards start higher

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

                {/* Front card: fills from NUM_BACK*PEEK down to 0 */}
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
                        {/* Header row */}
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

                        {/* Illustration — takes up the middle flex space */}
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
                                {ritualCount} ritual{ritualCount !== 1 ? 's' : ''} · tap to explore
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
                                background: active ? CARD_META[CARD_ORDER[frontIdx % CARD_ORDER.length]].accentColor : 'rgba(128,128,140,0.3)',
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// ─── Exercise Panel ───────────────────────────────────────────────────────────

const ExercisePanel: React.FC<{ exercise: RitualExercise; index: number }> = ({ exercise, index }) => {
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const setAnswer = (i: number, val: string) => setAnswers(p => ({ ...p, [i]: val }));
    return (
        <div className="border border-[var(--border-main)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[var(--bg-hover)]">
                <span className="text-xs text-[var(--accent)] font-mono uppercase tracking-wider mr-2">Exercise {index + 1}</span>
                <span className="text-sm font-medium">{exercise.title}</span>
            </div>
            <div className="px-4 py-3 space-y-3">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{exercise.instruction}</p>
                {exercise.inputFields && exercise.inputFields.length > 0 ? (
                    <div className="space-y-2">
                        {exercise.inputFields.map((label, i) => (
                            <div key={i}>
                                <label className="text-xs text-[var(--text-tertiary)] mb-1 block">{label}</label>
                                <textarea rows={2} value={answers[i] ?? ''} onChange={e => setAnswer(i, e.target.value)}
                                    placeholder="Write here..."
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border-main)] rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <textarea rows={4} value={answers[0] ?? ''} onChange={e => setAnswer(0, e.target.value)}
                        placeholder="Write here..."
                        className="w-full bg-[var(--bg-main)] border border-[var(--border-main)] rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors" />
                )}
            </div>
        </div>
    );
};

// ─── Live Tools Panel ─────────────────────────────────────────────────────────

const LiveToolsPanel: React.FC<{ ritual: Ritual }> = ({ ritual }) => {
    const [wordInput, setWordInput] = useState('');
    const [results, setResults] = useState<string[]>([]);
    const [aiResult, setAiResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeToolType, setActiveToolType] = useState<'rhyme' | 'synonym' | null>(null);

    const wordTool = ritual.liveTools?.find(t => t.type === 'rhyme' || t.type === 'synonym') ?? null;
    const geminiTool = ritual.liveTools?.find(t => t.type === 'gemini-prompt') ?? null;

    const handleWordLookup = useCallback(async () => {
        if (!wordInput.trim() || !wordTool) return;
        setLoading(true); setResults([]); setActiveToolType(wordTool.type as 'rhyme' | 'synonym');
        try {
            const res = wordTool.type === 'rhyme'
                ? await creative.getRhymes(wordInput.trim())
                : await creative.getSynonyms(wordInput.trim());
            setResults(res.slice(0, 16));
        } catch { setResults([]); }
        finally { setLoading(false); }
    }, [wordInput, wordTool]);

    const handleGeminiSuggest = useCallback(async () => {
        if (!geminiTool) return;
        setLoading(true); setAiResult(''); setActiveToolType(null);
        try {
            const { reply } = await chatWithFacilitator(
                `I'm doing a "${ritual.title}" session. Give me one specific songwriting action I can take right now based on the methods for this ritual.`,
                { projectTitle: '', sections: [], scraps: [], recentSessions: [], activeView: 'rituals', ritualContext: `${ritual.title} — ${ritual.description}`, sessionPhase: 'starting' }
            );
            setAiResult(reply);
        } catch { setAiResult('Could not reach the AI. Try again in a moment.'); }
        finally { setLoading(false); }
    }, [ritual, geminiTool]);

    if (!wordTool && !geminiTool) return null;

    return (
        <div className="w-full max-w-md space-y-3">
            <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-1">Live Tools</h3>
            {wordTool && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-xl p-4 space-y-3">
                    <p className="text-xs text-[var(--text-secondary)]">{wordTool.label}</p>
                    <div className="flex gap-2">
                        <input value={wordInput} onChange={e => setWordInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleWordLookup()} placeholder="Enter a word..."
                            className="flex-1 bg-[var(--bg-main)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors" />
                        <button onClick={handleWordLookup} disabled={loading || !wordInput.trim()}
                            className="px-3 py-2 bg-[var(--accent)] text-[var(--bg-main)] rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity flex items-center gap-1">
                            {loading && activeToolType ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                        </button>
                    </div>
                    {results.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {results.map((r, i) => (
                                <button key={i} onClick={() => navigator.clipboard.writeText(r)} title="Copy"
                                    className="px-2.5 py-1 rounded-full bg-[var(--bg-main)] border border-[var(--border-main)] text-xs hover:border-[var(--accent)] transition-colors active:scale-95">
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
                        <button onClick={handleGeminiSuggest} disabled={loading}
                            className="px-3 py-1.5 bg-[var(--accent)] text-[var(--bg-main)] rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity flex items-center gap-1.5">
                            {loading && !activeToolType ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Suggest
                        </button>
                    </div>
                    {aiResult && (
                        <p className="text-sm text-[var(--text-main)] leading-relaxed border-l-2 border-[var(--accent)] pl-3">{aiResult}</p>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Prompt Button ────────────────────────────────────────────────────────────

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
                    <button onClick={() => setPrompt(getRandomPrompt(categoryId))}
                        className="px-3 py-1.5 border border-[var(--border-main)] hover:border-[var(--accent)] rounded-lg text-xs transition-colors flex items-center gap-1">
                        {prompt ? <RefreshCw size={11} /> : <Sparkles size={11} className="text-[var(--accent)]" />}
                        {prompt ? 'New prompt' : 'Get a prompt'}
                    </button>
                </div>
                {prompt && (
                    <p className="text-sm text-[var(--text-main)] leading-relaxed italic border-l-2 border-[var(--accent)] pl-3">{prompt}</p>
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
        const t = setInterval(() => {
            const rem = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            setTimeLeft(rem);
            if (rem <= 0) setEndTime(null);
        }, 1000);
        return () => clearInterval(t);
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
        if (!activeRitual) return;
        onCompleteRitual({ ritualId: activeRitual.id, completedAt: new Date().toISOString(), durationMinutes: activeRitual.durationMinutes });
        setActiveRitual(null);
        setTimeLeft(null);
        setEndTime(null);
    };

    const toggleStep = (i: number) => {
        setCompletedSteps(prev => {
            const n = new Set(prev);
            if (n.has(i)) n.delete(i); else n.add(i);
            return n;
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
                    <button onClick={() => setActiveRitual(null)} className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors -ml-2">
                        <ArrowLeft size={20} className="text-[var(--text-secondary)]" />
                    </button>
                    <div className="text-center">
                        <h2 className="text-sm font-medium">{activeRitual.title}</h2>
                        <div className="text-xs text-[var(--text-tertiary)] flex items-center justify-center gap-1 mt-0.5">
                            <Clock size={12} />{activeRitual.durationMinutes}m Session
                        </div>
                    </div>
                    <div className="w-9" />
                </header>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-4">
                    <div className="my-4 text-center space-y-2">
                        <div className="text-6xl font-light tracking-tighter font-mono">{timeLeft !== null ? formatTime(timeLeft) : '0:00'}</div>
                        <p className="text-[var(--text-secondary)] text-sm">{activeRitual.description}</p>
                    </div>
                    {(activeRitual.methods?.length ?? 0) > 0 && <MethodChips methodIds={activeRitual.methods!} />}
                    <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl overflow-hidden">
                        <button onClick={() => setPrepStepsOpen(!prepStepsOpen)} className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors">
                            <h3 className="text-sm font-medium flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--accent)]" />Prep Steps</h3>
                            {prepStepsOpen ? <ChevronUp size={16} className="text-[var(--text-secondary)]" /> : <ChevronDown size={16} className="text-[var(--text-secondary)]" />}
                        </button>
                        {prepStepsOpen && (
                            <div className="px-4 pb-4 space-y-2">
                                {activeRitual.prepSteps.map((step, idx) => {
                                    const done = completedSteps.has(idx);
                                    return (
                                        <button key={idx} onClick={() => toggleStep(idx)}
                                            className={`w-full flex items-start gap-3 text-left p-3 rounded-xl transition-all ${done ? 'bg-[var(--bg-main)] text-[var(--text-tertiary)] line-through opacity-70' : 'hover:bg-[var(--bg-hover)]'}`}>
                                            <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${done ? 'bg-[var(--accent)] border-[var(--accent)] text-black' : 'border-[var(--text-tertiary)]'}`}>
                                                {done && <CheckCircle2 size={12} />}
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
                            <button onClick={() => setExercisesOpen(!exercisesOpen)} className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors">
                                <h3 className="text-sm font-medium flex items-center gap-2"><Sparkles size={16} className="text-[var(--accent)]" />Exercises</h3>
                                {exercisesOpen ? <ChevronUp size={16} className="text-[var(--text-secondary)]" /> : <ChevronDown size={16} className="text-[var(--text-secondary)]" />}
                            </button>
                            {exercisesOpen && (
                                <div className="px-4 pb-4 space-y-3">
                                    {activeRitual.exercises!.map((ex, i) => <ExercisePanel key={i} exercise={ex} index={i} />)}
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
                        <textarea value={ritualNotes} onChange={e => setRitualNotes(e.target.value)}
                            placeholder={activeRitual.category?.includes('Idea') ? 'Capture lyrics, ideas, and song thoughts here...' : 'Jot down technical notes, practice insights, or progress...'}
                            className="flex-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl p-4 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors min-h-[180px]" />
                    </div>
                </div>
                <div className="p-6 border-t border-[var(--border-main)] surface">
                    <button onClick={handleCompleteRitual} className="w-full py-4 rounded-xl font-medium bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 transition-opacity">
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
                        const completedToday = stats.some(s =>
                            s.ritualId === ritual.id &&
                            new Date(s.completedAt).toDateString() === new Date().toDateString()
                        );
                        const hasExtras = (ritual.exercises?.length ?? 0) > 0 || !!ritual.promptCategory || (ritual.liveTools?.length ?? 0) > 0;
                        return (
                            <button key={ritual.id} onClick={() => handleStartRitual(ritual)}
                                className="text-left bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl p-5 hover:border-[var(--text-tertiary)] transition-colors flex flex-col relative overflow-hidden">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-medium">{ritual.title}</h3>
                                    {completedToday && <CheckCircle2 size={16} className="text-green-400 shrink-0" />}
                                </div>
                                <p className="text-sm text-[var(--text-secondary)] mb-4 flex-1">{ritual.description}</p>
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
            <header className="px-6 pt-7 pb-3 shrink-0">
                <h1 className="text-[28px] font-bold tracking-tight">Rituals</h1>
                <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                    {todayCount === 0 ? 'None completed today' : `${todayCount} completed today`}
                </p>
            </header>

            <div className="flex-1 min-h-0 pb-1">
                <CardDeck onSelectCategory={setSelectedCategory} ritualStats={stats} />
            </div>
        </div>
    );
};
