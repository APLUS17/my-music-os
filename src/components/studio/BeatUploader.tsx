
import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, X, RotateCcw, Repeat, Flag, Trash2, ChevronDown, Music, Settings2, Volume2 } from 'lucide-react';

interface BeatUploaderProps {
  audioSrc: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  beatName?: string;
  onUpload: (file: File) => void;
  onClear: () => void;
  // Lifted Props
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  volume: number;
  setVolume: (vol: number) => void;
  loopStart: number | null;
  setLoopStart: (val: number | null) => void;
  loopEnd: number | null;
  setLoopEnd: (val: number | null) => void;
  isLooping: boolean;
  setIsLooping: (val: boolean) => void;
}

export const BeatUploader: React.FC<BeatUploaderProps> = ({
  audioSrc, audioRef, beatName, onUpload, onClear,
  isPlaying, setIsPlaying, volume, setVolume, loopStart, setLoopStart, loopEnd, setLoopEnd, isLooping, setIsLooping
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [showControls, setShowControls] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [draggingMarker, setDraggingMarker] = useState<'start' | 'end' | null>(null);
  const [isDraggingScrub, setIsDraggingScrub] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.duration && audio.duration !== Infinity) setDuration(audio.duration);
    setCurrentTime(audio.currentTime);

    const onLoadedMetadata = () => {
      if (audio.duration && audio.duration !== Infinity) setDuration(audio.duration);
    };

    const handleTimeSync = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener('timeupdate', handleTimeSync);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeSync);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [audioRef.current]);

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

          <div className="relative w-full h-12 flex items-center mb-1 select-none touch-none">
            <div className="relative w-full h-8 bg-[var(--bg-secondary)] rounded-md cursor-pointer overflow-hidden border border-[var(--border-main)]"
              ref={progressRef}
              onMouseDown={handleSeek}
              onTouchStart={handleTouchSeek}
            >
              {/* Loop Region background */}
              {isLooping && loopStart !== null && loopEnd !== null && (
                <div
                  className="absolute top-0 bottom-0 bg-[var(--accent)] opacity-10 pointer-events-none"
                  style={{
                    left: `${(loopStart / duration) * 100}%`,
                    width: `${((loopEnd - loopStart) / duration) * 100}%`
                  }}
                />
              )}
              {/* Progress fill */}
              <div
                className="absolute top-0 bottom-0 bg-[var(--text-secondary)] opacity-30 pointer-events-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Loop Markers (Circular Handles) - Outside overflow-hidden container */}
            {isLooping && loopStart !== null && (
              <div
                className="absolute top-0 bottom-2 w-6 -ml-3 z-30 cursor-col-resize flex flex-col items-center group"
                style={{ left: `${(loopStart / duration) * 100}%` }}
                onMouseDown={(e) => { e.stopPropagation(); setDraggingMarker('start'); }}
                onTouchStart={(e) => { e.stopPropagation(); setDraggingMarker('start'); }}
              >
                {/* The Circle Handle (Top) */}
                <div className="w-3 h-3 rounded-full bg-[var(--accent)] shadow-lg border border-[var(--bg-main)] z-10 group-hover:scale-125 group-active:scale-95 transition-transform" />
                {/* The Vertical Line */}
                <div className="w-[1.5px] flex-1 bg-[var(--accent)] opacity-60 group-hover:opacity-100 shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)]" />
              </div>
            )}
            {isLooping && loopEnd !== null && (
              <div
                className="absolute top-2 bottom-0 w-6 -ml-3 z-30 cursor-col-resize flex flex-col-reverse items-center group"
                style={{ left: `${(loopEnd / duration) * 100}%` }}
                onMouseDown={(e) => { e.stopPropagation(); setDraggingMarker('end'); }}
                onTouchStart={(e) => { e.stopPropagation(); setDraggingMarker('end'); }}
              >
                {/* The Circle Handle (Bottom) */}
                <div className="w-3 h-3 rounded-full bg-[var(--text-main)] shadow-lg border border-[var(--bg-main)] z-10 group-hover:scale-125 group-active:scale-95 transition-transform" />
                {/* The Vertical Line */}
                <div className="w-[1.5px] flex-1 bg-[var(--text-main)] opacity-60 group-hover:opacity-100 shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
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
