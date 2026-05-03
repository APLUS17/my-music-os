import { useEffect, useRef, useCallback } from 'react';
import { FXSettings } from '@/components/studio/FXPanel';

// Cached impulse response to avoid recreation
const impulseCache = new Map<string, AudioBuffer>();

function createReverbImpulse(context: AudioContext, duration: number, decay: number) {
  const key = `${context.sampleRate}-${duration}-${decay}`;
  if (impulseCache.has(key)) {
    return impulseCache.get(key)!;
  }

  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);

  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const val = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    left[i] = val;
    right[i] = val;
  }

  impulseCache.set(key, impulse);
  return impulse;
}

export function useVocalFX(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  settings: FXSettings,
  isActive: boolean,
  isPlaying: boolean,
  currentTime: number
) {
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Nodes
  const eqLowRef = useRef<BiquadFilterNode | null>(null);
  const eqMidRef = useRef<BiquadFilterNode | null>(null);
  const eqHighRef = useRef<BiquadFilterNode | null>(null);
  const compRef = useRef<DynamicsCompressorNode | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const delayWetRef = useRef<GainNode | null>(null);
  const delayDryRef = useRef<GainNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const reverbWetRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);

  const isInitializedRef = useRef(false);
  const nodesRef = useRef<AudioNode[]>([]);

  // Cleanup function
  const cleanupFX = useCallback(() => {
    try {
      // Disconnect all nodes
      nodesRef.current.forEach(node => {
        try {
          node.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      });
      nodesRef.current = [];

      // Close context if we created it
      if (contextRef.current && contextRef.current.state !== 'closed') {
        contextRef.current.close().catch(() => {});
      }
    } catch (err) {
      console.warn('Error cleaning up FX:', err);
    }

    contextRef.current = null;
    sourceRef.current = null;
    eqLowRef.current = null;
    eqMidRef.current = null;
    eqHighRef.current = null;
    compRef.current = null;
    delayRef.current = null;
    delayWetRef.current = null;
    delayDryRef.current = null;
    convolverRef.current = null;
    reverbWetRef.current = null;
    masterGainRef.current = null;
    limiterRef.current = null;
    isInitializedRef.current = false;
  }, []);

  // Initialization
  const initFX = useCallback(() => {
    if (!audioRef.current || isInitializedRef.current) return;

    try {
      // Check if audio element is ready
      if (!audioRef.current.src && audioRef.current.srcObject === null) {
        console.warn('Audio element has no src');
        return;
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      contextRef.current = ctx;

      // Create Source
      let source: MediaElementAudioSourceNode;
      try {
        source = ctx.createMediaElementSource(audioRef.current);
        sourceRef.current = source;
      } catch (err) {
        console.warn('Could not create MediaElementSourceNode:', err);
        return;
      }

      // 1. EQ
      const eqLow = ctx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = 250;
      eqLowRef.current = eqLow;
      nodesRef.current.push(eqLow);

      const eqMid = ctx.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.value = 1000;
      eqMid.Q.value = 1;
      eqMidRef.current = eqMid;
      nodesRef.current.push(eqMid);

      const eqHigh = ctx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = 4000;
      eqHighRef.current = eqHigh;
      nodesRef.current.push(eqHigh);

      // 2. Compressor (Punch)
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.knee.value = 30;
      comp.ratio.value = 12;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      compRef.current = comp;
      nodesRef.current.push(comp);

      // 3. Delay (Echo) - Parallel chain with proper feedback control
      const delay = ctx.createDelay(2.0);
      delay.delayTime.value = 0.4;
      const delayDry = ctx.createGain();
      delayDry.gain.value = 1;
      const delayWet = ctx.createGain();
      delayWet.gain.value = 0;

      delayRef.current = delay;
      delayWetRef.current = delayWet;
      delayDryRef.current = delayDry;
      nodesRef.current.push(delay, delayDry, delayWet);

      // 4. Reverb (Space) - Parallel chain
      const convolver = ctx.createConvolver();
      try {
        convolver.buffer = createReverbImpulse(ctx, 2.5, 2.0);
      } catch (err) {
        console.warn('Could not set convolver buffer:', err);
        return;
      }

      const reverbWet = ctx.createGain();
      reverbWet.gain.value = 0;
      convolverRef.current = convolver;
      reverbWetRef.current = reverbWet;
      nodesRef.current.push(convolver, reverbWet);

      // 5. Limiter (Clipping prevention)
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -0.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.1;
      limiterRef.current = limiter;
      nodesRef.current.push(limiter);

      // Master
      const masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGainRef.current = masterGain;
      nodesRef.current.push(masterGain);

      // Routing
      source.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(comp);

      // Dry signal path
      comp.connect(masterGain);

      // Delay parallel path (no feedback loop)
      comp.connect(delay);
      delay.connect(delayDry);
      delayDry.connect(delayWet);
      delayWet.connect(masterGain);

      // Reverb parallel path
      comp.connect(convolver);
      convolver.connect(reverbWet);
      reverbWet.connect(masterGain);

      // Limiter prevents clipping
      masterGain.connect(limiter);
      limiter.connect(ctx.destination);

      isInitializedRef.current = true;
    } catch (err) {
      console.error('Error initializing FX:', err);
      cleanupFX();
    }
  }, [audioRef, cleanupFX]);

  // Handle active state
  useEffect(() => {
    if (isActive && !isInitializedRef.current && audioRef.current) {
      initFX();
    }
  }, [isActive, initFX, audioRef]);

  // Suspend/Resume based on isPlaying and isActive
  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx) return;

    if (isActive && isPlaying) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(err => console.warn('Could not resume AudioContext:', err));
      }
    } else {
      if (ctx.state === 'running') {
        ctx.suspend().catch(err => console.warn('Could not suspend AudioContext:', err));
      }
    }
  }, [isActive, isPlaying]);

  // Handle seeks/scrubbing by clearing delay/reverb buffers when a time jump occurs
  const lastTimeRef = useRef(currentTime);
  useEffect(() => {
    if (!isInitializedRef.current || !isActive) {
      lastTimeRef.current = currentTime;
      return;
    }

    const delta = Math.abs(currentTime - lastTimeRef.current);
    // If the time jumps by more than 0.5s, it's a seek/scrub, not normal playback
    if (delta > 0.5) {
      const ctx = contextRef.current;
      const delay = delayRef.current;
      const delayDry = delayDryRef.current;
      const comp = compRef.current;
      const convolver = convolverRef.current;
      const reverbWet = reverbWetRef.current;

      if (ctx && delay && delayDry && comp && convolver && reverbWet) {
        // True flush in Web Audio: Disconnect the nodes and reconnect them,
        // OR reset the delay time momentarily. Recreating nodes is the most foolproof,
        // but resetting the delayTime property forces the delay buffer to clear in most browsers.
        const currentDelayTime = delay.delayTime.value;
        const now = ctx.currentTime;

        // Temporarily mute input to avoid pops, then reset buffer by changing delay time to 0 and back
        delay.delayTime.cancelScheduledValues(now);
        delay.delayTime.setValueAtTime(currentDelayTime, now);
        delay.delayTime.setValueAtTime(0, now + 0.01);
        delay.delayTime.setValueAtTime(currentDelayTime, now + 0.05);

        // For convolver, disconnecting and reconnecting is the only way to clear its internal state
        // safely without re-fetching/re-assigning the buffer which is expensive.
        try {
          comp.disconnect(convolver);
          convolver.disconnect(reverbWet);

          // Reconnect after a tiny delay using a setTimeout since we can't schedule disconnects
          setTimeout(() => {
            if (compRef.current && convolverRef.current && reverbWetRef.current) {
               compRef.current.connect(convolverRef.current);
               convolverRef.current.connect(reverbWetRef.current);
            }
          }, 50);
        } catch (e) {
          // ignore disconnect errors
        }
      }
    }

    lastTimeRef.current = currentTime;
  }, [currentTime, isActive, settings]);

  // Apply settings
  useEffect(() => {
    if (!isInitializedRef.current) return;

    try {
      if (eqLowRef.current) eqLowRef.current.gain.value = settings.eqLow;
      if (eqMidRef.current) eqMidRef.current.gain.value = settings.eqMid;
      if (eqHighRef.current) eqHighRef.current.gain.value = settings.eqHigh;

      if (compRef.current) {
        const punchAmount = settings.punch / 100;
        compRef.current.threshold.value = -50 * punchAmount;
        compRef.current.ratio.value = 1 + (19 * punchAmount);
      }

      if (delayWetRef.current) {
        delayWetRef.current.gain.value = (settings.echo / 100) * 0.7;
      }

      if (reverbWetRef.current) {
        reverbWetRef.current.gain.value = (settings.space / 100) * 1.0;
      }
    } catch (err) {
      console.warn('Error applying FX settings:', err);
    }
  }, [settings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupFX();
    };
  }, [cleanupFX]);

  return { isInitialized: isInitializedRef.current };
}
