import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Zap, ArrowLeft, MoreVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Ritual, RitualStat } from '../../types';
import { MASTER_RITUALS } from '../../lib/data/rituals';
import { formatTime } from '@/lib/utils/time';

interface RitualsViewProps {
    stats: RitualStat[];
    onCompleteRitual: (stat: RitualStat) => void;
}

export const RitualsView: React.FC<RitualsViewProps> = ({ stats, onCompleteRitual }) => {
    const [activeRitual, setActiveRitual] = useState<Ritual | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [prepStepsOpen, setPrepStepsOpen] = useState(false);
    const [ritualNotes, setRitualNotes] = useState("");

    // Timer logic
    useEffect(() => {
        if (endTime === null) return;

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) {
                setEndTime(null);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [endTime]);

    const handleStartRitual = (ritual: Ritual) => {
        setActiveRitual(ritual);
        setTimeLeft(ritual.durationMinutes * 60);
        const now = new Date().getTime();
        setEndTime(now + ritual.durationMinutes * 60 * 1000);
        setCompletedSteps(new Set());
        setRitualNotes("");
        setPrepStepsOpen(true);
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

    if (activeRitual) {
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

                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center pb-[120px]">
                    <div className="my-8 text-center">
                        <div className="text-6xl font-light tracking-tighter mb-2 font-mono">
                            {timeLeft !== null ? formatTime(timeLeft) : '0:00'}
                        </div>
                        <p className="text-[var(--text-secondary)] text-sm">{activeRitual.description}</p>
                    </div>

                    <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setPrepStepsOpen(!prepStepsOpen)}
                            className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
                        >
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-[var(--accent)]" />
                                Prep Steps
                            </h3>
                            {prepStepsOpen ? <ChevronUp size={16} className="text-[var(--text-secondary)]"/> : <ChevronDown size={16} className="text-[var(--text-secondary)]"/>}
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

                    <div className="w-full max-w-md mt-4 flex-1 flex flex-col min-h-[200px]">
                        <h3 className="text-sm font-medium mb-2 text-[var(--text-secondary)] px-1">
                            {activeRitual.category.includes('Idea') || activeRitual.category === 'Idea Curation' ? 'Scratchpad' : 'Session Notes'}
                        </h3>
                        <textarea
                            value={ritualNotes}
                            onChange={(e) => setRitualNotes(e.target.value)}
                            placeholder={activeRitual.category.includes('Idea') || activeRitual.category === 'Idea Curation' ? "Capture lyrics, ideas, and song thoughts here..." : "Jot down technical notes, practice insights, or progress..."}
                            className="flex-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl p-4 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />
                    </div>
                </div>

                <div className="p-6 pb-[120px] border-t border-[var(--border-main)] glass">
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

    return (
        <div className="h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
            <header className="px-6 py-8 border-b border-[var(--border-main)] glass z-10 sticky top-0">
                <h1 className="text-2xl font-medium tracking-tight mb-1">Rituals</h1>
                <p className="text-sm text-[var(--text-tertiary)]">Time-boxed sessions to build momentum.</p>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-[120px]">
                {['Idea Generation', 'Idea Development', 'Idea Review', 'Idea Curation', 'Optimization', 'Technique'].map(category => {
                    const categoryRituals = MASTER_RITUALS.filter(r => r.category === category);
                    if (categoryRituals.length === 0) return null;

                    return (
                        <div key={category} className="space-y-4">
                            <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">{category}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {categoryRituals.map(ritual => {
                                    const isCompletedToday = stats.some(s =>
                                        s.ritualId === ritual.id &&
                                        new Date(s.completedAt).toDateString() === new Date().toDateString()
                                    );

                                    return (
                                        <button
                                            key={ritual.id}
                                            onClick={() => handleStartRitual(ritual)}
                                            className="text-left bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl p-5 hover:border-[var(--text-tertiary)] transition-colors group flex flex-col relative overflow-hidden"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="font-medium">{ritual.title}</h3>
                                                {isCompletedToday && (
                                                    <CheckCircle2 size={16} className="text-green-400" />
                                                )}
                                            </div>

                                            <p className="text-sm text-[var(--text-secondary)] mb-6 flex-1">
                                                {ritual.description}
                                            </p>

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
                })}
            </div>
        </div>
    );
};
