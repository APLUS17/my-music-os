import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { CheckCircle2, Clock, Zap, ArrowLeft, MoreVertical, ChevronDown, ChevronUp, Sliders, Sparkles, ArrowRight, RefreshCw, ChevronLeft, ChevronRight, Flame, Hourglass, Trophy, PenTool, Library, Music } from 'lucide-react';
import { Ritual, RitualStat, RitualExercise } from '../../types';
import { MASTER_RITUALS } from '../../lib/data/rituals';
import { getRandomPrompt, getMethodById } from '../../lib/creative/SongwritingKnowledge';
import { creative } from '../../lib/services/creative';
import { chatWithFacilitator } from '../../app/actions';
import { formatTime } from '@/lib/utils/time';
import { motion, AnimatePresence } from 'framer-motion';

interface RitualsViewProps {
    stats: RitualStat[];
    onCompleteRitual: (stat: RitualStat) => void;
}

const CATEGORIES = ['Idea Generation', 'Idea Development', 'Idea Review', 'Idea Curation', 'Optimization', 'Technique'];

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

interface PromptButtonProps {
    categoryId: string;
}

const PromptButton: React.FC<PromptButtonProps> = ({ categoryId }) => {
    const [prompt, setPrompt] = useState('');

    const handleGet = () => setPrompt(getRandomPrompt(categoryId));

    return (
        <div className="w-full max-w-md">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={12} className="text-[var(--accent)]" />
                        Writing Prompt
                    </h3>
                    <button
                        onClick={handleGet}
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

interface MethodChipsProps {
    methodIds: string[];
}

const MethodChips: React.FC<MethodChipsProps> = ({ methodIds }) => {
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

// ─── Compound Carousel Component ────────────────────────────────────────────────

interface CarouselContextType {
    currentPage: number;
    setCurrentPage: (page: number) => void;
    slideCount: number;
}

const CarouselContext = createContext<CarouselContextType | undefined>(undefined);

const CarouselRoot: React.FC<{
    children: React.ReactNode;
    defaultPage?: number;
    slideCount: number;
    className?: string;
    activePage?: number;
    onPageChange?: (page: number) => void;
}> = ({ children, defaultPage = 0, slideCount, className, activePage, onPageChange }) => {
    const [currentPageInternal, setCurrentPageInternal] = useState(defaultPage);
    const currentPage = activePage !== undefined ? activePage : currentPageInternal;
    const setCurrentPage = activePage !== undefined && onPageChange ? onPageChange : setCurrentPageInternal;

    return (
        <CarouselContext.Provider value={{ currentPage, setCurrentPage, slideCount }}>
            <div className={`relative w-full ${className || ''}`}>
                {children}
            </div>
        </CarouselContext.Provider>
    );
};

const useCarousel = () => {
    const context = useContext(CarouselContext);
    if (!context) throw new Error('useCarousel must be used within Carousel.Root');
    return context;
};

const CarouselControl: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className }) => {
    return <div className={className}>{children}</div>;
};

const CarouselPrevTrigger: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className }) => {
    const { currentPage, setCurrentPage } = useCarousel();
    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentPage(Math.max(0, currentPage - 1));
    };
    return (
        <button
            type="button"
            onClick={handlePrev}
            disabled={currentPage === 0}
            className={`${className || ''} disabled:opacity-30 disabled:pointer-events-none transition-all`}
        >
            {children}
        </button>
    );
};

const CarouselNextTrigger: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className }) => {
    const { currentPage, setCurrentPage, slideCount } = useCarousel();
    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentPage(Math.min(slideCount - 1, currentPage + 1));
    };
    return (
        <button
            type="button"
            onClick={handleNext}
            disabled={currentPage === slideCount - 1}
            className={`${className || ''} disabled:opacity-30 disabled:pointer-events-none transition-all`}
        >
            {children}
        </button>
    );
};

const CarouselItemGroup: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className }) => {
    const { currentPage } = useCarousel();
    return (
        <div className={`overflow-hidden w-full ${className || ''}`}>
            <motion.div
                className="flex"
                animate={{ x: `-${currentPage * 100}%` }}
                transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            >
                {children}
            </motion.div>
        </div>
    );
};

const CarouselItem: React.FC<{
    children: React.ReactNode;
    index: number;
    className?: string;
}> = ({ children, index, className }) => {
    return (
        <div className={`w-full shrink-0 ${className || ''}`}>
            {children}
        </div>
    );
};

const CarouselIndicatorGroup: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className }) => {
    return <div className={className}>{children}</div>;
};

const CarouselIndicator: React.FC<{
    index: number;
    className?: string;
}> = ({ index, className }) => {
    const { currentPage, setCurrentPage } = useCarousel();
    const isCurrent = currentPage === index;
    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentPage(index);
    };
    return (
        <button
            type="button"
            onClick={handleSelect}
            data-current={isCurrent ? '' : undefined}
            className={`${className || ''} ${isCurrent ? 'bg-[var(--accent)] scale-110' : 'bg-gray-300 dark:bg-gray-600'}`}
        />
    );
};

const Carousel = {
    Root: CarouselRoot,
    Control: CarouselControl,
    PrevTrigger: CarouselPrevTrigger,
    NextTrigger: CarouselNextTrigger,
    ItemGroup: CarouselItemGroup,
    Item: CarouselItem,
    IndicatorGroup: CarouselIndicatorGroup,
    Indicator: CarouselIndicator,
};

const CATEGORY_META: Record<string, {
    description: string;
    tagline: string;
    icon: React.ComponentType<any>;
    gradient: string;
    glowColor: string;
}> = {
    'Idea Generation': {
        description: 'Overcome writer\'s block, explore constraints, and capture raw titles/melodies.',
        tagline: 'Ignite the creative spark.',
        icon: Sparkles,
        gradient: 'from-orange-500/20 to-red-500/10',
        glowColor: 'rgba(249, 115, 22, 0.15)',
    },
    'Idea Development': {
        description: 'Turn short loops into full structural arrangements and zoom in on lyric phrasing.',
        tagline: 'Build momentum and depth.',
        icon: PenTool,
        gradient: 'from-blue-500/20 to-indigo-500/10',
        glowColor: 'rgba(59, 130, 246, 0.15)',
    },
    'Idea Review': {
        description: 'Take objective distance, reduce clutter, and bridge the gap between pretty words and honesty.',
        tagline: 'Audit with absolute clarity.',
        icon: CheckCircle2,
        gradient: 'from-purple-500/20 to-pink-500/10',
        glowColor: 'rgba(168, 85, 247, 0.15)',
    },
    'Idea Curation': {
        description: 'Resurface buried fragments from the vault and construct emotional reference stacks.',
        tagline: 'Curate your creative wealth.',
        icon: Library,
        gradient: 'from-emerald-500/20 to-teal-500/10',
        glowColor: 'rgba(16, 185, 129, 0.15)',
    },
    'Optimization': {
        description: 'Organize files, templates, presets, and MIDI shortcuts to eliminate physical/digital friction.',
        tagline: 'Refine the system.',
        icon: Sliders,
        gradient: 'from-yellow-500/20 to-amber-500/10',
        glowColor: 'rgba(234, 179, 8, 0.15)',
    },
    'Technique': {
        description: 'Dedicated practice sessions for warmups, scale runs, and composing call-and-response phrases.',
        tagline: 'Hone the mechanical craft.',
        icon: Music,
        gradient: 'from-cyan-500/20 to-blue-500/10',
        glowColor: 'rgba(6, 182, 212, 0.15)',
    },
};

export const RitualsView: React.FC<RitualsViewProps> = ({ stats, onCompleteRitual }) => {
    const [activeRitual, setActiveRitual] = useState<Ritual | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [carouselPage, setCarouselPage] = useState(0);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [prepStepsOpen, setPrepStepsOpen] = useState(false);
    const [exercisesOpen, setExercisesOpen] = useState(true);
    const [ritualNotes, setRitualNotes] = useState('');

    const statsSummary = useMemo(() => {
        const totalSessions = stats.length;
        const totalMinutes = stats.reduce((acc, s) => acc + s.durationMinutes, 0);
        
        let streak = 0;
        if (totalSessions > 0) {
            const sortedDates = [...new Set(stats.map(s => new Date(s.completedAt).toDateString()))]
                .map(d => new Date(d))
                .sort((a, b) => b.getTime() - a.getTime());
            
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            const newestDateStr = sortedDates[0]?.toDateString();
            
            if (newestDateStr === today || newestDateStr === yesterday) {
                streak = 1;
                let current = sortedDates[0];
                for (let i = 1; i < sortedDates.length; i++) {
                    const diffDays = Math.round((current.getTime() - sortedDates[i].getTime()) / 86400000);
                    if (diffDays === 1) {
                        streak++;
                        current = sortedDates[i];
                    } else if (diffDays > 1) {
                        break;
                    }
                }
            }
        }
        
        const completedToday = stats.some(s => 
            new Date(s.completedAt).toDateString() === new Date().toDateString()
        );

        return { totalSessions, totalMinutes, streak, completedToday };
    }, [stats]);

    useEffect(() => {
        if (endTime === null) return;
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) setEndTime(null);
        }, 1000);
        return () => clearInterval(timer);
    }, [endTime]);

    const handleStartRitual = (ritual: Ritual) => {
        setActiveRitual(ritual);
        setTimeLeft(ritual.durationMinutes * 60);
        setEndTime(new Date().getTime() + ritual.durationMinutes * 60 * 1000);
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
                durationMinutes: activeRitual.durationMinutes
            });
            setActiveRitual(null);
            setTimeLeft(null);
            setEndTime(null);
        }
    };

    const toggleStep = (index: number) => {
        setCompletedSteps(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
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

    // ── Active ritual timer screen ────────────────────────────────────────────
    if (activeRitual) {
        const hasExercises = (activeRitual.exercises?.length ?? 0) > 0;
        const hasPromptCategory = !!activeRitual.promptCategory;
        const hasLiveTools = (activeRitual.liveTools?.length ?? 0) > 0;

        return (
            <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
                <header className="px-6 py-4 border-b border-[var(--border-main)] flex items-center justify-between sticky top-0 z-10 surface">
                    <button
                        onClick={() => setActiveRitual(null)}
                        className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors -ml-2 cursor-pointer"
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
                    <button className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors -mr-2 opacity-0 pointer-events-none">
                        <MoreVertical size={20} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-4">
                    {/* Timer + description */}
                    <div className="my-4 text-center space-y-2">
                        <div className="text-6xl font-light tracking-tighter font-mono">
                            {timeLeft !== null ? formatTime(timeLeft) : '0:00'}
                        </div>
                        <p className="text-[var(--text-secondary)] text-sm">{activeRitual.description}</p>
                    </div>

                    {/* Method chips — tappable to expand formula card */}
                    {(activeRitual.methods?.length ?? 0) > 0 && (
                        <MethodChips methodIds={activeRitual.methods!} />
                    )}

                    {/* Prep Steps */}
                    <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setPrepStepsOpen(!prepStepsOpen)}
                            className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                        >
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-[var(--accent)]" />
                                Prep Steps
                            </h3>
                            {prepStepsOpen
                                ? <ChevronUp size={16} className="text-[var(--text-secondary)]" />
                                : <ChevronDown size={16} className="text-[var(--text-secondary)]" />}
                        </button>
                        {prepStepsOpen && (
                            <div className="px-4 pb-4 space-y-2 bg-[var(--bg-card)]/50">
                                {activeRitual.prepSteps.map((step, idx) => {
                                    const isDone = completedSteps.has(idx);
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => toggleStep(idx)}
                                            className={`w-full flex items-start gap-3 text-left p-3 rounded-xl transition-all cursor-pointer ${isDone ? 'bg-[var(--bg-main)]/50 text-[var(--text-tertiary)] line-through opacity-70' : 'hover:bg-[var(--bg-hover)]'}`}
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

                    {/* Exercises section */}
                    {hasExercises && (
                        <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl overflow-hidden">
                            <button
                                onClick={() => setExercisesOpen(!exercisesOpen)}
                                className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                            >
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <Sparkles size={16} className="text-[var(--accent)]" />
                                    Exercises
                                </h3>
                                {exercisesOpen
                                    ? <ChevronUp size={16} className="text-[var(--text-secondary)]" />
                                    : <ChevronDown size={16} className="text-[var(--text-secondary)]" />}
                            </button>
                            {exercisesOpen && (
                                <div className="px-4 pb-4 space-y-3 bg-[var(--bg-card)]/50">
                                    {activeRitual.exercises!.map((ex, i) => (
                                        <ExercisePanel key={i} exercise={ex} index={i} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Writing prompt */}
                    {hasPromptCategory && (
                        <PromptButton categoryId={activeRitual.promptCategory!} />
                    )}

                    {/* Live tools (Datamuse rhyme/synonym + Gemini) */}
                    {hasLiveTools && (
                        <LiveToolsPanel ritual={activeRitual} />
                    )}

                    {/* Scratchpad */}
                    <div className="w-full max-w-md flex flex-col min-h-[180px]">
                        <h3 className="text-xs font-medium mb-2 text-[var(--text-tertiary)] uppercase tracking-wider px-1 font-bold">
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
                        className="w-full py-4 rounded-xl font-medium bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 transition-opacity cursor-pointer"
                    >
                        Mark Complete
                    </button>
                </div>
            </div>
        );
    }

    // ── Category ritual list view (GRID FORMAT) ─────────────────────────────────────────────
    if (selectedCategory && !activeRitual) {
        const categoryRituals = MASTER_RITUALS.filter(r => r.category === selectedCategory);
        const meta = CATEGORY_META[selectedCategory] || {
            gradient: 'from-gray-500/20 to-gray-500/10',
            glowColor: 'rgba(255,255,255,0.05)',
            icon: Sparkles
        };
        const CategoryIcon = meta.icon;

        return (
            <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
                <header className="px-6 py-5 border-b border-[var(--border-main)] flex items-center justify-between sticky top-0 z-10 surface bg-[var(--bg-main)]/90 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors -ml-2 cursor-pointer"
                        >
                            <ArrowLeft size={20} className="text-[var(--text-secondary)]" />
                        </button>
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-xl text-[var(--accent)]">
                                <CategoryIcon size={18} />
                            </div>
                            <h2 className="text-lg font-bold tracking-tight">{selectedCategory}</h2>
                        </div>
                    </div>
                    <span className="text-xs font-mono px-3 py-1 bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-full text-[var(--text-secondary)] font-bold">
                        {categoryRituals.length} {categoryRituals.length === 1 ? 'Ritual' : 'Rituals'}
                    </span>
                </header>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full">
                    {categoryRituals.map(ritual => {
                        const isCompletedToday = stats.some(s =>
                            s.ritualId === ritual.id &&
                            new Date(s.completedAt).toDateString() === new Date().toDateString()
                        );
                        const hasExtras = (ritual.exercises?.length ?? 0) > 0 || !!ritual.promptCategory || (ritual.liveTools?.length ?? 0) > 0;

                        return (
                            <div
                                key={ritual.id}
                                className={`bg-[var(--bg-secondary)] border ${isCompletedToday ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)] bg-emerald-500/[0.01]' : 'border-[var(--border-main)]'} rounded-3xl p-6 hover:border-[var(--text-tertiary)] transition-all flex flex-col justify-between relative overflow-hidden group`}
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="text-lg font-bold tracking-tight text-[var(--text-main)]">{ritual.title}</h3>
                                        {isCompletedToday ? (
                                            <span className="flex items-center gap-1 text-[10px] uppercase font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                                                <CheckCircle2 size={12} />
                                                Done Today
                                            </span>
                                        ) : (
                                            <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded-full bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-tertiary)] font-bold">
                                                Ready
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5">
                                        {ritual.description}
                                    </p>

                                    {/* Prep Steps Preview */}
                                    {ritual.prepSteps && ritual.prepSteps.length > 0 && (
                                        <div className="mb-6">
                                            <div className="text-[10px] uppercase tracking-wider font-mono text-[var(--text-tertiary)] mb-2.5 font-bold">Prep Steps</div>
                                            <ul className="space-y-2">
                                                {ritual.prepSteps.map((step, idx) => (
                                                    <li key={idx} className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/60 mt-1.5 shrink-0" />
                                                        <span>{step}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Badges for active tools */}
                                    {hasExtras && (
                                        <div className="flex flex-wrap gap-1.5 mb-6">
                                            {(ritual.exercises?.length ?? 0) > 0 && (
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-wider font-bold">
                                                    {ritual.exercises!.length} exercise{ritual.exercises!.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {!!ritual.promptCategory && (
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-tertiary)] uppercase tracking-wider font-bold">
                                                    prompts
                                                </span>
                                            )}
                                            {(ritual.liveTools?.length ?? 0) > 0 && (
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-tertiary)] uppercase tracking-wider font-bold">
                                                    live tools
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-main)] border border-[var(--border-main)] px-2.5 py-1 rounded-lg">
                                            <Clock size={12} className="text-[var(--text-tertiary)]" />
                                            {ritual.durationMinutes}m
                                        </span>
                                        <span className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border ${getEnergyColor(ritual.energyLevel)}`}>
                                            <Zap size={11} className="fill-current" />
                                            {ritual.energyLevel}
                                        </span>
                                    </div>
                                    
                                    <button
                                        type="button"
                                        onClick={() => handleStartRitual(ritual)}
                                        className="px-4 py-2 bg-[var(--text-main)] text-[var(--bg-main)] hover:bg-[var(--accent)] hover:text-[var(--text-main)] font-bold text-xs rounded-xl transition-colors duration-200 cursor-pointer active:scale-95 flex items-center gap-1"
                                    >
                                        Start
                                        <ArrowRight size={12} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Category grid (main view, featuring one-at-a-time carousel) ─────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
            <header className="px-6 py-6 border-b border-[var(--border-main)] surface z-10 sticky top-0 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Rituals</h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Sustain your creative momentum</p>
                </div>
            </header>

            {/* Stats Summary Dashboard */}
            <div className="px-6 py-4 mx-6 mt-6 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl flex items-center justify-between gap-4 flex-wrap shadow-sm">
                <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-xl">
                            <Trophy size={16} />
                        </div>
                        <div>
                            <div className="text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">Completed</div>
                            <div className="text-sm font-semibold">{statsSummary.totalSessions} Sessions</div>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-[var(--border-subtle)] hidden sm:block" />
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
                            <Hourglass size={16} />
                        </div>
                        <div>
                            <div className="text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">Time</div>
                            <div className="text-sm font-semibold">{statsSummary.totalMinutes}m</div>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-[var(--border-subtle)] hidden sm:block" />
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl">
                            <Flame size={16} />
                        </div>
                        <div>
                            <div className="text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">Streak</div>
                            <div className="text-sm font-semibold">{statsSummary.streak} Day{statsSummary.streak !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {statsSummary.completedToday ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Completed Today
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            Goal Pending
                        </div>
                    )}
                </div>
            </div>

            {/* Category tabs */}
            <div className="px-6 pt-6 pb-2 border-b border-[var(--border-subtle)] sticky top-[80px] z-10 bg-[var(--bg-main)]">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {CATEGORIES.map((category, index) => {
                        const isCurrent = carouselPage === index;
                        return (
                            <button
                                key={category}
                                onClick={() => setCarouselPage(index)}
                                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold tracking-wide transition-all border cursor-pointer ${
                                    isCurrent
                                        ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--bg-main)] shadow-sm'
                                        : 'border-[var(--border-main)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-main)]'
                                }`}
                            >
                                {category}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Category Carousel (One at a time) */}
            <div className="flex-1 flex flex-col justify-center items-center px-6 py-8">
                <Carousel.Root activePage={carouselPage} onPageChange={setCarouselPage} slideCount={CATEGORIES.length} className="max-w-xl w-full flex-1 flex flex-col justify-between">
                    <Carousel.ItemGroup className="rounded-2xl flex-1 flex items-center min-h-[340px]">
                        {CATEGORIES.map((category, index) => {
                            const meta = CATEGORY_META[category] || {
                                description: '',
                                tagline: '',
                                icon: Sparkles,
                                gradient: 'from-gray-500/10 to-gray-500/5',
                                glowColor: 'rgba(255,255,255,0.05)',
                            };
                            const CategoryIcon = meta.icon;
                            const categoryRitualCount = MASTER_RITUALS.filter(r => r.category === category).length;
                            
                            return (
                                <Carousel.Item key={category} index={index} className="px-2">
                                    <div 
                                        className="h-full bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-3xl p-8 hover:border-[var(--text-tertiary)] transition-all flex flex-col justify-between relative overflow-hidden group shadow-lg"
                                        style={{
                                            boxShadow: `0 10px 30px -10px ${meta.glowColor}`,
                                        }}
                                    >
                                        {/* Background gradient subtle accents */}
                                        <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-40 pointer-events-none group-hover:opacity-60 transition-opacity`} />
                                        
                                        <div>
                                            <div className="flex justify-between items-start mb-6 relative z-10">
                                                <div className="p-4 bg-[var(--bg-main)] border border-[var(--border-main)] rounded-2xl text-[var(--accent)] group-hover:scale-110 transition-transform duration-300">
                                                    <CategoryIcon size={32} className="stroke-[1.5]" />
                                                </div>
                                                <span className="text-xs font-mono px-3 py-1 bg-[var(--bg-main)] border border-[var(--border-main)] rounded-full text-[var(--text-secondary)]">
                                                    {categoryRitualCount} {categoryRitualCount === 1 ? 'Ritual' : 'Rituals'}
                                                </span>
                                            </div>

                                            <h2 className="text-2xl font-bold tracking-tight mb-2 text-[var(--text-main)] relative z-10">
                                                {category}
                                            </h2>
                                            <p className="text-[var(--accent)] text-sm font-medium mb-4 italic relative z-10">
                                                {meta.tagline}
                                            </p>
                                            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6 relative z-10">
                                                {meta.description}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedCategory(category)}
                                            className="w-full py-4 bg-[var(--text-main)] text-[var(--bg-main)] hover:bg-[var(--accent)] hover:text-[var(--text-main)] font-bold text-sm rounded-2xl transition-all duration-300 active:scale-98 flex items-center justify-center gap-2 cursor-pointer relative z-10"
                                        >
                                            Explore Rituals
                                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform animate-pulse" />
                                        </button>
                                    </div>
                                </Carousel.Item>
                            );
                        })}
                    </Carousel.ItemGroup>

                    {/* Carousel Navigation Controls */}
                    <div className="flex items-center justify-between mt-6 w-full px-2">
                        <Carousel.PrevTrigger className="px-4 py-2.5 border border-[var(--border-main)] hover:border-[var(--accent)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-main)] rounded-xl font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer">
                            <ChevronLeft size={16} />
                            Prev
                        </Carousel.PrevTrigger>
                        
                        <Carousel.IndicatorGroup className="flex justify-center items-center gap-2">
                            {CATEGORIES.map((_, index) => (
                                <Carousel.Indicator
                                    key={index}
                                    index={index}
                                    className="w-2.5 h-2.5 rounded-full bg-[var(--border-main)] hover:bg-[var(--text-tertiary)] data-current:bg-[var(--accent)] data-current:scale-125 transition-all cursor-pointer"
                                />
                            ))}
                        </Carousel.IndicatorGroup>

                        <Carousel.NextTrigger className="px-4 py-2.5 border border-[var(--border-main)] hover:border-[var(--accent)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-main)] rounded-xl font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer">
                            Next
                            <ChevronRight size={16} />
                        </Carousel.NextTrigger>
                    </div>
                </Carousel.Root>
            </div>
        </div>
    );
};
