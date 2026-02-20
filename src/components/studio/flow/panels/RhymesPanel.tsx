'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFlow } from '../FlowContext';
import { ToolPanel } from '../shared/ToolPanel';
import { buildRhymePrompt, parseJsonResponse } from '@/lib/ai/prompts';
import { detectRhymeScheme, getRhymesFromDatamuse, getNearRhymesFromDatamuse, getFamilyColor } from '@/lib/ai/rhymeScheme';
import { GoogleGenAI, Type } from '@google/genai';
import { Copy, RefreshCw } from 'lucide-react';

type RhymeTab = 'perfect' | 'near' | 'multi';

interface RhymeChipProps {
  text: string;
  onSelect: (text: string) => void;
  isLoading?: boolean;
}

const RhymeChip: React.FC<RhymeChipProps> = ({ text, onSelect, isLoading }) => {
  const [copied, setCopied] = useState(false);

  const handleTap = () => {
    onSelect(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleTap}
      disabled={isLoading}
      className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-main)] text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
    >
      {text}
    </button>
  );
};

export const RhymesPanel: React.FC = () => {
  const { activeTool, selectedText, previousLines, setActiveTool } = useFlow();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [perfectRhymes, setPerfectRhymes] = useState<string[]>([]);
  const [nearRhymes, setNearRhymes] = useState<string[]>([]);
  const [multiRhymes, setMultiRhymes] = useState<string[]>([]);
  const [currentTab, setCurrentTab] = useState<RhymeTab>('perfect');
  const [endWord, setEndWord] = useState<string>('');
  const [schemeVisualization, setSchemeVisualization] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const isOpen = activeTool === 'rhymes';

  // Detect end word and get rhymes when panel opens
  useEffect(() => {
    if (isOpen && selectedText) {
      const words = selectedText.trim().split(/\s+/);
      const detected = words[words.length - 1]?.toLowerCase() || '';
      setEndWord(detected);

      // Also detect rhyme scheme from previous lines
      if (previousLines.length > 0) {
        const scheme = detectRhymeScheme(previousLines);
        setSchemeVisualization(scheme.pattern);
      }

      // Auto-fetch rhymes
      const timer = setTimeout(() => {
        handleFetchRhymes(detected);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedText]);

  const handleFetchRhymes = async (word: string) => {
    if (!word || word.length < 2) return;

    setLocalLoading(true);
    setLocalError(null);

    try {
      // Try Datamuse first (faster, no API key needed)
      const [perfect, near] = await Promise.all([
        getRhymesFromDatamuse(word),
        getNearRhymesFromDatamuse(word),
      ]);

      setPerfectRhymes(perfect);
      setNearRhymes(near);

      // For multisyllabic rhymes, try Gemini as fallback
      if (perfect.length > 0 || near.length > 0) {
        try {
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
          if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = buildRhymePrompt(word);

            const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            });

            const multi = parseJsonResponse(response.text ?? '').filter(
              (r) => !perfect.includes(r) && !near.includes(r)
            );
            setMultiRhymes(multi);
          }
        } catch (e) {
          console.error('Gemini API for multisyllabic rhymes failed:', e);
          // Silently fail - we already have Datamuse results
        }
      }
    } catch (err) {
      setLocalError('Could not find rhymes. Try another word.');
      console.error('[RhymesPanel]', err);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSelectRhyme = (rhyme: string) => {
    // Parent component will handle insertion
    setActiveTool(null);
    // TODO: Emit event to parent to insert/replace word
  };

  const allRhymes = {
    perfect: perfectRhymes,
    near: nearRhymes,
    multi: multiRhymes,
  };

  const currentRhymes = allRhymes[currentTab];
  const hasRhymes = perfectRhymes.length > 0 || nearRhymes.length > 0 || multiRhymes.length > 0;

  return (
    <ToolPanel
      isOpen={isOpen}
      onClose={() => setActiveTool(null)}
      title="🔤 Rhymes"
      isLoading={localLoading}
      error={localError}
    >
      <div className="space-y-4">
        {/* Context Display */}
        {endWord && (
          <div className="rounded-lg bg-[var(--bg-hover)] p-3 border border-[var(--border-main)]">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Rhyme with
            </p>
            <p className="text-sm font-semibold text-[var(--text-main)]">{endWord}</p>
          </div>
        )}

        {/* Rhyme Scheme Visualization */}
        {schemeVisualization && (
          <div className="rounded-lg bg-[var(--bg-hover)] p-3 border border-[var(--border-main)]">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
              Scheme
            </p>
            <div className="flex flex-wrap gap-1">
              {schemeVisualization.split('').map((char, idx) => (
                <div
                  key={idx}
                  className="w-6 h-6 rounded-sm bg-[var(--accent)] text-black text-[10px] font-bold flex items-center justify-center"
                >
                  {char}
                </div>
              ))}
            </div>
            <p className="text-[9px] text-[var(--text-tertiary)] mt-2">
              Current pattern: {schemeVisualization}
            </p>
          </div>
        )}

        {/* Tabs */}
        {hasRhymes && (
          <div className="flex gap-2 border-b border-[var(--border-main)]">
            {(['perfect', 'near', 'multi'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 ${currentTab === tab
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                  }`}
              >
                {tab === 'perfect' && `Perfect (${perfectRhymes.length})`}
                {tab === 'near' && `Near (${nearRhymes.length})`}
                {tab === 'multi' && `Multi (${multiRhymes.length})`}
              </button>
            ))}
          </div>
        )}

        {/* Rhymes Grid */}
        {currentRhymes.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
            {currentRhymes.map((rhyme, idx) => (
              <RhymeChip
                key={idx}
                text={rhyme}
                onSelect={handleSelectRhyme}
                isLoading={localLoading}
              />
            ))}
          </div>
        ) : hasRhymes ? (
          <p className="text-sm text-[var(--text-secondary)] text-center py-4">
            No rhymes in this category
          </p>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-secondary)]">
              Select a line to find rhymes
            </p>
          </div>
        )}

        {/* Refresh Button */}
        {hasRhymes && (
          <button
            onClick={() => handleFetchRhymes(endWord)}
            disabled={localLoading}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            <RefreshCw size={16} />
            Find More Rhymes
          </button>
        )}
      </div>
    </ToolPanel>
  );
};
