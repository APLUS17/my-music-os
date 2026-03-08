import React, { useState, useEffect, useRef } from 'react';
import { Sliders, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EQControlsProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isActive?: boolean;
}

export const EQControls: React.FC<EQControlsProps> = ({ audioRef, isActive = true }) => {
  const [lowGain, setLowGain] = useState(0);
  const [midGain, setMidGain] = useState(0);
  const [highGain, setHighGain] = useState(0);
  const [showEQ, setShowEQ] = useState(false);

  const lowFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const highFilterRef = useRef<BiquadFilterNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Initialize Web Audio API
  useEffect(() => {
    if (!isActive || !audioRef.current) return;

    const audio = audioRef.current;

    const initializeAudio = () => {
      if (audioContextRef.current) return;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaElementSource(audio);
      sourceRef.current = source;

      const lowFilter = audioContext.createBiquadFilter();
      lowFilter.type = 'lowshelf';
      lowFilter.frequency.value = 100;
      lowFilter.gain.value = lowGain;

      const midFilter = audioContext.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 0.5;
      midFilter.gain.value = midGain;

      const highFilter = audioContext.createBiquadFilter();
      highFilter.type = 'highshelf';
      highFilter.frequency.value = 5000;
      highFilter.gain.value = highGain;

      source.connect(lowFilter);
      lowFilter.connect(midFilter);
      midFilter.connect(highFilter);
      highFilter.connect(audioContext.destination);

      lowFilterRef.current = lowFilter;
      midFilterRef.current = midFilter;
      highFilterRef.current = highFilter;
    };

    const handlePlay = () => initializeAudio();
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('play', handlePlay);
    };
  }, [isActive, audioRef]);

  useEffect(() => {
    if (lowFilterRef.current) lowFilterRef.current.gain.value = lowGain;
  }, [lowGain]);

  useEffect(() => {
    if (midFilterRef.current) midFilterRef.current.gain.value = midGain;
  }, [midGain]);

  useEffect(() => {
    if (highFilterRef.current) highFilterRef.current.gain.value = highGain;
  }, [highGain]);

  const resetEQ = () => {
    setLowGain(0);
    setMidGain(0);
    setHighGain(0);
  };

  const isAnyActive = lowGain !== 0 || midGain !== 0 || highGain !== 0;

  return (
    <div className="w-full">
      <Button
        variant="ghost"
        onClick={() => setShowEQ(!showEQ)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-6 bg-white/5 border border-white/10 rounded-xl transition-all font-mono uppercase tracking-widest text-[10px]",
          showEQ && "bg-white/10 border-white/20"
        )}
      >
        <span className="flex items-center gap-2">
          <Sliders size={14} className={cn("transition-colors", isAnyActive ? "text-[var(--accent)]" : "text-white/40")} />
          EQ SETTINGS
        </span>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[8px]",
          isAnyActive ? "bg-[var(--accent)] text-black font-bold" : "bg-white/10 text-white/40"
        )}>
          {isAnyActive ? 'ACTIVE' : 'DEFAULT'}
        </span>
      </Button>

      {showEQ && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-3 p-4 bg-white/5 border border-white/10 rounded-2xl space-y-6 overflow-hidden"
        >
          {/* Low */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] mono uppercase tracking-widest text-white/50">Low (100Hz)</label>
              <span className={cn("text-[10px] mono", lowGain !== 0 ? "text-[var(--accent)]" : "text-white/30")}>
                {lowGain > 0 ? '+' : ''}{lowGain.toFixed(1)}dB
              </span>
            </div>
            <Slider
              min={-12}
              max={12}
              step={0.5}
              value={[lowGain]}
              onValueChange={(val) => setLowGain(val[0])}
            />
          </div>

          {/* Mid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] mono uppercase tracking-widest text-white/50">Mid (1kHz)</label>
              <span className={cn("text-[10px] mono", midGain !== 0 ? "text-[var(--accent)]" : "text-white/30")}>
                {midGain > 0 ? '+' : ''}{midGain.toFixed(1)}dB
              </span>
            </div>
            <Slider
              min={-12}
              max={12}
              step={0.5}
              value={[midGain]}
              onValueChange={(val) => setMidGain(val[0])}
            />
          </div>

          {/* High */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] mono uppercase tracking-widest text-white/50">High (5kHz)</label>
              <span className={cn("text-[10px] mono", highGain !== 0 ? "text-[var(--accent)]" : "text-white/30")}>
                {highGain > 0 ? '+' : ''}{highGain.toFixed(1)}dB
              </span>
            </div>
            <Slider
              min={-12}
              max={12}
              step={0.5}
              value={[highGain]}
              onValueChange={(val) => setHighGain(val[0])}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={resetEQ}
            disabled={!isAnyActive}
            className="w-full text-[9px] mono uppercase tracking-widest gap-2 rounded-xl py-4"
          >
            <RotateCcw size={12} />
            Reset EQ
          </Button>
        </motion.div>
      )}
    </div>
  );
};
