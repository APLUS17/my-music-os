'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFlow } from '../FlowContext';
import { ToolPanel } from '../shared/ToolPanel';
import {
  buildSynonymPrompt,
  buildScenePrompt,
  buildExplodePrompt,
  buildSimilePrompt,
  parseJsonResponse,
} from '@/lib/ai/prompts';
import { GoogleGenAI, Type } from '@google/genai';
import { RefreshCw } from 'lucide-react';

type WordTab = 'synonyms' | 'scene' | 'simile' | 'explode';

interface WordChipProps {
  text: string;
  onSelect: (text: string) => void;
  isLoading?: boolean;
}

const WordChip: React.FC<WordChipProps> = ({ text, onSelect, isLoading }) => {
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
      className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-main)] text-xs text-[var(--text-main)] hover:bg-[var(--bg-hover)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation text-left"
    >
      <span className="line-clamp-2">{text}</span>
    </button>
  );
};

export const WordsPanel: React.FC = () => {
  const { activeTool, selectedText, genre, setActiveTool } = useFlow();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [sceneDescriptions, setSceneDescriptions] = useState<string[]>([]);
  const [similes, setSimiles] = useState<string[]>([]);
  const [explodeWords, setExplodeWords] = useState<string[]>([]);
  const [currentTab, setCurrentTab] = useState<WordTab>('synonyms');
  const [selectedWord, setSelectedWord] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const isOpen = activeTool === 'words';

  // Extract and process selected word when panel opens
  useEffect(() => {
    if (isOpen && selectedText) {
      // Extract the word (could be single word or phrase)
      const words = selectedText.trim().split(/\s+/);
      const word = words.length === 1 ? selectedText : selectedText;
      setSelectedWord(word);

      // Auto-fetch synonyms when panel opens
      const timer = setTimeout(() => {
        handleFetchWords(word);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedText]);

  const handleFetchWords = async (word: string) => {
    if (!word || word.length < 2) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLocalLoading(true);
    setLocalError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('Google API key not configured');
      }

      const ai = new GoogleGenAI({ apiKey });

      // Fetch all 4 word types in parallel
      const prompts = {
        synonyms: buildSynonymPrompt(word, genre),
        scene: buildScenePrompt(word),
        simile: buildSimilePrompt(word),
        explode: buildExplodePrompt(word),
      };

      const [synResults, sceneResults, simResults, explodeResults] = await Promise.all([
        generateFromPrompt(ai, prompts.synonyms),
        generateFromPrompt(ai, prompts.scene),
        generateFromPrompt(ai, prompts.simile),
        generateFromPrompt(ai, prompts.explode),
      ]);

      setSynonyms(synResults);
      setSceneDescriptions(sceneResults);
      setSimiles(simResults);
      setExplodeWords(explodeResults);

      if (
        synResults.length === 0 &&
        sceneResults.length === 0 &&
        simResults.length === 0 &&
        explodeResults.length === 0
      ) {
        setLocalError('No word suggestions generated. Try a different word.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate words';
      setLocalError(message);
      console.error('[WordsPanel]', err);
    } finally {
      setLocalLoading(false);
    }
  };

  const generateFromPrompt = async (ai: any, prompt: string): Promise<string[]> => {
    try {
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

      return parseJsonResponse(response.text).slice(0, 8);
    } catch (e) {
      console.error('Prompt generation failed:', e);
      return [];
    }
  };

  const handleSelectWord = (word: string) => {
    // Parent component will handle insertion
    setActiveTool(null);
    // TODO: Emit event to parent to insert/replace word
  };

  const allWords = {
    synonyms,
    scene: sceneDescriptions,
    simile: similes,
    explode: explodeWords,
  };

  const currentWords = allWords[currentTab];
  const hasWords = Object.values(allWords).some((arr) => arr.length > 0);

  const tabLabels: Record<WordTab, string> = {
    synonyms: `Synonyms (${synonyms.length})`,
    scene: `Scene (${sceneDescriptions.length})`,
    simile: `Similes (${similes.length})`,
    explode: `Explode (${explodeWords.length})`,
  };

  return (
    <ToolPanel
      isOpen={isOpen}
      onClose={() => setActiveTool(null)}
      title="📚 Words"
      isLoading={localLoading}
      error={localError}
    >
      <div className="space-y-4">
        {/* Context Display */}
        {selectedWord && (
          <div className="rounded-lg bg-[var(--bg-hover)] p-3 border border-[var(--border-main)]">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Selected
            </p>
            <p className="text-sm font-semibold text-[var(--text-main)] break-words line-clamp-2">
              {selectedWord}
            </p>
          </div>
        )}

        {/* Tabs */}
        {hasWords && (
          <div className="flex gap-2 border-b border-[var(--border-main)] overflow-x-auto">
            {(['synonyms', 'scene', 'simile', 'explode'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
                  currentTab === tab
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
        )}

        {/* Words Grid */}
        {currentWords.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
            {currentWords.map((word, idx) => (
              <WordChip
                key={idx}
                text={word}
                onSelect={handleSelectWord}
                isLoading={localLoading}
              />
            ))}
          </div>
        ) : hasWords ? (
          <p className="text-sm text-[var(--text-secondary)] text-center py-4">
            No words in this category
          </p>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-secondary)]">
              Select a word to explore alternatives
            </p>
          </div>
        )}

        {/* Tab Descriptions */}
        {currentTab === 'synonyms' && (
          <p className="text-[9px] text-[var(--text-tertiary)] italic">
            Similar words in the same genre style
          </p>
        )}
        {currentTab === 'scene' && (
          <p className="text-[9px] text-[var(--text-tertiary)] italic">
            Vivid sensory descriptions (visual, auditory, tactile)
          </p>
        )}
        {currentTab === 'simile' && (
          <p className="text-[9px] text-[var(--text-tertiary)] italic">
            Creative comparisons and metaphors
          </p>
        )}
        {currentTab === 'explode' && (
          <p className="text-[9px] text-[var(--text-tertiary)] italic">
            Similar-sounding phrases and variations
          </p>
        )}

        {/* Refresh Button */}
        {hasWords && (
          <button
            onClick={() => handleFetchWords(selectedWord)}
            disabled={localLoading}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            <RefreshCw size={16} />
            New Words
          </button>
        )}
      </div>
    </ToolPanel>
  );
};
