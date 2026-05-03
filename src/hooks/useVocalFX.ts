import { useEffect, useRef, useState, useCallback } from 'react';
import { FXSettings } from '@/components/studio/FXPanel';

// Create a synthesized impulse response for Reverb (Space)
function createReverbImpulse(context: AudioContext, duration: number, decay: number) {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);

  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const reverseT = length - i;
    // Exponential decay
    const val = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    left[i] = val;
    right[i] = val;
  }
  return impulse;
}

export function useVocalFX(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  settings: FXSettings,
  isActive: boolean
) {
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Nodes
  const eqLowRef = useRef<BiquadFilterNode | null>(null);
  const eqMidRef = useRef<BiquadFilterNode | null>(null);
  const eqHighRef = useRef<BiquadFilterNode | null>(null);

  const compRef = useRef<DynamicsCompressorNode | null>(null);

  const delayRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const delayWetRef = useRef<GainNode | null>(null);

  const convolverRef = useRef<ConvolverNode | null>(null);
  const reverbWetRef = useRef<GainNode | null>(null);

  const masterGainRef = useRef<GainNode | null>(null);
  const isInitializedRef = useRef(false);

  // Initialization
  const initFX = useCallback(() => {
    if (!audioRef.current || isInitializedRef.current) return;

    // Use an existing AudioContext on the window if available, or create a new one
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    contextRef.current = ctx;

    // Create Source
    try {
      sourceRef.current = ctx.createMediaElementSource(audioRef.current);
    } catch (err) {
      console.warn("Could not create MediaElementSourceNode (possibly already created).", err);
      // If we can't create it, we can't build the chain properly for this element.
      return;
    }

    const source = sourceRef.current;

    // 1. EQ
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 250;
    eqLowRef.current = eqLow;

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1;
    eqMidRef.current = eqMid;

    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 4000;
    eqHighRef.current = eqHigh;

    // 2. Compressor (Punch)
    const comp = ctx.createDynamicsCompressor();
    // Default settings
    comp.threshold.value = -24;
    comp.knee.value = 30;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    compRef.current = comp;

    // 3. Delay (Echo) - Parallel chain
    const delay = ctx.createDelay(2.0); // max 2 seconds
    delay.delayTime.value = 0.4; // 400ms default
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.3; // 30% feedback
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0;

    delayRef.current = delay;
    delayFeedbackRef.current = delayFeedback;
    delayWetRef.current = delayWet;

    // 4. Reverb (Space) - Parallel chain
    const convolver = ctx.createConvolver();
    convolver.buffer = createReverbImpulse(ctx, 2.5, 2.0); // 2.5s duration
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0;

    convolverRef.current = convolver;
    reverbWetRef.current = reverbWet;

    // Master
    const masterGain = ctx.createGain();
    masterGainRef.current = masterGain;

    // Routing
    // Dry Chain
    source.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(comp);
    comp.connect(masterGain);

    // Delay Routing
    comp.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(masterGain);

    // Reverb Routing
    comp.connect(convolver);
    convolver.connect(reverbWet);
    reverbWet.connect(masterGain);

    masterGain.connect(ctx.destination);

    isInitializedRef.current = true;
  }, [audioRef]);

  // Handle active state
  useEffect(() => {
    if (isActive && !isInitializedRef.current && audioRef.current) {
        initFX();
    }
  }, [isActive, initFX, audioRef]);

  // Ensure AudioContext is resumed if suspended
  useEffect(() => {
      if (isActive && contextRef.current?.state === 'suspended') {
          contextRef.current.resume();
      }
  }, [isActive, settings]);

  // Apply settings
  useEffect(() => {
    if (!isInitializedRef.current) return;

    // EQ
    if (eqLowRef.current) eqLowRef.current.gain.value = settings.eqLow;
    if (eqMidRef.current) eqMidRef.current.gain.value = settings.eqMid;
    if (eqHighRef.current) eqHighRef.current.gain.value = settings.eqHigh;

    // Punch (Compressor)
    // Map 0-100 to a practical range:
    // 0 = basically bypassed (threshold 0)
    // 100 = heavy compression (threshold -40, high ratio)
    if (compRef.current) {
        const punchAmount = settings.punch / 100;
        compRef.current.threshold.value = -50 * punchAmount;
        compRef.current.ratio.value = 1 + (19 * punchAmount); // 1:1 to 20:1
    }

    // Echo (Delay Wet Gain)
    // Map 0-100 to 0.0 - 0.7 gain
    if (delayWetRef.current) {
        delayWetRef.current.gain.value = (settings.echo / 100) * 0.7;
    }

    // Space (Reverb Wet Gain)
    // Map 0-100 to 0.0 - 1.0 gain
    if (reverbWetRef.current) {
        reverbWetRef.current.gain.value = (settings.space / 100) * 1.0;
    }

  }, [settings, isActive]);

  return { isInitialized: isInitializedRef.current };
}
