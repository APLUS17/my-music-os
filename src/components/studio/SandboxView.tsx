
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { ArrowRight, Mic, Play, Pause, GripVertical, Trash2, X } from 'lucide-react';
import { SandboxLine, VoiceTake } from '@/types';

interface SandboxViewProps {
  lines: SandboxLine[];
  takes: VoiceTake[];
  onChange: (lines: SandboxLine[]) => void;
  onPromote: (text: string) => void;
  onRecordStart: (lineId: string) => void;
  onPlayTake: (takeId: string) => void;
  currentlyPlayingTakeId: string | null;
}

const AutoResizeTextarea = ({
  id,
  value,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
  autoFocus
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
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
      onFocus={onFocus}
      rows={1}
      className="w-full bg-transparent border-none focus:outline-none text-[var(--text-main)] text-base leading-relaxed font-sans placeholder:text-[var(--text-tertiary)] resize-none overflow-hidden py-1 whitespace-pre-wrap break-words"
      placeholder={placeholder}
      spellCheck={false}
    />
  );
};

export const SandboxView: React.FC<SandboxViewProps> = ({
  lines,
  takes,
  onChange,
  onPromote,
  onRecordStart,
  onPlayTake,
  currentlyPlayingTakeId
}) => {
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [draggedTakeId, setDraggedTakeId] = useState<string | null>(null);
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);

  const handleLineChange = (id: string, newText: string) => {
    onChange(lines.map(l => l.id === id ? { ...l, text: newText } : l));
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newLineId = Math.random().toString(36).substr(2, 9);
      const newLine = { id: newLineId, text: '' };
      const newLines = [...lines];
      newLines.splice(index + 1, 0, newLine);
      onChange(newLines);
      setFocusedLineId(newLineId);
    } else if (e.key === 'Backspace' && lines[index].text === '' && lines.length > 1) {
      e.preventDefault();
      const prevLineId = lines[index - 1]?.id;
      const newLines = lines.filter(l => l.id !== id);
      onChange(newLines);
      if (prevLineId) {
        setTimeout(() => {
          document.getElementById(`line-${prevLineId}`)?.focus();
        }, 0);
      }
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      const prevId = lines[index - 1].id;
      const el = document.getElementById(`line-${prevId}`) as HTMLTextAreaElement;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    } else if (e.key === 'ArrowDown' && index < lines.length - 1) {
      e.preventDefault();
      const nextId = lines[index + 1].id;
      const el = document.getElementById(`line-${nextId}`) as HTMLTextAreaElement;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetLineId: string) => {
    e.preventDefault();
    const takeId = e.dataTransfer.getData('text/plain');

    // Remove take from any other line and add to target
    const newLines = lines.map(line => {
      if (line.id === targetLineId) return { ...line, takeId };
      if (line.takeId === takeId) return { ...line, takeId: undefined };
      return line;
    });
    onChange(newLines);
    setDraggedTakeId(null);
  };

  const removeTakeFromLine = (lineId: string) => {
    onChange(lines.map(l => l.id === lineId ? { ...l, takeId: undefined } : l));
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 relative min-h-full">
      {lines.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
          <span className="text-[10px] mono uppercase">Start typing...</span>
        </div>
      )}

      {lines.map((line, index) => {
        const take = line.takeId ? takes.find(t => t.id === line.takeId) : null;
        const isPlaying = take && currentlyPlayingTakeId === take.id;

        return (
          <div
            key={line.id}
            className="group flex items-start mb-2 relative pl-3 border-l-2 border-transparent hover:border-[var(--border-main)] transition-colors min-h-[32px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, line.id)}
          >
            {/* Controls - Absolute Positioned to left of content */}
            <div className="absolute -left-8 top-1 w-6 flex justify-center opacity-20 group-hover:opacity-100 transition-all duration-300 z-10">
              {!take ? (
                <button
                  onClick={() => onRecordStart(line.id)}
                  className="text-[var(--text-tertiary)] hover:text-red-500 transition-all hover:scale-125 p-1"
                  title="Record Take"
                >
                  <Mic size={14} />
                </button>
              ) : (
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', take.id);
                    setDraggedTakeId(take.id);
                  }}
                  className="cursor-grab active:cursor-grabbing text-[var(--accent)] hover:text-[var(--text-main)] p-1 transition-transform hover:scale-110"
                >
                  <GripVertical size={14} />
                </div>
              )}
            </div>

            {/* Line Input */}
            <div className="flex-1 relative min-w-0">
              <AutoResizeTextarea
                id={`line-${line.id}`}
                value={line.text}
                onChange={(e) => handleLineChange(line.id, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index, line.id)}
                onFocus={() => setActiveLineId(line.id)}
                placeholder={index === 0 && lines.length === 1 ? "Start writing..." : ""}
                autoFocus={focusedLineId === line.id}
              />
              {/* Underline effect */}
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--border-main)] opacity-10 group-hover:opacity-40 pointer-events-none transition-opacity" />

              {/* Delete X for Line */}
              <button
                onClick={() => {
                  if (lines.length > 1) {
                    onChange(lines.filter(l => l.id !== line.id));
                  } else {
                    handleLineChange(line.id, "");
                  }
                }}
                className="absolute -right-6 top-1.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-40 hover:opacity-100 hover:text-red-500 transition-all duration-300"
              >
                <X size={12} />
              </button>
            </div>

            {/* Audio Pill */}
            {take && (
              <div
                className={`flex items-center gap-2 ml-3 pr-2 pl-1 py-1 rounded-full border transition-all select-none flex-shrink-0 ${isPlaying ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--bg-main)]' : 'bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-secondary)]'}`}
              >
                <button onClick={() => onPlayTake(take.id)} className="p-0.5 hover:scale-110 transition-transform">
                  {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                </button>
                <button
                  onClick={() => removeTakeFromLine(line.id)}
                  className={`ml-1 hover:text-red-500 transition-colors ${isPlaying ? 'text-[var(--bg-main)] opacity-70' : 'text-[var(--text-tertiary)]'}`}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Promotion Button */}
      {lines.some(l => l.text.length > 5) && (
        <div className="fixed bottom-28 right-6 z-20 animate-in slide-in-from-right duration-500">
          <button
            onClick={() => onPromote(lines.map(l => l.text).join('\n'))}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--text-main)] text-[var(--bg-main)] rounded-full text-[10px] mono uppercase tracking-wider hover:opacity-90 shadow-lg"
          >
            Promote All <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
};
