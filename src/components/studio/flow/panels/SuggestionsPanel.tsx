'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFlow } from '../FlowContext';
import { ToolPanel } from '../shared/ToolPanel';
import { buildSuggestionPrompt, parseJsonResponse } from '@/lib/ai/prompts';
import { GoogleGenAI, Type } from '@google/genai';
import { Copy, RefreshCw } from 'lucide-react';

interface SuggestionChipProps {
  text: string;
  onSelect: (text: string) => void;
  isLoading?: boolean;
}

const SuggestionChip: React.FC<SuggestionChipProps> = ({ text, onSelect, isLoading }) => {
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
      className="w-full p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-main)] text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-hover)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex-1 break-words">{text}</span>
        <div className="flex-shrink-0">
          {copied ? (
            <span className="text-[10px] text-[var(--accent)] font-medium">✓</span>
          ) : (
            <Copy size={14} className="text-[var(--text-tertiary)]" />
          )}
        </div>
      </div>
    </button>
  );
};

export const SuggestionsPanel: React.FC = () => {
  const {
    activeTool,
    selectedText,
    genre,
    isLoading,
    suggestions,
    error,
    setActiveTool,
    generateSuggestions,
  } = useFlow();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuggestions, setLocalSuggestions] = useState<string[]>([]);
  const [creativity, setCreativity] = useState(50);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isOpen = activeTool === 'suggestions';


  // Generate suggestions with Gemini
  const handleGenerateSuggestions = async () => {
    if (!selectedText || !selectedText.trim()) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLocalLoading(true);
    setLocalError(null);
    setLocalSuggestions([]);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('Google API key not configured');
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = buildSuggestionPrompt(selectedText, genre, creativity);

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

      const results = parseJsonResponse(response.text).slice(0, 5);
      setLocalSuggestions(results.length > 0 ? results : []);

      if (results.length === 0) {
        setLocalError('No suggestions generated. Try a different line.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate suggestions';
      setLocalError(message);
      console.error('[SuggestionsPanel]', err);
    } finally {
      setLocalLoading(false);
    }
  };

  // Auto-generate when panel opens and text is selected
  useEffect(() => {
    if (isOpen && selectedText && !localLoading && localSuggestions.length === 0) {
      const timer = setTimeout(() => {
        handleGenerateSuggestions();
      }, 300); // Delay for smooth animation

      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedText]);

  const handleSelectSuggestion = (text: string) => {
    // Parent component will handle insertion
    setActiveTool(null);
    // TODO: Emit event to parent to insert text at cursor
  };

  return (
    <ToolPanel
      isOpen={isOpen}
      onClose={() => setActiveTool(null)}
      title="✨ Suggestions"
      isLoading={localLoading}
      error={localError}
    >
      <div className="space-y-4">
        {/* Context Display */}
        {selectedText && (
          <div className="rounded-lg bg-[var(--bg-hover)] p-3 border border-[var(--border-main)]">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Line
            </p>
            <p className="text-sm text-[var(--text-main)] break-words italic">{selectedText}</p>
          </div>
        )}

        {/* Genre & Creativity Display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-[var(--bg-hover)] p-3 border border-[var(--border-main)]">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Genre
            </p>
            <p className="text-sm font-medium text-[var(--text-main)] capitalize">{genre}</p>
          </div>
          <div className="rounded-lg bg-[var(--bg-hover)] p-3 border border-[var(--border-main)]">
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Creativity
            </p>
            <p className="text-sm font-medium text-[var(--text-main)]">
              {creativity > 70 ? '🎨 High' : creativity > 40 ? '⚡ Medium' : '📝 Low'}
            </p>
          </div>
        </div>

        {/* Creativity Slider */}
        <div>
          <label className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-2">
            Adjust Creativity
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={creativity}
            onChange={(e) => setCreativity(Number(e.target.value))}
            className="w-full h-2 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
          />
          <div className="flex justify-between text-[9px] text-[var(--text-tertiary)] mt-1">
            <span>Conservative</span>
            <span>Experimental</span>
          </div>
        </div>

        {/* Suggestions List */}
        {localSuggestions.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider block">
              Suggestions ({localSuggestions.length})
            </label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {localSuggestions.map((suggestion, idx) => (
                <SuggestionChip
                  key={idx}
                  text={suggestion}
                  onSelect={handleSelectSuggestion}
                  isLoading={localLoading}
                />
              ))}
            </div>
          </div>
        )}

        {/* Regenerate Button */}
        {localSuggestions.length > 0 && (
          <button
            onClick={handleGenerateSuggestions}
            disabled={localLoading}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            <RefreshCw size={16} />
            New Suggestions
          </button>
        )}

        {/* Initial State */}
        {!selectedText && (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-secondary)]">
              Select a line of lyrics to get suggestions
            </p>
          </div>
        )}
      </div>
    </ToolPanel>
  );
};
