import React, { useState, useEffect } from 'react';
import { ChevronDown, Terminal, RefreshCw } from 'lucide-react';

interface GeminiPanelProps {
  onClose: () => void;
  contextText: string;
}

export const GeminiPanel: React.FC<GeminiPanelProps> = ({ onClose, contextText }) => {
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const logs = [
    { id: 1, type: 'RHYME_MATCH', content: 'Consider "Desire" or "Higher"' },
    { id: 2, type: 'TONE_ANALYSIS', content: 'Detected: Nostalgia (0.87)' },
    { id: 3, type: 'SUGGESTION', content: 'Try expanding the second verse' }
  ];

  return (
    <div className="absolute bottom-[90px] left-2 right-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-30 font-mono">
      <div className="bg-[var(--bg-secondary)] p-2 flex items-center justify-between border-b border-[var(--border-main)]">
        <div className="flex items-center gap-2 px-2">
          <Terminal size={12} className="text-[var(--text-secondary)]" />
          <span className="text-[10px] uppercase text-[var(--text-secondary)] tracking-wider">System Intelligence</span>
        </div>
        <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-main)] p-1">
          <ChevronDown size={14} />
        </button>
      </div>
      
      <div className="p-4 h-[160px] overflow-y-auto bg-[var(--bg-main)] opacity-95">
        {loading ? (
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
             <RefreshCw size={12} className="animate-spin" />
             <span className="text-[10px]">PROCESSING_CONTEXT...</span>
          </div>
        ) : (
          <div className="space-y-3">
             {logs.map((log) => (
                <div key={log.id} className="flex gap-3 text-xs animate-in fade-in slide-in-from-left-2">
                   <span className="text-[var(--text-tertiary)] min-w-[100px] text-[10px] pt-0.5">[{log.type}]</span>
                   <span className="text-[var(--text-main)] font-serif italic">{log.content}</span>
                </div>
             ))}
             <div className="flex gap-2 pt-2">
                <span className="text-[var(--text-tertiary)] text-[10px] animate-pulse">_</span>
             </div>
          </div>
        )}
      </div>

      <div className="p-2 bg-[var(--bg-secondary)] border-t border-[var(--border-main)] flex gap-2">
         {['RHYME', 'EXPAND', 'CRITIQUE'].map(action => (
             <button key={action} className="px-3 py-1 bg-[var(--bg-hover)] border border-[var(--border-main)] rounded-sm text-[9px] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] transition-all uppercase">
                ./{action}
             </button>
         ))}
      </div>
    </div>
  );
};