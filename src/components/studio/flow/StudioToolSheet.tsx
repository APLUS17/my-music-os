'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { RefreshCw, ChevronUp } from 'lucide-react';
import { useFlow } from './FlowContext';
import { buildSuggestionPrompt, buildSynonymPrompt, buildSimilePrompt, buildScenePrompt, buildExplodePrompt, parseJsonResponse } from '@/lib/ai/prompts';
import { getRhymesFromDatamuse, getNearRhymesFromDatamuse } from '@/lib/ai/rhymeScheme';
import { GoogleGenAI, Type } from '@google/genai';

// ─── Snap heights ─────────────────────────────────────────────────────────────
const SNAP_MINI = 56;          // just the tab strip
const SNAP_FULL = 360;         // expanded content

type TabId = 'suggestions' | 'rhymes' | 'words';

// ─── Small chip component ─────────────────────────────────────────────────────
const Chip: React.FC<{ text: string; onTap: (t: string) => void; accent?: boolean }> = ({ text, onTap, accent }) => {
    const [flash, setFlash] = useState(false);
    return (
        <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { onTap(text); setFlash(true); setTimeout(() => setFlash(false), 900); }}
            style={{
                padding: '6px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.01em',
                border: flash ? '1px solid rgba(0,255,255,0.5)' : accent ? '1px solid rgba(165,139,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                background: flash ? 'rgba(0,255,255,0.12)' : accent ? 'rgba(165,139,255,0.12)' : 'rgba(255,255,255,0.05)',
                color: flash ? 'rgba(0,255,255,0.95)' : 'rgba(255,255,255,0.75)',
                cursor: 'pointer',
                transition: 'all 180ms',
                whiteSpace: 'nowrap' as const,
                WebkitTapHighlightColor: 'transparent',
            }}
        >
            {text}
        </motion.button>
    );
};

// ─── Filter pill ──────────────────────────────────────────────────────────────
const FilterPill: React.FC<{ label: string; active: boolean; onToggle: () => void }> = ({ label, active, onToggle }) => (
    <button
        onClick={onToggle}
        style={{
            padding: '5px 12px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            border: active ? '1px solid rgba(0,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
            background: active ? 'rgba(0,255,255,0.1)' : 'transparent',
            color: active ? 'rgba(0,255,255,0.9)' : 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
            transition: 'all 180ms',
            WebkitTapHighlightColor: 'transparent',
        }}
    >
        {label}
    </button>
);

// ─── Context chip ─────────────────────────────────────────────────────────────
const ContextChip: React.FC<{ text: string; label: string }> = ({ text, label }) => (
    <div style={{
        padding: '4px 0',
        marginBottom: 10,
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
    }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{text}</div>
    </div>
);

// ─── Skeleton loader ──────────────────────────────────────────────────────────
const Skeleton: React.FC = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
        {[80, 60, 100, 70, 90].map((w, i) => (
            <div key={i} style={{ width: w, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
        ))}
    </div>
);

// ─── Free tier counter helpers ────────────────────────────────────────────────
const DAILY_LIMIT = 25;
const COUNTER_KEY = 'lyriq-suggest-count';
const DATE_KEY = 'lyriq-suggest-date';

const getSuggestionsRemaining = (): number => {
    if (typeof window === 'undefined') return DAILY_LIMIT;
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem(DATE_KEY);
    if (storedDate !== today) {
        localStorage.setItem(DATE_KEY, today);
        localStorage.setItem(COUNTER_KEY, '0');
        return DAILY_LIMIT;
    }
    const used = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10);
    return Math.max(0, DAILY_LIMIT - used);
};

const incrementSuggestCounter = (): void => {
    if (typeof window === 'undefined') return;
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem(DATE_KEY);
    if (storedDate !== today) {
        localStorage.setItem(DATE_KEY, today);
        localStorage.setItem(COUNTER_KEY, '1');
        return;
    }
    const used = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10);
    localStorage.setItem(COUNTER_KEY, String(used + 1));
};

// ─── SUGGEST TAB ─────────────────────────────────────────────────────────────
const SuggestTab: React.FC<{ selectedText: string | null; genre: string }> = ({ selectedText, genre }) => {
    const { handleInsert } = useFlow();
    const [results, setResults] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [tone, setTone] = useState<'darker' | 'same' | 'hopeful'>('same');
    const lastText = useRef('');
    const [remaining, setRemaining] = useState(DAILY_LIMIT);

    // Sync remaining count on mount and after generations
    useEffect(() => {
        setRemaining(getSuggestionsRemaining());
    }, []);

    const generate = useCallback(async (text: string) => {
        if (!text.trim() || text === lastText.current) return;
        // Check free tier limit
        if (getSuggestionsRemaining() <= 0) return;
        lastText.current = text;
        setLoading(true);
        setResults([]);
        try {
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
            if (!apiKey) throw new Error('No API key');
            const ai = new GoogleGenAI({ apiKey });
            const prompt = buildSuggestionPrompt(text, genre as any, tone === 'hopeful' ? 80 : tone === 'darker' ? 20 : 50);
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } },
            });
            const parsed = parseJsonResponse(response.text ?? '').slice(0, 5);
            setResults(parsed);
            incrementSuggestCounter();
            setRemaining(getSuggestionsRemaining());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [genre, tone]);

    useEffect(() => {
        if (selectedText) {
            const t = setTimeout(() => generate(selectedText), 400);
            return () => clearTimeout(t);
        }
    }, [selectedText, tone]);

    if (!selectedText) return (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Tap a line to get suggestions
        </div>
    );

    // Limit reached
    if (remaining <= 0) return (
        <div>
            <ContextChip label="Continuing from" text={selectedText} />
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
                You&apos;ve used all {DAILY_LIMIT} suggestions today.
                <br />Come back tomorrow for more inspiration!
            </div>
        </div>
    );

    return (
        <div>
            <ContextChip label="Continuing from" text={selectedText} />
            {/* Tone filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
                {(['darker', 'same', 'hopeful'] as const).map(t => (
                    <FilterPill key={t} label={t === 'same' ? 'Keep tone' : t.charAt(0).toUpperCase() + t.slice(1)} active={tone === t} onToggle={() => { setTone(t); lastText.current = ''; }} />
                ))}
                <button onClick={() => { lastText.current = ''; generate(selectedText); }} disabled={loading} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: loading ? 'rgba(255,255,255,0.2)' : 'rgba(165,139,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
                    <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
                </button>
            </div>
            {/* Counter badge */}
            <div style={{ textAlign: 'right', marginBottom: 8, fontSize: 10, color: remaining <= 5 ? 'rgba(255,180,100,0.6)' : 'rgba(255,255,255,0.2)', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
                {remaining} left today
            </div>
            {/* Results */}
            {loading ? <Skeleton /> : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    {results.map((r, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                            style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(165,139,255,0.05)', border: '1px solid rgba(165,139,255,0.15)', fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, cursor: 'pointer', transition: 'all 200ms' }}
                            onClick={() => handleInsert('\n' + r)} // Start new line for suggestions
                            whileTap={{ scale: 0.98 }}
                            whileHover={{ background: 'rgba(165,139,255,0.1)', borderColor: 'rgba(165,139,255,0.3)' }}
                        >
                            {r}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── RHYMES TAB ──────────────────────────────────────────────────────────────
const RhymesTab: React.FC<{ selectedText: string | null }> = ({ selectedText }) => {
    const { handleInsert } = useFlow();
    const [perfect, setPerfect] = useState<string[]>([]);
    const [near, setNear] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<{ perfect: boolean; near: boolean }>({ perfect: true, near: true });
    const [endWord, setEndWord] = useState('');

    useEffect(() => {
        if (!selectedText) return;
        const words = selectedText.trim().split(/\s+/);
        const word = words[words.length - 1]?.toLowerCase().replace(/[^a-z]/g, '') || '';
        if (!word || word === endWord) return;
        setEndWord(word);
        setLoading(true);
        Promise.all([
            getRhymesFromDatamuse(word).catch(() => []),
            getNearRhymesFromDatamuse(word).catch(() => []),
        ]).then(([p, n]) => {
            setPerfect(p.slice(0, 20));
            setNear(n.slice(0, 20));
        }).finally(() => setLoading(false));
    }, [selectedText]);

    if (!selectedText) return (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Tap a line to find rhymes
        </div>
    );

    const showPerfect = filter.perfect && perfect.length > 0;
    const showNear = filter.near && near.length > 0;

    return (
        <div>
            <ContextChip label="Rhyming with" text={`"${endWord}"`} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                <FilterPill label="Perfect" active={filter.perfect} onToggle={() => setFilter(f => ({ ...f, perfect: !f.perfect }))} />
                <FilterPill label="Near" active={filter.near} onToggle={() => setFilter(f => ({ ...f, near: !f.near }))} />
            </div>
            {loading ? <Skeleton /> : (
                <div>
                    {showPerfect && (
                        <div style={{ marginBottom: 16 }}>
                            {!filter.near && !filter.perfect ? null : (
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 8 }}>Perfect</div>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 7 }}>
                                {perfect.map((w, i) => <Chip key={i} text={w} onTap={(t) => handleInsert(t + ' ')} />)}
                            </div>
                        </div>
                    )}
                    {showNear && (
                        <div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 8 }}>Near</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 7 }}>
                                {near.map((w, i) => <Chip key={i} text={w} onTap={(t) => handleInsert(t + ' ')} />)}
                            </div>
                        </div>
                    )}
                    {!showPerfect && !showNear && (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No rhymes found for "{endWord}"</div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── WORDS TAB ────────────────────────────────────────────────────────────────
type WordSub = 'synonyms' | 'similes' | 'scenes' | 'expand';
const WORD_SUBS: { id: WordSub; label: string }[] = [
    { id: 'synonyms', label: 'Synonyms' },
    { id: 'similes', label: 'Similes' },
    { id: 'scenes', label: 'Scenes' },
    { id: 'expand', label: 'Expand' },
];

const WordsTab: React.FC<{ selectedText: string | null; genre: string }> = ({ selectedText, genre }) => {
    const { handleInsert } = useFlow();
    const [sub, setSub] = useState<WordSub>('synonyms');
    const [results, setResults] = useState<Record<WordSub, string[]>>({ synonyms: [], similes: [], scenes: [], expand: [] });
    const [loading, setLoading] = useState(false);
    const lastWord = useRef('');

    const fetchSub = useCallback(async (word: string, subtab: WordSub) => {
        if (!word.trim()) return;
        const cacheKey = `${word}-${subtab}`;
        if (cacheKey === lastWord.current && results[subtab].length > 0) return;
        lastWord.current = cacheKey;
        setLoading(true);
        try {
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
            if (!apiKey) return;
            const ai = new GoogleGenAI({ apiKey });
            const promptFn = subtab === 'synonyms' ? buildSynonymPrompt
                : subtab === 'similes' ? buildSimilePrompt
                    : subtab === 'scenes' ? buildScenePrompt
                        : buildExplodePrompt;
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: promptFn(word, genre as any),
                config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } },
            });
            const parsed = parseJsonResponse(response.text ?? '').slice(0, 12);
            setResults(prev => ({ ...prev, [subtab]: parsed }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [genre, results]);

    useEffect(() => {
        if (selectedText) {
            lastWord.current = '';
            setResults({ synonyms: [], similes: [], scenes: [], expand: [] });
            const t = setTimeout(() => fetchSub(selectedText, sub), 400);
            return () => clearTimeout(t);
        }
    }, [selectedText]);

    useEffect(() => {
        if (selectedText) fetchSub(selectedText, sub);
    }, [sub]);

    if (!selectedText) return (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Select a word or line
        </div>
    );

    return (
        <div>
            <ContextChip label="Expanding" text={selectedText} />
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 14, overflowX: 'auto' as const, paddingBottom: 4 }}>
                {WORD_SUBS.map(({ id, label }) => (
                    <button key={id} onClick={() => setSub(id)} style={{
                        padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
                        border: sub === id ? '1px solid rgba(165,139,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                        background: sub === id ? 'rgba(165,139,255,0.12)' : 'transparent',
                        color: sub === id ? 'rgba(165,139,255,0.95)' : 'rgba(255,255,255,0.35)',
                        cursor: 'pointer', transition: 'all 180ms', WebkitTapHighlightColor: 'transparent',
                    }}>{label}</button>
                ))}
            </div>
            {/* Results */}
            {loading ? <Skeleton /> : (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 7 }}>
                    {results[sub].length > 0
                        ? results[sub].map((w, i) => <Chip key={i} text={w} onTap={(t) => handleInsert(t + ' ')} accent />)
                        : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No results yet</div>
                    }
                </div>
            )}
        </div>
    );
};

export const StudioToolSheet: React.FC = () => {
    const { activeTool, selectedText, genre } = useFlow();

    // The component now relies entirely on activeTool from context
    // No more internal tab clicking or redundant tab bars

    return (
        <div className="w-full flex flex-col">
            {/* Content Area */}
            <div className="flex-1 min-h-0">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTool}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTool === 'suggestions' && <SuggestTab selectedText={selectedText} genre={genre} />}
                        {activeTool === 'rhymes' && <RhymesTab selectedText={selectedText} />}
                        {activeTool === 'words' && <WordsTab selectedText={selectedText} genre={genre} />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
