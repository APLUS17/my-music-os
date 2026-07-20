// Custom hook: useSynchronizedCapture.ts
import { useEffect, useRef, useState } from 'react';

interface UseSynchronizedCaptureProps {
  beatUrl: string | null;
  onTakeComplete: (blob: Blob, duration: number, beatOffset: number) => void;
  onInterrupted?: (blob: Blob, duration: number, beatOffset: number) => void;
}

export function useSynchronizedCapture({
  beatUrl,
  onTakeComplete,
  onInterrupted,
}: UseSynchronizedCaptureProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioNodeRef = useRef<AudioWorkletNode | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const beatSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const beatBufferRef = useRef<AudioBuffer | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Synchronization refs
  const workletStartTimeRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const targetOffsetRef = useRef<number>(0);
  const isRecordingRef = useRef(false);

  // Keep a ref to callback to prevent stale closures
  const onTakeCompleteRef = useRef(onTakeComplete);
  const onInterruptedRef = useRef(onInterrupted);
  useEffect(() => {
    onTakeCompleteRef.current = onTakeComplete;
    onInterruptedRef.current = onInterrupted;
  }, [onTakeComplete, onInterrupted]);

  isRecordingRef.current = isRecording;

  // Pre-load the instrumental backing beat safely client-side
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Reset ready state if beatUrl changes
    setReady(false);
    setError(null);

    // Instantiate worker safely with Next.js asset routing configuration
    try {
      workerRef.current = new Worker(
        new URL('../utils/audio/wav-worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch (err) {
      console.error('Failed to initialize Web Worker:', err);
      setError('Web Worker initialization failed');
      return;
    }

    workerRef.current.onmessage = (e: MessageEvent) => {
      const { command, blob } = e.data;
      if (command === 'wavReady') {
        const duration = calculateRecordedDuration(blob);
        const beatOffset = calculateBeatOffset();

        if (isRecordingRef.current) {
          // If we were still recording, this is an interruption/auto-save
          setIsRecording(false);
          onInterruptedRef.current?.(blob, duration, beatOffset);
        } else {
          onTakeCompleteRef.current(blob, duration, beatOffset);
        }
      }
    };

    if (!beatUrl) {
      setReady(true);
      return;
    }

    // Pre-fetch and decode the backing beat
    fetch(beatUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((arrayBuffer) => {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const dummyCtx = new AudioContextClass();
        return dummyCtx.decodeAudioData(arrayBuffer).then((decoded) => {
          dummyCtx.close();
          return decoded;
        });
      })
      .then((decodedBuffer) => {
        beatBufferRef.current = decodedBuffer;
        setReady(true);
      })
      .catch((err: any) => {
        console.error('Error pre-loading backing track beat:', err);
        setError('Failed to load backing track');
        // Even if beat fails, we should let user record raw voice memos
        setReady(true);
      });

    return () => {
      workerRef.current?.terminate();
    };
  }, [beatUrl]);

  // Duration is based on final blob size relative to PCM mono WAV 16-bit parameters
  // Mono 16-bit PCM WAV has 44 bytes header, then 2 bytes per sample.
  // samplesCount = (blob.size - 44) / 2. duration = samplesCount / sampleRate.
  const calculateRecordedDuration = (blob: Blob): number => {
    const rate = audioCtxRef.current?.sampleRate || 44100;
    const bytesPerSample = 2;
    const headerSize = 44;
    const samplesCount = Math.max(0, (blob.size - headerSize) / bytesPerSample);
    return samplesCount / rate;
  };

  const calculateBeatOffset = (): number => {
    const startTime = recordingStartTimeRef.current;
    const workletTime = workletStartTimeRef.current;
    const targetOffset = targetOffsetRef.current;

    if (!workletTime || !startTime) return targetOffset;

    // Aligns exactly with: targetOffset + Math.max(0, workletTime - startTime)
    return targetOffset + Math.max(0, workletTime - startTime);
  };

  const startTake = async (currentBeatPosition: number = 0) => {
    if (typeof window === 'undefined' || !ready) return;

    try {
      // 1. Isolate recording context and force explicit resume guard
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // Force resume guard for iOS Safari / suspended mobile contexts
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Initialize the worker with current hardware rate (AirPods / device dynamic sample rate)
      const hardwareRate = ctx.sampleRate;
      workerRef.current?.postMessage({ command: 'init', rate: hardwareRate });

      // Request raw, pristine mic input (no echo cancellation or other filter modifications)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          channelCount: 1,
        },
      });
      micStreamRef.current = stream;

      const sourceNode = ctx.createMediaStreamSource(stream);

      // 2. Load Worklet with dynamic cache-busting timestamp to prevent sticky browser cache
      await ctx.audioWorklet.addModule(`/audio/recorder-worklet.js?v=${Date.now()}`);
      const workletNode = new AudioWorkletNode(ctx, 'recorder-worklet');

      // Reset synchronization timestamps
      workletStartTimeRef.current = 0;
      recordingStartTimeRef.current = 0;
      targetOffsetRef.current = currentBeatPosition;

      workletNode.port.onmessage = (e: MessageEvent) => {
        const { command, buffer } = e.data;
        if (command === 'audioData') {
          if (!workletStartTimeRef.current) {
            workletStartTimeRef.current = ctx.currentTime;
          }
          workerRef.current?.postMessage({ command: 'record', buffer });
        }
      };

      audioNodeRef.current = workletNode;
      sourceNode.connect(workletNode);

      // Setup interruption auto-save listener
      ctx.onstatechange = () => {
        if (ctx.state === 'suspended' && isRecordingRef.current) {
          handleInterruptAndAutoSave();
        }
      };

      // 3. Set up sample-accurate trigger timing alignment
      const playPadding = 0.05; // 50ms scheduling padding for stability
      const startTime = ctx.currentTime + playPadding;
      recordingStartTimeRef.current = startTime;

      if (beatBufferRef.current) {
        const beatSource = ctx.createBufferSource();
        beatSource.buffer = beatBufferRef.current;
        beatSource.connect(ctx.destination);
        beatSourceRef.current = beatSource;

        // Start playback exactly scheduled at startTime, starting from the current beat offset
        beatSource.start(startTime, currentBeatPosition);
      }

      setIsRecording(true);
    } catch (err: any) {
      console.error('Failed to start synchronized capture:', err);
      setError('Failed to start recording');
      setIsRecording(false);
      cleanupHardware();
    }
  };

  const handleInterruptAndAutoSave = () => {
    console.warn('AudioContext was suspended mid-take. Triggering auto-save recovery...');
    stopTake(true);
  };

  const stopTake = (isInterrupted: boolean = false) => {
    if (!isRecordingRef.current) return;

    if (!isInterrupted) {
      setIsRecording(false);
    }

    // Stop backing beat immediately
    try {
      beatSourceRef.current?.stop();
    } catch (e) {
      // Ignored if already stopped or not started
    }

    // Calculate how many pre-roll samples to discard
    // Pre-roll happens if workletStartTime is earlier than recordingStartTime (during the 50ms padding window)
    let samplesToDiscard = 0;
    const rate = audioCtxRef.current?.sampleRate || 44100;
    if (workletStartTimeRef.current && recordingStartTimeRef.current) {
      const preRollSecs = Math.max(0, recordingStartTimeRef.current - workletStartTimeRef.current);
      samplesToDiscard = Math.floor(preRollSecs * rate);
    }

    // Trigger file packaging with discarding count
    workerRef.current?.postMessage({
      command: 'exportWAV',
      samplesToDiscard,
    });

    cleanupHardware();
  };

  const cleanupHardware = () => {
    // Aggressively release hardware microphone lock to save mobile battery
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      micStreamRef.current = null;
    }

    // Clean up AudioContext completely
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch((err: any) => {
        console.error('Error closing AudioContext:', err);
      });
      audioCtxRef.current = null;
    }

    audioNodeRef.current = null;
    beatSourceRef.current = null;
  };

  return {
    startTake,
    stopTake: () => stopTake(false),
    isRecording,
    ready,
    error,
    audioCtxRef,
    micStreamRef,
  };
}
