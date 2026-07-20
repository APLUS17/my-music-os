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
import { Slider } from "@/components/ui/slider";
import { RecordingLayer } from '@/types';
import { formatTime } from '@/lib/utils/time';
import { FXSettings, defaultFXSettings } from './FXPanel';
import { createReverbImpulse } from '@/hooks/useVocalFX';
import { VOCAL_PRESETS } from '@/lib/audio/vocalPresets';
import { useSynchronizedCapture } from '@/hooks/useSynchronizedCapture';

import { Loader2 } from 'lucide-react';

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

  const [micSource, setMicSource] = useState<MediaStreamAudioSourceNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);

  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
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

  // Pass live time into canvas without stale closure
  const displayTimeRef = useRef(0);

  // Synchronized Recording Hook
  const {
    startTake,
    stopTake,
    isRecording, // Direct, single source of truth from high-performance hook!
    ready: synchronizedReady,
    audioCtxRef,
    micStreamRef,
  } = useSynchronizedCapture({
    beatUrl: backingTrackSrc || null,
    onTakeComplete: (blob, duration, beatOffset) => {
      setRecordedBlob(blob);
      setDuration(duration);
      setProgress(0);
      recordingStartOffsetRef.current = beatOffset;

      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        onSave(blob, duration, beatOffset, layerMode);
        onClose();
      }
    },
    onInterrupted: (blob, duration, beatOffset) => {
      setRecordedBlob(blob);
      setDuration(duration);
      setProgress(0);
      recordingStartOffsetRef.current = beatOffset;

      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        onSave(blob, duration, beatOffset, layerMode);
        onClose();
      }
    },
  });

  const isRecordingRef = useRef(false);
  isRecordingRef.current = isRecording;

  // Single React lifecycle observer that handles all recording start/stop transitions reactively
  useEffect(() => {
    onRecordingStateChange?.(isRecording);

    if (isRecording) {
      setRecordedBlob(null);
      setProgress(0);
      setDuration(0);
      setFinalTranscript('');
      setInterimTranscript('');
      startTimeRef.current = Date.now();
      peaksRef.current = [];
      liveWaveHistoryRef.current = [];
      lastSampleTimeRef.current = 0;

      // Connect real-time parallel low-latency monitoring feedback graph
      if (audioCtxRef.current && micStreamRef.current) {
        setupLiveFXMonitoring(audioCtxRef.current, micStreamRef.current);
      }

      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);

      startSpeechRecognition();
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopSpeechRecognition();
      cleanupFXMonitoring();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  // Synchronize Live Vocal FX settings with Web Audio Nodes
  useEffect(() => {
    if (!audioCtxRef.current || !eqLowRef.current) return;

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
  }, [audioCtxRef, isFXActive, fxSettings]);

  // Synchronize Live Monitoring toggle with monitor Gain node
  useEffect(() => {
    if (monitorGainRef.current) {
      monitorGainRef.current.gain.value = isMonitoringEnabled ? 0.8 : 0;
    }
  }, [isMonitoringEnabled]);

  // Auto-start recording when opened via nav button and backing track is fully ready (prevents preload race condition)
  useEffect(() => {
    if (autoStart && synchronizedReady) {
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, synchronizedReady]);

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
          analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
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
  }, [recordedBlob, showTranscription]);

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

  const setupLiveFXMonitoring = (ctx: AudioContext, stream: MediaStream) => {
    try {
      const source = ctx.createMediaStreamSource(stream);
      setMicSource(source);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      // 1. EQ Nodes
      const eqLow = ctx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = 250;
      eqLow.gain.value = isFXActive ? fxSettings.eqLow : 0;
      eqLowRef.current = eqLow;

      const eqMid = ctx.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.value = 1000;
      eqMid.Q.value = 1;
      eqMid.gain.value = isFXActive ? fxSettings.eqMid : 0;
      eqMidRef.current = eqMid;

      const eqHigh = ctx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = 4000;
      eqHigh.gain.value = isFXActive ? fxSettings.eqHigh : 0;
      eqHighRef.current = eqHigh;

      // 2. Compressor Node (Punch)
      const comp = ctx.createDynamicsCompressor();
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
      const delay = ctx.createDelay(2.0);
      delay.delayTime.value = 0.4;
      delayRef.current = delay;

      const delayDry = ctx.createGain();
      delayDry.gain.value = 1;
      delayDryRef.current = delayDry;

      const delayWet = ctx.createGain();
      delayWet.gain.value = isFXActive ? (fxSettings.echo / 100) * 0.7 : 0;
      delayWetRef.current = delayWet;

      // 4. Reverb Node (Space)
      const convolver = ctx.createConvolver();
      try {
        convolver.buffer = createReverbImpulse(ctx, 2.5, 2.0);
      } catch (err) {
        console.warn('Could not set convolver buffer in recorder:', err);
      }
      convolverRef.current = convolver;

      const reverbWet = ctx.createGain();
      reverbWet.gain.value = isFXActive ? (fxSettings.space / 100) * 1.0 : 0;
      reverbWetRef.current = reverbWet;

      // 5. Limiter / Master
      const masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGainRef.current = masterGain;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -0.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.1;
      limiterRef.current = limiter;

      // Routing
      analyser.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(comp);

      comp.connect(masterGain);

      comp.connect(delay);
      delay.connect(delayDry);
      delayDry.connect(delayWet);
      delayWet.connect(masterGain);

      comp.connect(convolver);
      convolver.connect(reverbWet);
      reverbWet.connect(masterGain);

      masterGain.connect(limiter);

      const merger = ctx.createChannelMerger(2);
      limiter.connect(merger, 0, 0);
      limiter.connect(merger, 0, 1);

      // Monitoring path
      const monitorGain = ctx.createGain();
      monitorGain.gain.value = isMonitoringEnabled ? 0.8 : 0;
      merger.connect(monitorGain);
      monitorGain.connect(ctx.destination);
      monitorGainRef.current = monitorGain;

      setAudioCtxReady(true);
    } catch (err) {
      console.error('Error setting up Vocal FX monitoring graph:', err);
    }
  };

  const cleanupFXMonitoring = () => {
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
    monitorGainRef.current = null;
    setMicSource(null);
    setAudioCtxReady(false);
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

      // 2. Trigger high-performance synchronized start (AudioWorklet & Worker thread setup)
      await startTake(targetOffset);

      if (layerMode) {
        startLayerPlayback();
      }

    } catch (err) {
      console.error("Start recording failed:", err);
    }
  };

  const stopRecording = () => {
    if (isRecording) {
      stopTake();
      if (layerMode) {
        stopLayerPlayback();
      }
      if (backingAudioRef?.current) {
        backingAudioRef.current.pause();
      }
      onPauseBeatAudio?.();
    }
  };

  const handleToggleRecord = () => {
    if (isBeatLoading || !synchronizedReady) return;
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

  // Discard the current take and jump straight back into recording a fresh one.
  const handleRetry = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
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
  const isRecordDisabled = isBeatLoading || !synchronizedReady;

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
                      onMouseDown={(e) => handleDragStart(e.clientX)}
                      onMouseMove={(e) => handleDragMove(e.clientX)}
                      onMouseUp={handleDragEnd}
                      onMouseLeave={handleDragEnd}
                      onTouchStart={(e) => {
                        if (e.touches[0]) handleDragStart(e.touches[0].clientX);
                      }}
                      onTouchMove={(e) => {
                        if (e.touches[0]) handleDragMove(e.touches[0].clientX);
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
                          className="w-7 h-7 rounded-full hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
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
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateCustomFX('space', parseInt(e.target.value))}
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
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateCustomFX('echo', parseInt(e.target.value))}
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
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateCustomFX('punch', parseInt(e.target.value))}
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
                  disabled={isRecordDisabled}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-2xl ${
                    isRecordDisabled
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : isRecording
                        ? 'bg-red-500 hover:bg-red-400'
                        : 'bg-red-600 hover:bg-red-500'
                  }`}
                  aria-label={isRecordDisabled ? 'Loading beat...' : isRecording ? 'Stop recording' : 'Start recording'}
                >
                  {isRecordDisabled ? (
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
