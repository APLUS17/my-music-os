'use client';

import React, { useEffect, useState } from 'react';
import { useFlow } from './FlowContext';
import { Zap, Type, BookOpen, Music } from 'lucide-react';

export const FlowToolbar: React.FC = () => {
  const { activeTool, setActiveTool } = useFlow();
  const [isVisible, setIsVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  let hideTimeoutId: NodeJS.Timeout;

  // Auto-fade toolbar after 3s of no cursor activity
  useEffect(() => {
    setIsVisible(true);
    setFadeOut(false);

    // Clear existing timeout
    if (hideTimeoutId) clearTimeout(hideTimeoutId);

    // Set new timeout
    hideTimeoutId = setTimeout(() => {
      setFadeOut(true);
    }, 3000);

    // Listen for cursor activity to reset timeout
    const handleActivity = () => {
      setIsVisible(true);
      setFadeOut(false);
      if (hideTimeoutId) clearTimeout(hideTimeoutId);
      hideTimeoutId = setTimeout(() => {
        setFadeOut(true);
      }, 3000);
    };

    document.addEventListener('mousedown', handleActivity);
    document.addEventListener('touchstart', handleActivity);

    return () => {
      document.removeEventListener('mousedown', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
      if (hideTimeoutId) clearTimeout(hideTimeoutId);
    };
  }, []);

  const tools = [
    {
      id: 'suggestions',
      icon: Zap,
      label: '✨ Suggestions',
      tooltip: 'AI line completion',
    },
    {
      id: 'rhymes',
      icon: Type,
      label: '🔤 Rhymes',
      tooltip: 'Find rhyming words',
    },
    {
      id: 'words',
      icon: BookOpen,
      label: '📚 Words',
      tooltip: 'Synonyms & TextFX',
    },
    {
      id: 'flow',
      icon: Music,
      label: '🎵 Flow',
      tooltip: 'Structure & melody',
    },
  ];

  if (!isVisible && fadeOut) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-30 transition-opacity duration-300 ${
        fadeOut ? 'opacity-30 hover:opacity-100' : 'opacity-100'
      }`}
    >
      <div className="flex gap-2 p-3 bg-[var(--bg-secondary)] rounded-full border border-[var(--border-main)] shadow-xl backdrop-blur-md">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(activeTool === tool.id ? null : (tool.id as any))}
            className={`relative p-3 rounded-full transition-all duration-200 group ${
              activeTool === tool.id
                ? 'bg-[var(--accent)] text-black shadow-lg scale-110'
                : 'bg-[var(--bg-main)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
            }`}
            title={tool.tooltip}
          >
            <tool.icon size={20} />

            {/* Pulse animation when active */}
            {activeTool === tool.id && (
              <div className="absolute inset-0 bg-[var(--accent)] rounded-full animate-ping opacity-25" />
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {tool.tooltip}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
