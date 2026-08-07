import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { LyricSection, SECTION_TYPES } from '@/types';
import { X, Mic, ChevronDown } from 'lucide-react';
import { countSyllables } from '@/lib/utils/syllable';
import { cn } from '@/lib/utils';

interface LyricCardProps {
  section: LyricSection;
  onUpdate: (id: string, updates: Partial<LyricSection>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  showSyllables: boolean;
  onSectionFocus?: (id: string) => void;
  onSectionBlur?: () => void;
  onRecordSection?: (id: string) => void;
}

const AutoResizeRowTextarea = ({
  id, value, onChange, onKeyDown, onPaste, onFocus, onBlur, placeholder, autoFocus
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
    if (autoFocus && textareaRef.current) textareaRef.current.focus();
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
      className="w-full bg-transparent text-[var(--text-main)] text-base leading-relaxed font-sans focus:outline-none placeholder:text-[var(--text-tertiary)] placeholder:opacity-30 resize-none overflow-hidden py-0.5 whitespace-pre-wrap break-words block border-none"
      placeholder={placeholder}
      spellCheck={false}
    />
  );
};

export const LyricCard: React.FC<LyricCardProps> = ({
  section, onUpdate, onDelete, onMove, showSyllables, onSectionFocus, onSectionBlur, onRecordSection,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<{ index: number; caretPos: number } | null>(null);

  const lines = section.text.split('\n');

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
    const { selectionStart, selectionEnd } = el;

    if (e.key === 'Enter') {
      e.preventDefault();
      const currentLines = [...lines];
      const before = (currentLines[index] || '').slice(0, selectionStart);
      const after = (currentLines[index] || '').slice(selectionStart);
      currentLines[index] = before;
      currentLines.splice(index + 1, 0, after);
      onUpdate(section.id, { text: currentLines.join('\n') });
      setPendingFocus({ index: index + 1, caretPos: 0 });
    } else if (e.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0 && index > 0) {
      e.preventDefault();
      const currentLines = [...lines];
      const prev = currentLines[index - 1] || '';
      const curr = currentLines[index] || '';
      currentLines[index - 1] = prev + curr;
      currentLines.splice(index, 1);
      onUpdate(section.id, { text: currentLines.join('\n') });
      setPendingFocus({ index: index - 1, caretPos: prev.length });
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      setPendingFocus({ index: index - 1, caretPos: selectionStart });
    } else if (e.key === 'ArrowDown' && index < lines.length - 1) {
      e.preventDefault();
      setPendingFocus({ index: index + 1, caretPos: selectionStart });
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, index: number) => {
    const pastedLines = e.clipboardData.getData('text').split(/\r?\n/);
    if (pastedLines.length > 1) {
      e.preventDefault();
      const currentLines = [...lines];
      const el = e.currentTarget;
      const before = (currentLines[index] || '').slice(0, el.selectionStart);
      const after = (currentLines[index] || '').slice(el.selectionEnd);
      currentLines[index] = before + pastedLines[0];
      currentLines.splice(index + 1, 0, ...pastedLines.slice(1, -1));
      const lastIdx = index + pastedLines.length - 1;
      currentLines.splice(lastIdx, 0, pastedLines[pastedLines.length - 1] + after);
      onUpdate(section.id, { text: currentLines.join('\n') });
      setPendingFocus({ index: lastIdx, caretPos: pastedLines[pastedLines.length - 1].length });
    }
  };

  return (
    <div className={cn('group relative pb-4')}>

      {/* Section label + actions */}
      <div className="flex items-center justify-between mb-2.5">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-1 text-[10px] mono uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors duration-150 cursor-pointer select-none"
        >
          {section.type}
          <ChevronDown size={9} className="opacity-50" />
        </button>

        <div className={cn(
          'flex items-center gap-0.5 transition-opacity duration-200',
          isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          {onRecordSection && (
            <button
              onClick={() => onRecordSection(section.id)}
              className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent)] rounded-md transition-colors"
              title="Record this section"
            >
              <Mic size={11} />
            </button>
          )}
          <button
            onClick={() => onDelete(section.id)}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-red-400 rounded-md transition-colors"
            title="Delete section"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Writing area — no borders, no card */}
      <div className="space-y-0.5">
        {lines.map((lineText, idx) => (
          <div key={`${section.id}-row-${idx}`} className="flex items-start w-full gap-2">
            {showSyllables && (
              <div className="w-5 text-right text-[10px] font-mono text-[var(--text-tertiary)] opacity-40 pt-1.5 select-none tabular-nums flex-shrink-0">
                {countSyllables(lineText) || ' '}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <AutoResizeRowTextarea
                id={`input-${section.id}-${idx}`}
                value={lineText}
                onChange={(e) => handleLineChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                onPaste={(e) => handlePaste(e, idx)}
                onFocus={() => { setIsFocused(true); onSectionFocus?.(section.id); }}
                onBlur={() => { setIsFocused(false); onSectionBlur?.(); }}
                placeholder={idx === 0 && lines.length === 1 ? 'Write here...' : ''}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Section type dropdown */}
      {isDropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
          <div className="absolute z-50 top-0 left-0 p-1 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg shadow-xl animate-in zoom-in-95 duration-150 w-28">
            {SECTION_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => { onUpdate(section.id, { type }); setIsDropdownOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[10px] mono uppercase tracking-wider rounded hover:bg-[var(--bg-hover)] ${section.type === type ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
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
