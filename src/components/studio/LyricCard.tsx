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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [section.text]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 group relative pl-3 border-l-2 border-[var(--border-main)] hover:border-[var(--text-tertiary)] transition-colors">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-main)] text-[10px] mono uppercase tracking-wider text-[var(--text-main)] hover:border-[var(--accent)] transition-colors font-medium"
          >
            {section.type}
            <ChevronDown size={10} className="opacity-70" />
          </button>

          <div className="flex items-center gap-1">
            <span className="text-[10px] mono text-[var(--text-tertiary)] tabular-nums opacity-50">x{section.repeats}</span>
            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onUpdate(section.id, { repeats: section.repeats + 1 })} className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)]"><Plus size={10} /></button>
              <button onClick={() => onUpdate(section.id, { repeats: Math.max(1, section.repeats - 1) })} className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)]"><Minus size={10} /></button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center mr-1 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={() => onMove(section.id, 'up')} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all hover:scale-110 active:scale-90"><ChevronUp size={14} /></button>
            <button onClick={() => onMove(section.id, 'down')} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all hover:scale-110 active:scale-90"><ChevronDown size={14} /></button>
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
          onChange={(e) => onUpdate(section.id, { text: e.target.value })}
          className="w-full bg-transparent text-[var(--text-main)] text-base leading-relaxed font-sans focus:outline-none placeholder:text-[var(--text-tertiary)] placeholder:opacity-40 resize-none scrollbar-hide min-h-[40px] py-1"
          placeholder={section.text === '' ? "Write your lyrics here...\nTip: Try ending lines with similar sounds (rhyming)" : ""}
          spellCheck={false}
        />
      </div>

      {isDropdownOpen && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsDropdownOpen(false)} />
          <div className="absolute z-50 top-6 left-0 p-1 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg shadow-xl animate-in zoom-in-95 duration-200 w-32">
            {SECTION_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => { onUpdate(section.id, { type }); setIsDropdownOpen(false); }}
                className={`w-full text-left px-3 py-2 text-[10px] mono uppercase tracking-wider rounded-md hover:bg-[var(--bg-hover)] ${section.type === type ? 'text-[var(--text-main)]' : 'text-[var(--text-secondary)]'}`}
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
