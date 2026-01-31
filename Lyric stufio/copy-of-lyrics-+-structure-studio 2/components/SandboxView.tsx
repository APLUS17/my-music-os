import React from 'react';
import { ArrowRight } from 'lucide-react';

interface SandboxViewProps {
  text: string;
  onChange: (text: string) => void;
  onPromote: () => void;
}

export const SandboxView: React.FC<SandboxViewProps> = ({ text, onChange, onPromote }) => {
  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500 relative">
      <div className="flex-1 relative">
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Start writing...&#10;&#10;Capture thoughts, rhymes, or rough ideas here. Promote them to the structure when you're ready."
          className="w-full h-full bg-transparent resize-none focus:outline-none text-[var(--text-main)] text-lg leading-[1.6] font-sans placeholder:text-[var(--text-tertiary)] placeholder:opacity-50 scrollbar-hide pb-32"
          spellCheck={false}
          autoFocus
        />
        
        {/* Subtle fade at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--bg-main)] to-transparent pointer-events-none" />
        
        {text.length > 5 && (
          <div className="absolute bottom-4 right-0 animate-in slide-in-from-right duration-500 z-10">
            <button 
              onClick={onPromote}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--text-main)] text-[var(--bg-main)] rounded-full text-[10px] mono uppercase tracking-wider hover:opacity-90 transition-transform hover:scale-105 active:scale-95 shadow-lg"
            >
              Convert to Verse <ArrowRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};