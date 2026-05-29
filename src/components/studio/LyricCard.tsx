import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { LyricSection, SECTION_TYPES } from '@/types';
import { Minus, Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { countSyllables } from '@/lib/utils/syllable';
import { cn } from '@/lib/utils';

interface LyricCardProps {
  section: LyricSection;
  onUpdate: (id: string, updates: Partial<LyricSection>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  showSyllables: boolean;
}

const AutoResizeRowTextarea = ({
  id,
  value,
  onChange,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  placeholder,
  autoFocus
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <textarea
      id={id}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onFocus={onFocus}
      onBlur={onBlur}
      rows={1}
      className="w-full bg-transparent text-[var(--text-main)] text-base leading-relaxed font-sans focus:outline-none placeholder:text-[var(--text-tertiary)] placeholder:opacity-40 resize-none overflow-hidden py-0.5 whitespace-pre-wrap break-words block border-none"
      placeholder={placeholder}
      spellCheck={false}
    />
  );
};

export const LyricCard: React.FC<LyricCardProps> = ({
  section,
  onUpdate,
  onDelete,
  onMove,
  showSyllables
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<{ index: number; caretPos: number } | null>(null);

  const lines = section.text.split('\n');

  // Caret positioning and row focusing side-effect
  useEffect(() => {
    if (pendingFocus !== null) {
      const el = document.getElementById(`input-${section.id}-${pendingFocus.index}`) as HTMLTextAreaElement;
      if (el) {
        el.focus();
        el.setSelectionRange(pendingFocus.caretPos, pendingFocus.caretPos);
      }
      setPendingFocus(null);
    }
  }, [pendingFocus, section.id, section.text]);

  const handleLineChange = (index: number, newText: string) => {
    const updatedLines = [...lines];
    updatedLines[index] = newText;
    onUpdate(section.id, { text: updatedLines.join('\n') });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const el = e.currentTarget;
    const selectionStart = el.selectionStart;
    const selectionEnd = el.selectionEnd;

    if (e.key === 'Enter') {
      e.preventDefault();
      const currentLines = [...lines];
      const lineText = currentLines[index] || '';

      const before = lineText.slice(0, selectionStart);
      const after = lineText.slice(selectionStart);

      currentLines[index] = before;
      currentLines.splice(index + 1, 0, after);

      onUpdate(section.id, { text: currentLines.join('\n') });
      setPendingFocus({ index: index + 1, caretPos: 0 });
    } else if (e.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0) {
      if (index > 0) {
        e.preventDefault();
        const currentLines = [...lines];
        const prevLineText = currentLines[index - 1] || '';
        const currLineText = currentLines[index] || '';

        currentLines[index - 1] = prevLineText + currLineText;
        currentLines.splice(index, 1);

        onUpdate(section.id, { text: currentLines.join('\n') });
        setPendingFocus({ index: index - 1, caretPos: prevLineText.length });
      }
    } else if (e.key === 'ArrowUp') {
      if (index > 0) {
        e.preventDefault();
        setPendingFocus({ index: index - 1, caretPos: selectionStart });
      }
    } else if (e.key === 'ArrowDown') {
      if (index < lines.length - 1) {
        e.preventDefault();
        setPendingFocus({ index: index + 1, caretPos: selectionStart });
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, index: number) => {
    const pastedData = e.clipboardData.getData('text');
    const pastedLines = pastedData.split(/\r?\n/);

    if (pastedLines.length > 1) {
      e.preventDefault();
      const currentLines = [...lines];
      const el = e.currentTarget;
      const selectionStart = el.selectionStart;
      const selectionEnd = el.selectionEnd;
      const lineText = currentLines[index] || '';

      const before = lineText.slice(0, selectionStart);
      const after = lineText.slice(selectionEnd);

      // Replace current line with text before caret + first pasted line
      currentLines[index] = before + pastedLines[0];

      // Insert middle lines
      const middleLines = pastedLines.slice(1, pastedLines.length - 1);
      currentLines.splice(index + 1, 0, ...middleLines);

      // Insert last pasted line + text after caret
      const lastIndex = index + pastedLines.length - 1;
      const lastLineText = pastedLines[pastedLines.length - 1] + after;
      currentLines.splice(lastIndex, 0, lastLineText);

      onUpdate(section.id, { text: currentLines.join('\n') });
      setPendingFocus({
        index: lastIndex,
        caretPos: pastedLines[pastedLines.length - 1].length
      });
    }
  };

  return (
    <div className={cn(
      "animate-in fade-in slide-in-from-bottom-2 duration-500 group relative px-4 py-3 rounded-xl border transition-all duration-300 border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]",
      isFocused && "bg-[var(--bg-secondary)] border-[var(--shark-blue-dim)] shadow-md"
    )}>
      <div className="flex items-center justify-between mb-2 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-main)] text-[10px] mono uppercase tracking-wider text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all font-medium active:scale-95 cursor-pointer"
          >
            {section.type}
            <ChevronDown size={10} className="opacity-70" />
          </button>

        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-md px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button 
              onClick={() => onMove(section.id, 'up')} 
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all hover:scale-110 active:scale-90 cursor-pointer"
              title="Move up"
            >
              <ChevronUp size={12} />
            </button>
            <span className="w-[1px] h-3 bg-[var(--border-main)] mx-0.5" />
            <button 
              onClick={() => onMove(section.id, 'down')} 
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all hover:scale-110 active:scale-90 cursor-pointer"
              title="Move down"
            >
              <ChevronDown size={12} />
            </button>
          </div>
          <button 
            onClick={() => onDelete(section.id)} 
            className="p-1 text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-90 cursor-pointer"
            title="Delete section"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Row-Based Lyrics Content */}
      <div className="space-y-1.5 relative transition-all">
        {lines.map((lineText, idx) => (
          <div key={`${section.id}-row-${idx}`} className="flex items-start w-full gap-1">
            <div className={cn(
              "w-6 text-right pr-1.5 text-xs font-mono text-[var(--text-tertiary)] pt-1.5 select-none tabular-nums flex-shrink-0 transition-opacity duration-200",
              showSyllables ? "opacity-60" : "opacity-0 pointer-events-none"
            )}>
              {countSyllables(lineText) || '\u00A0'}
            </div>
            <div className="flex-1 min-w-0">
              <AutoResizeRowTextarea
                id={`input-${section.id}-${idx}`}
                value={lineText}
                onChange={(e) => handleLineChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                onPaste={(e) => handlePaste(e, idx)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={idx === 0 && lines.length === 1 ? "Write your lyrics here..." : ""}
              />
            </div>
          </div>
        ))}
      </div>

      {isDropdownOpen && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsDropdownOpen(false)} />
          <div className="absolute z-50 top-6 left-0 p-1 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg shadow-xl animate-in zoom-in-95 duration-200 w-32">
            {SECTION_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => { onUpdate(section.id, { type }); setIsDropdownOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs mono uppercase tracking-wider rounded-md hover:bg-[var(--bg-hover)] ${section.type === type ? 'text-[var(--text-main)]' : 'text-[var(--text-secondary)]'}`}
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
