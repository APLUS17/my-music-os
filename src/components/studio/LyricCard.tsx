'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LyricSection, SECTION_TYPES, VoiceTake } from '@/types';
import { Play, Pause, X, ChevronUp, ChevronDown, Paperclip, Layers, Volume2, Trash2 } from 'lucide-react';
import { useFlow } from './flow/FlowContext';

// --- Syllable counter (heuristic, no external deps) ---
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;
  // remove silent trailing e
  word = word.replace(/e$/, '');
  const vowelGroups = word.match(/[aeiouy]+/g);
  return vowelGroups ? vowelGroups.length : 1;
}

function lineSyllables(line: string): number {
  return line
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((sum, w) => sum + countSyllables(w), 0);
}

interface LyricCardProps {
  section: LyricSection;
  onUpdate: (id: string, updates: Partial<LyricSection>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  availableTakes: VoiceTake[];
  beatAudioRef?: React.RefObject<HTMLAudioElement | null>;
  onDeleteTake?: (takeId: string) => void;
}

export const LyricCard: React.FC<LyricCardProps> = ({ section, onUpdate, onDelete, onMove, availableTakes, beatAudioRef, onDeleteTake }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPinSelectorOpen, setIsPinSelectorOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mixEnabled, setMixEnabled] = useState(true);
  const [showVolume, setShowVolume] = useState(false);
  const [vocalVolume, setVocalVolume] = useState(1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { setSelection, pendingInsertion, clearInsertion, currentLineId } = useFlow();

  const pinnedTake = availableTakes.find(t => t.id === section.pinnedTakeId);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [section.text]);

  useEffect(() => {
    if (pinnedTake?.audioUrl) {
      const audio = new Audio(pinnedTake.audioUrl);
      audio.onended = () => {
        setIsPlaying(false);
        if (beatAudioRef?.current && mixEnabled) {
          beatAudioRef.current.pause();
        }
      };
      audioRef.current = audio;
    } else {
      audioRef.current = null;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [pinnedTake, beatAudioRef, mixEnabled]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = vocalVolume;
    }
  }, [vocalVolume]);

  // Handle AI tool text insertion
  useEffect(() => {
    if (pendingInsertion && currentLineId && currentLineId.startsWith(section.id)) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + pendingInsertion + after;

      onUpdate(section.id, { text: newText });
      clearInsertion();

      // Reposition cursor after insertion
      setTimeout(() => {
        textarea.focus();
        const newCursor = start + pendingInsertion.length;
        textarea.setSelectionRange(newCursor, newCursor);
      }, 0);
    }
  }, [pendingInsertion, currentLineId, section.id, onUpdate, clearInsertion]);

  const handleSelectionChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    // Get the specific word or line at cursor
    let selected = value.substring(start, end);
    if (!selected && start === end) {
      // Find the line we are on
      const beforeCursor = value.substring(0, start);
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const afterCursor = value.substring(start);
      const nextNewline = afterCursor.indexOf('\n');
      const lineEnd = nextNewline === -1 ? value.length : start + nextNewline;

      selected = value.substring(lineStart, lineEnd).trim();
    }

    // Use a composite ID so we know which section and offset we are in
    setSelection(selected || null, start, `${section.id}-${start}`);
  }, [section.id, setSelection]);

  const togglePlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      if (beatAudioRef?.current) beatAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (mixEnabled && beatAudioRef?.current && pinnedTake?.beatOffset !== undefined) {
        beatAudioRef.current.currentTime = pinnedTake.beatOffset;
        beatAudioRef.current.play().catch(console.error);
      }

      audioRef.current.play().catch(e => {
        console.error("Playback failed", e);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  const toggleMix = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMixEnabled(!mixEnabled);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 group relative flex gap-0">
      <div className="flex flex-col pt-[calc(1.5rem+1px)] pr-2 min-w-[28px] items-end select-none pointer-events-none">
        {section.text.split('\n').map((line, i) => {
          const count = line.trim() ? lineSyllables(line) : null;
          return (
            <div
              key={i}
              className="leading-relaxed text-[10px] mono tabular-nums text-[var(--text-secondary)] opacity-55"
              style={{ lineHeight: '1.625rem' }}
            >
              {count ?? ''}
            </div>
          );
        })}
      </div>

      <div className="flex-1 pl-3 border-l-2 border-[var(--border-main)] hover:border-[var(--text-tertiary)] transition-colors">
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-main)] text-[10px] mono uppercase tracking-wider text-[var(--text-main)] hover:border-[var(--accent)] transition-colors font-medium"
          >
            {section.type}
            <ChevronDown size={10} className="opacity-70" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center mr-1 opacity-50">
              <button onClick={() => onMove(section.id, 'up')} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all hover:scale-110 active:scale-90"><ChevronUp size={14} /></button>
              <button onClick={() => onMove(section.id, 'down')} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all hover:scale-110 active:scale-90"><ChevronDown size={14} /></button>
            </div>
            <button
              onClick={() => setIsPinSelectorOpen(!isPinSelectorOpen)}
              className={`p-1 rounded transition-all duration-300 active:scale-90 ${section.pinnedTakeId ? 'text-[var(--accent)] bg-[var(--bg-secondary)] opacity-100' : 'text-[var(--text-tertiary)] opacity-50'}`}
              title="Attach Recording"
            >
              <Paperclip size={12} className={section.pinnedTakeId ? "animate-pulse" : ""} />
            </button>
            <button onClick={() => onDelete(section.id)} className="text-[var(--text-tertiary)] active:text-red-500 transition-all duration-300 ml-1 opacity-40 active:scale-90">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="relative transition-all">
          <textarea
            ref={textareaRef}
            value={section.text}
            onChange={(e) => {
              onUpdate(section.id, { text: e.target.value });
              handleSelectionChange();
            }}
            onFocus={handleSelectionChange}
            onSelect={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            className="w-full bg-transparent text-[var(--text-main)] text-base leading-relaxed font-sans focus:outline-none placeholder:text-[var(--text-tertiary)] placeholder:opacity-40 resize-none scrollbar-hide min-h-[40px] py-1"
            placeholder={section.text === '' ? "Write your lyrics here...\nTip: Try ending lines with similar sounds (rhyming)" : ""}
            spellCheck={false}
          />

          {pinnedTake && (
            <div className="mt-1 animate-in fade-in zoom-in-95 duration-200 flex items-center gap-2">
              <div
                className={`inline-flex items-center gap-2 px-2 py-1 rounded-full border select-none transition-all ${isPlaying ? 'bg-[var(--bg-secondary)] border-[var(--accent)]' : 'bg-[var(--bg-secondary)] border-[var(--border-main)] hover:border-[var(--text-tertiary)]'}`}
                onMouseEnter={() => setShowVolume(true)}
                onMouseLeave={() => setShowVolume(false)}
              >
                <div onClick={togglePlayback} className="cursor-pointer flex items-center gap-2">
                  {isPlaying ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                  <span className="text-[9px] mono font-medium">Rec {pinnedTake.id.slice(-4)}</span>
                </div>

                <div className="h-3 w-[1px] bg-[var(--border-main)] mx-1" />
                <button
                  onClick={toggleMix}
                  className={`p-0.5 rounded transition-colors ${mixEnabled ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                  title={mixEnabled ? "Mix Active (Vocal + Beat)" : "Solo Vocal"}
                >
                  <Layers size={10} />
                </button>

                {showVolume && (
                  <div className="flex items-center gap-1 animate-in slide-in-from-left-2 fade-in duration-200">
                    <div className="h-3 w-[1px] bg-[var(--border-main)] mx-1" />
                    <Volume2 size={10} className="text-[var(--text-tertiary)]" />
                    <input
                      type="range"
                      min="0" max="1" step="0.1"
                      value={vocalVolume}
                      onChange={(e) => setVocalVolume(parseFloat(e.target.value))}
                      className="w-12 h-1 accent-[var(--accent)] bg-[var(--border-main)] rounded-full appearance-none cursor-pointer"
                    />
                  </div>
                )}

                {!showVolume && <span className="text-[9px] opacity-60 tabular-nums ml-1">{pinnedTake.duration}</span>}

                <button
                  onClick={(e) => { e.stopPropagation(); onUpdate(section.id, { pinnedTakeId: undefined }); }}
                  className="ml-2 rounded-full p-0.5 hover:bg-black/20 text-[var(--text-tertiary)] hover:text-[var(--text-main)]"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          )}
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

        {isPinSelectorOpen && (
          <>
            <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsPinSelectorOpen(false)} />
            <div className="absolute z-50 top-6 right-0 p-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg shadow-xl animate-in zoom-in-95 duration-200 w-56 max-h-64 overflow-y-auto scrollbar-hide">
              <p className="text-[9px] mono uppercase text-[var(--text-tertiary)] p-2 border-b border-[var(--border-main)] mb-1">Attach a Recording</p>
              {availableTakes.length === 0 ? (
                <p className="text-[9px] mono text-center py-6 text-[var(--text-tertiary)]">No recordings yet. Hit the record button to create one.</p>
              ) : (
                availableTakes.map((take) => (
                  <div
                    key={take.id}
                    className={`group w-full flex items-center justify-between rounded-md hover:bg-[var(--bg-hover)] border mb-1 transition-colors ${section.pinnedTakeId === take.id ? 'border-[var(--accent)]' : 'border-transparent'}`}
                  >
                    <button
                      onClick={() => { onUpdate(section.id, { pinnedTakeId: take.id }); setIsPinSelectorOpen(false); }}
                      className={`flex-1 text-left pl-3 py-2.5 text-[10px] mono flex justify-between items-center ${section.pinnedTakeId === take.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">Rec {take.id.slice(-4)}</span>
                        <span className="text-[8px] opacity-60">{take.timestamp}</span>
                      </div>
                      <span className="opacity-50 pr-2">{take.duration}</span>
                    </button>
                    {onDeleteTake && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTake(take.id);
                        }}
                        className="px-2 py-3 text-[var(--text-tertiary)] hover:text-red-500 transition-all active:scale-90"
                        title="Delete Take"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
