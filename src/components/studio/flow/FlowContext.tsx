'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { FlowContextState, ToolType, Genre, SuggestionResult } from '@/types';

const FlowContext = createContext<FlowContextState | undefined>(undefined);

export interface FlowContextValue extends FlowContextState {
  setPreviousLines: (lines: string[]) => void;
  setMood: (mood: string | null) => void;
  setSelection: (text: string | null, position: number | null, lineId: string | null) => void;
  handleInsert: (text: string) => void;
  clearInsertion: () => void;
  pendingInsertion: string | null;
}

export const FlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [currentLineId, setCurrentLineId] = useState<string | null>(null);
  const [pendingInsertion, setPendingInsertion] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [genre, setGenreState] = useState<Genre>('hip-hop');
  const [mood, setMoodState] = useState<string | null>(null);
  const [previousLines, setPreviousLines] = useState<string[]>([]);

  const setSelection = useCallback((text: string | null, position: number | null, lineId: string | null) => {
    // Only update if we have a real selection or if we are explicitly clearing
    // This allows "stuck" context when clicking into the tool panels
    if (text !== null || lineId !== null) {
      setSelectedText(text);
      setCursorPosition(position);
      setCurrentLineId(lineId);
    }
  }, []);

  const handleInsert = useCallback((text: string) => {
    setPendingInsertion(text);
  }, []);

  const clearInsertion = useCallback(() => {
    setPendingInsertion(null);
  }, []);

  const generateSuggestions = useCallback(async (type: ToolType) => {
    setIsLoading(true);
    setError(null);
    try {
      setSuggestions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setGenre = useCallback((newGenre: Genre) => {
    setGenreState(newGenre);
    setSuggestions([]);
  }, []);

  const value: FlowContextValue = {
    activeTool,
    selectedText,
    cursorPosition,
    currentLineId,
    pendingInsertion,
    isLoading,
    suggestions,
    error,
    genre,
    mood,
    previousLines,
    setActiveTool,
    setSelection,
    generateSuggestions,
    handleInsert,
    clearInsertion,
    insertText: (text) => setPendingInsertion(text), // legacy support
    setGenre,
    setPreviousLines,
    setMood: setMoodState,
  };

  return <FlowContext.Provider value={value as any}>{children}</FlowContext.Provider>;
};

export const useFlow = () => {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error('useFlow must be used within a FlowProvider');
  }
  return context as FlowContextValue;
};
