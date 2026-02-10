
import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, X, RotateCcw, Repeat, Flag, Trash2, ChevronDown, Music, Settings2, Volume2 } from 'lucide-react';

interface BeatUploaderProps {
  audioSrc: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  beatName?: string;
  onUpload: (file: File) => void;
  onClear: () => void;
}

export const BeatUploader: React.FC<BeatUploaderProps> = ({ audioSrc, audioRef, beatName, onUpload, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState(true);
  
  const [draggingMarker, setDraggingMarker] = useState<'start' | 'end' | null>(null);
  const [isDraggingScrub, setIsDraggingScrub] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    
    return () => {
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
    };
  }, [audioRef.current]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        if (audioRef.current.paused) {
            audioRef.current.play().catch(() => setIsPlaying(false));
        }
      } else {
        if (!audioRef.current.paused) {
            audioRef.current.pause();
        }
      }
    }
  }, [isPlaying]);

  useEffect(() => {
      if(audioRef.current) audioRef.current.volume = volume;
  }, [volume, audioSrc]);

  // Marker Dragging Logic
  useEffect(() => {
    const handleMove = (clientX: number) => {
        if (!progressRef.current || duration === 0) return;
        const rect = progressRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const time = percent * duration;

        if (draggingMarker === 'start') {
            const endLimit = loopEnd ?? duration;
            const newStart = Math.max(0, Math.min(time, endLimit - 0.5)); 
            setLoopStart(newStart);
        } else if (draggingMarker === 'end') {
            const startLimit = loopStart ?? 0;
            const newEnd = Math.max(startLimit + 0.5, Math.min(time, duration));
            setLoopEnd(newEnd);
        }
    };

    const onMouseMove = (e: MouseEvent) => {
        if (draggingMarker) {
            e.preventDefault();
            handleMove(e.clientX);
        }
    };

    const onTouchMove = (e: TouchEvent) => {
        if (draggingMarker) {
            e.preventDefault();
            handleMove(e.touches[0].clientX);
        }
    };

    const onUp = () => setDraggingMarker(null);

    if (draggingMarker) {
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchend', onUp);
    }

    return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchend', onUp);
    };
  }, [draggingMarker, duration, loopEnd, loopStart]);

  // Drag-to-scrub logic
  useEffect(() => {
    const handleScrubMove = (clientX: number) => {
      if (!progressRef.current || duration === 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (audioRef.current) {
        audioRef.current.currentTime = percent * duration;
        setCurrentTime(percent * duration);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingScrub && !draggingMarker) {
        e.preventDefault();
        handleScrubMove(e.clientX);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isDraggingScrub && !draggingMarker) {
        e.preventDefault();
        handleScrubMove(e.touches[0].clientX);
      }
    };

    const onUp = () => setIsDraggingScrub(false);

    if (isDraggingScrub) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDraggingScrub, draggingMarker, duration]);

  const handleTimeUpdate = () => {
    if (audioRef.current && !draggingMarker && !isDraggingScrub) {
      const curr = audioRef.current.currentTime;
      setCurrentTime(curr);

      if (isLooping) {
        const start = loopStart ?? 0;
        const end = loopEnd ?? duration;
        if (curr >= end && end > 0) {
           audioRef.current.currentTime = start;
        }
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingMarker) return;
    if (!audioRef.current || !progressRef.current || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = percent * duration;
    setCurrentTime(percent * duration);
    setIsDraggingScrub(true);
  };

  const handleTouchSeek = (e: React.TouchEvent<HTMLDivElement>) => {
    if (draggingMarker) return;
    if (!audioRef.current || !progressRef.current || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
    audioRef.current.currentTime = percent * duration;
    setCurrentTime(percent * duration);
    setIsDraggingScrub(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setLoopStart(null);
        setLoopEnd(null);
        setIsLooping(true);
        onUpload(file);
    }
  };

  const formatTime = (t: number) => {
    if (!t) return "0:00";
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- EMPTY STATE ---
  if (!audioSrc) {
    return (
      <>
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="audio/*, .mp3, .wav, .m4a, .aac" 
          className="absolute opacity-0 w-0 h-0 pointer-events-none" 
          onChange={handleFileChange}
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="h-8 px-3 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-main)] hover:border-[var(--text-tertiary)] transition-all"
          title="Load Reference Track"
        >
          <Music size={12} />
          <span className="text-[10px] mono uppercase tracking-wider hidden sm:inline">Load Beat</span>
        </button>
      </>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // --- LOADED STATE (PILL) ---
  return (
    <div className="relative z-30">
      <audio 
        ref={audioRef} 
        src={audioSrc} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => isLooping ? (audioRef.current!.currentTime = loopStart ?? 0, audioRef.current!.play()) : setIsPlaying(false)}
      />

      {/* Split Action Pill */}
      <div className="group relative h-8 rounded-md border border-[var(--border-main)] bg-[var(--bg-secondary)] flex items-center overflow-hidden hover:border-[var(--text-tertiary)] transition-colors">
        
        {/* Progress Background Fill (Underneath everything) */}
        <div 
            className="absolute inset-0 bg-[var(--text-main)] opacity-10 pointer-events-none transition-all duration-200 ease-linear origin-left"
            style={{ transform: `scaleX(${progressPercent / 100})` }}
        />

        {/* Action 1: Play/Pause Toggle */}
        <button 
           onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
           className="relative z-20 h-full pl-2 pr-2 flex items-center justify-center hover:bg-[var(--bg-hover)] active:scale-95 transition-all text-[var(--text-main)]"
           title={isPlaying ? "Pause" : "Play"}
        >
            {isPlaying ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
        </button>

        {/* Divider (Optional visual separation) */}
        <div className="w-[1px] h-3 bg-[var(--border-main)] relative z-10 opacity-50" />

        {/* Action 2: Open Controls */}
        <button 
           onClick={() => setShowControls(!showControls)}
           className="relative z-10 h-full pl-2 pr-3 flex items-center gap-2 hover:bg-[var(--bg-hover)] transition-colors"
           title="Open Controls"
        >
            <span className="text-[10px] mono uppercase font-medium text-[var(--text-main)] max-w-[80px] truncate">{beatName || 'Beat'}</span>
        </button>
      </div>

      {/* --- CONTROLS POPOVER --- */}
      {showControls && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-3 animate-in fade-in zoom-in-95 origin-top-right z-50">
           
           {/* Header */}
           <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] mono uppercase text-[var(--text-tertiary)]">{beatName || 'Beat'}</span>
              <button onClick={onClear} className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors">
                  <Trash2 size={12} />
              </button>
           </div>

           {/* Scrubber */}
           <div className="relative w-full h-8 bg-[var(--bg-secondary)] rounded-md cursor-pointer overflow-hidden select-none touch-none border border-[var(--border-main)] mb-3"
                ref={progressRef}
                onMouseDown={handleSeek}
                onTouchStart={handleTouchSeek}
           >
              {/* Loop Region */}
              {isLooping && loopStart !== null && loopEnd !== null && (
                  <div 
                      className="absolute top-0 bottom-0 bg-[var(--accent)] opacity-10 pointer-events-none"
                      style={{
                          left: `${(loopStart / duration) * 100}%`,
                          width: `${((loopEnd - loopStart) / duration) * 100}%`
                      }}
                  />
              )}
              {/* Progress */}
              <div 
                  className="absolute top-0 bottom-0 bg-[var(--text-secondary)] opacity-30 pointer-events-none"
                  style={{ width: `${progressPercent}%` }}
              />
              {/* Markers */}
              {isLooping && loopStart !== null && (
                  <div 
                    className="absolute top-0 bottom-0 w-4 -ml-2 z-30 cursor-col-resize flex flex-col items-center justify-center group" 
                    style={{ left: `${(loopStart / duration) * 100}%` }}
                    onMouseDown={(e) => { e.stopPropagation(); setDraggingMarker('start'); }}
                    onTouchStart={(e) => { e.stopPropagation(); setDraggingMarker('start'); }}
                  >
                     <div className="w-[1px] h-full bg-[var(--accent)]" />
                  </div>
              )}
              {isLooping && loopEnd !== null && (
                  <div 
                    className="absolute top-0 bottom-0 w-4 -ml-2 z-30 cursor-col-resize flex flex-col items-center justify-center group" 
                    style={{ left: `${(loopEnd / duration) * 100}%` }}
                    onMouseDown={(e) => { e.stopPropagation(); setDraggingMarker('end'); }}
                    onTouchStart={(e) => { e.stopPropagation(); setDraggingMarker('end'); }}
                  >
                     <div className="w-[1px] h-full bg-[var(--accent)]" />
                  </div>
              )}
           </div>

           {/* Controls Row */}
           <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] mono tabular-nums text-[var(--text-main)]">
                  {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="flex items-center gap-2">
                 <button onClick={() => audioRef.current!.currentTime = loopStart ?? 0} className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-main)]">
                    <RotateCcw size={14} />
                 </button>
                 <button 
                    onClick={() => setIsLooping(!isLooping)} 
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] mono uppercase border transition-all ${isLooping ? 'bg-[var(--bg-hover)] border-[var(--accent)] text-[var(--text-main)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}
                 >
                    <Repeat size={10} /> Loop
                 </button>
              </div>
           </div>

           {/* Loop Points Details (only if looping) */}
           {isLooping && (
             <div className="flex gap-2 mb-3">
                 <button onClick={() => setLoopStart(currentTime)} className="flex-1 py-1 bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded text-[9px] mono uppercase text-[var(--text-secondary)] hover:text-[var(--text-main)]">Set Start</button>
                 <button onClick={() => setLoopEnd(currentTime)} className="flex-1 py-1 bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded text-[9px] mono uppercase text-[var(--text-secondary)] hover:text-[var(--text-main)]">Set End</button>
             </div>
           )}

           {/* Volume */}
           <div className="pt-3 border-t border-[var(--border-main)] flex items-center gap-2">
              <Volume2 size={12} className="text-[var(--text-tertiary)]" />
              <input 
                 type="range" 
                 min="0" max="1" step="0.1" 
                 value={volume}
                 onChange={(e) => setVolume(parseFloat(e.target.value))}
                 className="flex-1 h-1 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-secondary)] hover:[&::-webkit-slider-thumb]:bg-[var(--text-main)]"
              />
           </div>

        </div>
      )}
    </div>
  );
};
