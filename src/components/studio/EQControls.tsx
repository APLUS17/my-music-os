import React, { useState, useEffect, useRef } from 'react';
import { Sliders } from 'lucide-react';

interface EQControlsProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isActive?: boolean;
}

export const EQControls: React.FC<EQControlsProps> = ({ audioRef, isActive = true }) => {
  const [lowGain, setLowGain] = useState(0);
  const [midGain, setMidGain] = useState(0);
  const [highGain, setHighGain] = useState(0);
  const [showEQ, setShowEQ] = useState(false);

  const analyserRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const highFilterRef = useRef<BiquadFilterNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSource | null>(null);

  // Initialize Web Audio API
  useEffect(() => {
    if (!isActive || !audioRef.current) return;

    const audio = audioRef.current;

    // Create audio context on first interaction
    const initializeAudio = () => {
      if (audioContextRef.current) return;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create source from audio element
      const source = audioContext.createMediaElementSource(audio);
      sourceRef.current = source;

      // Create filters
      const lowFilter = audioContext.createBiquadFilter();
      lowFilter.type = 'lowshelf';
      lowFilter.frequency.value = 100;
      lowFilter.gain.value = 0;

      const midFilter = audioContext.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 0.5;
      midFilter.gain.value = 0;

      const highFilter = audioContext.createBiquadFilter();
      highFilter.type = 'highshelf';
      highFilter.frequency.value = 5000;
      highFilter.gain.value = 0;

      // Connect: source → lowFilter → midFilter → highFilter → destination
      source.connect(lowFilter);
      lowFilter.connect(midFilter);
      midFilter.connect(highFilter);
      highFilter.connect(audioContext.destination);

      analyserRef.current = lowFilter;
      midFilterRef.current = midFilter;
      highFilterRef.current = highFilter;
    };

    // Initialize on audio play
    const handlePlay = () => initializeAudio();
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('play', handlePlay);
    };
  }, [isActive, audioRef]);

  // Update low gain
  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.gain.value = lowGain;
    }
  }, [lowGain]);

  // Update mid gain
  useEffect(() => {
    if (midFilterRef.current) {
      midFilterRef.current.gain.value = midGain;
    }
  }, [midGain]);

  // Update high gain
  useEffect(() => {
    if (highFilterRef.current) {
      highFilterRef.current.gain.value = highGain;
    }
  }, [highGain]);

  const resetEQ = () => {
    setLowGain(0);
    setMidGain(0);
    setHighGain(0);
  };

  return (
    <div className="w-full">
      <button
        onClick={() => setShowEQ(!showEQ)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-lg hover:bg-[var(--bg-hover)] transition-all text-[12px] mono uppercase tracking-wider text-[var(--text-secondary)]"
      >
        <span className="flex items-center gap-2">
          <Sliders size={14} />
          EQ
        </span>
        <span className={`text-[10px] ${lowGain !== 0 || midGain !== 0 || highGain !== 0 ? 'text-[var(--accent)]' : 'opacity-50'}`}>
          {lowGain !== 0 || midGain !== 0 || highGain !== 0 ? 'Active' : 'Off'}
        </span>
      </button>

      {showEQ && (
        <div className="mt-3 p-3 bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-lg space-y-3">
          {/* Low */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] mono uppercase tracking-wider text-[var(--text-secondary)]">Low (100Hz)</label>
              <span className="text-[9px] mono text-[var(--text-tertiary)]">{lowGain > 0 ? '+' : ''}{lowGain}dB</span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={lowGain}
              onChange={(e) => setLowGain(parseFloat(e.target.value))}
              className="w-full h-2 bg-[var(--bg-main)] rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Mid */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] mono uppercase tracking-wider text-[var(--text-secondary)]">Mid (1kHz)</label>
              <span className="text-[9px] mono text-[var(--text-tertiary)]">{midGain > 0 ? '+' : ''}{midGain}dB</span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={midGain}
              onChange={(e) => setMidGain(parseFloat(e.target.value))}
              className="w-full h-2 bg-[var(--bg-main)] rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* High */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] mono uppercase tracking-wider text-[var(--text-secondary)]">High (5kHz)</label>
              <span className="text-[9px] mono text-[var(--text-tertiary)]">{highGain > 0 ? '+' : ''}{highGain}dB</span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={highGain}
              onChange={(e) => setHighGain(parseFloat(e.target.value))}
              className="w-full h-2 bg-[var(--bg-main)] rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <button
            onClick={resetEQ}
            className="w-full text-[9px] mono uppercase tracking-wider py-1.5 bg-[var(--bg-main)] text-[var(--text-tertiary)] hover:text-[var(--text-main)] border border-[var(--border-main)] rounded transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          box-shadow: 0 0 8px rgba(255,255,255,0.2);
        }
        .slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
};
