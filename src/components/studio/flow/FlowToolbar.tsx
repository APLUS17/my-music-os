'use client';

import React from 'react';
import { useFlow } from './FlowContext';
import { Zap, Type, BookOpen, Music } from 'lucide-react';

type ToolId = 'suggestions' | 'rhymes' | 'words' | 'flow';

const tools: { id: ToolId; Icon: React.FC<{ size?: number }>; label: string; emoji: string }[] = [
  { id: 'suggestions', Icon: Zap, label: 'Suggest', emoji: '✨' },
  { id: 'rhymes', Icon: Type, label: 'Rhymes', emoji: '🔤' },
  { id: 'words', Icon: BookOpen, label: 'Words', emoji: '📚' },
  { id: 'flow', Icon: Music, label: 'Flow', emoji: '🎵' },
];

export const FlowToolbar: React.FC = () => {
  const { activeTool, setActiveTool } = useFlow();

  const handlePress = (id: ToolId) => {
    setActiveTool(activeTool === id ? null : id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 120,
        padding: '10px 16px 20px',
        background: 'linear-gradient(to top, rgba(10,8,22,0.98) 60%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {tools.map(({ id, Icon, label, emoji }) => {
        const isActive = activeTool === id;
        return (
          <button
            key={id}
            onClick={() => handlePress(id)}
            style={{
              flex: 1,
              maxWidth: 90,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '10px 8px',
              borderRadius: 16,
              border: isActive
                ? '1px solid rgba(0,255,255,0.35)'
                : '1px solid rgba(255,255,255,0.07)',
              background: isActive
                ? 'linear-gradient(135deg, rgba(89,13,242,0.35), rgba(0,200,200,0.2))'
                : 'rgba(255,255,255,0.04)',
              boxShadow: isActive
                ? '0 0 16px rgba(0,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
                : 'none',
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: isActive ? 'rgba(0,255,255,0.95)' : 'rgba(255,255,255,0.4)',
                transition: 'color 200ms',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </span>
            {/* Active dot indicator */}
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'rgba(0,255,255,0.8)',
                opacity: isActive ? 1 : 0,
                transition: 'opacity 200ms',
                boxShadow: '0 0 6px rgba(0,255,255,0.6)',
              }}
            />
          </button>
        );
      })}
    </div>
  );
};
