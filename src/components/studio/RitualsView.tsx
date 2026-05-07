import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Clock, Zap, ArrowLeft, MoreVertical, ChevronDown, ChevronUp, Sliders, Sparkles, ArrowRight, RefreshCw } from 'lucide-react';
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

// ─── Main Component ───────────────────────────────────────────────────────────

export const RitualsView: React.FC<RitualsViewProps> = ({ stats, onCompleteRitual }) => {
    const [activeRitual, setActiveRitual] = useState<Ritual | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [prepStepsOpen, setPrepStepsOpen] = useState(false);
    const [exercisesOpen, setExercisesOpen] = useState(true);
    const [ritualNotes, setRitualNotes] = useState('');

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
                <header className="px-6 py-4 border-b border-[var(--border-main)] flex items-center justify-between sticky top-0 z-10 glass">
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
                            className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
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

                    {/* Exercises section */}
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
                                {exercisesOpen
                                    ? <ChevronUp size={16} className="text-[var(--text-secondary)]" />
                                    : <ChevronDown size={16} className="text-[var(--text-secondary)]" />}
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

                <div className="p-6 border-t border-[var(--border-main)] glass">
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

    // ── Category ritual list view ─────────────────────────────────────────────
    if (selectedCategory && !activeRitual) {
        const categoryRituals = MASTER_RITUALS.filter(r => r.category === selectedCategory);

        return (
            <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
                <header className="px-6 py-4 border-b border-[var(--border-main)] flex items-center justify-between sticky top-0 z-10 glass">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors -ml-2"
                    >
                        <ArrowLeft size={20} className="text-[var(--text-secondary)]" />
                    </button>
                    <h2 className="text-lg font-medium">{selectedCategory}</h2>
                    <button className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors -mr-2 opacity-0 pointer-events-none">
                        <MoreVertical size={20} />
                    </button>
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
                                    {isCompletedToday && <CheckCircle2 size={16} className="text-green-400" />}
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

    // ── Category grid (main view) ─────────────────────────────────────────────
    const categoriesToShow = filterCategory && filterCategory !== 'All'
        ? CATEGORIES.filter(c => c === filterCategory)
        : CATEGORIES;

    return (
        <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
            <header className="px-6 py-8 border-b border-[var(--border-main)] glass z-10 sticky top-0 flex items-center justify-between">
                <h1 className="text-2xl font-medium tracking-tight">Rituals</h1>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-full transition-colors ${showFilters ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'}`}
                >
                    <Sliders size={20} className={showFilters ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                </button>
            </header>

            <div className={`overflow-hidden transition-all duration-200 ${showFilters ? 'max-h-12' : 'max-h-0'}`}>
                <div className="px-6 py-3 border-b border-[var(--border-main)] glass sticky top-[80px] z-10">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <button
                            onClick={() => setFilterCategory(null)}
                            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                                !filterCategory
                                    ? 'bg-[var(--accent)] text-[var(--bg-main)]'
                                    : 'border border-[var(--border-main)] text-[var(--text-main)] hover:border-[var(--text-secondary)]'
                            }`}
                        >
                            All
                        </button>
                        {CATEGORIES.map(category => (
                            <button
                                key={category}
                                onClick={() => setFilterCategory(category)}
                                className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors whitespace-nowrap ${
                                    filterCategory === category
                                        ? 'bg-[var(--accent)] text-[var(--bg-main)] font-medium'
                                        : 'border border-[var(--border-main)] text-[var(--text-main)] hover:border-[var(--text-secondary)]'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoriesToShow.map(category => (
                    <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className="text-left bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl p-8 hover:border-[var(--text-tertiary)] transition-colors flex items-center justify-center min-h-[160px]"
                    >
                        <h2 className="text-xl font-medium text-center">{category}</h2>
                    </button>
                ))}
            </div>
        </div>
    );
};
