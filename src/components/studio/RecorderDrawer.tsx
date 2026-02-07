
import React, { useState, useRef, useEffect } from 'react';
import {
  Undo2,
  Redo2,
  Play,
  Pause,
  Check,
  Trash2,
  Music,
  X,
  Timer,
  Clock,
  Settings2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FXPanel, FXSettings } from './FXPanel';

interface RecorderDrawerProps {
  onClose: () => void;
  onSave: (blob: Blob, duration: number, beatOffset?: number) => void;
  backingTrackSrc?: string | null;
  backingAudioRef?: React.RefObject<HTMLAudioElement | null>;
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
}

export const RecorderDrawer: React.FC<RecorderDrawerProps> = ({
  onClose,
  onSave,
  backingTrackSrc,
  backingAudioRef,
  isMinimized = false,
  onMinimizeToggle
}) => {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);

  // UI States
  const [activeTakeTab, setActiveTakeTab] = useState('T1');
  const [metronomeActive, setMetronomeActive] = useState(false);
  const [showFx, setShowFx] = useState(false);
  const [fxSettings, setFxSettings] = useState<FXSettings>({ space: 25, echo: 0, punch: 50 });

  // Refs for logic
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordingStartOffsetRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>([]);
  const isDraggingRef = useRef(false);

  // Ref to track progress inside animation loop without stale closures
  const visualizerProgressRef = useRef(0);
  visualizerProgressRef.current = progress;

  const takes = ['T1', 'T2', 'T3', 'T4'];

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      // If we were playing the backing track via this drawer, pause it (though it's controlled externally often)
      if (backingAudioRef?.current && isPlaying) {
        backingAudioRef.current.pause();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // --- Visualizer & Canvas Logic ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cache colors once to avoid slow getComputedStyle in loop
    const style = getComputedStyle(document.documentElement);
    const accentColor = style.getPropertyValue('--accent').trim() || '#ffffff';
    const textColor = style.getPropertyValue('--text-main').trim() || '#ffffff';
    const recordingColor = '#EF4444';

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;
      const currentProgress = visualizerProgressRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = isMinimized ? 1.5 : 2;
      ctx.lineCap = 'round';

      if (isRecording) {
        // LIVE VISUALIZATION
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteTimeDomainData(dataArrayRef.current as any);

          ctx.beginPath();
          ctx.strokeStyle = recordingColor;

          const sliceWidth = width * 1.0 / dataArrayRef.current.length;
          let x = 0;

          for (let i = 0; i < dataArrayRef.current.length; i++) {
            const v = dataArrayRef.current[i] / 128.0;
            const y = v * height / 2;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
          }
          ctx.stroke();

          // Collect peaks (only if not minimized for performance, or keep consistent)
          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            const v = (dataArrayRef.current[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArrayRef.current.length);
          if (Math.random() > 0.5) peaksRef.current.push(rms);
        }

      } else if (recordedBlob) {
        // PLAYBACK VISUALIZATION
        const peaks = peaksRef.current;
        const barWidth = isMinimized ? 2 : 3;
        const gap = 1;
        const totalBars = Math.floor(width / (barWidth + gap));
        const step = Math.ceil(peaks.length / totalBars);

        ctx.fillStyle = accentColor;

        for (let i = 0; i < totalBars; i++) {
          let peakIndex = i * step;
          if (peakIndex >= peaks.length) break;

          let val = 0;
          for (let j = 0; j < step && (peakIndex + j) < peaks.length; j++) {
            val = Math.max(val, peaks[peakIndex + j]);
          }

          const barHeight = Math.max(2, val * height * (isMinimized ? 1.2 : 1.5));
          const x = i * (barWidth + gap);

          const progressX = currentProgress * width;

          // Color diff based on played/unplayed
          if (x < progressX) {
            ctx.globalAlpha = 1.0;
          } else {
            ctx.globalAlpha = 0.3;
          }

          ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
        }
        ctx.globalAlpha = 1.0;

        // Draw Playhead
        const px = currentProgress * width;
        ctx.beginPath();
        ctx.strokeStyle = textColor;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();

        if (!isMinimized) {
          ctx.fillStyle = textColor;
          ctx.beginPath();
          ctx.arc(px, height - 4, 3, 0, Math.PI * 2);
          ctx.fill();
        }

      } else {
        // IDLE
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth * window.devicePixelRatio;
        canvas.height = parent.clientHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        canvas.style.width = `${parent.clientWidth}px`;
        canvas.style.height = `${parent.clientHeight}px`;
      }
    };

    // Add small delay to allow layout transition to finish before resizing
    setTimeout(resizeCanvas, 50);

    window.addEventListener('resize', resizeCanvas);

    // Start loop
    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRecording, recordedBlob, isMinimized]); // Add isMinimized to re-bind on layout change

  // --- Interaction Logic ---
  const handleCanvasInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (isRecording || !recordedBlob || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const x = clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, x / rect.width));

    handleScrub(newProgress);
  };

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
        if (backingAudioRef?.current && backingTrackSrc) {
          // Check if we have an offset to respect, usually 0 for a new recording playback unless synced
          // For simple playback review, we might just play from where the user scrubbed
          backingAudioRef.current.currentTime = audioRef.current.currentTime + recordingStartOffsetRef.current;
          backingAudioRef.current.play().catch(console.error);
        }
      } else {
        audioRef.current.pause();
        if (backingAudioRef?.current) {
          backingAudioRef.current.pause();
        }
      }
    }
  }, [isPlaying, backingTrackSrc]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSupportedMimeType = () => {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      peaksRef.current = [];

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        source.disconnect();

        if (backingAudioRef?.current) {
          backingAudioRef.current.pause();
          // Don't reset time here, user might want to review with beat in sync
        }

        if (audioRef.current) {
          const url = URL.createObjectURL(blob);
          audioRef.current.src = url;

          audioRef.current.onloadedmetadata = () => {
            if (audioRef.current && audioRef.current.duration !== Infinity) {
              setDuration(audioRef.current.duration);
            }
          };

          audioRef.current.onended = () => {
            setIsPlaying(false);
            setProgress(1);
          };
          audioRef.current.ontimeupdate = () => {
            if (audioRef.current && audioRef.current.duration > 0) {
              const d = audioRef.current.duration;
              setProgress(audioRef.current.currentTime / d);
            }
          };
        }
        stream.getTracks().forEach(track => track.stop());
      };

      // Start Backing Track
      if (backingAudioRef?.current && backingTrackSrc) {
        recordingStartOffsetRef.current = backingAudioRef.current.currentTime;
        backingAudioRef.current.volume = 0.6;
        backingAudioRef.current.play();
      } else {
        recordingStartOffsetRef.current = 0;
      }

      mediaRecorder.start();
      setIsRecording(true);
      setRecordedBlob(null);
      setProgress(0);
      setDuration(0);
      startTimeRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      if (recordedBlob && !confirm("Discard recording?")) return;
      startRecording();
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const tempAudio = new Audio(url);
      tempAudio.onloadedmetadata = () => {
        setDuration(tempAudio.duration);
        setRecordedBlob(file);
        peaksRef.current = Array.from({ length: 100 }, () => Math.random() * 0.5 + 0.1);

        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.ontimeupdate = () => {
            if (audioRef.current && tempAudio.duration > 0) {
              setProgress(audioRef.current.currentTime / tempAudio.duration);
            }
          };
          audioRef.current.onended = () => {
            setIsPlaying(false);
            setProgress(1);
          };
        }
      };
    }
  };

  const handleSave = () => {
    if (recordedBlob) {
      onSave(recordedBlob, duration, recordingStartOffsetRef.current);
      onClose();
    }
  };

  const handleDiscard = () => {
    if (recordedBlob) {
      if (confirm("Delete this take?")) {
        setRecordedBlob(null);
        setDuration(0);
        setProgress(0);
        peaksRef.current = [];
      }
    } else {
      onClose();
    }
  };

  const handleScrub = (val: number) => {
    if (audioRef.current && recordedBlob) {
      const d = duration || audioRef.current.duration || 1;
      const time = val * d;

      if (Number.isFinite(time)) {
        audioRef.current.currentTime = time;
        if (backingAudioRef?.current && backingTrackSrc) {
          backingAudioRef.current.currentTime = time + recordingStartOffsetRef.current;
        }
        setProgress(val);
      }
    }
  };

  const handleUpdateFx = (key: keyof FXSettings, value: number) => {
    setFxSettings(prev => ({ ...prev, [key]: value }));
  };

  // --- RENDER ---
  return (
    <AnimatePresence mode="wait">
      {isMinimized ? (
        /* --- MINIMIZED: FLOATING CAPSULE --- */
        <motion.div
          key="minimized"
          initial={{ y: 100, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: 100, opacity: 0, x: '-50%' }}
          className="fixed bottom-28 left-1/2 z-[70] w-full max-w-[90%] sm:max-w-md pointer-events-auto"
        >
          <div className="w-full glass rounded-full p-2 pl-3 shadow-2xl flex items-center justify-between gap-3 border border-white/10">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={onMinimizeToggle}
                className="p-1.5 rounded-full hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
              >
                <ChevronUp size={16} />
              </button>

              <button
                onClick={handleToggleRecord}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse' : 'bg-red-600 hover:scale-105'}`}
              >
                {isRecording ? <div className="w-3 h-3 bg-white rounded-sm" /> : <div className="w-3 h-3 bg-white rounded-full" />}
              </button>

              <div className="flex-1 h-8 bg-black/20 rounded-md relative overflow-hidden border border-white/5">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-pointer touch-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCanvasInteraction(e);
                  }}
                />
              </div>

              <div className="text-[10px] mono tabular-nums text-[var(--text-secondary)] w-10 text-right">
                {formatTime(isRecording ? duration : (progress * duration))}
              </div>
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              {recordedBlob && !isRecording && (
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 rounded-full hover:bg-white/10 text-[var(--text-main)]"
                >
                  {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                </button>
              )}

              {recordedBlob ? (
                <button onClick={handleSave} className="w-8 h-8 rounded-full bg-[var(--text-main)] text-[var(--bg-main)] flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                  <Check size={14} strokeWidth={3} />
                </button>
              ) : (
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 text-[var(--text-secondary)] flex items-center justify-center hover:bg-white/10">
                  <X size={14} />
                </button>
              )}
            </div>
            <audio ref={audioRef} className="hidden" />
          </div>
        </motion.div>
      ) : (
        /* --- FULL MODE: STUDIO SHEET --- */
        <motion.div
          key="full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col justify-end"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-lg mx-auto bg-[var(--bg-card)] rounded-t-[2.5rem] border-t border-white/10 p-6 pb-12 text-[var(--text-main)] shadow-[0_-20px_60px_rgba(0,0,0,0.8)] flex flex-col items-center relative overflow-hidden"
          >
            {showFx && (
              <FXPanel
                onClose={() => setShowFx(false)}
                settings={fxSettings}
                onUpdate={handleUpdateFx}
              />
            )}

            <audio ref={audioRef} className="hidden" />
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleImportFile} />

            {/* Drag Handle */}
            <div className="w-12 h-1 bg-white/10 rounded-full mb-6 cursor-pointer" onClick={onMinimizeToggle} />

            {/* --- Top Bar --- */}
            <div className="w-full flex items-center justify-between mb-8">
              <button
                onClick={onMinimizeToggle}
                className="p-2 hover:bg-white/5 rounded-full text-[var(--text-secondary)] transition-colors"
              >
                <ChevronDown size={20} />
              </button>

              <div className="flex bg-white/5 p-1 rounded-full border border-white/5">
                {takes.map(take => (
                  <button
                    key={take}
                    onClick={() => setActiveTakeTab(take)}
                    className={`px-4 py-1.5 rounded-full text-[10px] mono font-bold transition-all ${activeTakeTab === take
                      ? 'bg-[var(--text-main)] text-[var(--bg-main)] shadow-sm'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                      }`}
                  >
                    {take}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDiscard}
                className={`p-2 rounded-full transition-colors ${recordedBlob ? 'text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10' : 'text-white/10'}`}
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* --- Waveform --- */}
            <div className="w-full mb-10 px-2 h-24 bg-black/20 rounded-2xl border border-white/5 relative overflow-hidden shadow-inner">
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-pointer touch-none"
                onMouseDown={(e) => {
                  isDraggingRef.current = true;
                  handleCanvasInteraction(e);
                }}
                onMouseMove={(e) => {
                  if (isDraggingRef.current) handleCanvasInteraction(e);
                }}
                onMouseUp={() => isDraggingRef.current = false}
                onMouseLeave={() => isDraggingRef.current = false}
                onTouchStart={(e) => {
                  isDraggingRef.current = true;
                  handleCanvasInteraction(e);
                }}
                onTouchMove={(e) => {
                  if (isDraggingRef.current) handleCanvasInteraction(e);
                }}
                onTouchEnd={() => isDraggingRef.current = false}
              />
            </div>

            {/* --- Grid Controls --- */}
            <div className="w-full grid grid-cols-3 items-center mb-10 px-2">
              <button
                disabled={isRecording}
                onClick={() => fileInputRef.current?.click()}
                className="justify-self-start flex items-center gap-2 px-5 py-3 bg-white/5 rounded-2xl text-[10px] mono uppercase tracking-widest border border-white/5 hover:border-white/10 transition-all text-[var(--text-secondary)] hover:text-[var(--text-main)]"
              >
                <Timer size={14} />
                <span>In</span>
              </button>

              <div className="justify-self-center relative">
                {isRecording && (
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                )}
                <button
                  onClick={handleToggleRecord}
                  className={`w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all shadow-2xl relative z-10 ${isRecording
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-white/10 bg-white/5 hover:scale-105'
                    }`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-inner transition-colors duration-300 ${isRecording ? 'bg-red-900/40' : 'bg-[var(--bg-main)]'}`}>
                    {isRecording ? (
                      <div className="w-6 h-6 rounded-sm bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)]" />
                    )}
                  </div>
                </button>
              </div>

              <button
                onClick={() => setMetronomeActive(!metronomeActive)}
                className={`justify-self-end flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] mono uppercase tracking-widest border transition-all ${metronomeActive
                  ? 'bg-[var(--accent)] text-[var(--bg-main)] border-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]'
                  : 'bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-white/10'
                  }`}
              >
                <Clock size={14} />
                <span>Click</span>
              </button>
            </div>

            {/* --- Bottom Row --- */}
            <div className="w-full flex items-center justify-between px-2">
              <button
                onClick={onClose}
                className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/5 text-[var(--text-secondary)] hover:text-[var(--text-main)]"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-8">
                  <button
                    onClick={() => setShowFx(true)}
                    className={`p-2 transition-colors ${showFx ? 'text-[var(--accent)]' : 'text-white/20 hover:text-white/60'}`}
                  >
                    <Settings2 size={22} strokeWidth={1.5} />
                  </button>

                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    disabled={!recordedBlob || isRecording}
                    className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center hover:bg-[var(--text-main)] hover:text-[var(--bg-main)] disabled:opacity-20 transition-all border border-white/5 shadow-xl"
                  >
                    {isPlaying ?
                      <Pause size={28} fill="currentColor" strokeWidth={0} /> :
                      <Play size={28} fill="currentColor" strokeWidth={0} className="ml-1" />
                    }
                  </button>

                  <div className={`p-2 transition-opacity ${backingTrackSrc ? 'text-[var(--accent)]' : 'text-white/5'}`}>
                    <Music size={22} strokeWidth={1.5} />
                  </div>
                </div>

                <div className="flex items-baseline font-mono tracking-tight">
                  <span className="text-base font-bold text-[var(--text-main)]">
                    {formatTime(progress * duration)}
                  </span>
                  <span className="text-[11px] text-[var(--text-tertiary)] ml-1.5 opacity-60">
                    / {formatTime(duration)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={!recordedBlob}
                className="w-12 h-12 rounded-2xl bg-[var(--text-main)] text-[var(--bg-main)] flex items-center justify-center hover:opacity-90 disabled:opacity-20 transition-all shadow-xl"
              >
                <Check size={20} strokeWidth={3} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
