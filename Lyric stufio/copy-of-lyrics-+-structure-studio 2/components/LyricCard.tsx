import React, { useState, useRef, useEffect } from 'react';
import { LyricSection, SECTION_TYPES, VoiceTake } from '../types';
import { Minus, Plus, Play, Pause, X, Pin, ChevronUp, ChevronDown } from 'lucide-react';

interface LyricCardProps {
  section: LyricSection;
  onUpdate: (id: string, updates: Partial<LyricSection>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  availableTakes: VoiceTake[];
}

export const LyricCard: React.FC<LyricCardProps> = ({ section, onUpdate, onDelete, onMove, availableTakes }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPinSelectorOpen, setIsPinSelectorOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      audio.onended = () => setIsPlaying(false);
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
  }, [pinnedTake]);

  const togglePlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => {
        console.error("Playback failed", e);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 group relative pl-3 border-l-2 border-[var(--border-main)] hover:border-[var(--text-tertiary)] transition-colors">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 text-[10px] mono uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors font-medium"
          >
            {section.type}
            <ChevronDown size={10} className="opacity-50" />
          </button>
          
          <div className="flex items-center gap-1">
             <span className="text-[10px] mono text-[var(--text-tertiary)] tabular-nums opacity-50">x{section.repeats}</span>
             <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onUpdate(section.id, { repeats: section.repeats + 1 })} className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)]"><Plus size={10} /></button>
                <button onClick={() => onUpdate(section.id, { repeats: Math.max(1, section.repeats - 1) })} className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-main)]"><Minus size={10} /></button>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center mr-1">
             <button onClick={() => onMove(section.id, 'up')} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors"><ChevronUp size={14} /></button>
             <button onClick={() => onMove(section.id, 'down')} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors"><ChevronDown size={14} /></button>
          </div>
          <button 
            onClick={() => setIsPinSelectorOpen(!isPinSelectorOpen)}
            className={`p-1 rounded transition-colors ${section.pinnedTakeId ? 'text-[var(--accent)] bg-[var(--bg-secondary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-main)]'}`}
            title="Attach Recording"
          >
            <Pin size={14} />
          </button>
          <button onClick={() => onDelete(section.id)} className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors ml-1">
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
          placeholder="Lyrics..."
          spellCheck={false}
        />

        {pinnedTake && (
          <div className="mt-2 mb-1 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-md p-2 border border-[var(--border-main)] max-w-xs">
              <div className="flex items-center gap-3">
                <button 
                  onClick={togglePlayback}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-[var(--accent)] text-[var(--bg-main)]' : 'bg-[var(--text-main)] text-[var(--bg-main)]'}`}
                >
                  {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
                </button>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] mono uppercase text-[var(--text-main)] tracking-wider">Take {pinnedTake.id}</span>
                    {isPlaying && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onUpdate(section.id, { pinnedTakeId: undefined })}
                className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 rounded"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isDropdownOpen && (
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
      )}

      {isPinSelectorOpen && (
        <div className="absolute z-50 top-6 right-0 p-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg shadow-xl animate-in zoom-in-95 duration-200 w-56 max-h-64 overflow-y-auto scrollbar-hide">
          <p className="text-[9px] mono uppercase text-[var(--text-tertiary)] p-2 border-b border-[var(--border-main)] mb-1">Select Recording</p>
          {availableTakes.length === 0 ? (
            <p className="text-[9px] mono text-center py-6 text-[var(--text-tertiary)]">No recordings found</p>
          ) : (
            availableTakes.map((take) => (
              <button
                key={take.id}
                onClick={() => { onUpdate(section.id, { pinnedTakeId: take.id }); setIsPinSelectorOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-[10px] mono flex justify-between items-center rounded-md hover:bg-[var(--bg-hover)] border mb-1 ${section.pinnedTakeId === take.id ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)]'}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">Take {take.id}</span>
                  <span className="text-[8px] opacity-60">{take.timestamp}</span>
                </div>
                <span className="opacity-50">{take.duration}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};