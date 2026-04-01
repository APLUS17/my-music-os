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

type BandKey = 'low' | 'mid' | 'high';

const BAND_CONFIG = {
  low:  { min: 40,   max: 1200,  defaultFreq: FREQ_LOW,         color: COLOR_LOW,  sweepLabel: 'LOW SWEEP',  ticks: [60, 100, 200, 400, 800] },
  mid:  { min: 80,   max: 16000, defaultFreq: FREQ_MID_DEFAULT, color: COLOR_MID,  sweepLabel: 'MID SWEEP',  ticks: [100, 200, 500, 1000, 2000, 5000, 8000] },
  high: { min: 2000, max: 20000, defaultFreq: FREQ_HIGH,        color: COLOR_HIGH, sweepLabel: 'HIGH SWEEP', ticks: [2000, 4000, 8000, 16000] },
} as const;

function freqToX(freq: number, width: number): number {
  return ((Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))) * width;
}

function freqToTRange(freq: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, Math.log(freq / min) / Math.log(max / min)));
}

function tToFreqRange(t: number, min: number, max: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round(min * Math.pow(max / min, clamped));
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

interface FreqState {
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
  const [freqs, setFreqs] = useState<FreqState>({ low: FREQ_LOW, mid: FREQ_MID_DEFAULT, high: FREQ_HIGH });
  const [selectedBand, setSelectedBand] = useState<BandKey>('mid');

  // Stale-closure bridges (read inside rAF loop without stale closures)
  const gainsRef = useRef<GainState>(gains);
  gainsRef.current = gains;
  const freqsRef = useRef<FreqState>(freqs);
  freqsRef.current = freqs;
  const selectedBandRef = useRef<BandKey>('mid');
  selectedBandRef.current = selectedBand;

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

  // Node drag state (both gain and frequency)
  const activeNodeRef = useRef<BandKey | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartGainRef = useRef(0);
  const dragStartFreqRef = useRef(0);

  // --- Audio Graph ---
  const initializeAudio = useCallback((ctx: AudioContext, sourceNode: AudioNode) => {
    try { audioSourceRef.current?.disconnect(lowFilterRef.current!); } catch {}

    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = freqsRef.current.low;
    low.gain.value = gainsRef.current.low;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = freqsRef.current.mid;
    mid.Q.value = 0.5;
    mid.gain.value = gainsRef.current.mid;

    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = freqsRef.current.high;
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
      // Wire the graph BEFORE resuming — createMediaElementSource works on a
      // suspended context, so the routing transition happens at t=0 (no frames
      // have played through the browser's direct pipeline yet). Resuming after
      // the graph is connected avoids the mid-playback rerouting glitch that
      // causes the recorded audio to stutter and drift from the beat.
      const source = ctx.createMediaElementSource(audio);
      initializeAudio(ctx, source);
      if (ctx.state === 'suspended') await ctx.resume();
    };

    audio.addEventListener('play', handlePlay);
    return () => {
      audio.removeEventListener('play', handlePlay);
      if (internalAudioCtxRef.current) {
        internalAudioCtxRef.current.close();
        internalAudioCtxRef.current = null;
      }
    };
  }, [isActive, audioRef, externalSource, initializeAudio]);

  // --- Recompute EQ curve in place ---
  const recomputeCurve = useCallback(() => {
    if (!lowFilterRef.current || !midFilterRef.current || !highFilterRef.current) return;
    const freqArr = curveFreqsRef.current;
    const phase = phaseRef.current;
    lowFilterRef.current.getFrequencyResponse(freqArr as Float32Array<ArrayBuffer>, magLowRef.current as Float32Array<ArrayBuffer>, phase as Float32Array<ArrayBuffer>);
    midFilterRef.current.getFrequencyResponse(freqArr as Float32Array<ArrayBuffer>, magMidRef.current as Float32Array<ArrayBuffer>, phase as Float32Array<ArrayBuffer>);
    highFilterRef.current.getFrequencyResponse(freqArr as Float32Array<ArrayBuffer>, magHighRef.current as Float32Array<ArrayBuffer>, phase as Float32Array<ArrayBuffer>);
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

  // Sync all filter frequencies when freqs state changes
  useEffect(() => {
    if (lowFilterRef.current) lowFilterRef.current.frequency.value = freqs.low;
    if (midFilterRef.current) midFilterRef.current.frequency.value = freqs.mid;
    if (highFilterRef.current) highFilterRef.current.frequency.value = freqs.high;
    recomputeCurve();
  }, [freqs, recomputeCurve]);

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

        const maxBarHeight = h * 0.6;
        const lowGrad = ctx2d.createLinearGradient(0, h, 0, h - maxBarHeight);
        lowGrad.addColorStop(0, COLOR_LOW + 'CC');
        lowGrad.addColorStop(1, COLOR_LOW + '33');
        const midGrad = ctx2d.createLinearGradient(0, h, 0, h - maxBarHeight);
        midGrad.addColorStop(0, COLOR_MID + 'CC');
        midGrad.addColorStop(1, COLOR_MID + '33');
        const highGrad = ctx2d.createLinearGradient(0, h, 0, h - maxBarHeight);
        highGrad.addColorStop(0, COLOR_HIGH + 'CC');
        highGrad.addColorStop(1, COLOR_HIGH + '33');

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
          const barHeight = (magnitude / 255) * maxBarHeight;
          const x = i * barWidth;

          if (geoMean < 300) ctx2d.fillStyle = lowGrad;
          else if (geoMean < 5000) ctx2d.fillStyle = midGrad;
          else ctx2d.fillStyle = highGrad;

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
      const currentFreqs = freqsRef.current;
      const nodes: Array<{ key: BandKey; freq: number; color: string; label: string }> = [
        { key: 'low',  freq: currentFreqs.low,  color: COLOR_LOW,  label: 'L' },
        { key: 'mid',  freq: currentFreqs.mid,  color: COLOR_MID,  label: 'M' },
        { key: 'high', freq: currentFreqs.high, color: COLOR_HIGH, label: 'H' },
      ];

      const currentGains = gainsRef.current;
      const currentSelected = selectedBandRef.current;
      nodes.forEach(({ key, freq, color, label }) => {
        const nx = freqToX(freq, w);
        const gain = currentGains[key];
        const ny = centerY - (gain / 12) * centerY * 0.85;
        const isNodeActive = activeNodeRef.current === key;
        const isSelected = currentSelected === key;

        // Selected band (not dragging): dashed ring to indicate slider target
        if (isSelected && !isNodeActive) {
          ctx2d.beginPath();
          ctx2d.arc(nx, ny, 18, 0, Math.PI * 2);
          ctx2d.setLineDash([3, 3]);
          ctx2d.strokeStyle = color + '66';
          ctx2d.lineWidth = 1;
          ctx2d.stroke();
          ctx2d.setLineDash([]);
        }

        // Active drag: solid glow ring
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
        ctx2d.fillStyle = (isNodeActive || isSelected) ? color : color + 'BB';
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

        // dB readout (always show for selected band so user knows which is active)
        if (gain !== 0 || isNodeActive || isSelected) {
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

  // --- Pointer Handlers (drag nodes for both gain and frequency) ---
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

    const currentFreqs = freqsRef.current;
    const nodes: Array<{ key: BandKey; freq: number }> = [
      { key: 'low',  freq: currentFreqs.low  },
      { key: 'mid',  freq: currentFreqs.mid  },
      { key: 'high', freq: currentFreqs.high },
    ];

    for (const { key, freq } of nodes) {
      const nx = freqToX(freq, w);
      const gain = gainsRef.current[key];
      const ny = centerY - (gain / 12) * centerY * 0.85;
      const dist = Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);
      if (dist <= HIT_RADIUS) {
        activeNodeRef.current = key;
        setSelectedBand(key);
        dragStartXRef.current = e.clientX;
        dragStartYRef.current = e.clientY;
        dragStartGainRef.current = gain;
        dragStartFreqRef.current = freq;
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
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const centerY = h / 2;
    const key = activeNodeRef.current;
    const { min, max } = BAND_CONFIG[key];

    // Vertical drag controls gain
    const pxPerDb = (centerY * 0.85) / 12;
    const deltaY = dragStartYRef.current - e.clientY;
    const newGain = Math.max(GAIN_MIN, Math.min(GAIN_MAX, dragStartGainRef.current + deltaY / pxPerDb));

    // Horizontal drag controls frequency (logarithmic scale)
    const deltaX = e.clientX - dragStartXRef.current;
    const startT = freqToTRange(dragStartFreqRef.current, min, max);
    const sensitivity = 1.5; // Pixels per full range
    const newT = startT + (deltaX / w) * sensitivity;
    const newFreq = tToFreqRange(newT, min, max);

    setGains(prev => ({ ...prev, [key]: Math.round(newGain * 10) / 10 }));
    setFreqs(prev => ({ ...prev, [key]: newFreq }));
  };

  const handlePointerUp = () => {
    activeNodeRef.current = null;
  };

  const resetAll = () => {
    setGains({ low: 0, mid: 0, high: 0 });
    setFreqs({ low: FREQ_LOW, mid: FREQ_MID_DEFAULT, high: FREQ_HIGH });
  };
  const anyActive =
    gains.low !== 0 || gains.mid !== 0 || gains.high !== 0 ||
    freqs.low !== FREQ_LOW || freqs.mid !== FREQ_MID_DEFAULT || freqs.high !== FREQ_HIGH;

  return (
    <div className="w-full flex flex-col gap-2 relative">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-mono uppercase tracking-[0.2em] text-white/40">EQ</span>
        <button
          disabled={!anyActive}
          onClick={resetAll}
          className="text-xs font-mono uppercase tracking-[0.2em] text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors px-2 py-0.5 rounded border border-white/10 hover:border-white/20"
        >
          RESET
        </button>
      </div>

      <div className="h-52 min-h-[13rem] bg-black/40 rounded-3xl overflow-hidden border border-white/5 touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      {/* Hint text */}
      <p className="text-[9px] font-mono text-white/30 text-center">
        Drag nodes: vertical = gain, horizontal = frequency
      </p>
    </div>
  );
};
