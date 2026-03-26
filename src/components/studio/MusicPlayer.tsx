import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Volume2, SkipBack, SkipForward } from 'lucide-react';
import { motion } from 'framer-motion';
import { RecordingSession } from '@/types';

interface MusicPlayerProps {
  onClose: () => void;
  beatSrc?: string | null;
  vocalSessions: RecordingSession[];
  projectTitle: string;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  onClose,
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
        vocal.play().catch(() => { });
        
        if (beat.paused && hasBeat) {
          // Sync beat to vocal start position + offset
          beat.currentTime = vocal.currentTime + beatOffset;
          beat.play().catch(() => { });
        }
      }
    } else {
      if (!beat.paused && hasBeat) beat.pause();
      if (!vocal.paused && hasVocals) vocal.pause();
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

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[var(--bg-main)] z-50 flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all z-10"
      >
        <X size={20} />
      </button>

      {/* Content */}
      <div className="w-full h-full flex flex-col items-center justify-center px-6 max-w-lg">
        {/* Artwork / Visualization */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-48 h-48 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center mb-12 shadow-2xl"
        >
          <div className="text-center px-4">
            <div className="text-3xl font-bold text-[var(--bg-main)] mb-2 truncate">{projectTitle}</div>
            <div className="text-xs mono text-[var(--bg-main)]/70 uppercase tracking-wider">
              {hasVocals ? `${vocalSessions.length} take${vocalSessions.length > 1 ? 's' : ''}` : 'No vocals'}
            </div>
          </div>
        </motion.div>

        {/* Title & Info */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-main)] mb-1">{projectTitle}</h2>
          {hasVocals && currentVocal && (
            <p className="text-sm text-[var(--text-secondary)]">
              Take {currentTrackIndex + 1} of {vocalSessions.length} • {currentVocal.duration}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full mb-6">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={progress}
            onChange={(e) => handleProgressChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex items-center justify-between text-xs tabular-nums mono text-[var(--text-tertiary)] mt-2">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mb-12">
          {/* Previous Take */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePrevVocal}
            disabled={currentTrackIndex === 0 || !hasVocals}
            className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <SkipBack size={18} />
          </motion.button>

          {/* Play/Pause */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={handlePlayPause}
            disabled={!hasBeat && !hasVocals}
            className="w-16 h-16 rounded-full bg-[var(--accent)] text-[var(--bg-main)] flex items-center justify-center shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </motion.button>

          {/* Next Take */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleNextVocal}
            disabled={currentTrackIndex === vocalSessions.length - 1 || !hasVocals}
            className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <SkipForward size={18} />
          </motion.button>
        </div>

        {/* Volume Control */}
        <div className="w-full max-w-xs">
          <div className="flex items-center gap-3">
            <Volume2 size={14} className="text-[var(--text-secondary)]" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>

        {/* Audio Elements - always render to maintain Web Audio connection */}
        <audio ref={beatAudioRef} src={beatSrc || undefined} className="hidden" crossOrigin="anonymous" />
        <audio ref={vocalAudioRef} src={currentVocal?.audioUrl || currentVocal?.base64 || undefined} className="hidden" crossOrigin="anonymous" />

        {/* Status Messages */}
        {!hasBeat && !hasVocals && (
          <div className="text-center text-[var(--text-tertiary)] text-sm">
            Upload a beat or record a vocal to get started
          </div>
        )}
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          border: none;
        }
      `}</style>
    </motion.div>
  );
};
