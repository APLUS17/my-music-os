'use client';

import React, { useState, useEffect } from 'react';
import { useFlow } from '../FlowContext';
import { ToolPanel } from '../shared/ToolPanel';
import { CheckCircle, Circle, RefreshCw } from 'lucide-react';

interface StructureSection {
    label: string;
    bars: number;
    syllableRange: [number, number];
    description: string;
}

const SONG_STRUCTURES: Record<string, StructureSection[]> = {
    standard: [
        { label: 'Verse 1', bars: 8, syllableRange: [24, 40], description: 'Set the scene, tell the story' },
        { label: 'Pre-Chorus', bars: 4, syllableRange: [12, 20], description: 'Build tension before the hook' },
        { label: 'Chorus', bars: 8, syllableRange: [20, 32], description: 'Your most memorable moment' },
        { label: 'Verse 2', bars: 8, syllableRange: [24, 40], description: 'Deepen the narrative' },
        { label: 'Pre-Chorus', bars: 4, syllableRange: [12, 20], description: 'Build again' },
        { label: 'Chorus', bars: 8, syllableRange: [20, 32], description: 'The hook returns bigger' },
        { label: 'Bridge', bars: 8, syllableRange: [16, 28], description: 'Surprise shift in perspective' },
        { label: 'Outro Chorus', bars: 8, syllableRange: [20, 32], description: 'Grand finale' },
    ],
    rap: [
        { label: 'Intro', bars: 4, syllableRange: [8, 20], description: 'Set your vibe' },
        { label: 'Verse 1', bars: 16, syllableRange: [64, 100], description: '16 bars — establish your flow' },
        { label: 'Hook', bars: 4, syllableRange: [12, 24], description: 'Catchy, less syllable-dense' },
        { label: 'Verse 2', bars: 16, syllableRange: [64, 100], description: 'Elevate from verse 1' },
        { label: 'Hook', bars: 4, syllableRange: [12, 24], description: 'The hook again' },
        { label: 'Verse 3 / Bridge', bars: 8, syllableRange: [32, 64], description: 'Optional: go hardest here' },
        { label: 'Outro Hook', bars: 4, syllableRange: [12, 24], description: 'Fade out' },
    ],
    ballad: [
        { label: 'Intro', bars: 4, syllableRange: [0, 0], description: 'Instrumental / humming' },
        { label: 'Verse 1', bars: 8, syllableRange: [20, 32], description: 'Slow, emotional opening' },
        { label: 'Chorus', bars: 8, syllableRange: [16, 28], description: 'Emotional climax' },
        { label: 'Verse 2', bars: 8, syllableRange: [20, 32], description: 'Layer more imagery' },
        { label: 'Chorus', bars: 8, syllableRange: [16, 28], description: 'Repeat with more feeling' },
        { label: 'Bridge', bars: 8, syllableRange: [16, 24], description: 'Breakdown / key change' },
        { label: 'Final Chorus', bars: 8, syllableRange: [16, 28], description: 'Biggest moment' },
    ],
};

const RHYME_SCHEMES = [
    { name: 'AABB', description: 'Couplets — 1&2 rhyme, 3&4 rhyme', example: ['Roses • A', 'Poses • A', 'Blue sky • B', 'High fly • B'] },
    { name: 'ABAB', description: 'Alternating — 1&3 rhyme, 2&4 rhyme', example: ['Roses • A', 'Blue • B', 'Poses • A', 'Dew • B'] },
    { name: 'ABCB', description: 'Folk/Country — only 2&4 rhyme', example: ['Mountains • A', 'Blue • B', 'Calling • C', 'Through • B'] },
    { name: 'AAAA', description: 'Monorhyme — all lines rhyme (rap)', example: ['Night • A', 'Sight • A', 'Light • A', 'Right • A'] },
];

const countSyllables = (text: string): number => {
    if (!text) return 0;
    // Simple heuristic syllable counter
    const lower = text.toLowerCase().replace(/[^a-z]/g, ' ');
    const words = lower.split(/\s+/).filter(Boolean);
    return words.reduce((total, word) => {
        const matches = word.match(/[aeiouy]+/g);
        let count = matches ? matches.length : 1;
        if (word.endsWith('e') && count > 1) count--;
        return total + Math.max(1, count);
    }, 0);
};

export const FlowPanel: React.FC<{ lyrics?: string }> = ({ lyrics = '' }) => {
    const { activeTool, genre, setActiveTool } = useFlow();
    const [structureType, setStructureType] = useState<'standard' | 'rap' | 'ballad'>('standard');
    const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
    const [activeTab, setActiveTab] = useState<'structure' | 'syllables' | 'scheme'>('structure');

    const isOpen = activeTool === 'flow';

    // Auto-pick structure based on genre
    useEffect(() => {
        if (genre === 'hip-hop') {
            setStructureType('rap');
        } else if (genre === 'country') {
            setStructureType('ballad');
        } else {
            setStructureType('standard');
        }
    }, [genre]);

    const structure = SONG_STRUCTURES[structureType];

    // Calculate syllables per line from lyrics text
    const lines = lyrics
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    const toggleSection = (idx: number) => {
        setCompletedSections(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const progressPct = structure.length > 0
        ? Math.round((completedSections.size / structure.length) * 100)
        : 0;

    return (
        <ToolPanel
            isOpen={isOpen}
            onClose={() => setActiveTool(null)}
            title="Flow"
            icon="🎵"
            heightFraction={0.7}
        >
            <div className="space-y-4">

                {/* Structure Type Picker */}
                <div className="flex gap-2">
                    {(['standard', 'rap', 'ballad'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => setStructureType(type)}
                            style={{
                                flex: 1,
                                padding: '8px 4px',
                                borderRadius: 10,
                                border: structureType === type
                                    ? '1px solid rgba(0,255,255,0.4)'
                                    : '1px solid rgba(255,255,255,0.08)',
                                background: structureType === type
                                    ? 'rgba(0,200,200,0.12)'
                                    : 'rgba(255,255,255,0.04)',
                                fontSize: 11,
                                fontWeight: 600,
                                color: structureType === type
                                    ? 'rgba(0,255,255,0.9)'
                                    : 'rgba(255,255,255,0.45)',
                                textTransform: 'capitalize',
                                transition: 'all 200ms',
                            }}
                        >
                            {type === 'standard' ? 'Pop/R&B' : type === 'rap' ? 'Rap/Hip-Hop' : 'Ballad/Folk'}
                        </button>
                    ))}
                </div>

                {/* Progress Bar */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Song Progress
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(0,255,255,0.8)', fontWeight: 700 }}>
                            {progressPct}%
                        </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div
                            style={{
                                height: '100%',
                                width: `${progressPct}%`,
                                background: 'linear-gradient(90deg, rgba(89,13,242,0.9), rgba(0,255,255,0.9))',
                                borderRadius: 99,
                                transition: 'width 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }}
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    {(['structure', 'syllables', 'scheme'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1,
                                padding: '8px 4px',
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: `2px solid ${activeTab === tab ? 'rgba(0,255,255,0.8)' : 'transparent'}`,
                                color: activeTab === tab ? 'rgba(0,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                                transition: 'all 200ms',
                                background: 'none',
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Structure Tab */}
                {activeTab === 'structure' && (
                    <div className="space-y-2">
                        {structure.map((section, idx) => {
                            const done = completedSections.has(idx);
                            return (
                                <button
                                    key={idx}
                                    onClick={() => toggleSection(idx)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '12px 14px',
                                        borderRadius: 12,
                                        border: done
                                            ? '1px solid rgba(0,255,255,0.3)'
                                            : '1px solid rgba(255,255,255,0.07)',
                                        background: done
                                            ? 'rgba(0,200,200,0.08)'
                                            : 'rgba(255,255,255,0.03)',
                                        textAlign: 'left',
                                        transition: 'all 200ms',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {done ? (
                                        <CheckCircle size={18} color="rgba(0,255,255,0.8)" />
                                    ) : (
                                        <Circle size={18} color="rgba(255,255,255,0.25)" />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: done ? 'rgba(0,255,255,0.9)' : 'rgba(255,255,255,0.85)' }}>
                                                {section.label}
                                            </span>
                                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                                                {section.bars} bars
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                                            {section.description}
                                        </p>
                                        {section.syllableRange[0] > 0 && (
                                            <p style={{ fontSize: 10, color: 'rgba(89,13,242,0.7)', marginTop: 3 }}>
                                                ~{section.syllableRange[0]}–{section.syllableRange[1]} syllables
                                            </p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Syllables Tab */}
                {activeTab === 'syllables' && (
                    <div className="space-y-2">
                        {lines.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                                    Start writing to see syllable counts
                                </p>
                            </div>
                        ) : (
                            <>
                                <div style={{ marginBottom: 8 }}>
                                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Line-by-Line
                                    </p>
                                </div>
                                {lines.slice(-20).map((line, idx) => {
                                    const count = countSyllables(line);
                                    const ideal = count >= 6 && count <= 14;
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 14px',
                                                borderRadius: 10,
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                gap: 12,
                                            }}
                                        >
                                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {line}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: ideal ? 'rgba(0,255,255,0.8)' : count < 4 ? 'rgba(239,68,68,0.7)' : 'rgba(251,191,36,0.8)',
                                                    flexShrink: 0,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {count}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        background: 'rgba(89,13,242,0.12)',
                                        border: '1px solid rgba(89,13,242,0.3)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Total syllables</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(89,13,242,0.9)' }}>
                                        {lines.reduce((s, l) => s + countSyllables(l), 0)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Rhyme Scheme Tab */}
                {activeTab === 'scheme' && (
                    <div className="space-y-3">
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Common Patterns
                        </p>
                        {RHYME_SCHEMES.map(scheme => (
                            <div
                                key={scheme.name}
                                style={{
                                    padding: '12px 14px',
                                    borderRadius: 12,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'rgba(255,255,255,0.03)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                    <span
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            letterSpacing: '0.1em',
                                            color: 'rgba(0,255,255,0.9)',
                                            fontFamily: 'monospace',
                                        }}
                                    >
                                        {scheme.name}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                                        {scheme.description}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {scheme.example.map((ex, i) => (
                                        <span
                                            key={i}
                                            style={{
                                                fontSize: 10,
                                                padding: '3px 8px',
                                                borderRadius: 99,
                                                background: ex.endsWith('A') ? 'rgba(89,13,242,0.2)' : ex.endsWith('B') ? 'rgba(0,150,150,0.2)' : 'rgba(255,255,255,0.08)',
                                                color: ex.endsWith('A') ? 'rgba(180,140,255,0.9)' : ex.endsWith('B') ? 'rgba(0,200,200,0.9)' : 'rgba(255,255,255,0.5)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                            }}
                                        >
                                            {ex}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </ToolPanel>
    );
};
