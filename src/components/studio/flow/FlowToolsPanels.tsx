'use client';

import React from 'react';
import { SuggestionsPanel } from './panels/SuggestionsPanel';
import { RhymesPanel } from './panels/RhymesPanel';
import { WordsPanel } from './panels/WordsPanel';
import { FlowPanel } from './panels/FlowPanel';

interface FlowToolsPanelsProps {
  /** Current lyrics text — passed to FlowPanel for syllable counting */
  lyrics?: string;
}

/**
 * FlowToolsPanels
 * Renders all FLOW AI tool panels as non-blocking bottom sheets.
 * Each panel manages its own open/close state via FlowContext.
 */
export const FlowToolsPanels: React.FC<FlowToolsPanelsProps> = ({ lyrics = '' }) => {
  return (
    <>
      <SuggestionsPanel />
      <RhymesPanel />
      <WordsPanel />
      <FlowPanel lyrics={lyrics} />
    </>
  );
};
