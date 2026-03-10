import React, { useState, useRef, useEffect, useCallback } from 'react';

// --- Constants ---
const FREQ_LOW = 100;
const FREQ_MID_DEFAULT = 1000;
const FREQ_HIGH = 10000;
const GAIN_MIN = -12;
const GAIN_MAX = 12;
const HIT_RADIUS = 30;
const COLOR_LOW = '#60A5FA';
const COLOR_MID = '#FBBF24';
const COLOR_HIGH = '#F472B6';
const CURVE_POINTS = 100;
const SWEEP_MIN = 80;
const SWEEP_MAX = 16000;

function freqToX(freq: number, width: number): number {
  return ((Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))) * width;
}

/** Normalize frequency to 0..1 on a log scale across SWEEP_MIN–SWEEP_MAX */
function freqToT(freq: number): number {
  return Math.log(freq / SWEEP_MIN) / Math.log(SWEEP_MAX / SWEEP_MIN);
}

/** Map 0..1 back to frequency */
function tToFreq(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round(SWEEP_MIN * Math.pow(SWEEP_MAX / SWEEP_MIN, clamped));
}

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}Hz`;
}

function buildCurveFreqs(): Float32Array {
  const arr = new Float32Array(CURVE_POINTS);
  for (let i = 0; i < CURVE_POINTS; i++) {
    arr[i] = 20 * Math.pow(1000, i / (CURVE_POINTS - 1));
  }
  return arr;
}

interface GainState {
  low: number;
  mid: number;
  high: number;
}

interface SpectralEQProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
  dataArrayRef: React.RefObject<Uint8Array | null>;
  audioContext: AudioContext | null;
  externalSource?: AudioNode | null;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  destinationNode?: AudioNode | null;
  isActive?: boolean;
}

export const SpectralEQ: React.FC<SpectralEQProps> = ({
  analyserRef,
  dataArrayRef,
  audioContext,
  externalSource = null,
  audioRef,
  destinationNode = null,
  isActive = true,
}) => {
  const [gains, setGains] = useState<GainState>({ low: 0, mid: 0, high: 0 });
  const [midFreq, setMidFreq] = useState(FREQ_MID_DEFAULT);

  // Stale-closure bridges (read inside rAF loop without stale closures)
  const gainsRef = useRef<GainState>(gains);
  gainsRef.current = gains;
  const midFreqRef = useRef(FREQ_MID_DEFAULT);
  midFreqRef.current = midFreq;

  // Filter nodes
  const lowFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const highFilterRef = useRef<BiquadFilterNode | null>(null);
  const internalAudioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioNode | null>(null);

  // Canvas + rAF
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // EQ curve data — pre-allocated, updated in place
  const curveMagRef = useRef<Float32Array>(new Float32Array(CURVE_POINTS).fill(1));
  const curveFreqsRef = useRef<Float32Array>(buildCurveFreqs());
  const magLowRef = useRef<Float32Array>(new Float32Array(CURVE_POINTS));
  const magMidRef = useRef<Float32Array>(new Float32Array(CURVE_POINTS));
  const magHighRef = useRef<Float32Array>(new Float32Array(CURVE_POINTS));
  const phaseRef = useRef<Float32Array>(new Float32Array(CURVE_POINTS));

  // Gain-drag state
  const activeNodeRef = useRef<'low' | 'mid' | 'high' | null>(null);
  const dragStartYRef = useRef(0);
  const dragStartGainRef = useRef(0);

  // Frequency sweep knob state
  const sweepTrackRef = useRef<HTMLDivElement>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const isSweepingRef = useRef(false);   // sync guard for move handler
  const sweepStartXRef = useRef(0);
  const sweepStartTRef = useRef(0);

  // --- Audio Graph ---
  const initializeAudio = useCallback((ctx: AudioContext, sourceNode: AudioNode) => {
    // Disconnect previous chain if any
    try { audioSourceRef.current?.disconnect(lowFilterRef.current!); } catch {}

    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 100;
    low.gain.value = gainsRef.current.low;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = midFreqRef.current;
    mid.Q.value = 0.5;
    mid.gain.value = gainsRef.current.mid;

    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 5000;
    high.gain.value = gainsRef.current.high;

    sourceNode.connect(low);
    low.connect(mid);
    mid.connect(high);
    high.connect(destinationNode ?? ctx.destination);

    lowFilterRef.current = low;
    midFilterRef.current = mid;
    highFilterRef.current = high;
    audioSourceRef.current = sourceNode;

    recomputeCurve();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationNode]);

  // External source path (mic/monitoring)
  useEffect(() => {
    if (!isActive || !externalSource || !audioContext) return;

    const init = async () => {
      if (audioContext.state === 'suspended') await audioContext.resume();
      initializeAudio(audioContext, externalSource);
    };
    init();

    return () => {
      try { audioSourceRef.current?.disconnect(lowFilterRef.current!); } catch {}
      lowFilterRef.current = null;
      midFilterRef.current = null;
      highFilterRef.current = null;
      audioSourceRef.current = null;
    };
  }, [isActive, externalSource, audioContext, initializeAudio]);

  // Playback path — lazy init on 'play' event
  useEffect(() => {
    if (!isActive || !audioRef?.current || externalSource) return;

    const audio = audioRef.current;
    let initialized = false;

    const handlePlay = async () => {
      if (initialized || internalAudioCtxRef.current) return;
      initialized = true;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass() as AudioContext;
      internalAudioCtxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();
      const source = ctx.createMediaElementSource(audio);
      initializeAudio(ctx, source);
    };

    audio.addEventListener('play', handlePlay);
    return () => audio.removeEventListener('play', handlePlay);
  }, [isActive, audioRef, externalSource, initializeAudio]);

  // --- Recompute EQ curve in place ---
  const recomputeCurve = useCallback(() => {
    if (!lowFilterRef.current || !midFilterRef.current || !highFilterRef.current) return;
    const freqs = curveFreqsRef.current;
    const phase = phaseRef.current;
    lowFilterRef.current.getFrequencyResponse(freqs as Float32Array<ArrayBuffer>, magLowRef.current as Float32Array<ArrayBuffer>, phase as Float32Array<ArrayBuffer>);
    midFilterRef.current.getFrequencyResponse(freqs as Float32Array<ArrayBuffer>, magMidRef.current as Float32Array<ArrayBuffer>, phase as Float32Array<ArrayBuffer>);
    highFilterRef.current.getFrequencyResponse(freqs as Float32Array<ArrayBuffer>, magHighRef.current as Float32Array<ArrayBuffer>, phase as Float32Array<ArrayBuffer>);
    for (let i = 0; i < CURVE_POINTS; i++) {
      curveMagRef.current[i] = magLowRef.current[i] * magMidRef.current[i] * magHighRef.current[i];
    }
  }, []);

  // Sync filter gains when state changes
  useEffect(() => {
    if (lowFilterRef.current) lowFilterRef.current.gain.value = gains.low;
    if (midFilterRef.current) midFilterRef.current.gain.value = gains.mid;
    if (highFilterRef.current) highFilterRef.current.gain.value = gains.high;
    recomputeCurve();
  }, [gains, recomputeCurve]);

  // Sync mid filter frequency when sweep changes
  useEffect(() => {
    if (midFilterRef.current) midFilterRef.current.frequency.value = midFreq;
    recomputeCurve();
  }, [midFreq, recomputeCurve]);

  // --- Canvas Render Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      ctx2d.scale(dpr, dpr);
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
    };

    setTimeout(resizeCanvas, 50);
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const centerY = h / 2;

      ctx2d.clearRect(0, 0, w, h);

      // --- Layer 1: Spectrum bars (when analyser active) ---
      if (analyserRef.current && dataArrayRef.current) {
        const dataArray = dataArrayRef.current;
        analyserRef.current.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);

        const barCount = 64;
        const barWidth = w / barCount;
        const sampleRate = audioContext?.sampleRate ?? 44100;
        const nyquist = sampleRate / 2;

        for (let i = 0; i < barCount; i++) {
          const freqStart = 20 * Math.pow(20000 / 20, i / barCount);
          const freqEnd = 20 * Math.pow(20000 / 20, (i + 1) / barCount);
          const geoMean = Math.sqrt(freqStart * freqEnd);

          const binStart = Math.floor((freqStart / nyquist) * dataArray.length);
          const binEnd = Math.floor((freqEnd / nyquist) * dataArray.length);

          let sum = 0, count = 0;
          for (let j = binStart; j <= binEnd && j < dataArray.length; j++) {
            sum += dataArray[j]; count++;
          }
          const magnitude = count > 0 ? sum / count : 0;
          const barHeight = (magnitude / 255) * h * 0.6;
          const x = i * barWidth;

          let color: string;
          if (geoMean < 300) color = COLOR_LOW;
          else if (geoMean < 5000) color = COLOR_MID;
          else color = COLOR_HIGH;

          const grad = ctx2d.createLinearGradient(x, h, x, h - barHeight);
          grad.addColorStop(0, color + 'CC');   // 80% opacity
          grad.addColorStop(1, color + '33');   // 20% opacity
          ctx2d.fillStyle = grad;
          ctx2d.fillRect(x + 1, h - barHeight, barWidth - 2, barHeight);
        }
      } else {
        // Idle: flat dashed center line
        ctx2d.beginPath();
        ctx2d.setLineDash([4, 6]);
        ctx2d.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx2d.lineWidth = 1;
        ctx2d.moveTo(0, centerY);
        ctx2d.lineTo(w, centerY);
        ctx2d.stroke();
        ctx2d.setLineDash([]);
      }

      // --- Layer 2: EQ curve + fill ---
      const curveMag = curveMagRef.current;

      // 0dB reference line
      ctx2d.beginPath();
      ctx2d.setLineDash([3, 5]);
      ctx2d.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx2d.lineWidth = 1;
      ctx2d.moveTo(0, centerY);
      ctx2d.lineTo(w, centerY);
      ctx2d.stroke();
      ctx2d.setLineDash([]);

      // Build curve path
      ctx2d.beginPath();
      for (let i = 0; i < CURVE_POINTS; i++) {
        const xPos = (i / (CURVE_POINTS - 1)) * w;
        const mag = curveMag[i];
        const yPos = mag > 0 ? centerY - (Math.log10(mag) / Math.log10(4)) * h * 0.4 : centerY;
        if (i === 0) ctx2d.moveTo(xPos, yPos);
        else ctx2d.lineTo(xPos, yPos);
      }

      // Fill under curve
      ctx2d.lineTo(w, centerY);
      ctx2d.lineTo(0, centerY);
      ctx2d.closePath();
      const fillGrad = ctx2d.createLinearGradient(0, 0, 0, h);
      fillGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
      fillGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx2d.fillStyle = fillGrad;
      ctx2d.fill();

      // Stroke curve
      ctx2d.beginPath();
      for (let i = 0; i < CURVE_POINTS; i++) {
        const xPos = (i / (CURVE_POINTS - 1)) * w;
        const mag = curveMag[i];
        const yPos = mag > 0 ? centerY - (Math.log10(mag) / Math.log10(4)) * h * 0.4 : centerY;
        if (i === 0) ctx2d.moveTo(xPos, yPos);
        else ctx2d.lineTo(xPos, yPos);
      }
      ctx2d.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx2d.lineWidth = 1.5;
      ctx2d.stroke();

      // --- Layer 3: Draggable nodes ---
      const nodes: Array<{ key: keyof GainState; freq: number; color: string; label: string }> = [
        { key: 'low', freq: FREQ_LOW, color: COLOR_LOW, label: 'L' },
        { key: 'mid', freq: midFreqRef.current, color: COLOR_MID, label: 'M' },
        { key: 'high', freq: FREQ_HIGH, color: COLOR_HIGH, label: 'H' },
      ];

      const currentGains = gainsRef.current;
      nodes.forEach(({ key, freq, color, label }) => {
        const nx = freqToX(freq, w);
        const gain = currentGains[key];
        const ny = centerY - (gain / 12) * centerY * 0.85;
        const isNodeActive = activeNodeRef.current === key;

        // Glow ring when active
        if (isNodeActive) {
          ctx2d.beginPath();
          ctx2d.arc(nx, ny, 18, 0, Math.PI * 2);
          ctx2d.strokeStyle = color + '88';
          ctx2d.lineWidth = 1.5;
          ctx2d.stroke();
        }

        // Node circle
        ctx2d.beginPath();
        ctx2d.arc(nx, ny, 10, 0, Math.PI * 2);
        ctx2d.fillStyle = isNodeActive ? color : color + 'BB';
        ctx2d.fill();
        ctx2d.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx2d.lineWidth = 1;
        ctx2d.stroke();

        // Label
        ctx2d.fillStyle = '#000';
        ctx2d.font = 'bold 9px monospace';
        ctx2d.textAlign = 'center';
        ctx2d.textBaseline = 'middle';
        ctx2d.fillText(label, nx, ny);

        // dB readout
        if (gain !== 0 || isNodeActive) {
          const readout = `${gain > 0 ? '+' : ''}${gain.toFixed(1)}`;
          ctx2d.fillStyle = color;
          ctx2d.font = '8px monospace';
          ctx2d.textAlign = 'center';
          ctx2d.textBaseline = 'bottom';
          ctx2d.fillText(readout, nx, ny - 13);
        }
      });

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioContext]);

  // --- Pointer Handlers ---
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const centerY = h / 2;

    const nodes: Array<{ key: keyof GainState; freq: number }> = [
      { key: 'low', freq: FREQ_LOW },
      { key: 'mid', freq: midFreqRef.current },
      { key: 'high', freq: FREQ_HIGH },
    ];

    for (const { key, freq } of nodes) {
      const nx = freqToX(freq, w);
      const gain = gainsRef.current[key];
      const ny = centerY - (gain / 12) * centerY * 0.85;
      const dist = Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);
      if (dist <= HIT_RADIUS) {
        activeNodeRef.current = key;
        dragStartYRef.current = e.clientY;
        dragStartGainRef.current = gain;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        break;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeNodeRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const h = canvas.height / dpr;
    const centerY = h / 2;
    // ±12dB spans centerY * 0.85 px each direction
    const pxPerDb = (centerY * 0.85) / 12;
    const deltaY = dragStartYRef.current - e.clientY;
    const newGain = Math.max(GAIN_MIN, Math.min(GAIN_MAX, dragStartGainRef.current + deltaY / pxPerDb));
    const key = activeNodeRef.current;
    setGains(prev => ({ ...prev, [key]: Math.round(newGain * 10) / 10 }));
  };

  const handlePointerUp = () => {
    activeNodeRef.current = null;
  };

  // --- Sweep knob handlers ---
  const handleSweepDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isSweepingRef.current = true;
    setIsSweeping(true);
    sweepStartXRef.current = e.clientX;
    sweepStartTRef.current = freqToT(midFreqRef.current);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSweepMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSweepingRef.current) return;
    const track = sweepTrackRef.current;
    if (!track) return;
    const trackWidth = track.clientWidth;
    const deltaX = e.clientX - sweepStartXRef.current;
    setMidFreq(tToFreq(sweepStartTRef.current + deltaX / trackWidth));
  };

  const handleSweepUp = () => {
    isSweepingRef.current = false;
    setIsSweeping(false);
  };

  const resetAll = () => {
    setGains({ low: 0, mid: 0, high: 0 });
    setMidFreq(FREQ_MID_DEFAULT);
  };
  const anyActive = gains.low !== 0 || gains.mid !== 0 || gains.high !== 0 || midFreq !== FREQ_MID_DEFAULT;

  return (
    <div className="w-full flex flex-col gap-2 relative">
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/40">EQ</span>
        <button
          disabled={!anyActive}
          onClick={resetAll}
          className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors px-2 py-0.5 rounded border border-white/10 hover:border-white/20"
        >
          RESET
        </button>
      </div>

      <div className="h-44 bg-black/40 rounded-3xl overflow-hidden border border-white/5 touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      {/* Frequency sweep knob */}
      <div className="px-2 flex flex-col gap-1.5 touch-none select-none">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-white/25">MID SWEEP</span>
          <span
            className="text-[9px] font-mono tabular-nums transition-colors"
            style={{ color: midFreq !== FREQ_MID_DEFAULT ? COLOR_MID : 'rgba(255,255,255,0.25)' }}
          >
            {formatFreq(midFreq)}
          </span>
        </div>
        <div
          ref={sweepTrackRef}
          className="relative h-8 flex items-center cursor-ew-resize"
          onPointerDown={handleSweepDown}
          onPointerMove={handleSweepMove}
          onPointerUp={handleSweepUp}
          onPointerCancel={handleSweepUp}
        >
          {/* Track line */}
          <div className="absolute inset-x-0 h-px bg-white/10 rounded-full" />
          {/* Filled portion left of thumb */}
          <div
            className="absolute left-0 h-px rounded-full transition-none"
            style={{
              width: `${freqToT(midFreq) * 100}%`,
              backgroundColor: COLOR_MID + '60',
            }}
          />
          {/* Thumb */}
          <div
            className="absolute -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-none"
            style={{
              left: `${freqToT(midFreq) * 100}%`,
              backgroundColor: COLOR_MID + '22',
              border: `1.5px solid ${COLOR_MID}99`,
              boxShadow: isSweeping ? `0 0 10px ${COLOR_MID}44` : 'none',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: COLOR_MID }}
            />
          </div>
          {/* Freq tick marks at octave boundaries */}
          {[100, 200, 500, 1000, 2000, 5000, 8000].map(f => (
            <div
              key={f}
              className="absolute bottom-0 w-px h-1.5 bg-white/10"
              style={{ left: `${freqToT(f) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
