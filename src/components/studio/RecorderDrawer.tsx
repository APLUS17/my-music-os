import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Check,
  Trash2,
  X,
  Timer,
  ChevronUp,
  Headphones,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpectralEQ } from './SpectralEQ';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RecordingLayer } from '@/types';

interface RecorderDrawerProps {
  onClose: () => void;
  onSave: (blob: Blob, duration: number, beatOffset?: number, isLayer?: boolean) => void;
  backingTrackSrc?: string | null;
  backingAudioRef?: React.RefObject<HTMLAudioElement | null>;
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
  autoStart?: boolean;
  latencyCompensation?: number;
  beatVolume?: number;
  loopStart?: number | null;
  loopEnd?: number | null;
  isLooping?: boolean;
  onResumeBeatAudio?: () => void;
  // Layer mode props
  layerMode?: boolean;
  existingLayers?: RecordingLayer[];
  parentAudioUrl?: string | null;
}

export const RecorderDrawer: React.FC<RecorderDrawerProps> = ({
  onClose,
  onSave,
  backingTrackSrc,
  backingAudioRef,
  isMinimized = false,
  onMinimizeToggle,
  autoStart = false,
  latencyCompensation = 0,
  beatVolume = 1,
  loopStart = null,
  loopEnd = null,
  isLooping = false,
  onResumeBeatAudio,
  layerMode = false,
  existingLayers = [],
  parentAudioUrl = null,
}) => {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);

  // UI States
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioCtxReady, setAudioCtxReady] = useState(false);

  // Refs for logic
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordingStartOffsetRef = useRef<number>(0);
  const loopPassCountRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Layer playback refs - for playing existing layers while recording new one
  const parentAudioRef = useRef<HTMLAudioElement | null>(null);
  const layerAudioRefs = useRef<HTMLAudioElement[]>([]);

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [micSource, setMicSource] = useState<MediaStreamAudioSourceNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const isInitializingMicRef = useRef(false);

  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>([]);
  const isDraggingRef = useRef(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineMinRef = useRef<HTMLDivElement>(null);

  // Ref to track state inside animation loop without stale closures
  const visualizerProgressRef = useRef(0);
  visualizerProgressRef.current = progress;

  const stopMicStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Track isPlaying in a ref for cleanup to avoid stale closures
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Keep audioContextRef in sync for cleanup
  audioContextRef.current = audioContext;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      // Use ref to get current value, avoiding stale closure
      if (backingAudioRef?.current && isPlayingRef.current) {
        backingAudioRef.current.pause();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Close AudioContext to prevent resource leak
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      stopMicStream();
    };
  }, []);

  // Auto-start recording when opened via nav button
  useEffect(() => {
    if (autoStart) {
      startRecording();
    } else if (!isMinimized) {
      // Traditional browser recording pattern: prompt for microphone
      // permissions and initialize as soon as the drawer opens
      initializeMic().catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, isMinimized]);

  // --- Visualizer & Canvas Logic ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const style = getComputedStyle(document.documentElement);
    const accentColor = style.getPropertyValue('--accent').trim() || '#ffffff';
    const textColor = style.getPropertyValue('--text-main').trim() || '#ffffff';
    const recordingColor = '#EF4444';

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const centerY = height / 2;
      const currentProgress = visualizerProgressRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = isMinimized ? 1.5 : 2;
      ctx.lineCap = 'round';

      if (recordedBlob) {
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

          if (x < progressX) {
            ctx.globalAlpha = 1.0;
          } else {
            ctx.globalAlpha = 0.3;
          }

          ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
        }
        ctx.globalAlpha = 1.0;

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
        ctx.beginPath();
        ctx.strokeStyle = `rgba(128, 128, 128, 0.3)`;
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

    setTimeout(resizeCanvas, 50);
    window.addEventListener('resize', resizeCanvas);
    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRecording, recordedBlob, isMinimized]);

  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (recordedBlob && audioRef.current) {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      const url = URL.createObjectURL(recordedBlob);
      audioUrlRef.current = url;
      audioRef.current.src = url;
      audioRef.current.load();

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

  // Helper to calculate beat position considering loops
  const getBeatPosition = (recordingTime: number, startOffset: number): number => {
    if (!isLooping || loopStart === null || loopEnd === null) {
      return recordingTime + startOffset;
    }

    const loopDuration = loopEnd - loopStart;
    if (loopDuration <= 0) return recordingTime + startOffset;

    // Calculate position within the loop
    const totalBeatTime = recordingTime + startOffset;

    // If we started within the loop, wrap around
    if (startOffset >= loopStart && startOffset < loopEnd) {
      const timeInLoop = (totalBeatTime - loopStart) % loopDuration;
      return loopStart + timeInLoop;
    }

    return totalBeatTime;
  };

  useEffect(() => {
    const audio = audioRef.current;
    const backingAudio = backingAudioRef?.current;

    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
      if (backingAudio && backingTrackSrc) {
        const compensatedStartOffset = Math.max(0, recordingStartOffsetRef.current - (latencyCompensation / 1000));
        const beatPos = getBeatPosition(audio.currentTime, compensatedStartOffset);
        backingAudio.currentTime = beatPos;
        onResumeBeatAudio?.();
        backingAudio.play().catch(console.error);
      }
    } else {
      audio.pause();
      // Only pause the backing beat when reviewing a recording (not on initial mount or during recording)
      if (backingAudio && recordedBlob) {
        backingAudio.pause();
      }
    }

    // Sync beat position during playback (handle loop wrapping)
    const handleTimeUpdate = () => {
      if (!backingAudio || !isPlaying || !isLooping) return;
      if (loopStart === null || loopEnd === null) return;

      const compensatedStartOffset = Math.max(0, recordingStartOffsetRef.current - (latencyCompensation / 1000));
      const expectedBeatPos = getBeatPosition(audio.currentTime, compensatedStartOffset);

      // If beat has drifted or needs to loop, correct it
      const drift = Math.abs(backingAudio.currentTime - expectedBeatPos);
      if (drift > 0.1 || backingAudio.currentTime >= loopEnd) {
        backingAudio.currentTime = expectedBeatPos;
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isPlaying, backingTrackSrc, recordedBlob, beatVolume, isLooping, loopStart, loopEnd, latencyCompensation]);

  // Handle live monitoring connection
  useEffect(() => {
    if (audioContext && monitorGainRef.current) {
      if (isMonitoring && streamRef.current) {
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        monitorGainRef.current.connect(audioContext.destination);
      } else {
        monitorGainRef.current.disconnect();
      }
    }
  }, [isMonitoring, isRecording, audioContext]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start playback of existing layers (parent + layers) for overdub recording
  const startLayerPlayback = () => {
    if (!layerMode) return;

    // Play parent audio (main take)
    if (parentAudioRef.current && parentAudioUrl) {
      parentAudioRef.current.currentTime = 0;
      parentAudioRef.current.play().catch(console.error);
    }

    // Play all unmuted existing layers
    layerAudioRefs.current.forEach((audio, idx) => {
      const layer = existingLayers[idx];
      if (audio && layer && !layer.isMuted) {
        audio.currentTime = 0;
        audio.volume = layer.gain ?? 1;
        audio.play().catch(console.error);
      }
    });
  };

  // Stop playback of all layers
  const stopLayerPlayback = () => {
    if (parentAudioRef.current) {
      parentAudioRef.current.pause();
      parentAudioRef.current.currentTime = 0;
    }
    layerAudioRefs.current.forEach(audio => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  };

  const initializeMic = async () => {
    if (streamRef.current && audioContext) return;
    if (isInitializingMicRef.current) return;

    try {
      isInitializingMicRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false, channelCount: 1 },
      });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      setAudioContext(audioCtx);

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      setMicSource(source);

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512; // Lower for cleaner bars
      source.connect(analyser);

      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      // Merge mono mic signal into both L+R channels for headphone monitoring
      const merger = audioCtx.createChannelMerger(2);
      analyser.connect(merger, 0, 0);
      analyser.connect(merger, 0, 1);

      const monitorGain = audioCtx.createGain();
      monitorGain.gain.value = 0.8;
      merger.connect(monitorGain);
      monitorGainRef.current = monitorGain;

      // Create a destination node for recording the merged stereo signal
      const destination = audioCtx.createMediaStreamDestination();
      merger.connect(destination);
      recordingStreamRef.current = destination.stream;

      setAudioCtxReady(true);
      return { stream, audioCtx, source, monitorGain, recordingStream: destination.stream };
    } catch (err) {
      console.error("Error accessing microphone:", err);
      throw err;
    } finally {
      isInitializingMicRef.current = false;
    }
  };

  const startRecording = async () => {
    try {
      const micResult = await initializeMic();

      if (!streamRef.current) return;
      // audioContext state may not have updated yet (React async), so fall back to the returned value
      const activeCtx = audioContext ?? micResult?.audioCtx;
      if (!activeCtx) return;

      const streamToRecord = recordingStreamRef.current ?? micResult?.recordingStream;
      if (!streamToRecord) return;

      const mediaRecorder = new MediaRecorder(streamToRecord);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      peaksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setRecordedBlob(blob);
        // Don't stop the stream here if we might still want to monitor
        // Mic cleanup will happen on onClose or explicit discard
      };

      if (backingAudioRef?.current && backingTrackSrc) {
        const backingAudio = backingAudioRef.current;
        recordingStartOffsetRef.current = backingAudio.currentTime;
        loopPassCountRef.current = 0;
        onResumeBeatAudio?.();
        backingAudio.play().catch(console.error);
      } else {
        recordingStartOffsetRef.current = 0;
        loopPassCountRef.current = 0;
      }

      // Start layer playback if in layer mode (overdubbing)
      if (layerMode) {
        startLayerPlayback();
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
      console.error("Start recording failed:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      // Stop layer playback if in layer mode
      if (layerMode) {
        stopLayerPlayback();
      }
      // Keep mic active for SpectralEQ unless the user discards or closes drawer
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

  const handleSave = () => {
    if (recordedBlob) {
      onSave(recordedBlob, duration, recordingStartOffsetRef.current, layerMode);
      onClose();
    }
  };

  const handleDiscard = () => {
    if (recordedBlob) {
      if (confirm("Delete this recording?")) {
        setRecordedBlob(null);
        setDuration(0);
        setProgress(0);
        peaksRef.current = [];
      }
    } else {
      onClose();
    }
  };

  return (
    <>
      <audio ref={audioRef} className="hidden" preload="metadata" />

      {/* Hidden audio elements for layer playback during overdub recording */}
      {layerMode && parentAudioUrl && (
        <audio ref={parentAudioRef} src={parentAudioUrl} className="hidden" preload="auto" />
      )}
      {layerMode && existingLayers.map((layer, idx) => (
        <audio
          key={layer.id}
          ref={(el) => { if (el) layerAudioRefs.current[idx] = el; }}
          src={layer.audioUrl}
          className="hidden"
          preload="auto"
        />
      ))}

      <AnimatePresence>
        {isMinimized && (
          <motion.div
            key="minimized"
            initial={{ y: 100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, x: '-50%' }}
            className="fixed bottom-28 left-1/2 z-[70] w-full max-w-[90%] sm:max-w-md"
          >
            <div className="w-full glass rounded-full p-2 pl-3 shadow-2xl flex items-center justify-between gap-3 border border-white/10">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button onClick={onMinimizeToggle} className="p-1.5 rounded-full hover:bg-white/10 text-[var(--text-secondary)] transition-colors">
                  <ChevronUp size={16} />
                </button>

                <button
                  onClick={handleToggleRecord}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-red-600'}`}
                >
                  {isRecording ? <div className="w-4 h-4 bg-white rounded-sm" /> : <div className="w-4 h-4 bg-white rounded-full" />}
                </button>

                {recordedBlob ? (
                  <div className="flex-1 h-8 bg-black/20 rounded-md relative flex items-center px-2">
                    <Slider
                      disabled={isRecording}
                      max={1}
                      step={0.01}
                      value={[progress]}
                      onValueChange={(val) => {
                        setProgress(val[0]);
                        if (audioRef.current) audioRef.current.currentTime = val[0] * duration;
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex-1 h-8 rounded-md relative flex items-center justify-center px-2">
                    <div className="text-xs mono text-[var(--text-secondary)] uppercase tracking-wide opacity-50">
                      {isRecording ? "Recording..." : "Ready"}
                    </div>
                  </div>
                )}

                <div className="text-xs mono tabular-nums text-[var(--text-secondary)] w-10 text-right">
                  {formatTime(isRecording ? duration : (progress * duration))}
                </div>
              </div>

              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                {recordedBlob && !isRecording && (
                  <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 rounded-full hover:bg-white/10 text-[var(--text-main)]">
                    {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                  </button>
                )}
                {recordedBlob ? (
                  <button onClick={handleSave} className="w-10 h-10 rounded-full bg-[var(--text-main)] text-[var(--bg-main)] flex items-center justify-center shadow-lg transition-transform hover:scale-105">
                    <Check size={16} strokeWidth={3} />
                  </button>
                ) : (
                  <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 text-[var(--text-secondary)] flex items-center justify-center hover:bg-white/10">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={!isMinimized} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent
          side="bottom"
          className="p-0 border-t border-[var(--border-main)] bg-[var(--bg-card)] rounded-t-[2.5rem] overflow-hidden sm:max-w-xl mx-auto max-h-[80vh] flex flex-col"
        >
          <SheetHeader className="hidden">
            <SheetTitle>Recorder</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className={`px-4 pt-2 pb-4 flex flex-col items-center gap-2 transition-all duration-700 ${isRecording ? 'shadow-[0_0_80px_rgba(220,38,38,0.15)]' : ''}`}>

              {/* Layer mode indicator */}
              {layerMode && (
                <div className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl mb-1">
                  <Layers size={14} className="text-[var(--accent)]" />
                  <span className="text-xs font-medium text-[var(--accent)]">
                    Recording Layer {(existingLayers?.length || 0) + 2}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    ({existingLayers.length + 1} playing)
                  </span>
                </div>
              )}

              {/* Drag handle */}
              <div className="w-10 h-1 bg-white/20 rounded-full cursor-pointer hover:bg-white/30 transition-colors" onClick={onMinimizeToggle} />

              {/* Spectral EQ visualizer - prominent placement */}
              <div className="w-full bg-[var(--bg-secondary)] rounded-2xl relative overflow-hidden border border-[var(--border-main)] shadow-inner p-3 mt-1">
                <SpectralEQ
                  analyserRef={analyserRef}
                  dataArrayRef={dataArrayRef}
                  audioContext={audioContext}
                  externalSource={(isRecording || isMonitoring) ? micSource : null}
                  audioRef={audioRef}
                  destinationNode={monitorGainRef.current}
                  isActive={true}
                />
              </div>

              {/* Progress slider (only visible when recorded) */}
              <div className={`w-full px-2 transition-all duration-300 ${recordedBlob && !isRecording ? 'opacity-100 h-8' : 'opacity-0 h-0 overflow-hidden'}`}>
                <Slider
                  disabled={isRecording || !recordedBlob}
                  max={1}
                  step={0.01}
                  value={[progress]}
                  onValueChange={(val) => {
                    setProgress(val[0]);
                    if (audioRef.current) audioRef.current.currentTime = val[0] * duration;
                  }}
                  className="h-8"
                />
              </div>

              {/* Controls row - Monitor, Record, Play/Trash */}
              <div className="w-full flex items-center justify-between px-2 py-1">
                {/* Left - Monitor */}
                <div className="flex flex-col items-center gap-0.5 w-16">
                  <Button
                    variant={isMonitoring ? "default" : "ghost"}
                    size="icon"
                    className={`rounded-full h-11 w-11 transition-all ${isMonitoring ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-white/5'}`}
                    onClick={async () => {
                      if (!isMonitoring) {
                        if (!streamRef.current) await initializeMic();
                        setIsMonitoring(true);
                      } else {
                        setIsMonitoring(false);
                        // Do NOT stop mic stream so the Spectral EQ stays active
                      }
                    }}
                  >
                    <Headphones size={18} />
                  </Button>
                  <span className={`text-[8px] mono uppercase tracking-wide ${isMonitoring ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                    Monitor
                  </span>
                  {isMonitoring && (
                    <span className="text-[7px] mono text-red-500 font-medium animate-pulse">
                      Headphones
                    </span>
                  )}
                </div>

                {/* Center - Record button with timer */}
                <div className="flex flex-col items-center gap-1">
                  <div className="relative">
                    {isRecording && <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />}
                    <Button
                      onClick={handleToggleRecord}
                      className={`w-16 h-16 rounded-full border-2 p-0 flex items-center justify-center transition-all ${isRecording ? 'border-red-500/50 bg-red-500/10 scale-105' : 'border-white/10 bg-white/5 hover:border-red-500/30'}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${isRecording ? 'bg-red-900/40' : 'bg-[var(--bg-main)]'}`}>
                        {isRecording ? (
                          <div className="w-5 h-5 rounded-sm bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)]" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                        )}
                      </div>
                    </Button>
                  </div>
                  <div className="text-sm mono tabular-nums text-[var(--text-main)] font-light">
                    {formatTime(isRecording ? duration : (recordedBlob ? progress * duration : 0))}
                  </div>
                </div>

                {/* Right - Play (when recorded) or Trash */}
                <div className="flex flex-col items-center gap-0.5 w-16">
                  {(recordedBlob && !isRecording) ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="rounded-full h-11 w-11 text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-white/5"
                      >
                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                      </Button>
                      <span className="text-[8px] mono uppercase tracking-wide text-[var(--text-muted)]">
                        {isPlaying ? 'Pause' : 'Play'}
                      </span>
                    </>
                  ) : (recordedBlob || isRecording) ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDiscard}
                        className="rounded-full h-11 w-11 text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 size={18} />
                      </Button>
                      <span className="text-[8px] mono uppercase tracking-wide text-[var(--text-muted)]">
                        Discard
                      </span>
                    </>
                  ) : (
                    <div className="h-11 w-11" />
                  )}
                </div>
              </div>

              {/* Bottom action buttons */}
              <div className="w-full flex gap-3 mt-1">
                <Button onClick={onClose} variant="ghost" className="flex-1 rounded-2xl py-4 font-bold text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors uppercase tracking-wide text-xs">CANCEL</Button>
                <Button
                  disabled={!recordedBlob}
                  onClick={handleSave}
                  className={`flex-1 rounded-2xl py-4 font-bold hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wide text-xs shadow-xl ${
                    layerMode
                      ? 'bg-[var(--accent)]/80 text-[var(--bg-main)]'
                      : 'bg-[var(--accent)] text-[var(--bg-main)]'
                  }`}
                >
                  {layerMode ? 'ADD LAYER' : 'KEEP TAKE'}
                </Button>
              </div>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const url = URL.createObjectURL(file);
              const tempAudio = new Audio(url);
              tempAudio.onloadedmetadata = () => {
                setDuration(tempAudio.duration);
                setRecordedBlob(file);
                peaksRef.current = Array.from({ length: 100 }, () => Math.random() * 0.5 + 0.1);
                if (audioRef.current) audioRef.current.src = url;
              };
            }
          }} />
        </SheetContent>
      </Sheet>
    </>
  );
};
