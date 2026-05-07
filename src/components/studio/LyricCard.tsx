import React, { useState, useRef, useEffect } from 'react';
import { LyricSection, SECTION_TYPES } from '@/types';
import { Minus, Plus, X, ChevronUp, ChevronDown } from 'lucide-react';

interface LyricCardProps {
  section: LyricSection;
  onUpdate: (id: string, updates: Partial<LyricSection>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}

export const LyricCard: React.FC<LyricCardProps> = ({ section, onUpdate, onDelete, onMove }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [section.text]);

  return (
    <div className={`
      animate-in fade-in slide-in-from-bottom-2 duration-500 group relative px-4 py-3 rounded-xl border transition-all duration-300
      ${isFocused 
        ? 'bg-secondary border-primary/20 shadow-md'
        : 'bg-transparent border-transparent hover:border-subtle hover:bg-accent/20'
      }
    `}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary border border-border text-metadata text-foreground hover:border-primary transition-colors"
          >
            {section.type}
            <ChevronDown size={10} className="opacity-70" />
          </button>

          <div className="flex items-center gap-1">
            <span className="text-metadata text-muted-foreground opacity-50">x{section.repeats}</span>
            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); onUpdate(section.id, { repeats: section.repeats + 1 }); }} 
                className="p-0.5 text-muted-foreground hover:text-foreground"
              >
                <Plus size={10} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onUpdate(section.id, { repeats: Math.max(1, section.repeats - 1) }); }} 
                className="p-0.5 text-muted-foreground hover:text-foreground"
              >
                <Minus size={10} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center mr-1 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={() => onMove(section.id, 'up')} className="p-1 text-muted-foreground hover:text-foreground transition-all hover:scale-110 active:scale-90"><ChevronUp size={14} /></button>
            <button onClick={() => onMove(section.id, 'down')} className="p-1 text-muted-foreground hover:text-foreground transition-all hover:scale-110 active:scale-90"><ChevronDown size={14} /></button>
          </div>
          <button onClick={() => onDelete(section.id)} className="text-[var(--text-tertiary)] hover:text-red-500 transition-all duration-300 ml-1 opacity-10 group-hover:opacity-100 hover:scale-110 active:scale-90">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className={`relative transition-all`}>
        <textarea
          ref={textareaRef}
          value={section.text}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => onUpdate(section.id, { text: e.target.value })}
          className="w-full bg-transparent text-foreground text-base leading-relaxed font-sans focus:outline-none placeholder:text-muted-foreground placeholder:opacity-40 resize-none scrollbar-hide min-h-[40px] py-1"
          placeholder={section.text === '' ? "Write your lyrics here..." : ""}
          spellCheck={false}
        />
      </div>

      {isDropdownOpen && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsDropdownOpen(false)} />
          <div className="absolute z-50 top-6 left-0 p-1 bg-card border border-border rounded-lg shadow-xl animate-in zoom-in-95 duration-200 w-32">
            {SECTION_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => { onUpdate(section.id, { type }); setIsDropdownOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs mono uppercase tracking-wider rounded-md hover:bg-accent ${section.type === type ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
