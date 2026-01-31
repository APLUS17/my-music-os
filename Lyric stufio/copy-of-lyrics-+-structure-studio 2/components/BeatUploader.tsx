import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, X, RotateCcw, Repeat, Flag, Trash2, ChevronDown, Music, Disc } from 'lucide-react';

interface BeatUploaderProps {
  audioSrc: string | null;
  onUpload: (file: File) => void;
  onClear: () => void;
}

export const BeatUploader: React.FC<BeatUploaderProps> = ({ audioSrc, onUpload, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed to save space
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  
  const [draggingMarker, setDraggingMarker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.log("Playback prevented:", error);
            setIsPlaying(false);
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

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

  const handleTimeUpdate = () => {
    if (audioRef.current && !draggingMarker) {
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

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsPlaying(true); 
      setIsLooping(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingMarker) return;
    if (!audioRef.current || !progressRef.current || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = percent * duration;
    setCurrentTime(percent * duration);
  };

  const formatTime = (t: number) => {
    if (!t) return "0:00";
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  if (!audioSrc) {
    return (
      <div className="w-full flex justify-start animate-in fade-in">
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp3,audio/x-m4a,audio/aac,audio/*" 
          className="hidden" 
          onChange={handleFileChange}
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-lg p-2.5 flex items-center gap-3 text-[var(--text-tertiary)] hover:text-[var(--text-main)] hover:border-[var(--text-tertiary)] transition-all group cursor-pointer"
        >
          <div className="w-8 h-8 rounded bg-[var(--bg-card)] flex items-center justify-center border border-[var(--border-main)]">
             <Music size={14} />
          </div>
          <div className="flex flex-col items-start gap-0.5">
             <span className="text-[10px] mono uppercase tracking-wider text-[var(--text-main)]">Track 1</span>
             <span className="text-[9px] text-[var(--text-secondary)]">Empty • Tap to load beat</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-lg flex flex-col animate-in fade-in slide-in-from-top-1 transition-all duration-300 overflow-hidden ${isCollapsed ? 'p-0' : 'p-3 gap-3'}`}>
      <audio 
        ref={audioRef} 
        src={audioSrc} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => isLooping ? (audioRef.current!.currentTime = loopStart ?? 0, audioRef.current!.play()) : setIsPlaying(false)}
      />
      
      {/* Header / Collapsed View */}
      <div className={`flex items-center justify-between select-none ${isCollapsed ? 'p-2' : ''}`}>
        <div 
          className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {/* Cover Art / Play Button */}
          <div 
            onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} 
            className={`w-9 h-9 rounded flex items-center justify-center transition-all shrink-0 ${isPlaying ? 'bg-[var(--accent)] text-[var(--bg-main)] shadow-[0_0_10px_var(--accent-dim)]' : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-secondary)] hover:border-[var(--text-main)]'}`}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
          </div>
          
          <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-[var(--text-main)] truncate">Reference Track</span>
                <span className="text-[9px] mono text-[var(--text-tertiary)] tabular-nums">
                   {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              {isCollapsed && (
                 <div className="w-full h-0.5 bg-[var(--bg-card)] mt-1.5 rounded-full overflow-hidden relative max-w-[120px]">
                    <div className="absolute top-0 bottom-0 left-0 bg-[var(--text-secondary)]" style={{ width: `${(currentTime / duration) * 100}%`}} />
                 </div>
              )}
          </div>
        </div>
        
        {!isCollapsed && (
          <button 
             onClick={onClear} 
             className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-hover)] rounded-md transition-all"
          >
             <Trash2 size={14} />
          </button>
        )}
         {isCollapsed && (
             <ChevronDown size={14} className="text-[var(--text-tertiary)] mr-1" />
         )}
      </div>

      {!isCollapsed && (
        <div className="flex flex-col gap-3 animate-in slide-in-from-top-1 fade-in duration-200">
          <div 
              ref={progressRef}
              onMouseDown={handleSeek}
              className="relative w-full h-8 bg-[var(--bg-card)] rounded-sm cursor-pointer overflow-hidden select-none touch-none border border-[var(--border-main)]"
          >
              {isLooping && loopStart !== null && loopEnd !== null && (
                  <div 
                      className="absolute top-0 bottom-0 bg-[var(--accent)] opacity-10 pointer-events-none"
                      style={{
                          left: `${(loopStart / duration) * 100}%`,
                          width: `${((loopEnd - loopStart) / duration) * 100}%`
                      }}
                  />
              )}
              <div 
                  className="absolute top-0 bottom-0 bg-[var(--text-secondary)] opacity-20 pointer-events-none"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              {isLooping && loopStart !== null && (
                  <div 
                    className="absolute top-0 bottom-0 w-6 -ml-3 z-30 cursor-col-resize group/marker flex flex-col items-center justify-center" 
                    style={{ left: `${(loopStart / duration) * 100}%` }}
                    onMouseDown={(e) => { e.stopPropagation(); setDraggingMarker('start'); }}
                    onTouchStart={(e) => { e.stopPropagation(); setDraggingMarker('start'); }}
                  >
                     <div className="w-[1px] h-full bg-[var(--accent)] shadow-[0_0_4px_var(--accent)]">
                        <div className="absolute top-0 -translate-x-1/2 bg-[var(--accent)] text-[var(--bg-card)] rounded-sm p-[2px]"><Flag size={8} fill="currentColor" /></div>
                     </div>
                  </div>
              )}
              {isLooping && loopEnd !== null && (
                  <div 
                    className="absolute top-0 bottom-0 w-6 -ml-3 z-30 cursor-col-resize group/marker flex flex-col items-center justify-center" 
                    style={{ left: `${(loopEnd / duration) * 100}%` }}
                    onMouseDown={(e) => { e.stopPropagation(); setDraggingMarker('end'); }}
                    onTouchStart={(e) => { e.stopPropagation(); setDraggingMarker('end'); }}
                  >
                     <div className="w-[1px] h-full bg-[var(--accent)] shadow-[0_0_4px_var(--accent)]">
                        <div className="absolute bottom-0 -translate-x-1/2 bg-[var(--accent)] text-[var(--bg-card)] rounded-sm p-[2px] rotate-180"><Flag size={8} fill="currentColor" /></div>
                     </div>
                  </div>
              )}
          </div>

          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <button onClick={() => audioRef.current!.currentTime = loopStart ?? 0} className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-all"><RotateCcw size={14} /></button>
                  <button onClick={() => setIsLooping(!isLooping)} className={`h-8 px-3 rounded-md flex items-center gap-2 text-[10px] mono uppercase tracking-wider transition-all border ${isLooping ? 'bg-[var(--bg-hover)] border-[var(--accent)] text-[var(--text-main)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}><Repeat size={12} className={isLooping ? "text-[var(--accent)]" : ""} />Loop</button>
              </div>
              <div className={`flex items-center gap-1 transition-opacity duration-200 ${isLooping ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <button onClick={() => setLoopStart(currentTime)} className="h-7 px-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded text-[9px] mono uppercase text-[var(--text-secondary)] hover:text-[var(--text-main)]">In</button>
                  <button onClick={() => setLoopEnd(currentTime)} className="h-7 px-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded text-[9px] mono uppercase text-[var(--text-secondary)] hover:text-[var(--text-main)]">Out</button>
                  {(loopStart !== null || loopEnd !== null) && <button onClick={() => { setLoopStart(null); setLoopEnd(null); }} className="h-7 w-7 flex items-center justify-center text-[var(--text-tertiary)] hover:text-red-400 hover:bg-[var(--bg-hover)] rounded ml-1"><X size={12} /></button>}
              </div>
          </div>
        </div>
      )}
    </div>
  );
};