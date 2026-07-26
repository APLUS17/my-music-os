import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Check,
  X,
  MessageSquare,
  ChevronUp,
  Sliders,
  Radio,
  Waves,
  Mic,
  Activity,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Slider } from "@/components/ui/slider";
import { RecordingLayer } from '@/types';
import { formatTime } from '@/lib/utils/time';
import { FXSettings, defaultFXSettings } from './FXPanel';
import { createReverbImpulse } from '@/hooks/useVocalFX';
import { VOCAL_PRESETS } from '@/lib/audio/vocalPresets';
import { randomId } from '@/lib/utils/id';
import { putMuseChunk, putMuseManifest, deleteMuseChunks, deleteMuseManifest } from '@/lib/idb/studioDB';

import { Loader2 } from 'lucide-react';

interface RecorderDrawerProps {
  onClose: () => void;
  onSave: (blob: Blob, duration: number, beatOffset?: number, isLayer?: boolean, recordingId?: string, chunks?: Blob[]) => void;
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
  onPauseBeatAudio?: () => void;
  // Layer mode props
  layerMode?: boolean;
  existingLayers?: RecordingLayer[];
  parentAudioUrl?: string | null;
  isBeatLoading?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
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
  onPauseBeatAudio,
  layerMode = false,
  existingLayers = [],
  parentAudioUrl = null,
  isBeatLoading = false,
  onRecordingStateChange,
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

  // Vocal FX state
  const [showFXPanel, setShowFXPanel] = useState(false);
  const [fxSettings, setFxSettings] = useState<FXSettings>(defaultFXSettings);
  const [isFXActive, setIsFXActive] = useState(false);
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string>('dry');
  const [fxViewMode, setFxViewMode] = useState<'presets' | 'custom'>('presets');

  // Vocal FX Web Audio nodes refs
  const eqLowRef = useRef<BiquadFilterNode | null>(null);
  const eqMidRef = useRef<BiquadFilterNode | null>(null);
  const eqHighRef = useRef<BiquadFilterNode | null>(null);
  const compRef = useRef<DynamicsCompressorNode | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const delayDryRef = useRef<GainNode | null>(null);
  const delayWetRef = useRef<GainNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const reverbWetRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);

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
  // Discard-during-recording: mirrors pendingSaveRef so cleanup in onstop can
  // wait for the final chunk's write instead of racing it (see onstop below).
  const pendingDiscardRef = useRef(false);

  // Chunked-write reliability: id/sequence for the in-progress recording's
  // IndexedDB chunk backup (crash recovery), and the Screen Wake Lock sentinel.
  const recordingIdRef = useRef<string>('');
  const chunkSeqRef = useRef<number>(0);
  const chunkWritePromisesRef = useRef<Promise<void>[]>([]);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

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
  const dragStartXRef = useRef(0);
  const dragStartPercentRef = useRef(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  // Timeline-style live waveform history — each entry is a single peak snapshot
  const liveWaveHistoryRef = useRef<number[]>([]);
  const lastSampleTimeRef = useRef(0);

  // Ref to track state inside animation loop without stale closures
  const visualizerProgressRef = useRef(0);
  visualizerProgressRef.current = progress;
  const isRecordingRef = useRef(false);
  isRecordingRef.current = isRecording;
  // Pass live time into canvas without stale closure
  const displayTimeRef = useRef(0);

  const stopMicStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Storage quota preflight — refuse to start a take we likely can't persist,
  // and request durable storage so the browser is less likely to evict it.
  const checkStorageAndPersist = async (): Promise<boolean> => {
    if (typeof window !== 'undefined' && navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const freeBytes = (estimate.quota || 0) - (estimate.usage || 0);
        if (freeBytes < 100 * 1024 * 1024) {
          toast.error('Low on device storage — free up space before recording.');
          return false;
        }
      } catch (err) {
        console.warn('Storage estimate check failed:', err);
      }
    }
    if (typeof window !== 'undefined' && navigator.storage?.persist) {
      try {
        const persisted = await navigator.storage.persist();
        if (!persisted) {
          toast.warning("Storage isn't persisted — recordings may be cleared by the browser after a period of inactivity.", { id: 'storage-persist-warning' });
        }
      } catch { /* best-effort */ }
    }
    return true;
  };

  const requestWakeLock = async () => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        const sentinel = await (navigator as unknown as { wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
        wakeLockRef.current = sentinel;
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch { /* ignore */ }
      wakeLockRef.current = null;
    }
  };

  audioContextRef.current = audioContext;

  // Re-acquire the wake lock if the tab regains visibility mid-recording
  // (the OS releases it automatically when the tab is backgrounded).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isRecordingRef.current && document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before an accidental tab close while recording or mid-save.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecordingRef.current || pendingSaveRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (backingAudioRef?.current) {
        backingAudioRef.current.pause();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      stopMicStream();
      stopSpeechRecognition();
      releaseWakeLock();

      // Clear Vocal FX node refs
      eqLowRef.current = null;
      eqMidRef.current = null;
      eqHighRef.current = null;
      compRef.current = null;
      delayRef.current = null;
      delayDryRef.current = null;
      delayWetRef.current = null;
      convolverRef.current = null;
      reverbWetRef.current = null;
      masterGainRef.current = null;
      limiterRef.current = null;
    };
  }, []);

  // Synchronize Live Vocal FX settings with Web Audio Nodes
  useEffect(() => {
    if (!audioContext || !eqLowRef.current) return;

    try {
      if (isFXActive) {
        // Apply EQ settings
        if (eqLowRef.current) eqLowRef.current.gain.value = fxSettings.eqLow;
        if (eqMidRef.current) eqMidRef.current.gain.value = fxSettings.eqMid;
        if (eqHighRef.current) eqHighRef.current.gain.value = fxSettings.eqHigh;

        // Apply Punch (Compression)
        if (compRef.current) {
          const punchAmount = fxSettings.punch / 100;
          compRef.current.threshold.value = -50 * punchAmount;
          compRef.current.ratio.value = 1 + (19 * punchAmount);
        }

        // Apply Delay (Echo)
        if (delayWetRef.current) {
          delayWetRef.current.gain.value = (fxSettings.echo / 100) * 0.7;
        }

        // Apply Reverb (Space)
        if (reverbWetRef.current) {
          reverbWetRef.current.gain.value = (fxSettings.space / 100) * 1.0;
        }
      } else {
        // Flat/Bypass settings
        if (eqLowRef.current) eqLowRef.current.gain.value = 0;
        if (eqMidRef.current) eqMidRef.current.gain.value = 0;
        if (eqHighRef.current) eqHighRef.current.gain.value = 0;

        if (compRef.current) {
          compRef.current.threshold.value = 0;
          compRef.current.ratio.value = 1;
        }

        if (delayWetRef.current) delayWetRef.current.gain.value = 0;
        if (reverbWetRef.current) reverbWetRef.current.gain.value = 0;
      }
    } catch (err) {
      console.warn('Error updating recording Vocal FX nodes:', err);
    }
  }, [audioContext, isFXActive, fxSettings]);

  // Synchronize Live Monitoring toggle with monitor Gain node
  useEffect(() => {
    if (monitorGainRef.current) {
      monitorGainRef.current.gain.value = isMonitoringEnabled ? 0.8 : 0;
    }
  }, [isMonitoringEnabled]);

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
        const barWidth = 2;
        const gap = 1;
        const barStep = barWidth + gap;
        const playheadX = Math.floor(width / 2);
        const playheadOffset = currentProgress * peaks.length * barStep;

        ctx.fillStyle = accentColor;

        for (let i = 0; i < peaks.length; i++) {
          const val = peaks[i];
          const x = playheadX - playheadOffset + i * barStep;

          // Skip drawing if off-screen
          if (x + barWidth < 0 || x > width) continue;

          const barHeight = Math.max(2, val * height * 0.8);

          // Symmetrical look with opacity (already played = 1.0, upcoming = 0.3)
          ctx.globalAlpha = i < currentProgress * peaks.length ? 1.0 : 0.3;
          ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
        }
        ctx.globalAlpha = 1.0;

        // Draw vertical playhead line — shorter, centered on waveform (matching active recording)
        const lineSpan = height * 0.35; // extends 35% of canvas height up and down from center
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        ctx.moveTo(playheadX, centerY - lineSpan);
        ctx.lineTo(playheadX, centerY + lineSpan);
        ctx.stroke();

        // Draw time pill above the playhead line (matching active recording)
        const timeStr = (() => {
          const t = displayTimeRef.current;
          const mins = Math.floor(t / 60);
          const secs = Math.floor(t % 60);
          const ms   = Math.floor((t % 1) * 100);
          return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
        })();

        const pillPad = { x: 10, y: 5 };
        const pillFont = '11px -apple-system, BlinkMacSystemFont, monospace';
        ctx.font = pillFont;
        const textW = ctx.measureText(timeStr).width;
        const pillW = textW + pillPad.x * 2;
        const pillH = 22;
        const pillR = pillH / 2; // fully rounded ends
        const pillTop = centerY - lineSpan - pillH - 6;
        const pillLeft = playheadX - pillW / 2;

        // Pill background
        ctx.beginPath();
        ctx.roundRect(pillLeft, pillTop, pillW, pillH, pillR);
        ctx.fillStyle = 'rgba(20,20,22,0.92)';
        ctx.fill();

        // Pill text
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = pillFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeStr, playheadX, pillTop + pillH / 2);
        // Reset alignment for subsequent draws
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

      } else if (isRecordingRef.current && analyserRef.current && dataArrayRef.current) {
        // Live waveform — timeline style: playhead at center, bars flow left
        const barWidth = 2;
        const gap = 1;
        const barStep = barWidth + gap;
        const playheadX = Math.floor(width / 2);

        // Sample the current audio peak (throttled to ~barStep-width intervals)
        const now = performance.now();
        const msPerBar = 50; // one bar every 50ms for a smooth scroll
        if (now - lastSampleTimeRef.current >= msPerBar) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          const binCount = analyserRef.current.frequencyBinCount;
          // Compute a single peak value across all bins
          let peak = 0;
          for (let b = 0; b < binCount; b++) {
            peak = Math.max(peak, dataArrayRef.current[b]);
          }
          liveWaveHistoryRef.current.push(peak / 255);
          lastSampleTimeRef.current = now;

          // Also push to peaksRef for the post-recording static waveform
          peaksRef.current.push(peak / 255);
        }

        const history = liveWaveHistoryRef.current;
        // How many bars fit from the playhead to the left edge
        const maxVisibleBars = Math.floor(playheadX / barStep);

        ctx.fillStyle = recordingColor;
        // Draw bars from newest (at playhead) to oldest (flowing left)
        for (let i = 0; i < maxVisibleBars; i++) {
          const histIdx = history.length - 1 - i;
          if (histIdx < 0) break;

          const val = history[histIdx];
          const barHeight = Math.max(2, val * height * 0.8);
          const x = playheadX - (i + 1) * barStep;

          // Slight fade for older bars trailing off-screen
          const ageFade = Math.max(0.3, 1 - (i / maxVisibleBars) * 0.5);
          ctx.globalAlpha = (0.6 + val * 0.4) * ageFade;
          ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
        }
        ctx.globalAlpha = 1.0;

        // Draw vertical playhead line — shorter, centered on waveform
        const lineSpan = height * 0.35; // extends 35% of canvas height up and down from center
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        ctx.moveTo(playheadX, centerY - lineSpan);
        ctx.lineTo(playheadX, centerY + lineSpan);
        ctx.stroke();

        // Draw time pill above the playhead line
        const timeStr = (() => {
          const t = displayTimeRef.current;
          const mins = Math.floor(t / 60);
          const secs = Math.floor(t % 60);
          const ms   = Math.floor((t % 1) * 100);
          return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
        })();

        const pillPad = { x: 10, y: 5 };
        const pillFont = '11px -apple-system, BlinkMacSystemFont, monospace';
        ctx.font = pillFont;
        const textW = ctx.measureText(timeStr).width;
        const pillW = textW + pillPad.x * 2;
        const pillH = 22;
        const pillR = pillH / 2; // fully rounded ends
        const pillTop = centerY - lineSpan - pillH - 6;
        const pillLeft = playheadX - pillW / 2;

        // Pill background
        ctx.beginPath();
        ctx.roundRect(pillLeft, pillTop, pillW, pillH, pillR);
        ctx.fillStyle = 'rgba(20,20,22,0.92)';
        ctx.fill();

        // Pill text
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = pillFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeStr, playheadX, pillTop + pillH / 2);
        // Reset alignment for subsequent draws
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

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
  }, [isRecording, recordedBlob, showTranscription]);

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
        onResumeBeatAudio?.();
        backingAudio.play().catch(console.error);
      }
    } else {
      if (!audio.paused) audio.pause();
      if (backingAudio && recordedBlob && !backingAudio.paused) {
        backingAudio.pause();
        onPauseBeatAudio?.();
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

      // 1. EQ Nodes
      const eqLow = audioCtx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = 250;
      eqLow.gain.value = isFXActive ? fxSettings.eqLow : 0;
      eqLowRef.current = eqLow;

      const eqMid = audioCtx.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.value = 1000;
      eqMid.Q.value = 1;
      eqMid.gain.value = isFXActive ? fxSettings.eqMid : 0;
      eqMidRef.current = eqMid;

      const eqHigh = audioCtx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = 4000;
      eqHigh.gain.value = isFXActive ? fxSettings.eqHigh : 0;
      eqHighRef.current = eqHigh;

      // 2. Compressor Node (Punch)
      const comp = audioCtx.createDynamicsCompressor();
      if (isFXActive) {
        const punchAmount = fxSettings.punch / 100;
        comp.threshold.value = -50 * punchAmount;
        comp.ratio.value = 1 + (19 * punchAmount);
      } else {
        comp.threshold.value = 0;
        comp.ratio.value = 1;
      }
      comp.knee.value = 30;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      compRef.current = comp;

      // 3. Delay Node (Echo)
      const delay = audioCtx.createDelay(2.0);
      delay.delayTime.value = 0.4;
      delayRef.current = delay;

      const delayDry = audioCtx.createGain();
      delayDry.gain.value = 1;
      delayDryRef.current = delayDry;

      const delayWet = audioCtx.createGain();
      delayWet.gain.value = isFXActive ? (fxSettings.echo / 100) * 0.7 : 0;
      delayWetRef.current = delayWet;

      // 4. Reverb Node (Space)
      const convolver = audioCtx.createConvolver();
      try {
        convolver.buffer = createReverbImpulse(audioCtx, 2.5, 2.0);
      } catch (err) {
        console.warn('Could not set convolver buffer in recorder:', err);
      }
      convolverRef.current = convolver;

      const reverbWet = audioCtx.createGain();
      reverbWet.gain.value = isFXActive ? (fxSettings.space / 100) * 1.0 : 0;
      reverbWetRef.current = reverbWet;

      // 5. Limiter / Master
      const masterGain = audioCtx.createGain();
      masterGain.gain.value = 1;
      masterGainRef.current = masterGain;

      const limiter = audioCtx.createDynamicsCompressor();
      limiter.threshold.value = -0.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.1;
      limiterRef.current = limiter;

      // Graph Routing
      analyser.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(comp);

      // Dry path to master
      comp.connect(masterGain);

      // Parallel Delay Path
      comp.connect(delay);
      delay.connect(delayDry);
      delayDry.connect(delayWet);
      delayWet.connect(masterGain);

      // Parallel Reverb Path
      comp.connect(convolver);
      convolver.connect(reverbWet);
      reverbWet.connect(masterGain);

      // Master to Limiter
      masterGain.connect(limiter);

      // Merger for stereo channel matching
      const merger = audioCtx.createChannelMerger(2);
      limiter.connect(merger, 0, 0);
      limiter.connect(merger, 0, 1);

      // Monitoring path (outputs to headphones)
      const monitorGain = audioCtx.createGain();
      monitorGain.gain.value = isMonitoringEnabled ? 0.8 : 0;
      merger.connect(monitorGain);
      monitorGain.connect(audioCtx.destination);
      monitorGainRef.current = monitorGain;

      // Recording path (outputs to MediaRecorder)
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

    recognition.onerror = (e: any) => {
      if (e.error !== 'aborted') console.warn('[SpeechRecognition] Error:', e.error);
    };
    recognition.start();
    speechRef.current = recognition;
  };

  const stopSpeechRecognition = () => {
    try { speechRef.current?.stop(); } catch { /* ignore */ }
    speechRef.current = null;
    setInterimTranscript('');
  };

  const startRecording = async () => {
    const storageOk = await checkStorageAndPersist();
    if (!storageOk) return;

    try {
      // 1. Immediately pause backing audio if playing to prevent sync drift and device driver sample-rate glitches
      const backingAudio = backingAudioRef?.current;
      const wasPlaying = backingAudio && !backingAudio.paused;
      let targetOffset = 0;

      if (backingAudio && backingTrackSrc) {
        targetOffset = backingAudio.currentTime;
        if (wasPlaying) {
          backingAudio.pause();
          onPauseBeatAudio?.();
        }
      }

      // 2. Initialize the mic and audio context nodes while audio is paused to prevent pops/clicks on shared audio threads
      const micResult = await initializeMic();

      if (!streamRef.current) return;
      const activeCtx = audioContext ?? micResult?.audioCtx;
      if (!activeCtx) return;

      const streamToRecord = recordingStreamRef.current ?? micResult?.recordingStream;
      if (!streamToRecord) return;

      // Surface a mid-take mic disconnect (Bluetooth drop, device unplug) instead of
      // silently losing capture — stop gracefully so whatever was captured is saved.
      const micTrack = streamRef.current.getAudioTracks()[0];
      if (micTrack) {
        micTrack.onended = () => {
          toast.error('Microphone disconnected — recording stopped.');
          if (isRecordingRef.current) stopRecording();
        };
      }

      // Negotiate best supported audio MIME type (iOS Safari doesn't support WebM)
      const mimePreference = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac',
      ];
      const supportedMime = mimePreference.find(m => MediaRecorder.isTypeSupported(m));
      const recorderOptions: MediaRecorderOptions = supportedMime ? { mimeType: supportedMime } : {};
      const mediaRecorder = new MediaRecorder(streamToRecord, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      peaksRef.current = [];
      liveWaveHistoryRef.current = [];
      lastSampleTimeRef.current = 0;

      // Fresh recording id + chunk backup bookkeeping for this take. Chunks are
      // written to IndexedDB as they arrive so a crash mid-take leaves recoverable
      // audio (surfaced automatically by MuseView's orphan-recovery scan).
      const recId = randomId().substring(0, 6).toUpperCase();
      recordingIdRef.current = recId;
      chunkSeqRef.current = 0;
      chunkWritePromisesRef.current = [];
      const recStartedAt = new Date().toISOString();
      const recMimeType = supportedMime || mediaRecorder.mimeType || 'audio/webm';
      putMuseManifest({ id: recId, startedAt: recStartedAt, mimeType: recMimeType, chunkCount: 0, status: 'recording' })
        .catch(err => console.warn('Failed to write recording manifest:', err));

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          const seq = chunkSeqRef.current++;
          const p = putMuseChunk(recId, seq, e.data)
            .then(() => putMuseManifest({ id: recId, startedAt: recStartedAt, mimeType: recMimeType, chunkCount: seq + 1, status: 'recording' }))
            .catch(err => console.warn('Chunk write failed:', err));
          chunkWritePromisesRef.current.push(p);
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        toast.error('Recording error — check your microphone connection.');
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch (stopErr) {
          console.error('Failed to stop after recorder error:', stopErr);
        }
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        stopSpeechRecognition();
        releaseWakeLock();
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setRecordedBlob(blob);

        // mediaRecorder.stop() flushes one final ondataavailable (and its async
        // IndexedDB write) before this handler runs — wait for every write we
        // know about (including that final one, already pushed synchronously)
        // before deleting, otherwise the last chunk's write can land AFTER the
        // delete and resurrect a stale orphaned manifest entry.
        const idToClean = recordingIdRef.current;
        const writesSettled = Promise.all(chunkWritePromisesRef.current);

        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          onSave(blob, savedDurationRef.current, recordingStartOffsetRef.current, layerMode, idToClean, chunksRef.current);
          writesSettled.finally(() => {
            deleteMuseChunks(idToClean).catch(() => {});
            deleteMuseManifest(idToClean).catch(() => {});
          });
          onClose();
        } else if (pendingDiscardRef.current) {
          pendingDiscardRef.current = false;
          writesSettled.finally(() => {
            deleteMuseChunks(idToClean).catch(() => {});
            deleteMuseManifest(idToClean).catch(() => {});
          });
        }
      };

      // 3. Resume the beat in sync with MediaRecorder starting
      if (backingAudio && backingTrackSrc) {
        backingAudio.currentTime = targetOffset;
        recordingStartOffsetRef.current = targetOffset;
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

      mediaRecorder.start(20000); // 20s timeslices — incremental capture instead of one giant in-memory buffer
      setIsRecording(true);
      setRecordedBlob(null);
      setProgress(0);
      setDuration(0);
      setFinalTranscript('');
      setInterimTranscript('');
      startTimeRef.current = Date.now();
      requestWakeLock();

      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);

      startSpeechRecognition();

    } catch (err) {
      console.error("Start recording failed:", err);
      const e = err as DOMException;
      const message =
        e.name === 'NotAllowedError' ? 'Microphone access denied — enable it in Settings.' :
        e.name === 'NotFoundError' ? 'No microphone found on this device.' :
        e.name === 'OverconstrainedError' ? "Microphone doesn't support the requested audio settings." :
        'Could not start recording — check microphone permissions.';
      toast.error(message);
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
      releaseWakeLock();
      if (backingAudioRef?.current) {
        backingAudioRef.current.pause();
      }
      onPauseBeatAudio?.();
    }
  };

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  const handleToggleRecord = () => {
    if (isBeatLoading) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setActivePresetId(presetId);
    const selected = VOCAL_PRESETS.find(p => p.id === presetId);
    if (selected) {
      setFxSettings(selected.settings);
      if (presetId === 'dry') {
        setIsFXActive(false);
      } else {
        setIsFXActive(true);
      }
    }
  };

  const handleUpdateCustomFX = (key: keyof FXSettings, value: number) => {
    setFxSettings(prev => ({ ...prev, [key]: value }));
    setActivePresetId('custom');
    setIsFXActive(true);
  };

  const handleSave = () => {
    if (isRecording) {
      pendingSaveRef.current = true;
      savedDurationRef.current = duration;
      stopRecording();
    } else if (recordedBlob) {
      onSave(recordedBlob, duration, recordingStartOffsetRef.current, layerMode, recordingIdRef.current, chunksRef.current);
      deleteMuseChunks(recordingIdRef.current).catch(() => {});
      deleteMuseManifest(recordingIdRef.current).catch(() => {});
      onClose();
    }
  };

  const handleDiscard = () => {
    if (isRecording) {
      // Still recording — defer cleanup to onstop, which waits for the final
      // chunk's write instead of racing it (see mediaRecorder.onstop above).
      pendingDiscardRef.current = true;
      stopRecording();
    } else if (recordingIdRef.current) {
      // Already stopped (reviewing a completed take) — onstop's writes settled
      // long ago, safe to clean up immediately.
      deleteMuseChunks(recordingIdRef.current).catch(() => {});
      deleteMuseManifest(recordingIdRef.current).catch(() => {});
    }
    setRecordedBlob(null);
    setDuration(0);
    setProgress(0);
    peaksRef.current = [];
    onClose();
  };

  // Discard the current take and jump straight back into recording a fresh one.
  const handleRetry = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    if (recordingIdRef.current) {
      deleteMuseChunks(recordingIdRef.current).catch(() => {});
      deleteMuseManifest(recordingIdRef.current).catch(() => {});
    }
    setRecordedBlob(null);
    setDuration(0);
    setProgress(0);
    peaksRef.current = [];
    liveWaveHistoryRef.current = [];
    lastSampleTimeRef.current = 0;
    setFinalTranscript('');
    setInterimTranscript('');
    startRecording();
  };

  // --- Waveform Swiping / Scrubbing Handlers ---
  const handleDragStart = (clientX: number) => {
    if (!recordedBlob || isRecording) return;
    isDraggingRef.current = true;
    dragStartXRef.current = clientX;
    dragStartPercentRef.current = progress;
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleDragMove = (clientX: number) => {
    if (!isDraggingRef.current || !recordedBlob || isRecording) return;
    const dx = clientX - dragStartXRef.current;
    
    const barWidth = 2;
    const gap = 1;
    const barStep = barWidth + gap;
    const totalWaveWidth = peaksRef.current.length * barStep;
    
    if (totalWaveWidth <= 0) return;

    // Moving the waveform right (dx > 0) scrubs backwards in time
    let newProgress = dragStartPercentRef.current - dx / totalWaveWidth;
    newProgress = Math.max(0, Math.min(1, newProgress));
    
    setProgress(newProgress);
    if (audioRef.current) {
      audioRef.current.currentTime = newProgress * duration;
    }
  };

  const handleDragEnd = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
    }
  };

  const currentDisplayTime = isRecording
    ? duration
    : recordedBlob
      ? progress * duration
      : 0;
  displayTimeRef.current = currentDisplayTime;

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
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-bold transition-all active:scale-95 cursor-pointer ${canSave
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
                    <div
                      ref={timelineRef}
                      className={`w-full h-full relative select-none ${recordedBlob && !isRecording ? 'cursor-ew-resize active:cursor-grabbing' : ''}`}
                      style={{ touchAction: 'none' }}
                      onMouseDown={(e) => handleDragStart(e.clientX)}
                      onMouseMove={(e) => handleDragMove(e.clientX)}
                      onMouseUp={handleDragEnd}
                      onMouseLeave={handleDragEnd}
                      onTouchStart={(e) => {
                        if (e.touches[0]) {
                          e.preventDefault();
                          handleDragStart(e.touches[0].clientX);
                        }
                      }}
                      onTouchMove={(e) => {
                        if (e.touches[0]) {
                          e.preventDefault();
                          handleDragMove(e.touches[0].clientX);
                        }
                      }}
                      onTouchEnd={handleDragEnd}
                    >
                      <canvas ref={canvasRef} className="w-full h-full" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Floating Vocal FX Card */}
              <AnimatePresence>
                {showFXPanel && (
                  <motion.div
                    initial={{ y: 150, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 150, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                    className="absolute bottom-4 left-4 right-4 z-[120] bg-[var(--bg-card)]/98 backdrop-blur-xl border border-[var(--border-main)] rounded-2xl p-4 flex flex-col gap-4 shadow-2xl overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <Sliders size={16} className="text-[var(--accent)]" />
                        <span className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider">Vocal FX Presets</span>
                      </div>
                      
                      {/* Live Monitoring Switch */}
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold uppercase text-[var(--text-secondary)]">Live Monitor</span>
                          {isMonitoringEnabled && (
                            <span className="text-[8px] text-red-400 font-semibold leading-none">Use Headphones</span>
                          )}
                        </div>
                        <button
                          onClick={() => setIsMonitoringEnabled(!isMonitoringEnabled)}
                          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer outline-none ${isMonitoringEnabled ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 'bg-[var(--bg-secondary)] border border-[var(--border-main)]'}`}
                          aria-label="Toggle Live Monitoring"
                        >
                          <span 
                            className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${isMonitoringEnabled ? 'translate-x-4' : 'translate-x-0'}`} 
                          />
                        </button>
                        
                        <div className="w-[1px] h-4 bg-[var(--border-main)] mx-1" />
                        
                        <button
                          onClick={() => setShowFXPanel(false)}
                          className="w-11 h-11 rounded-full hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                          aria-label="Close Vocal FX panel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Segmented Tab Selector */}
                    <div className="w-full bg-[var(--bg-secondary)] p-0.5 rounded-full flex gap-0.5 border border-[var(--border-main)] shrink-0">
                      <button
                        onClick={() => setFxViewMode('presets')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-full transition-all text-center cursor-pointer ${fxViewMode === 'presets' ? 'bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-main)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}
                      >
                        Presets
                      </button>
                      <button
                        onClick={() => setFxViewMode('custom')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-full transition-all text-center cursor-pointer ${fxViewMode === 'custom' ? 'bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-main)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}
                      >
                        Custom FX
                      </button>
                    </div>

                    {/* Sliding panels */}
                    <div className="min-h-[100px] max-h-[140px] overflow-hidden">
                      {fxViewMode === 'presets' ? (
                        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-hide snap-x select-none">
                          {VOCAL_PRESETS.map((preset) => {
                            // Map icon
                            const IconComponent = (() => {
                              switch (preset.id) {
                                case 'studio': return Activity;
                                case 'space': return Waves;
                                case 'echo': return Zap;
                                case 'radio': return Radio;
                                default: return Mic;
                              }
                            })();
                            const isSelected = activePresetId === preset.id && (preset.id === 'dry' ? !isFXActive : isFXActive);
                            return (
                              <button
                                key={preset.id}
                                onClick={() => handleSelectPreset(preset.id)}
                                className={`snap-center flex-shrink-0 w-[84px] h-[84px] rounded-xl flex flex-col items-center justify-center gap-1.5 border transition-all active:scale-95 cursor-pointer ${
                                  isSelected
                                    ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)] shadow-[0_0_12px_var(--accent-dim)]'
                                    : 'bg-[var(--bg-secondary)] border border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                                }`}
                              >
                                <IconComponent size={18} />
                                <span className="text-[9px] font-bold tracking-wider uppercase">{preset.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-full overflow-y-auto pr-0.5 space-y-3 pb-2 pt-1 scrollbar-thin">
                          {/* Enable Custom FX Toggle */}
                          <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-main)]">
                            <span className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">Enable Custom FX</span>
                            <button
                              onClick={() => setIsFXActive(!isFXActive)}
                              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer outline-none ${isFXActive ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-[var(--bg-secondary)] border border-[var(--border-main)]'}`}
                            >
                              <span 
                                className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${isFXActive ? 'translate-x-4' : 'translate-x-0'}`} 
                              />
                            </button>
                          </div>

                          {/* Reverb Space Slider */}
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-[9px] text-[var(--text-secondary)] font-bold">
                              <span>REVERB (SPACE)</span>
                              <span className="tabular-nums">{fxSettings.space}%</span>
                            </div>
                            <input 
                              type="range"
                              min="0"
                              max="100"
                              value={fxSettings.space}
                              disabled={!isFXActive}
                              onChange={(e) => handleUpdateCustomFX('space', parseInt(e.target.value))}
                              className={`w-full h-1 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-main)] ${!isFXActive && 'opacity-30 cursor-not-allowed'}`}
                            />
                          </div>

                          {/* Delay Echo Slider */}
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-[9px] text-[var(--text-secondary)] font-bold">
                              <span>ECHO (DELAY)</span>
                              <span className="tabular-nums">{fxSettings.echo}%</span>
                            </div>
                            <input 
                              type="range"
                              min="0"
                              max="100"
                              value={fxSettings.echo}
                              disabled={!isFXActive}
                              onChange={(e) => handleUpdateCustomFX('echo', parseInt(e.target.value))}
                              className={`w-full h-1 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-main)] ${!isFXActive && 'opacity-30 cursor-not-allowed'}`}
                            />
                          </div>

                          {/* Compressor Punch Slider */}
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-[9px] text-[var(--text-secondary)] font-bold">
                              <span>PUNCH (COMPRESSOR)</span>
                              <span className="tabular-nums">{fxSettings.punch}%</span>
                            </div>
                            <input 
                              type="range"
                              min="0"
                              max="100"
                              value={fxSettings.punch}
                              disabled={!isFXActive}
                              onChange={(e) => handleUpdateCustomFX('punch', parseInt(e.target.value))}
                              className={`w-full h-1 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text-main)] ${!isFXActive && 'opacity-30 cursor-not-allowed'}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Playback Control Area — fixed height to prevent layout shifts */}
            <div className="h-20 flex items-center justify-center gap-6 flex-shrink-0">
              {recordedBlob && !isRecording && (
                <>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-14 h-14 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg text-[var(--text-main)]"
                    aria-label={isPlaying ? "Pause playback" : "Start playback"}
                  >
                    {isPlaying ? (
                      <Pause size={20} fill="currentColor" />
                    ) : (
                      <Play size={20} fill="currentColor" className="ml-0.5" />
                    )}
                  </button>

                  {/* Retry — discard this take and re-record */}
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all active:scale-90 cursor-pointer shadow-lg"
                    aria-label="Discard this take and record again"
                  >
                    <RotateCcw size={17} />
                    <span className="text-[13px] font-semibold">Retry</span>
                  </button>
                </>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="px-10 pb-8 flex items-center justify-between flex-shrink-0">
              {/* Left: Toggles */}
              <div className="flex items-center gap-3">
                {/* Transcription toggle */}
                <button
                  onClick={() => setShowTranscription(!showTranscription)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${showTranscription
                      ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                      : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'
                    }`}
                  aria-label="Toggle live transcription"
                >
                  <MessageSquare size={22} />
                </button>

                {/* Vocal FX Settings Toggle */}
                <button
                  onClick={() => setShowFXPanel(!showFXPanel)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                    isFXActive
                      ? 'bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-dim)]'
                      : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'
                  }`}
                  aria-label="Vocal FX Settings"
                >
                  <Sliders size={22} />
                </button>
              </div>

              {/* Center: Record / Stop */}
              <div className="relative">
                {isRecording && (
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping scale-125 pointer-events-none" />
                )}
                <button
                  onClick={handleToggleRecord}
                  disabled={isBeatLoading}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-2xl ${
                    isBeatLoading
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : isRecording
                        ? 'bg-red-500 hover:bg-red-400'
                        : 'bg-red-600 hover:bg-red-500'
                  }`}
                  aria-label={isBeatLoading ? 'Loading beat...' : isRecording ? 'Stop recording' : 'Start recording'}
                >
                  {isBeatLoading ? (
                    <Loader2 size={32} className="text-white animate-spin" />
                  ) : isRecording ? (
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
