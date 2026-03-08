import React, { useState, useEffect, useRef } from 'react';
import { Sliders, RotateCcw, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EQControlsProps {
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  externalSource?: AudioNode | null;
  destinationNode?: AudioNode | null;
  audioContext?: AudioContext | null;
  isActive?: boolean;
  isAlwaysOpen?: boolean;
  onCurveChange?: (curve: Float32Array) => void;
}

const Knob = ({
  label,
  value,
  min,
  max,
  onChange,
  unit = "dB",
  color = "var(--accent)"
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit?: string;
  color?: string;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startValRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = startYRef.current - e.clientY;
    const range = max - min;
    const step = range / 200; // Sensitivity
    const newVal = Math.max(min, Math.min(max, startValRef.current + delta * step));
    onChange(newVal);
  };

  const handlePointerUp = () => setIsDragging(false);

  const percentage = ((value - min) / (max - min)) * 100;
  const rotation = (percentage / 100) * 270 - 135; // -135 to 135 degrees

  return (
    <div className="flex flex-col items-center gap-3 group">
      <div className="relative flex flex-col items-center">
        {/* LCD Display */}
        <div className={cn(
          "mb-3 px-2 py-1 bg-black/80 rounded border border-white/5 min-w-[55px] text-center shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all duration-300",
          value !== 0 ? "border-[var(--accent)]/30" : "border-white/5"
        )}>
          <span className={cn(
            "text-[10px] font-mono transition-all duration-300 tracking-tighter",
            value !== 0 ? "text-white drop-shadow-[0_0_8px_white]" : "text-white/40"
          )} style={{ color: value !== 0 ? color : undefined, textShadow: value !== 0 ? `0 0 10px ${color}` : 'none' }}>
            {value > 0 ? '+' : ''}{value.toFixed(1)}{unit}
          </span>
        </div>

        {/* Knob Body */}
        <div
          className="relative w-14 h-14 cursor-ns-resize touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Scale Marks */}
          <svg className="absolute inset-0 -rotate-90 w-full h-full opacity-20 group-hover:opacity-40 transition-opacity">
            <circle cx="28" cy="28" r="24" fill="none" stroke="white" strokeWidth="1" strokeDasharray="1 4" />
          </svg>

          {/* Knob Inner */}
          <motion.div
            className="absolute inset-2 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 shadow-xl flex items-center justify-center overflow-hidden"
            style={{ rotate: rotation }}
          >
            {/* Pointer Indication */}
            <div className="absolute top-1 w-1 h-2 bg-current rounded-full" style={{ color }} />
            <div className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm shadow-inner" />
          </motion.div>

          {/* Active Level Ring */}
          <svg className="absolute inset-0 -rotate-[225deg] w-full h-full pointer-events-none">
            <circle
              cx="28" cy="28" r="22"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeDasharray={`${(percentage / 100) * 103} 200`}
              className="transition-all duration-75"
              style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.2))' }}
            />
          </svg>
        </div>
      </div>
      <label className="text-[8px] mono uppercase tracking-[0.2em] text-white/40 font-bold group-hover:text-white/60 transition-colors">{label}</label>
    </div>
  );
};

export const EQControls: React.FC<EQControlsProps> = ({
  audioRef,
  externalSource = null,
  destinationNode = null,
  audioContext: providedAudioContext = null,
  isActive = true,
  isAlwaysOpen = false,
  onCurveChange
}) => {
  const [lowGain, setLowGain] = useState(0);
  const [midGain, setMidGain] = useState(0);
  const [highGain, setHighGain] = useState(0);
  const [showEQ, setShowEQ] = useState(isAlwaysOpen);
  const [isInitialized, setIsInitialized] = useState(false);

  const lowFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const highFilterRef = useRef<BiquadFilterNode | null>(null);
  const internalAudioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioNode | null>(null);

  // Initialize Web Audio API
  useEffect(() => {
    // Initial Curve Update for UI Visibility
    if (!isInitialized) {
      const flatCurve = new Float32Array(100).fill(1.0);
      onCurveChange?.(flatCurve);
      setIsInitialized(true);
    }

    if (!isActive) return;

    const initializeAudio = (ctx: AudioContext, sourceNode: AudioNode) => {
      const lowFilter = ctx.createBiquadFilter();
      lowFilter.type = 'lowshelf';
      lowFilter.frequency.value = 100;
      lowFilter.gain.value = lowGain;

      const midFilter = ctx.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 0.5;
      midFilter.gain.value = midGain;

      const highFilter = ctx.createBiquadFilter();
      highFilter.type = 'highshelf';
      highFilter.frequency.value = 5000;
      highFilter.gain.value = highGain;

      sourceNode.connect(lowFilter);
      lowFilter.connect(midFilter);
      midFilter.connect(highFilter);
      highFilter.connect(destinationNode || ctx.destination);

      lowFilterRef.current = lowFilter;
      midFilterRef.current = midFilter;
      highFilterRef.current = highFilter;
      sourceRef.current = sourceNode;
    };

    // Case 1: External Source Provided (e.g. Mic Monitoring)
    if (externalSource && providedAudioContext) {
      initializeAudio(providedAudioContext, externalSource);
      updateCurve();
      return () => {
        if (sourceRef.current && lowFilterRef.current) {
          sourceRef.current.disconnect(lowFilterRef.current);
        }
      };
    }

    // Case 2: Audio Element Provided (Playback)
    if (audioRef?.current) {
      const audio = audioRef.current;
      const handlePlay = () => {
        if (internalAudioContextRef.current) return;
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        internalAudioContextRef.current = ctx;
        const source = ctx.createMediaElementSource(audio);
        initializeAudio(ctx, source);
      };

      audio.addEventListener('play', handlePlay);
      return () => audio.removeEventListener('play', handlePlay);
    }
  }, [isActive, audioRef, externalSource, providedAudioContext, destinationNode]);

  useEffect(() => {
    if (lowFilterRef.current) lowFilterRef.current.gain.value = lowGain;
    updateCurve();
  }, [lowGain]);

  useEffect(() => {
    if (midFilterRef.current) midFilterRef.current.gain.value = midGain;
    updateCurve();
  }, [midGain]);

  useEffect(() => {
    if (highFilterRef.current) highFilterRef.current.gain.value = highGain;
    updateCurve();
  }, [highGain]);

  const updateCurve = () => {
    if (!onCurveChange || !lowFilterRef.current || !midFilterRef.current || !highFilterRef.current) return;

    const frequencies = new Float32Array(100);
    const magLow = new Float32Array(100);
    const phaseLow = new Float32Array(100);
    const magMid = new Float32Array(100);
    const phaseMid = new Float32Array(100);
    const magHigh = new Float32Array(100);
    const phaseHigh = new Float32Array(100);

    for (let i = 0; i < 100; i++) {
      // Logarithmic scale for frequency response visualization
      frequencies[i] = 20 * Math.pow(1000, i / 99);
    }

    lowFilterRef.current.getFrequencyResponse(frequencies, magLow, phaseLow);
    midFilterRef.current.getFrequencyResponse(frequencies, magMid, phaseMid);
    highFilterRef.current.getFrequencyResponse(frequencies, magHigh, phaseHigh);

    const totalMag = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      totalMag[i] = magLow[i] * magMid[i] * magHigh[i];
    }

    onCurveChange(totalMag);
  };

  const resetEQ = () => {
    setLowGain(0);
    setMidGain(0);
    setHighGain(0);
  };

  const isAnyActive = lowGain !== 0 || midGain !== 0 || highGain !== 0;

  return (
    <div className="w-full">
      {!isAlwaysOpen && (
        <Button
          variant="ghost"
          onClick={() => setShowEQ(!showEQ)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-7 bg-white/5 border border-white/5 rounded-2xl transition-all font-mono uppercase tracking-[0.2em] text-[10px]",
            showEQ && "bg-white/10 border-white/10 shadow-lg"
          )}
        >
          <span className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(255,255,255,0.5)]",
              showEQ ? "bg-[var(--accent)]" : "bg-white/20 shadow-none"
            )} />
            <Sliders size={15} className={cn("transition-colors", isAnyActive ? "text-[var(--accent)]" : "text-white/30")} />
            CHANNEL STRIP
          </span>
          <span className={cn(
            "px-2.5 py-1 rounded border text-[8px] font-bold transition-all",
            isAnyActive ? "border-[var(--accent)] text-[var(--accent)]" : "border-white/10 text-white/20"
          )}>
            {isAnyActive ? 'ACTIVE' : 'BYPASS'}
          </span>
        </Button>
      )}

      <AnimatePresence>
        {showEQ && (
          <motion.div
            initial={{ height: 0, opacity: 0, scale: 0.95 }}
            animate={{ height: 'auto', opacity: 1, scale: 1 }}
            exit={{ height: 0, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className={cn(
              "p-6 bg-black/40 border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl relative",
              isAlwaysOpen && "mt-0"
            )}
          >
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

            <div className="relative grid grid-cols-3 gap-4 mb-8">
              <Knob label="Low" min={-12} max={12} value={lowGain} onChange={setLowGain} color="#60A5FA" />
              <Knob label="Mid" min={-12} max={12} value={midGain} onChange={setMidGain} color="#FBBF24" />
              <Knob label="High" min={-12} max={12} value={highGain} onChange={setHighGain} color="#F472B6" />
            </div>

            <div className="relative flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={resetEQ}
                disabled={!isAnyActive}
                className="h-10 px-4 text-[9px] mono uppercase tracking-widest gap-2 rounded-xl border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 disabled:opacity-20 transition-all"
              >
                <RotateCcw size={12} />
                Reset
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
