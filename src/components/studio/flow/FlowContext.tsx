'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { FlowContextState, ToolType, Genre, SuggestionResult } from '@/types';

const FlowContext = createContext<FlowContextState | undefined>(undefined);

export const FlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [currentLineId, setCurrentLineId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [genre, setGenreState] = useState<Genre>('hip-hop');
  const [mood, setMood] = useState<string | null>(null);
  const [previousLines, setPreviousLines] = useState<string[]>([]);

  const setSelection = useCallback((text: string, position: number, lineId: string) => {
    setSelectedText(text);
    setCursorPosition(position);
    setCurrentLineId(lineId);
  }, []);

  const generateSuggestions = useCallback(async (type: ToolType) => {
    setIsLoading(true);
    setError(null);
    try {
      // Placeholder - will be implemented in each panel
      setSuggestions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const insertText = useCallback((text: string, position: 'replace' | 'append') => {
    // This will be handled by the parent component
    // Just setting suggestion for the parent to pick up
    setSuggestions([{ text }]);
  }, []);

  const setGenre = useCallback((newGenre: Genre) => {
    setGenreState(newGenre);
    // Clear suggestions when genre changes
    setSuggestions([]);
  }, []);

  const value: FlowContextState = {
    activeTool,
    selectedText,
    cursorPosition,
    currentLineId,
    isLoading,
    suggestions,
    error,
    genre,
    mood,
    previousLines,
    setActiveTool,
    setSelection,
    generateSuggestions,
    insertText,
    setGenre,
  };

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
};

export const useFlow = () => {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error('useFlow must be used within a FlowProvider');
  }
  return context;
};
