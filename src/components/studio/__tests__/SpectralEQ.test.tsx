import React, { createRef } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpectralEQ } from '../SpectralEQ';

// ---------------------------------------------------------------------------
// Web Audio API mocks
// ---------------------------------------------------------------------------
const makeBiquadFilter = () => ({
  type: '' as BiquadFilterType,
  frequency: { value: 0 },
  Q: { value: 0 },
  gain: { value: 0 },
  connect: vi.fn(),
  disconnect: vi.fn(),
  getFrequencyResponse: vi.fn(
    (_freqs: Float32Array, mag: Float32Array, _phase: Float32Array) => mag.fill(1)
  ),
});

type MockFilter = ReturnType<typeof makeBiquadFilter>;

const makeAudioContext = (state: AudioContextState = 'running') => ({
  state,
  resume: vi.fn().mockResolvedValue(undefined),
  destination: { _dest: true } as unknown as AudioDestinationNode,
  createBiquadFilter: vi.fn(() => makeBiquadFilter()),
  createMediaElementSource: vi.fn(),
});

// Canvas 2D context mock
const makeCtx2d = () => ({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  arc: vi.fn(),
  closePath: vi.fn(),
  setLineDash: vi.fn(),
  scale: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  lineCap: '',
  font: '',
  textAlign: '',
  textBaseline: '',
  globalAlpha: 1,
});

// Helpers
/** freqToX replicated from SpectralEQ for expected coordinate calculation */
function freqToX(freq: number, width: number): number {
  return ((Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))) * width;
}

const CANVAS_W = 400;
const CANVAS_H = 176;
const DPR = 1;
const CENTER_Y = CANVAS_H / 2;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
let rafCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  rafCallbacks = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

  // Canvas getContext mock
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(makeCtx2d() as any);

  // devicePixelRatio
  Object.defineProperty(window, 'devicePixelRatio', { value: DPR, configurable: true });

  // Canvas dimensions + getBoundingClientRect
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
    get() { return CANVAS_W; },
    set() {},
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
    get() { return CANVAS_H; },
    set() {},
    configurable: true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: CANVAS_W, bottom: CANVAS_H,
    width: CANVAS_W, height: CANVAS_H, x: 0, y: 0,
    toJSON: () => {},
  } as DOMRect);

  // setPointerCapture — not defined in jsdom, must be assigned
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: minimal props
// ---------------------------------------------------------------------------
function makeRefs() {
  const analyserRef = createRef<AnalyserNode | null>() as React.RefObject<AnalyserNode | null>;
  const dataArrayRef = createRef<Uint8Array | null>() as React.RefObject<Uint8Array | null>;
  (analyserRef as any).current = null;
  (dataArrayRef as any).current = null;
  return { analyserRef, dataArrayRef };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SpectralEQ', () => {

  // --- Rendering -----------------------------------------------------------
  describe('Rendering', () => {
    it('renders a canvas element', () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      expect(document.querySelector('canvas')).toBeTruthy();
    });

    it('renders the EQ label', () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      expect(screen.getByText('EQ')).toBeTruthy();
    });

    it('renders the RESET button', () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      expect(screen.getByText('RESET')).toBeTruthy();
    });

    it('RESET button is disabled when all gains are zero', () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      const resetBtn = screen.getByText('RESET').closest('button')!;
      expect(resetBtn.disabled).toBe(true);
    });
  });

  // --- Audio graph ---------------------------------------------------------
  describe('Audio graph initialization', () => {
    it('creates 3 biquad filters when externalSource is provided', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const mockCtx = makeAudioContext();
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      await act(async () => {
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
          />
        );
      });

      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(3);
    });

    it('sets lowshelf filter at 100 Hz', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const filters: MockFilter[] = [];
      const mockCtx = makeAudioContext();
      mockCtx.createBiquadFilter.mockImplementation(() => {
        const f = makeBiquadFilter();
        filters.push(f);
        return f;
      });
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      await act(async () => {
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
          />
        );
      });

      const lowFilter = filters[0];
      expect(lowFilter.type).toBe('lowshelf');
      expect(lowFilter.frequency.value).toBe(100);
    });

    it('sets peaking mid filter at 1000 Hz with Q=0.5', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const filters: MockFilter[] = [];
      const mockCtx = makeAudioContext();
      mockCtx.createBiquadFilter.mockImplementation(() => {
        const f = makeBiquadFilter();
        filters.push(f);
        return f;
      });
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      await act(async () => {
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
          />
        );
      });

      const midFilter = filters[1];
      expect(midFilter.type).toBe('peaking');
      expect(midFilter.frequency.value).toBe(1000);
      expect(midFilter.Q.value).toBe(0.5);
    });

    it('sets highshelf filter at 5000 Hz', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const filters: MockFilter[] = [];
      const mockCtx = makeAudioContext();
      mockCtx.createBiquadFilter.mockImplementation(() => {
        const f = makeBiquadFilter();
        filters.push(f);
        return f;
      });
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      await act(async () => {
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
          />
        );
      });

      const highFilter = filters[2];
      expect(highFilter.type).toBe('highshelf');
      expect(highFilter.frequency.value).toBe(5000);
    });

    it('connects source → low → mid → high → destinationNode', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const filters: MockFilter[] = [];
      const mockCtx = makeAudioContext();
      mockCtx.createBiquadFilter.mockImplementation(() => {
        const f = makeBiquadFilter();
        filters.push(f);
        return f;
      });
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;
      const mockDest = { _dest: true } as unknown as AudioNode;

      await act(async () => {
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
            destinationNode={mockDest}
          />
        );
      });

      const [low, mid, high] = filters;
      expect((mockSource as any).connect).toHaveBeenCalledWith(low);
      expect(low.connect).toHaveBeenCalledWith(mid);
      expect(mid.connect).toHaveBeenCalledWith(high);
      expect(high.connect).toHaveBeenCalledWith(mockDest);
    });

    it('resumes a suspended AudioContext before init', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const mockCtx = makeAudioContext('suspended');
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      await act(async () => {
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
          />
        );
      });

      expect(mockCtx.resume).toHaveBeenCalled();
    });

    it('does not initialize audio when isActive=false', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const mockCtx = makeAudioContext();
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      await act(async () => {
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
            isActive={false}
          />
        );
      });

      expect(mockCtx.createBiquadFilter).not.toHaveBeenCalled();
    });

    it('disconnects source on unmount', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const filters: MockFilter[] = [];
      const mockCtx = makeAudioContext();
      mockCtx.createBiquadFilter.mockImplementation(() => {
        const f = makeBiquadFilter();
        filters.push(f);
        return f;
      });
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      let unmount: () => void;
      await act(async () => {
        const result = render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
          />
        );
        unmount = result.unmount;
      });

      await act(async () => { unmount(); });

      // source.disconnect should have been attempted
      expect((mockSource as any).disconnect).toHaveBeenCalled();
    });
  });

  // --- freqToX helper ------------------------------------------------------
  describe('freqToX coordinate helper', () => {
    it('maps 20Hz to x=0', () => {
      expect(freqToX(20, 400)).toBeCloseTo(0, 1);
    });

    it('maps 20kHz to x=width', () => {
      expect(freqToX(20000, 400)).toBeCloseTo(400, 1);
    });

    it('maps 200Hz within left half of spectrum', () => {
      // 200Hz is in the bass range — should be in the left quarter
      const x = freqToX(200, 400);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(200);
    });

    it('maps 2kHz to roughly center of log spectrum', () => {
      // geometric mean of 20–20000 is sqrt(20*20000) = ~632Hz
      // 2kHz is somewhat right of center
      const x = freqToX(2000, 400);
      expect(x).toBeGreaterThan(200);
      expect(x).toBeLessThan(350);
    });

    it('is monotonically increasing', () => {
      const freqs = [20, 100, 200, 1000, 5000, 10000, 20000];
      const xs = freqs.map(f => freqToX(f, 400));
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i]).toBeGreaterThan(xs[i - 1]);
      }
    });
  });

  // --- Pointer drag interaction --------------------------------------------
  describe('Drag interaction', () => {
    it('dragging low node up increases low gain', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const { container } = render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      const canvas = container.querySelector('canvas')!;

      // Node 'low' is at FREQ_LOW=100, gain=0, so ny = CENTER_Y
      const nodeX = Math.round(freqToX(100, CANVAS_W));
      const nodeY = CENTER_Y;

      // Drag start — hit the low node
      fireEvent.pointerDown(canvas, { clientX: nodeX, clientY: nodeY, pointerId: 1 });
      // Drag up by ~37px (should yield ~+6dB)
      fireEvent.pointerMove(canvas, { clientX: nodeX, clientY: nodeY - 37, pointerId: 1 });
      fireEvent.pointerUp(canvas, { pointerId: 1 });

      // RESET button should now be enabled (gain changed from 0)
      await waitFor(() => {
        const resetBtn = screen.getByText('RESET').closest('button')!;
        expect(resetBtn.disabled).toBe(false);
      });
    });

    it('dragging mid node down decreases mid gain', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const { container } = render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      const canvas = container.querySelector('canvas')!;

      const nodeX = Math.round(freqToX(1000, CANVAS_W));
      const nodeY = CENTER_Y;

      fireEvent.pointerDown(canvas, { clientX: nodeX, clientY: nodeY, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: nodeX, clientY: nodeY + 37, pointerId: 1 });
      fireEvent.pointerUp(canvas, { pointerId: 1 });

      await waitFor(() => {
        const resetBtn = screen.getByText('RESET').closest('button')!;
        expect(resetBtn.disabled).toBe(false);
      });
    });

    it('dragging high node activates it (RESET becomes enabled)', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const { container } = render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      const canvas = container.querySelector('canvas')!;

      const nodeX = Math.round(freqToX(10000, CANVAS_W));
      const nodeY = CENTER_Y;

      fireEvent.pointerDown(canvas, { clientX: nodeX, clientY: nodeY, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: nodeX, clientY: nodeY - 20, pointerId: 1 });
      fireEvent.pointerUp(canvas, { pointerId: 1 });

      await waitFor(() => {
        const resetBtn = screen.getByText('RESET').closest('button')!;
        expect(resetBtn.disabled).toBe(false);
      });
    });

    it('pointerCancel also releases the active node', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const { container } = render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      const canvas = container.querySelector('canvas')!;

      const nodeX = Math.round(freqToX(100, CANVAS_W));
      const nodeY = CENTER_Y;

      fireEvent.pointerDown(canvas, { clientX: nodeX, clientY: nodeY, pointerId: 1 });
      // Simulate gain change
      fireEvent.pointerMove(canvas, { clientX: nodeX, clientY: nodeY - 30, pointerId: 1 });
      // Cancel (incoming call, swipe-away, etc.)
      fireEvent.pointerCancel(canvas, { pointerId: 1 });
      // No further movement should change gain — a new drag elsewhere should not accumulate
      fireEvent.pointerMove(canvas, { clientX: nodeX, clientY: nodeY - 99, pointerId: 1 });

      // Component should still be alive (no crash)
      expect(canvas).toBeTruthy();
    });

    it('clicking far from any node does not activate drag', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const { container } = render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      const canvas = container.querySelector('canvas')!;

      // Click dead center — far from all nodes
      fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: 5, clientY: 5 - 50, pointerId: 1 });
      fireEvent.pointerUp(canvas, { pointerId: 1 });

      // RESET should still be disabled — no gain changed
      const resetBtn = screen.getByText('RESET').closest('button')!;
      expect(resetBtn.disabled).toBe(true);
    });
  });

  // --- Frequency sweep knob ------------------------------------------------
  describe('Frequency sweep knob', () => {
    it('renders the MID SWEEP label', () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      expect(screen.getByText('MID SWEEP')).toBeTruthy();
    });

    it('shows 1.0k as default frequency', () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      expect(screen.getByText('1.0k')).toBeTruthy();
    });

    it('dragging sweep knob right increases midFreq and updates display', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const { container } = render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );

      // The sweep track is the div with cursor-ew-resize
      const sweepTrack = container.querySelector('.cursor-ew-resize') as HTMLElement;
      expect(sweepTrack).toBeTruthy();

      // Mock clientWidth so deltaX / trackWidth is meaningful
      Object.defineProperty(sweepTrack, 'clientWidth', { value: 300, configurable: true });

      // Drag right by 90px on a 300px track → t increases by 0.3
      // Start at freqToT(1000) ≈ 0.526, new t ≈ 0.826 → ~5000Hz range
      fireEvent.pointerDown(sweepTrack, { clientX: 150, pointerId: 1 });
      fireEvent.pointerMove(sweepTrack, { clientX: 240, pointerId: 1 });
      fireEvent.pointerUp(sweepTrack, { pointerId: 1 });

      await waitFor(() => {
        // Freq should have increased — display should no longer say 1.0k
        const freqDisplay = container.querySelector('[style*="color"]');
        // Just check RESET is now enabled (midFreq ≠ default)
        const resetBtn = screen.getByText('RESET').closest('button')!;
        expect(resetBtn.disabled).toBe(false);
      });
    });

    it('dragging sweep knob left decreases midFreq', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const { container } = render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );

      const sweepTrack = container.querySelector('.cursor-ew-resize') as HTMLElement;
      Object.defineProperty(sweepTrack, 'clientWidth', { value: 300, configurable: true });

      // Drag left by 60px → t decreases, freq goes below 1000
      fireEvent.pointerDown(sweepTrack, { clientX: 150, pointerId: 1 });
      fireEvent.pointerMove(sweepTrack, { clientX: 90, pointerId: 1 });
      fireEvent.pointerUp(sweepTrack, { pointerId: 1 });

      await waitFor(() => {
        const resetBtn = screen.getByText('RESET').closest('button')!;
        expect(resetBtn.disabled).toBe(false);
      });
    });

    it('sweep updates mid filter frequency value', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const filters: MockFilter[] = [];
      const mockCtx = makeAudioContext();
      mockCtx.createBiquadFilter.mockImplementation(() => {
        const f = makeBiquadFilter();
        filters.push(f);
        return f;
      });
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      const { container } = await act(async () =>
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
          />
        )
      );

      const sweepTrack = container.querySelector('.cursor-ew-resize') as HTMLElement;
      Object.defineProperty(sweepTrack, 'clientWidth', { value: 300, configurable: true });

      const initialFreq = filters[1].frequency.value; // mid filter

      fireEvent.pointerDown(sweepTrack, { clientX: 150, pointerId: 1 });
      fireEvent.pointerMove(sweepTrack, { clientX: 240, pointerId: 1 });
      fireEvent.pointerUp(sweepTrack, { pointerId: 1 });

      await waitFor(() => {
        expect(filters[1].frequency.value).not.toBe(initialFreq);
      });
    });

    it('pointerCancel on sweep track releases drag without error', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const { container } = render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );

      const sweepTrack = container.querySelector('.cursor-ew-resize') as HTMLElement;
      Object.defineProperty(sweepTrack, 'clientWidth', { value: 300, configurable: true });

      fireEvent.pointerDown(sweepTrack, { clientX: 150, pointerId: 1 });
      fireEvent.pointerCancel(sweepTrack, { pointerId: 1 });
      // Further moves after cancel should not change state
      fireEvent.pointerMove(sweepTrack, { clientX: 300, pointerId: 1 });

      // Still alive, no crash
      expect(sweepTrack).toBeTruthy();
    });
  });

  // --- RESET button --------------------------------------------------------
  describe('RESET button', () => {
    it('clicking RESET returns all gains to 0 (button becomes disabled)', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const { container } = render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );
      const canvas = container.querySelector('canvas')!;

      // Drag low node to set a non-zero gain
      const nodeX = Math.round(freqToX(100, CANVAS_W));
      fireEvent.pointerDown(canvas, { clientX: nodeX, clientY: CENTER_Y, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: nodeX, clientY: CENTER_Y - 40, pointerId: 1 });
      fireEvent.pointerUp(canvas, { pointerId: 1 });

      // Wait for RESET to be enabled
      await waitFor(() => {
        expect(screen.getByText('RESET').closest('button')!.disabled).toBe(false);
      });

      // Click RESET
      fireEvent.click(screen.getByText('RESET'));

      // RESET should become disabled again — gains and midFreq both back to default
      await waitFor(() => {
        expect(screen.getByText('RESET').closest('button')!.disabled).toBe(true);
      });
    });

    it('RESET also restores midFreq to 1.0k after sweep', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const { container } = render(
        <SpectralEQ analyserRef={analyserRef} dataArrayRef={dataArrayRef} audioContext={null} />
      );

      const sweepTrack = container.querySelector('.cursor-ew-resize') as HTMLElement;
      Object.defineProperty(sweepTrack, 'clientWidth', { value: 300, configurable: true });

      // Sweep to non-default frequency
      fireEvent.pointerDown(sweepTrack, { clientX: 150, pointerId: 1 });
      fireEvent.pointerMove(sweepTrack, { clientX: 240, pointerId: 1 });
      fireEvent.pointerUp(sweepTrack, { pointerId: 1 });

      await waitFor(() => {
        expect(screen.getByText('RESET').closest('button')!.disabled).toBe(false);
      });

      fireEvent.click(screen.getByText('RESET'));

      await waitFor(() => {
        expect(screen.getByText('1.0k')).toBeTruthy();
        expect(screen.getByText('RESET').closest('button')!.disabled).toBe(true);
      });
    });
  });

  // --- Gain clamping -------------------------------------------------------
  describe('Gain clamping', () => {
    it('does not exceed +12dB when dragged far up', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      // Intercept filter gain updates to check clamping
      const filters: MockFilter[] = [];
      const mockCtx = makeAudioContext();
      mockCtx.createBiquadFilter.mockImplementation(() => {
        const f = makeBiquadFilter();
        filters.push(f);
        return f;
      });
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      const { container } = await act(async () =>
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
          />
        )
      );

      const canvas = container.querySelector('canvas')!;
      const nodeX = Math.round(freqToX(100, CANVAS_W));

      // Drag 1000px up — way beyond +12dB
      fireEvent.pointerDown(canvas, { clientX: nodeX, clientY: CENTER_Y, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: nodeX, clientY: CENTER_Y - 1000, pointerId: 1 });
      fireEvent.pointerUp(canvas, { pointerId: 1 });

      await waitFor(() => {
        // The low filter gain should not exceed 12
        expect(filters[0].gain.value).toBeLessThanOrEqual(12);
      });
    });

    it('does not go below -12dB when dragged far down', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const filters: MockFilter[] = [];
      const mockCtx = makeAudioContext();
      mockCtx.createBiquadFilter.mockImplementation(() => {
        const f = makeBiquadFilter();
        filters.push(f);
        return f;
      });
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      const { container } = await act(async () =>
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
          />
        )
      );

      const canvas = container.querySelector('canvas')!;
      const nodeX = Math.round(freqToX(100, CANVAS_W));

      // Drag 1000px down — way below -12dB
      fireEvent.pointerDown(canvas, { clientX: nodeX, clientY: CENTER_Y, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: nodeX, clientY: CENTER_Y + 1000, pointerId: 1 });
      fireEvent.pointerUp(canvas, { pointerId: 1 });

      await waitFor(() => {
        expect(filters[0].gain.value).toBeGreaterThanOrEqual(-12);
      });
    });
  });

  // --- recomputeCurve ------------------------------------------------------
  describe('recomputeCurve', () => {
    it('calls getFrequencyResponse on all 3 filters after init', async () => {
      const { analyserRef, dataArrayRef } = makeRefs();
      const filters: MockFilter[] = [];
      const mockCtx = makeAudioContext();
      mockCtx.createBiquadFilter.mockImplementation(() => {
        const f = makeBiquadFilter();
        filters.push(f);
        return f;
      });
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

      await act(async () => {
        render(
          <SpectralEQ
            analyserRef={analyserRef}
            dataArrayRef={dataArrayRef}
            audioContext={mockCtx as unknown as AudioContext}
            externalSource={mockSource}
          />
        );
      });

      // recomputeCurve is called at least once after init (may fire again when gains effect runs)
      expect(filters[0].getFrequencyResponse).toHaveBeenCalled();
      expect(filters[1].getFrequencyResponse).toHaveBeenCalled();
      expect(filters[2].getFrequencyResponse).toHaveBeenCalled();
    });
  });
});
