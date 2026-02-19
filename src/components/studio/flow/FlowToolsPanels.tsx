'use client';

import React from 'react';
import { SuggestionsPanel } from './panels/SuggestionsPanel';
// Import other panels when they're created
// import { RhymesPanel } from './panels/RhymesPanel';
// import { WordsPanel } from './panels/WordsPanel';
// import { FlowPanel } from './panels/FlowPanel';

/**
 * FlowToolsPanels
 * Renders all FLOW AI tool panels as non-blocking overlays
 * Each panel manages its own open/close state via FlowContext
 */
export const FlowToolsPanels: React.FC = () => {
  return (
    <>
      <SuggestionsPanel />
      {/* <RhymesPanel /> */}
      {/* <WordsPanel /> */}
      {/* <FlowPanel /> */}
    </>
  );
};
