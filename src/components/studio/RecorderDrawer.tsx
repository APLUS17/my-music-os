import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Check,
  Trash2,
  X,
  Timer,
  ChevronDown,
  ChevronUp,
  Headphones
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

interface RecorderDrawerProps {
  onClose: () => void;
  onSave: (blob: Blob, duration: number, beatOffset?: number) => void;
  backingTrackSrc?: string | null;
  backingAudioRef?: React.RefObject<HTMLAudioElement | null>;
  isMinimized?: boolean;
  onMinimizeToggle?: () => void;
  autoStart?: boolean;
}

export const RecorderDrawer: React.FC<RecorderDrawerProps> = ({
  onClose,
  onSave,
  backingTrackSrc,
  backingAudioRef,
  isMinimized = false,
  onMinimizeToggle,
  autoStart = false
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [micSource, setMicSource] = useState<MediaStreamAudioSourceNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (backingAudioRef?.current && isPlaying) {
        backingAudioRef.current.pause();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stopMicStream();
    };
  }, []);

  // Auto-start recording when opened via nav button
  useEffect(() => {
    if (autoStart) {
      startRecording();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

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

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
        if (backingAudioRef?.current && backingTrackSrc) {
          backingAudioRef.current.currentTime = audioRef.current.currentTime + recordingStartOffsetRef.current;
          backingAudioRef.current.play().catch(console.error);
        }
      } else {
        audioRef.current.pause();
        // Only pause the backing beat when reviewing a recording (not on initial mount or during recording)
        if (backingAudioRef?.current && recordedBlob) {
          backingAudioRef.current.pause();
        }
      }
    }
  }, [isPlaying, backingTrackSrc, recordedBlob]);

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

  const initializeMic = async () => {
    if (streamRef.current && audioContext) return;

    try {
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

      setAudioCtxReady(true);
      return { stream, audioCtx, source, monitorGain };
    } catch (err) {
      console.error("Error accessing microphone:", err);
      throw err;
    }
  };

  const startRecording = async () => {
    try {
      const micResult = await initializeMic();

      if (!streamRef.current) return;
      // audioContext state may not have updated yet (React async), so fall back to the returned value
      const activeCtx = audioContext ?? micResult?.audioCtx;
      if (!activeCtx) return;

      const mediaRecorder = new MediaRecorder(streamRef.current);
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
        backingAudio.volume = 1.0;
        backingAudio.play().catch(console.error);
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
      console.error("Start recording failed:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      // Release mic immediately if not monitoring — kills the browser mic indicator
      if (!isMonitoring) stopMicStream();
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
      onSave(recordedBlob, duration, recordingStartOffsetRef.current);
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
                    <div className="text-[10px] mono text-[var(--text-secondary)] uppercase tracking-widest opacity-50">
                      {isRecording ? "Recording..." : "Ready"}
                    </div>
                  </div>
                )}

                <div className="text-[10px] mono tabular-nums text-[var(--text-secondary)] w-10 text-right">
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
          className="p-0 border-t border-white/10 bg-[var(--bg-card)] rounded-t-[2.5rem] overflow-hidden sm:max-w-xl mx-auto max-h-[85vh] flex flex-col"
        >
          <SheetHeader className="hidden">
            <SheetTitle>Recorder</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className={`p-6 pb-8 flex flex-col items-center gap-6 transition-all duration-700 ${isRecording ? 'shadow-[0_0_80px_rgba(220,38,38,0.2)]' : ''}`}>

              <div className="w-12 h-1.5 bg-white/10 rounded-full cursor-pointer hover:bg-white/20 transition-colors" onClick={onMinimizeToggle} />

              <div className="w-full flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={onMinimizeToggle} className="text-[var(--text-secondary)] hover:text-[var(--text-main)]">
                  <ChevronDown size={22} />
                </Button>
                {(recordedBlob || isRecording) && (
                  <Button variant="ghost" size="icon" onClick={handleDiscard} className="text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 size={20} />
                  </Button>
                )}
              </div>

              <div className={`w-full px-2 transition-opacity duration-300 ${recordedBlob ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <Slider
                  disabled={isRecording || !recordedBlob}
                  max={1}
                  step={0.01}
                  value={[progress]}
                  onValueChange={(val) => {
                    setProgress(val[0]);
                    if (audioRef.current) audioRef.current.currentTime = val[0] * duration;
                  }}
                  className="h-10"
                />
              </div>

              <div className="w-full grid grid-cols-3 items-center">
                <div className="justify-self-start">
                  {(recordedBlob && !isRecording) ? (
                    <Button variant="default" size="sm" onClick={handleSave} className="rounded-xl text-[10px] mono uppercase tracking-widest gap-2 h-10 bg-[var(--text-main)] text-[var(--bg-main)] hover:bg-[var(--text-main)]/90 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                      <Check size={14} strokeWidth={3} />
                      <span className="font-bold">Keep</span>
                    </Button>
                  ) : null}
                </div>

                <div className="justify-self-center relative">
                  {isRecording && <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />}
                  <Button
                    onClick={handleToggleRecord}
                    className={`w-20 h-20 rounded-full border-2 p-0 flex items-center justify-center transition-all ${isRecording ? 'border-red-500/50 bg-red-500/10 scale-110' : 'border-white/10 bg-white/5 hover:border-red-500/30'}`}
                  >
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300 ${isRecording ? 'bg-red-900/40' : 'bg-[var(--bg-main)]'}`}>
                      {isRecording ? (
                        <div className="w-6 h-6 rounded-sm bg-red-500 shadow-[0_0_25px_rgba(239,68,68,0.7)]" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]" />
                      )}
                    </div>
                  </Button>
                </div>

                <div className="justify-self-end">
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      variant={isMonitoring ? "default" : "outline"}
                      size="sm"
                      className={`rounded-xl text-[10px] mono uppercase tracking-widest h-10 px-4 transition-all ${isMonitoring ? 'bg-[var(--accent)] text-black' : 'border-white/10 hover:bg-white/5'}`}
                      onClick={async () => {
                        if (!isMonitoring) {
                          if (!streamRef.current) await initializeMic();
                          setIsMonitoring(true);
                        } else {
                          setIsMonitoring(false);
                          // Release mic when monitoring off and not recording
                          if (!isRecording) stopMicStream();
                        }
                      }}
                    >
                      <Headphones size={14} className="mr-2" />
                      MONITOR
                    </Button>
                    {isMonitoring && (
                      <span className="text-[7px] mono text-red-500 font-bold animate-pulse pr-1 tracking-tighter">
                        HEADPHONES REQUIRED
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full flex flex-col gap-4 mt-0">
                <div className="h-28 bg-black/40 rounded-3xl relative overflow-hidden group border border-white/5 shadow-inner">
                  <canvas ref={canvasRef} className="w-full h-full cursor-pointer" />
                  <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[9px] mono text-white/40 border border-white/5">ANALYSER</div>
                </div>
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

              <div className="w-full flex gap-4 mt-4">
                <Button onClick={onClose} variant="ghost" className="flex-1 rounded-2xl py-7 font-bold text-[var(--text-secondary)] hover:text-white transition-colors uppercase tracking-widest text-xs">CANCEL</Button>
                <Button
                  disabled={!recordedBlob}
                  onClick={handleSave}
                  className="flex-1 rounded-2xl py-7 font-bold bg-white text-black hover:bg-[var(--accent)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-xs shadow-xl"
                >
                  KEEP TAKE
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
