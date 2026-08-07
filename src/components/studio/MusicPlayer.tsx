import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Play, Pause, Sliders } from 'lucide-react';
import { motion } from 'framer-motion';
import { RecordingSession } from '@/types';
import { formatTime } from '@/lib/utils/time';
import { SyncedLyrics } from './SyncedLyrics';

interface MusicPlayerProps {
  onClose: () => void;
  onFXOpen?: () => void;
  beatSrc?: string | null;
  vocalSessions: RecordingSession[];
  projectTitle: string;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  onClose,
  onFXOpen,
  beatSrc,
  vocalSessions,
  projectTitle
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
  const vocalAudioRef = useRef<HTMLAudioElement | null>(null);
  const vocalAudioCtxRef = useRef<AudioContext | null>(null);

  // Play beat + current vocal
  const currentVocal = vocalSessions[currentTrackIndex];
  const hasBeat = !!beatSrc;
  const hasVocals = vocalSessions.length > 0;

  // Route vocal audio through Web Audio API so mono recording plays in both ears
  // Only run once since audio element is always rendered (just src changes)
  useEffect(() => {
    const audio = vocalAudioRef.current;
    if (!audio) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass() as AudioContext;
    vocalAudioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audio);
    const merger = ctx.createChannelMerger(2);
    source.connect(merger, 0, 0); // mono → left
    source.connect(merger, 0, 1); // mono → right
    merger.connect(ctx.destination);

    return () => {
      ctx.close();
      vocalAudioCtxRef.current = null;
    };
  }, []); // Run once - audio element is stable, only src changes

  // Set duration from the vocal recording (progress bar represents vocal time, 0-based)
  useEffect(() => {
    const updateDuration = () => {
      // Use vocal duration so the scrubber maps to vocal time (0 → end of recording).
      // Fall back to beat if no vocal is loaded yet.
      if (vocalAudioRef.current && isFinite(vocalAudioRef.current.duration)) {
        setDuration(vocalAudioRef.current.duration);
      } else if (beatAudioRef.current && isFinite(beatAudioRef.current.duration)) {
        setDuration(beatAudioRef.current.duration);
      }
    };

    const beat = beatAudioRef.current;
    const vocal = vocalAudioRef.current;

    if (beat) beat.addEventListener('loadedmetadata', updateDuration);
    if (vocal) vocal.addEventListener('loadedmetadata', updateDuration);

    return () => {
      if (beat) beat.removeEventListener('loadedmetadata', updateDuration);
      if (vocal) vocal.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [currentVocal]);

  // Sync playback
  useEffect(() => {
    const beat = beatAudioRef.current;
    const vocal = vocalAudioRef.current;
    const beatOffset = currentVocal?.beatOffset || 0;

    if (!beat || !vocal) return;

    // Track progress from the vocal's time (0-based), not the beat's (which starts at beatOffset)
    const handleTimeUpdate = () => {
      setProgress(vocal.currentTime);
    };

    // Stop when the vocal ends (beat may be longer or looping)
    const handleEnded = () => {
      setIsPlaying(false);
    };

    vocal.addEventListener('timeupdate', handleTimeUpdate);
    vocal.addEventListener('ended', handleEnded);

    if (isPlaying) {
      vocalAudioCtxRef.current?.resume();
      
      if (vocal.paused && hasVocals) {
        vocal.play().catch(() => setIsPlaying(false));
        
        if (beat.paused && hasBeat) {
          // Sync beat to vocal start position + offset
          beat.currentTime = vocal.currentTime + beatOffset;
          beat.play().catch(() => {
            // If beat fails, we might still want to play vocal, but let's be safe
            console.error("Beat playback failed");
          });
        }
      }
    } else {
      if (beat && !beat.paused) beat.pause();
      if (vocal && !vocal.paused) vocal.pause();
    }

    return () => {
      vocal.removeEventListener('timeupdate', handleTimeUpdate);
      vocal.removeEventListener('ended', handleEnded);
    };
  }, [isPlaying, hasBeat, hasVocals, currentVocal]);

  // Update volumes
  useEffect(() => {
    if (beatAudioRef.current) beatAudioRef.current.volume = volume * 0.7;
    if (vocalAudioRef.current) vocalAudioRef.current.volume = volume * 0.8;
  }, [volume]);

  // Cleanup: pause audio when component unmounts
  useEffect(() => {
    return () => {
      if (beatAudioRef.current) beatAudioRef.current.pause();
      if (vocalAudioRef.current) vocalAudioRef.current.pause();
    };
  }, []);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (newProgress: number) => {
    setProgress(newProgress);
    if (vocalAudioRef.current) vocalAudioRef.current.currentTime = newProgress;
    if (beatAudioRef.current) beatAudioRef.current.currentTime = newProgress + (currentVocal?.beatOffset || 0);
  };

  const handleNextVocal = () => {
    if (currentTrackIndex < vocalSessions.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
    }
  };

  const handlePrevVocal = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    }
  };

  // Render timeline markers every 5 seconds
  const timelineMarkers = React.useMemo(() => {
    const markers = [];
    const step = 5; // 5 second intervals
    for (let i = 0; i <= duration; i += step) {
      markers.push(i);
    }
    return markers;
  }, [duration]);

  const formatTimeMs = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[var(--bg-main)] z-50 flex flex-col overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Top Timeline Section */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-[var(--border-main)]">
        {/* Timeline with markers */}
        <div className="mb-6 relative">
          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] mono mb-2 px-1">
            {timelineMarkers.slice(0, 5).map((time, idx) => (
              <span key={idx} className="flex-1">
                {Math.floor(time / 60)}:{String(Math.floor(time % 60)).padStart(2, '0')}
              </span>
            ))}
          </div>
          {/* Progress slider with track */}
          <div className="relative">
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={progress}
              onChange={(e) => handleProgressChange(parseFloat(e.target.value))}
              className="w-full h-6 bg-transparent appearance-none cursor-pointer slider-ios rounded-lg"
              style={{ touchAction: 'none' }}
            />
          </div>
        </div>

        {/* Large Time Display */}
        <div className="text-center">
          <div className="text-5xl font-bold tabular-nums text-[var(--text-main)] tracking-tight font-mono">
            {formatTimeMs(progress)}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6">
        {/* Synced transcript — scroll through the take instead of re-listening */}
        {hasVocals && currentVocal?.lines && currentVocal.lines.length > 0 && (
          <div className="w-full h-64 mb-6 relative max-w-lg">
            <SyncedLyrics
              lines={currentVocal.lines}
              currentTime={progress}
              onSeek={handleProgressChange}
              className="h-64"
            />
          </div>
        )}

        {/* Project Info */}
        {!hasVocals && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">{projectTitle}</h2>
            <p className="text-sm text-[var(--text-tertiary)]">No vocals recorded yet</p>
          </div>
        )}
      </div>

      {/* Controls Section */}
      <div className="flex-shrink-0 px-6 py-8 border-t border-[var(--border-main)]">
        {/* Play Controls - Skip back 15s, Play/Pause, Skip forward 15s */}
        <div className="flex items-center justify-center gap-12 mb-12">
          {/* Skip Back 15s */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleProgressChange(Math.max(0, progress - 15))}
            disabled={!hasVocals}
            className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Rewind 15s"
          >
            <span className="text-xs font-bold">-15</span>
          </motion.button>

          {/* Play/Pause - Large Center Button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={handlePlayPause}
            disabled={!hasBeat && !hasVocals}
            className="w-20 h-20 rounded-full bg-[var(--accent)] text-[var(--bg-main)] flex items-center justify-center shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
          </motion.button>

          {/* Skip Forward 15s */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleProgressChange(Math.min(duration, progress + 15))}
            disabled={!hasVocals}
            className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Forward 15s"
          >
            <span className="text-xs font-bold">+15</span>
          </motion.button>
        </div>

        {/* Bottom Toolbar - Transcription, Pause, FX */}
        <div className="flex items-center justify-center gap-8">
          {/* Transcription/Chat Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              // Placeholder for transcription/chat functionality
            }}
            className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all"
            title="View transcription"
          >
            <MessageSquare size={18} />
          </motion.button>

          {/* Pause Button - Red Center (currently playing indicator) */}
          <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              <Pause size={14} fill="white" className="text-white" />
            </div>
          </div>

          {/* FX Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onFXOpen || onClose}
            className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all"
            title="Open effects"
          >
            <Sliders size={18} />
          </motion.button>
        </div>
      </div>

      {/* Audio Elements - always render to maintain Web Audio connection */}
      <audio ref={beatAudioRef} src={beatSrc || undefined} className="hidden" crossOrigin="anonymous" />
      <audio ref={vocalAudioRef} src={currentVocal?.audioUrl || currentVocal?.base64 || undefined} className="hidden" crossOrigin="anonymous" />

      <style>{`
        .slider-ios::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .slider-ios::-webkit-slider-runnable-track {
          background: linear-gradient(to right, var(--accent) 0%, var(--accent) calc(100% * ${progress / (duration || 1)}), var(--bg-secondary) calc(100% * ${progress / (duration || 1)}), var(--bg-secondary) 100%);
          height: 6px;
          border-radius: 3px;
        }
        .slider-ios::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .slider-ios::-moz-range-track {
          background: transparent;
          border: none;
        }
        .slider-ios::-moz-range-progress {
          background: var(--accent);
          height: 6px;
          border-radius: 3px;
        }
      `}</style>
    </motion.div>
  );
};
