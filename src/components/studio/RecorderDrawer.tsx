import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Check,
  X,
  MessageSquare,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from "@/components/ui/slider";
import { RecordingLayer } from '@/types';
import { formatTime } from '@/lib/utils/time';

interface RecorderDrawerProps {
  onClose: () => void;
  onSave: (blob: Blob, duration: number, beatOffset?: number, isLayer?: boolean) => void;
  projectName?: string;
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
  projectName,
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
  const [audioCtxReady, setAudioCtxReady] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  // Refs for logic
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordingStartOffsetRef = useRef<number>(0);
  const loopPassCountRef = useRef<number>(0);

  // Save-during-recording: flag + captured duration
  const pendingSaveRef = useRef(false);
  const savedDurationRef = useRef(0);

  // Speech recognition ref
  const speechRef = useRef<any>(null);

  // Layer playback refs
  const parentAudioRef = useRef<HTMLAudioElement | null>(null);
  const layerAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

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
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>([]);
  const isDraggingRef = useRef(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  // Ref to track state inside animation loop without stale closures
  const visualizerProgressRef = useRef(0);
  visualizerProgressRef.current = progress;
  const isRecordingRef = useRef(false);
  isRecordingRef.current = isRecording;

  const stopMicStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  audioContextRef.current = audioContext;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (backingAudioRef?.current) {
        backingAudioRef.current.volume = 1.0;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      stopMicStream();
      stopSpeechRecognition();
    };
  }, []);

  // Auto-start recording when opened via nav button
  useEffect(() => {
    if (autoStart) {
      startRecording();
    } else {
      initializeMic().catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Auto-scroll transcription to bottom
  useEffect(() => {
    if (showTranscription && transcriptBottomRef.current) {
      transcriptBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [finalTranscript, interimTranscript, showTranscription]);

  // --- Visualizer & Canvas Logic ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const accentColor = '#EF4444'; // always red for recording feel
    const textColor = 'rgba(255,255,255,0.8)';
    const recordingColor = '#EF4444';

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const centerY = height / 2;
      const currentProgress = visualizerProgressRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      if (recordedBlob) {
        const peaks = peaksRef.current;
        const barWidth = 3;
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

          const barHeight = Math.max(2, val * height * 1.5);
          const x = i * (barWidth + gap);
          const progressX = currentProgress * width;

          ctx.globalAlpha = x < progressX ? 1.0 : 0.3;
          ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
        }
        ctx.globalAlpha = 1.0;

        const px = currentProgress * width;
        ctx.beginPath();
        ctx.strokeStyle = textColor;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.beginPath();
        ctx.arc(px, height - 4, 3, 0, Math.PI * 2);
        ctx.fill();

      } else if (isRecordingRef.current && analyserRef.current && dataArrayRef.current) {
        // Live waveform during recording
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const binCount = analyserRef.current.frequencyBinCount;
        const barWidth = 3;
        const gap = 1;
        const totalBars = Math.floor(width / (barWidth + gap));
        const step = Math.ceil(binCount / totalBars);

        ctx.fillStyle = recordingColor;
        for (let i = 0; i < totalBars; i++) {
          let val = 0;
          for (let j = 0; j < step && (i * step + j) < binCount; j++) {
            val = Math.max(val, dataArrayRef.current[i * step + j]);
          }
          const normalized = val / 255;
          const barHeight = Math.max(3, normalized * height * 1.4);
          const x = i * (barWidth + gap);
          ctx.globalAlpha = 0.6 + normalized * 0.4;
          ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
        }
        ctx.globalAlpha = 1.0;

      } else {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
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
  }, [isRecording, recordedBlob]);

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

  const getBeatPosition = (recordingTime: number, startOffset: number): number => {
    if (!isLooping || loopStart === null || loopEnd === null) {
      return recordingTime + startOffset;
    }

    const loopDuration = loopEnd - loopStart;
    if (loopDuration <= 0) return recordingTime + startOffset;

    const totalBeatTime = recordingTime + startOffset;

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
      if (audio.paused) {
        audio.play().catch(() => setIsPlaying(false));
      }

      if (backingAudio && backingTrackSrc && backingAudio.paused) {
        const compensatedStartOffset = Math.max(0, recordingStartOffsetRef.current - (latencyCompensation / 1000));
        const beatPos = getBeatPosition(audio.currentTime, compensatedStartOffset);
        backingAudio.currentTime = beatPos;
        backingAudio.volume = 0.55;
        onResumeBeatAudio?.();
        backingAudio.play().catch(console.error);
      }
    } else {
      if (!audio.paused) audio.pause();
      if (backingAudio && recordedBlob && !backingAudio.paused) {
        backingAudio.pause();
        backingAudio.volume = 1.0;
      }
    }

    const handleTimeUpdate = () => {
      if (!backingAudio || !isPlaying || !isLooping) return;
      if (loopStart === null || loopEnd === null) return;

      const compensatedStartOffset = Math.max(0, recordingStartOffsetRef.current - (latencyCompensation / 1000));
      const expectedBeatPos = getBeatPosition(audio.currentTime, compensatedStartOffset);

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

  const startLayerPlayback = () => {
    if (!layerMode) return;

    if (parentAudioRef.current && parentAudioUrl) {
      parentAudioRef.current.currentTime = 0;
      parentAudioRef.current.play().catch(console.error);
    }

    existingLayers.forEach((layer) => {
      const audio = layerAudioRefs.current.get(layer.id);
      if (audio && !layer.isMuted && audio.paused) {
        audio.currentTime = 0;
        audio.volume = layer.gain ?? 1;
        audio.play().catch(console.error);
      }
    });
  };

  const stopLayerPlayback = () => {
    if (parentAudioRef.current) {
      parentAudioRef.current.pause();
      parentAudioRef.current.currentTime = 0;
    }
    layerAudioRefs.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
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
      analyser.fftSize = 512;
      source.connect(analyser);

      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

      const merger = audioCtx.createChannelMerger(2);
      analyser.connect(merger, 0, 0);
      analyser.connect(merger, 0, 1);

      const monitorGain = audioCtx.createGain();
      monitorGain.gain.value = 0.8;
      merger.connect(monitorGain);
      monitorGainRef.current = monitorGain;

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

  // --- Speech Recognition ---
  const startSpeechRecognition = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let newFinal = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newFinal += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (newFinal) setFinalTranscript(prev => prev + newFinal);
      setInterimTranscript(interim);
    };

    recognition.onerror = () => { /* silent */ };
    recognition.start();
    speechRef.current = recognition;
  };

  const stopSpeechRecognition = () => {
    try { speechRef.current?.stop(); } catch { /* ignore */ }
    speechRef.current = null;
    setInterimTranscript('');
  };

  const startRecording = async () => {
    try {
      const micResult = await initializeMic();

      if (!streamRef.current) return;
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

        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          onSave(blob, savedDurationRef.current, recordingStartOffsetRef.current, layerMode);
          onClose();
        }
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

      if (layerMode) {
        startLayerPlayback();
      }

      mediaRecorder.start();
      setIsRecording(true);
      setRecordedBlob(null);
      setProgress(0);
      setDuration(0);
      setFinalTranscript('');
      setInterimTranscript('');
      startTimeRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);

      startSpeechRecognition();

    } catch (err) {
      console.error("Start recording failed:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (layerMode) {
        stopLayerPlayback();
      }
      stopSpeechRecognition();
    }
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSave = () => {
    if (isRecording) {
      pendingSaveRef.current = true;
      savedDurationRef.current = duration;
      stopRecording();
    } else if (recordedBlob) {
      onSave(recordedBlob, duration, recordingStartOffsetRef.current, layerMode);
      onClose();
    }
  };

  const handleDiscard = () => {
    if (isRecording) {
      stopRecording();
    }
    setRecordedBlob(null);
    setDuration(0);
    setProgress(0);
    peaksRef.current = [];
    onClose();
  };

  const currentDisplayTime = isRecording
    ? duration
    : recordedBlob
      ? progress * duration
      : 0;

  const canSave = isRecording || !!recordedBlob;

  return (
    <>
      <audio ref={audioRef} className="hidden" preload="metadata" />

      {/* Hidden audio elements for layer overdub playback */}
      {layerMode && parentAudioUrl && (
        <audio ref={parentAudioRef} src={parentAudioUrl} className="hidden" preload="auto" />
      )}
      {layerMode && existingLayers.map((layer) => (
        <audio
          key={layer.id}
          ref={(el) => { if (el) layerAudioRefs.current.set(layer.id, el); }}
          src={layer.audioUrl}
          className="hidden"
          preload="auto"
        />
      ))}

      {/* ─── Peek bar — fixed bottom strip when minimized ─── */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            key="peek-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[120] bg-[var(--bg-secondary)]/95 backdrop-blur-xl border-t border-[var(--border-main)] rounded-t-[20px] cursor-pointer"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={onMinimizeToggle}
          >
            {/* Drag indicator */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 bg-[var(--text-tertiary)]/50 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 pb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full bg-red-500 ${isRecording ? 'animate-pulse' : 'opacity-50'}`} />
                <span className="text-[11px] font-semibold text-red-400 uppercase tracking-widest mono">
                  {isRecording ? 'Recording' : 'Paused'}
                </span>
              </div>

              <span className="text-base font-bold text-[var(--text-main)] mono tabular-nums">
                {formatTime(currentDisplayTime)}
              </span>

              <div className="flex items-center gap-1 text-[var(--text-secondary)] text-xs">
                <ChevronUp size={14} />
                <span>Swipe up</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Full-screen overlay ─── */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            key="recording-overlay"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 150) {
                onMinimizeToggle?.();
              }
            }}
            className="fixed inset-0 z-[110] bg-[var(--bg-main)] flex flex-col select-none"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-[var(--border-main)]" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-2 pb-4 flex-shrink-0">
              <div>
                <h2 className="text-[17px] font-semibold text-[var(--text-main)] leading-tight">
                  {projectName || 'New Recording'}
                </h2>
                <p className="text-[12px] text-[var(--text-secondary)] mono mt-0.5">
                  {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {recordedBlob && !isRecording && (
                    <span className="ml-1.5">· {formatTime(duration)}</span>
                  )}
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={!canSave}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-bold transition-all active:scale-95 cursor-pointer ${
                  canSave
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'text-[var(--text-tertiary)] cursor-not-allowed'
                }`}
              >
                <Check size={15} strokeWidth={3} />
                Done
              </button>
            </div>

            {/* Content — Waveform or Transcription */}
            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {showTranscription ? (
                  <motion.div
                    key="transcript-view"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 overflow-y-auto px-6 pt-4 pb-2"
                  >
                    {finalTranscript || interimTranscript ? (
                      <p className="text-[22px] font-light text-[var(--text-main)] leading-relaxed tracking-wide">
                        <span className="opacity-100">{finalTranscript}</span>
                        <span className="opacity-40">{interimTranscript}</span>
                      </p>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-[var(--text-secondary)] text-sm text-center leading-relaxed">
                          {isRecording
                            ? 'Listening for your voice…\nStart rapping or speaking'
                            : 'Start recording to see live transcription'}
                        </p>
                      </div>
                    )}
                    <div ref={transcriptBottomRef} className="h-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="waveform-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0"
                  >
                    <div ref={timelineRef} className="w-full h-full relative">
                      <canvas ref={canvasRef} className="w-full h-full" />
                    </div>

                    {/* Playback scrubber — only after recorded */}
                    {recordedBlob && !isRecording && (
                      <div className="absolute bottom-4 left-6 right-6">
                        <Slider
                          max={1}
                          step={0.01}
                          value={[progress]}
                          onValueChange={(val) => {
                            setProgress(val[0]);
                            if (audioRef.current) audioRef.current.currentTime = val[0] * duration;
                          }}
                          className="h-6"
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Timer pill */}
            <div className="flex justify-center py-5 flex-shrink-0">
              <div className="bg-[var(--bg-card)] border border-[var(--border-main)] backdrop-blur-sm rounded-full px-6 py-3 flex items-center gap-3">
                {isRecording && (
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
                <span className="text-[var(--text-main)] text-[26px] font-bold mono tabular-nums leading-none">
                  {formatTime(currentDisplayTime)}
                </span>
                {/* Playback button inside timer when post-recorded */}
                {recordedBlob && !isRecording && (
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="ml-1 w-8 h-8 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--border-main)] flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                  >
                    {isPlaying
                      ? <Pause size={14} fill="currentColor" className="text-[var(--text-main)]" />
                      : <Play size={14} fill="currentColor" className="text-[var(--text-main)] ml-0.5" />
                    }
                  </button>
                )}
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="px-10 pb-8 flex items-center justify-between flex-shrink-0">
              {/* Left: Transcription toggle */}
              <button
                onClick={() => setShowTranscription(!showTranscription)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                  showTranscription
                    ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                    : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'
                }`}
                aria-label="Toggle live transcription"
              >
                <MessageSquare size={22} />
              </button>

              {/* Center: Record / Stop */}
              <div className="relative">
                {isRecording && (
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping scale-125 pointer-events-none" />
                )}
                <button
                  onClick={handleToggleRecord}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-2xl ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-400'
                      : 'bg-red-600 hover:bg-red-500'
                  }`}
                  aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  {isRecording ? (
                    <div className="w-7 h-7 bg-white rounded-[5px]" />
                  ) : (
                    <div className="w-8 h-8 bg-white rounded-full" />
                  )}
                </button>
              </div>

              {/* Right: Discard */}
              <button
                onClick={handleDiscard}
                className="w-14 h-14 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-main)] flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                aria-label="Discard recording"
              >
                <X size={22} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
