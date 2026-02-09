
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
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineMinRef = useRef<HTMLDivElement>(null);

  // Ref to track progress inside animation loop without stale closures
  const visualizerProgressRef = useRef(0);
  visualizerProgressRef.current = progress;

  visualizerProgressRef.current = progress;

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
          analyserRef.current.getByteTimeDomainData(dataArrayRef.current as Uint8Array<ArrayBuffer>);

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
          const peakIndex = i * step;
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
        // IDLE - "Alive" line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
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

  // Track audio URL to properly cleanup and reinitialize
  const audioUrlRef = useRef<string | null>(null);

  // Ensure audio src is set when blob exists
  useEffect(() => {
    if (recordedBlob && audioRef.current) {
      // Cleanup previous URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      const url = URL.createObjectURL(recordedBlob);
      audioUrlRef.current = url;
      audioRef.current.src = url;
      audioRef.current.load(); // Force reload

      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current && audioRef.current.duration !== Infinity && audioRef.current.duration > 0) {
          setDuration(audioRef.current.duration);
        }
      };
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setProgress(1);
      };
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current && audioRef.current.duration > 0 && !isDraggingRef.current) {
          setProgress(audioRef.current.currentTime / audioRef.current.duration);
        }
      };
    }

    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [recordedBlob]);

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

  // Global event handlers for smooth scrubbing across entire window
  useEffect(() => {
    const getActiveTimeline = () => {
      // Check which timeline is active based on visibility/mounting
      if (isMinimized && timelineMinRef.current) return timelineMinRef.current;
      if (!isMinimized && timelineRef.current) return timelineRef.current;
      return null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !recordedBlob || isRecording) return;

      const timeline = getActiveTimeline();
      if (!timeline) return;

      const rect = timeline.getBoundingClientRect();
      // Account for padding in minimized view
      const padding = isMinimized ? 8 : 0;
      const effectiveWidth = rect.width - (padding * 2);
      const x = e.clientX - rect.left - padding;
      const newProgress = Math.max(0, Math.min(1, x / effectiveWidth));

      // Update progress and audio position
      setProgress(newProgress);
      if (audioRef.current) {
        const d = duration || audioRef.current.duration || 1;
        const time = newProgress * d;
        if (Number.isFinite(time) && time >= 0) {
          audioRef.current.currentTime = time;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || !recordedBlob || isRecording || e.touches.length === 0) return;

      const timeline = getActiveTimeline();
      if (!timeline) return;

      const rect = timeline.getBoundingClientRect();
      const padding = isMinimized ? 8 : 0;
      const effectiveWidth = rect.width - (padding * 2);
      const x = e.touches[0].clientX - rect.left - padding;
      const newProgress = Math.max(0, Math.min(1, x / effectiveWidth));

      setProgress(newProgress);
      if (audioRef.current) {
        const d = duration || audioRef.current.duration || 1;
        const time = newProgress * d;
        if (Number.isFinite(time) && time >= 0) {
          audioRef.current.currentTime = time;
        }
      }
    };

    const handleEnd = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [recordedBlob, isRecording, duration, isMinimized]);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });

      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
        const backingAudio = backingAudioRef.current;
        recordingStartOffsetRef.current = backingAudio.currentTime;
        backingAudio.volume = 1.0;

        if (backingAudio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          backingAudio.play().catch(console.error);
        } else {
          backingAudio.addEventListener('canplay', () => {
            backingAudio.play().catch(console.error);
          }, { once: true });
        }
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
      const clampedVal = Math.max(0, Math.min(1, val));
      const d = duration || audioRef.current.duration || 1;
      const time = clampedVal * d;

      if (Number.isFinite(time) && time >= 0) {
        // Immediately update visual progress
        setProgress(clampedVal);

        // Update audio position
        audioRef.current.currentTime = time;

        // Sync backing track if present
        if (backingAudioRef?.current && backingTrackSrc) {
          backingAudioRef.current.currentTime = time + recordingStartOffsetRef.current;
        }
      }
    }
  };

  // Handle scrub end - resume playback if was playing
  const handleScrubEnd = () => {
    isDraggingRef.current = false;
  };

  const handleUpdateFx = (key: keyof FXSettings, value: number) => {
    setFxSettings(prev => ({ ...prev, [key]: value }));
  };

  // --- RENDER ---
  return (
    <>
      {/* Persistent audio element - outside AnimatePresence so it doesn't get unmounted */}
      <audio ref={audioRef} className="hidden" preload="metadata" />

      <AnimatePresence>
        {isMinimized ? (
          /* --- MINIMIZED: FLOATING CAPSULE --- */
          <motion.div
            key="minimized"
            initial={{ y: 100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, x: '-50%' }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
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

                <div
                  ref={timelineMinRef}
                  className="flex-1 h-8 bg-black/20 rounded-md relative overflow-hidden border border-white/5 flex items-center px-2 cursor-pointer"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (!isRecording && recordedBlob) {
                      isDraggingRef.current = true;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left - 8;
                      const newProgress = Math.max(0, Math.min(1, x / (rect.width - 16)));
                      handleScrub(newProgress);
                    }
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (!isRecording && recordedBlob) {
                      isDraggingRef.current = true;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.touches[0].clientX - rect.left - 8;
                      const newProgress = Math.max(0, Math.min(1, x / (rect.width - 16)));
                      handleScrub(newProgress);
                    }
                  }}
                >
                  <div className="w-full h-1.5 bg-white/10 rounded-full relative overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full ${isRecording ? 'bg-red-500' : 'bg-[var(--accent)]'}`}
                      style={{ width: `${(isRecording ? 1 : progress) * 100}%` }}
                    />
                    {!isRecording && recordedBlob && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--text-main)] rounded-full shadow-md -ml-1.5"
                        style={{ left: `${progress * 100}%` }}
                      />
                    )}
                    {isRecording && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </div>
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
            </div>
          </motion.div>
        ) : (
          /* --- FULL MODE: STUDIO SHEET --- */
          <motion.div
            key="full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-[2px] flex flex-col justify-end"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300,
                duration: 0.3
              }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg mx-auto bg-[var(--bg-card)] rounded-t-[2rem] border-t p-4 pb-8 text-[var(--text-main)] flex flex-col items-center relative overflow-hidden transition-all duration-700 ${isRecording
                ? 'shadow-[0_0_50px_rgba(220,38,38,0.4)] border-red-500/30'
                : 'shadow-[0_-20px_60px_rgba(0,0,0,0.8)] border-white/10'
                }`}
            >
              {showFx && (
                <FXPanel
                  onClose={() => setShowFx(false)}
                  settings={fxSettings}
                  onUpdate={handleUpdateFx}
                />
              )}

              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleImportFile} />

              {/* Drag Handle */}
              <div className="w-12 h-1 bg-white/10 rounded-full mb-4 cursor-pointer" onClick={onClose} />

              {/* --- Top Bar --- */}
              <div className="w-full flex items-center justify-between mb-4">
                <button
                  onClick={onMinimizeToggle}
                  className="p-1.5 hover:bg-white/5 rounded-full text-[var(--text-secondary)] transition-colors"
                >
                  <ChevronDown size={18} />
                </button>

                {(recordedBlob || isRecording) && (
                  <button
                    onClick={handleDiscard}
                    className="p-1.5 rounded-full transition-colors text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* --- Timeline Scrubber --- */}
              <div
                ref={timelineRef}
                className="w-full mb-6 px-2 h-12 flex items-center cursor-pointer"
                onMouseDown={(e) => {
                  if (!isRecording && recordedBlob) {
                    isDraggingRef.current = true;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const newProgress = Math.max(0, Math.min(1, x / rect.width));
                    handleScrub(newProgress);
                  }
                }}
                onTouchStart={(e) => {
                  if (!isRecording && recordedBlob) {
                    isDraggingRef.current = true;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.touches[0].clientX - rect.left;
                    const newProgress = Math.max(0, Math.min(1, x / rect.width));
                    handleScrub(newProgress);
                  }
                }}
              >
                <div className="w-full h-2 bg-white/10 rounded-full relative overflow-hidden">
                  {/* Progress fill */}
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full ${isRecording ? 'bg-red-500' : 'bg-[var(--accent)]'}`}
                    style={{ width: `${(isRecording ? 1 : progress) * 100}%` }}
                  />
                  {/* Playhead */}
                  {!isRecording && recordedBlob && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[var(--text-main)] rounded-full shadow-lg border-2 border-[var(--bg-card)] -ml-2 transition-none"
                      style={{ left: `${progress * 100}%` }}
                    />
                  )}
                  {/* Recording pulse indicator */}
                  {isRecording && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                  )}
                </div>
              </div>

              {/* --- Grid Controls --- */}
              <div className="w-full grid grid-cols-3 items-center mb-6 px-2">
                <button
                  disabled={isRecording}
                  onClick={() => fileInputRef.current?.click()}
                  className="justify-self-start flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl text-[10px] mono uppercase tracking-widest border border-white/5 hover:border-white/10 transition-all text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                >
                  <Timer size={12} />
                  <span>In</span>
                </button>

                <div className="justify-self-center relative">
                  {isRecording && (
                    <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                  )}
                  <button
                    onClick={handleToggleRecord}
                    className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all shadow-2xl relative z-10 ${isRecording
                      ? 'border-red-500/50 bg-red-500/10'
                      : 'border-white/10 bg-white/5 hover:scale-105'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner transition-colors duration-300 ${isRecording ? 'bg-red-900/40' : 'bg-[var(--bg-main)]'}`}>
                      {isRecording ? (
                        <div className="w-5 h-5 rounded-sm bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)]" />
                      )}
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => setMetronomeActive(!metronomeActive)}
                  className={`justify-self-end flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] mono uppercase tracking-widest border transition-all ${metronomeActive
                    ? 'bg-[var(--accent)] text-[var(--bg-main)] border-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]'
                    : 'bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-white/10'
                    }`}
                >
                  <Clock size={12} />
                  <span>Click</span>
                </button>
              </div>

              {/* --- Bottom Row --- */}
              <div className="w-full grid grid-cols-3 items-center px-2">
                <div className="justify-self-start">
                  {(recordedBlob) && (
                    <button
                      onClick={onClose}
                      className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all border border-white/5 text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                <div className="justify-self-center flex flex-col items-center gap-2">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setShowFx(true)}
                      className={`p-1.5 transition-colors ${showFx ? 'text-[var(--accent)]' : 'text-white/20 hover:text-white/60'}`}
                    >
                      <Settings2 size={18} strokeWidth={1.5} />
                    </button>

                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      disabled={!recordedBlob || isRecording}
                      className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center hover:bg-[var(--text-main)] hover:text-[var(--bg-main)] disabled:opacity-20 transition-all border border-white/5 shadow-xl"
                    >
                      {isPlaying ?
                        <Pause size={22} fill="currentColor" strokeWidth={0} /> :
                        <Play size={22} fill="currentColor" strokeWidth={0} className="ml-0.5" />
                      }
                    </button>
                  </div>

                  <div className="flex items-baseline font-mono tracking-tight">
                    <span className="text-sm font-bold text-[var(--text-main)]">
                      {formatTime(progress * duration)}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] ml-1 opacity-60">
                      / {formatTime(duration)}
                    </span>
                  </div>
                </div>

                <div className="justify-self-end">
                  {recordedBlob && (
                    <button
                      onClick={handleSave}
                      disabled={!recordedBlob}
                      className="w-10 h-10 rounded-xl bg-[var(--text-main)] text-[var(--bg-main)] flex items-center justify-center hover:opacity-90 disabled:opacity-20 transition-all shadow-xl"
                    >
                      <Check size={18} strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
