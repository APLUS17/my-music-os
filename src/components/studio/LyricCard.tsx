
import React, { useState, useRef, useEffect } from 'react';
import { LyricSection, SECTION_TYPES, VoiceTake } from '@/types';
import { Minus, Plus, Play, Pause, X, Pin, ChevronUp, ChevronDown, Paperclip, Layers, Volume2 } from 'lucide-react';

interface LyricCardProps {
  section: LyricSection;
  onUpdate: (id: string, updates: Partial<LyricSection>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  availableTakes: VoiceTake[];
  beatAudioRef?: React.RefObject<HTMLAudioElement | null>;
}

export const LyricCard: React.FC<LyricCardProps> = ({ section, onUpdate, onDelete, onMove, availableTakes, beatAudioRef }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPinSelectorOpen, setIsPinSelectorOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mixEnabled, setMixEnabled] = useState(true);
  const [showVolume, setShowVolume] = useState(false);
  const [vocalVolume, setVocalVolume] = useState(1);

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

  const togglePlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      if (beatAudioRef?.current) beatAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (mixEnabled && beatAudioRef?.current && pinnedTake?.beatOffset !== undefined) {
        // Sync beat
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
    // If currently playing, we might want to start/stop beat immediately, 
    // but simpler to let next play handle it or require restart.
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

        <div className="flex items-center gap-2">
          <div className="flex items-center mr-1 opacity-30 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={() => onMove(section.id, 'up')} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-all hover:scale-110"><ChevronUp size={14} /></button>
            <button onClick={() => onMove(section.id, 'down')} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-all hover:scale-110"><ChevronDown size={14} /></button>
          </div>
          <button
            onClick={() => setIsPinSelectorOpen(!isPinSelectorOpen)}
            className={`p-1 rounded transition-all duration-300 ${section.pinnedTakeId ? 'text-[var(--accent)] bg-[var(--bg-secondary)] opacity-100' : 'text-[var(--text-tertiary)] hover:text-[var(--text-main)] opacity-30 group-hover:opacity-100'}`}
            title="Attach Recording"
          >
            <Paperclip size={12} className={section.pinnedTakeId ? "animate-pulse" : ""} />
          </button>
          <button onClick={() => onDelete(section.id)} className="text-[var(--text-tertiary)] hover:text-red-500 transition-all duration-300 ml-1 opacity-10 group-hover:opacity-100 hover:scale-110">
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
          <div className="mt-1 animate-in fade-in zoom-in-95 duration-200 flex items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 px-2 py-1 rounded-full border select-none transition-all ${isPlaying ? 'bg-[var(--bg-secondary)] border-[var(--accent)]' : 'bg-[var(--bg-secondary)] border-[var(--border-main)] hover:border-[var(--text-tertiary)]'}`}
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <div onClick={togglePlayback} className="cursor-pointer flex items-center gap-2">
                {isPlaying ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                <span className="text-[9px] mono font-medium">Take {pinnedTake.id}</span>
              </div>

              {/* Mix Toggle */}
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
                className={`ml-2 rounded-full p-0.5 hover:bg-black/20 text-[var(--text-tertiary)] hover:text-[var(--text-main)]`}
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
        </>
      )}
    </div>
  );
};
