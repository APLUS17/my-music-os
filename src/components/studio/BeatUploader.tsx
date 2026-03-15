import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, X, RotateCcw, Repeat, Trash2, Music, Volume2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 rounded-xl bg-[var(--bg-hover)] border-[var(--border-main)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all uppercase tracking-widest text-[10px] font-mono gap-2"
        >
          <Music size={12} />
          <span>Load Beat</span>
        </Button>
      </>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative z-30">
      <Popover open={showControls} onOpenChange={setShowControls}>
        <div className="group relative h-9 rounded-xl border border-[var(--border-main)] bg-[var(--bg-hover)] flex items-center overflow-hidden hover:border-[var(--border-focus)] transition-all shadow-sm">
          <div
            className="absolute inset-0 bg-[var(--accent)] opacity-10 pointer-events-none transition-all duration-200 ease-linear origin-left"
            style={{ transform: `scaleX(${progressPercent / 100})` }}
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
            className="relative z-20 h-full w-9 flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-main)] active:scale-90 transition-all rounded-none"
          >
            {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
          </Button>

          <div className="w-[1px] h-3 bg-[var(--border-main)] relative z-10" />

          <PopoverTrigger asChild>
            <button
              className="relative z-10 h-full px-3 flex items-center gap-2 hover:bg-white/5 transition-colors text-left"
            >
              <span className="text-[10px] mono uppercase font-bold tracking-widest text-[var(--text-main)] max-w-[100px] truncate">{beatName || 'Beat'}</span>
              <Badge variant="outline" className="h-4 px-1 text-[8px] border-[var(--border-main)] text-[var(--text-secondary)]">BEAT</Badge>
            </button>
          </PopoverTrigger>
        </div>

        <PopoverContent align="end" className="w-80 p-4 bg-[var(--bg-card)] border-white/10 shadow-2xl rounded-2xl flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] mono uppercase tracking-widest text-[var(--text-tertiary)]">Backing Track</span>
              <span className="text-sm font-bold text-[var(--text-main)] truncate max-w-[200px]">{beatName || 'Untitled Beat'}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClear} className="text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-full h-8 w-8">
              <Trash2 size={14} />
            </Button>
          </div>

          {/* Timeline / Scrubber */}
          <div className="relative w-full h-12 flex items-center select-none touch-none">
            <div className="relative w-full h-8 bg-[var(--bg-secondary)] rounded-xl cursor-pointer overflow-hidden border border-[var(--border-main)]"
              ref={progressRef}
              onMouseDown={handleSeek}
              onTouchStart={handleTouchSeek}
            >
              {/* Loop Region background */}
              {isLooping && loopStart !== null && loopEnd !== null && (
                <div
                  className="absolute top-0 bottom-0 bg-[var(--accent)] opacity-20 pointer-events-none"
                  style={{
                    left: `${(loopStart / duration) * 100}%`,
                    width: `${((loopEnd - loopStart) / duration) * 100}%`
                  }}
                />
              )}
              {/* Progress fill */}
              <div
                className="absolute top-0 bottom-0 bg-[var(--accent)] opacity-20 pointer-events-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Loop Markers */}
            {isLooping && loopStart !== null && (
              <div
                className="absolute top-0 bottom-0 w-6 -ml-3 z-30 cursor-col-resize flex flex-col items-center group"
                style={{ left: `${(loopStart / duration) * 100}%` }}
                onMouseDown={(e) => { e.stopPropagation(); setDraggingMarker('start'); }}
                onTouchStart={(e) => { e.stopPropagation(); setDraggingMarker('start'); }}
              >
                <div className="w-3 h-3 rounded-full bg-[var(--accent)] shadow-lg border border-black z-10 group-hover:scale-125 transition-transform" />
                <div className="w-[1.5px] flex-1 bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
              </div>
            )}
            {isLooping && loopEnd !== null && (
              <div
                className="absolute top-0 bottom-0 w-6 -ml-3 z-30 cursor-col-resize flex flex-col-reverse items-center group"
                style={{ left: `${(loopEnd / duration) * 100}%` }}
                onMouseDown={(e) => { e.stopPropagation(); setDraggingMarker('end'); }}
                onTouchStart={(e) => { e.stopPropagation(); setDraggingMarker('end'); }}
              >
                <div className="w-3 h-3 rounded-full bg-[var(--text-secondary)] shadow-lg border border-black z-10 group-hover:scale-125 transition-transform" />
                <div className="w-[1.5px] flex-1 bg-[var(--text-secondary)] opacity-60" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] mono tabular-nums text-[var(--text-secondary)]">
              {formatTime(currentTime)} <span className="opacity-30">/</span> {formatTime(duration)}
            </span>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => audioRef.current!.currentTime = loopStart ?? 0} className="h-8 w-8 text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]">
                    <RotateCcw size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset position</TooltipContent>
              </Tooltip>

              <Button
                variant={isLooping ? "default" : "outline"}
                size="sm"
                onClick={() => setIsLooping(!isLooping)}
                className={cn(
                  "h-7 rounded-lg text-[10px] mono uppercase tracking-widest gap-2",
                  isLooping ? "bg-[var(--accent)] text-[var(--bg-main)] font-bold" : "border-[var(--border-main)] text-[var(--text-secondary)]"
                )}
              >
                <Repeat size={10} /> {isLooping ? 'Looping' : 'Loop'}
              </Button>
            </div>
          </div>

          {isLooping && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setLoopStart(currentTime)} className="flex-1 h-8 rounded-xl text-[10px] mono uppercase border-[var(--border-main)] bg-[var(--bg-hover)] hover:bg-[var(--bg-secondary)]">Set Start</Button>
              <Button variant="outline" size="sm" onClick={() => setLoopEnd(currentTime)} className="flex-1 h-8 rounded-xl text-[10px] mono uppercase border-[var(--border-main)] bg-[var(--bg-hover)] hover:bg-[var(--bg-secondary)]">Set End</Button>
            </div>
          )}

          {/* Volume */}
          <div className="pt-4 border-t border-[var(--border-main)] flex items-center gap-4">
            <Volume2 size={14} className="text-[var(--text-tertiary)]" />
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[volume]}
              onValueChange={(val) => setVolume(val[0])}
              className="flex-1"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
