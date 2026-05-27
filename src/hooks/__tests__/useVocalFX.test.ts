import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVocalFX } from '../useVocalFX';
import { FXSettings } from '@/components/studio/FXPanel';

// --- Mocks ---

const makeAudioParam = (initialValue = 0) => ({
  value: initialValue,
  setValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
});

const makeAudioNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
});

const makeBiquadFilterNode = () => ({
  ...makeAudioNode(),
  type: '',
  frequency: makeAudioParam(),
  Q: makeAudioParam(),
  gain: makeAudioParam(),
});

const makeDynamicsCompressorNode = () => ({
  ...makeAudioNode(),
  threshold: makeAudioParam(),
  knee: makeAudioParam(),
  ratio: makeAudioParam(),
  attack: makeAudioParam(),
  release: makeAudioParam(),
});

const makeDelayNode = () => ({
  ...makeAudioNode(),
  delayTime: makeAudioParam(),
});

const makeGainNode = () => ({
  ...makeAudioNode(),
  gain: makeAudioParam(),
});

const makeConvolverNode = () => ({
  ...makeAudioNode(),
  buffer: null,
});

const makeAudioContext = () => {
  const ctx = {
    state: 'running' as AudioContextState,
    currentTime: 0,
    sampleRate: 44100,
    resume: vi.fn().mockImplementation(async () => {
      ctx.state = 'running';
    }),
    suspend: vi.fn().mockImplementation(async () => {
      ctx.state = 'suspended';
    }),
    close: vi.fn().mockImplementation(async () => {
      ctx.state = 'closed';
    }),
    createMediaElementSource: vi.fn(() => makeAudioNode()),
    createBiquadFilter: vi.fn(() => makeBiquadFilterNode()),
    createDynamicsCompressor: vi.fn(() => makeDynamicsCompressorNode()),
    createDelay: vi.fn(() => makeDelayNode()),
    createGain: vi.fn(() => makeGainNode()),
    createConvolver: vi.fn(() => makeConvolverNode()),
    createBuffer: vi.fn(() => ({
      getChannelData: vi.fn(() => new Float32Array(100)),
    })),
    destination: makeAudioNode(),
  };
  return ctx;
};

// Mock impulse response generation in separate file
vi.mock('@/lib/audio/reverb', () => ({
  createReverbImpulse: vi.fn(() => ({
    getChannelData: vi.fn(() => new Float32Array(100)),
    sampleRate: 44100,
    length: 100,
    duration: 100 / 44100,
    numberOfChannels: 2,
  })),
}));

describe('useVocalFX', () => {
  let mockAudioContext: any;
  let audioRef: any;
  const defaultSettings: FXSettings = {
    space: 0,
    echo: 0,
    punch: 0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockAudioContext = makeAudioContext();
    (window as any).AudioContext = vi.fn().mockImplementation(function() {
      return mockAudioContext;
    });

    audioRef = {
      current: {
        src: 'test.mp3',
        srcObject: null,
      },
    };

    // Mock Audio constructor if needed, but here we just need a mock element
    if (typeof Audio === 'undefined') {
      (global as any).Audio = function() {
        return audioRef.current;
      };
    }
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;
  });

  it('should initialize when isActive is true', async () => {
    const { result } = renderHook(() =>
      useVocalFX(audioRef, defaultSettings, true, false, 0)
    );

    await vi.waitFor(() => expect(result.current.isInitialized).toBe(true));
    expect(window.AudioContext).toHaveBeenCalled();
    expect(mockAudioContext.createMediaElementSource).toHaveBeenCalledWith(audioRef.current);
  });

  it('should not initialize when isActive is false', () => {
    const { result } = renderHook(() =>
      useVocalFX(audioRef, defaultSettings, false, false, 0)
    );

    expect(result.current.isInitialized).toBe(false);
    expect(window.AudioContext).not.toHaveBeenCalled();
  });

  it('should fallback to webkitAudioContext', async () => {
    delete (window as any).AudioContext;
    (window as any).webkitAudioContext = vi.fn().mockImplementation(function() {
      return mockAudioContext;
    });

    const { result } = renderHook(() =>
      useVocalFX(audioRef, defaultSettings, true, false, 0)
    );

    await vi.waitFor(() => expect(result.current.isInitialized).toBe(true));
    expect((window as any).webkitAudioContext).toHaveBeenCalled();
  });

  it('should update node values when settings change', async () => {
    const { rerender, result } = renderHook(
      ({ settings }) => useVocalFX(audioRef, settings, true, false, 0),
      {
        initialProps: { settings: defaultSettings },
      }
    );

    await vi.waitFor(() => expect(result.current.isInitialized).toBe(true));

    // Get the created nodes from the mocks
    const lowFilter = mockAudioContext.createBiquadFilter.mock.results[0].value;
    const midFilter = mockAudioContext.createBiquadFilter.mock.results[1].value;
    const highFilter = mockAudioContext.createBiquadFilter.mock.results[2].value;
    const delayWet = mockAudioContext.createGain.mock.results[1].value; // Based on initFX order

    const newSettings: FXSettings = {
      ...defaultSettings,
      eqLow: 5,
      eqMid: -3,
      eqHigh: 2,
      echo: 50,
    };

    act(() => {
        rerender({ settings: newSettings });
    });

    expect(lowFilter.gain.value).toBe(5);
    expect(midFilter.gain.value).toBe(-3);
    expect(highFilter.gain.value).toBe(2);
    // delayWet gain = (echo / 100) * 0.7 = (50 / 100) * 0.7 = 0.35
    expect(delayWet.gain.value).toBeCloseTo(0.35);
  });

  it('should suspend/resume context based on isPlaying', async () => {
    const { result, rerender } = renderHook(
      ({ isPlaying, isActive }) => useVocalFX(audioRef, defaultSettings, isActive, isPlaying, 0),
      {
        initialProps: { isPlaying: false, isActive: true },
      }
    );

    await vi.waitFor(() => expect(result.current.isInitialized).toBe(true));

    // After initialization, it should check the state and suspend since isPlaying is false
    await vi.waitFor(() => expect(mockAudioContext.suspend).toHaveBeenCalled());

    act(() => {
        rerender({ isPlaying: true, isActive: true });
    });
    expect(mockAudioContext.resume).toHaveBeenCalled();

    act(() => {
        rerender({ isPlaying: false, isActive: true });
    });
    expect(mockAudioContext.suspend).toHaveBeenCalledTimes(2);
  });

  it('should flush delay/reverb on significant time jump', async () => {
    const { result, rerender } = renderHook(
      ({ currentTime }) => useVocalFX(audioRef, defaultSettings, true, true, currentTime),
      {
        initialProps: { currentTime: 0 },
      }
    );

    await vi.waitFor(() => expect(result.current.isInitialized).toBe(true));

    const delayNode = mockAudioContext.createDelay.mock.results[0].value;

    // Jump time by 1 second
    act(() => {
        rerender({ currentTime: 1 });
    });

    expect(delayNode.delayTime.cancelScheduledValues).toHaveBeenCalled();
    expect(delayNode.delayTime.setValueAtTime).toHaveBeenCalledTimes(3);

    // Reconnection of convolver uses setTimeout
    act(() => {
        vi.advanceTimersByTime(50);
    });

    // We can't easily check if it was reconnected without more complex node mocking,
    // but we've verified the timer was triggered.
  });

  it('should cleanup on unmount', async () => {
    const { unmount, result } = renderHook(() =>
      useVocalFX(audioRef, defaultSettings, true, false, 0)
    );

    await vi.waitFor(() => expect(result.current.isInitialized).toBe(true));

    const createdNodes = [
        ...mockAudioContext.createBiquadFilter.mock.results.map((r: any) => r.value),
        ...mockAudioContext.createDynamicsCompressor.mock.results.map((r: any) => r.value),
        ...mockAudioContext.createDelay.mock.results.map((r: any) => r.value),
        ...mockAudioContext.createGain.mock.results.map((r: any) => r.value),
        ...mockAudioContext.createConvolver.mock.results.map((r: any) => r.value),
    ];

    unmount();

    createdNodes.forEach(node => {
        expect(node.disconnect).toHaveBeenCalled();
    });
    expect(mockAudioContext.close).toHaveBeenCalled();
  });

  it('should handle source creation failure', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockAudioContext.createMediaElementSource.mockImplementation(() => {
      throw new Error('Failed to create source');
    });

    const { result } = renderHook(() =>
      useVocalFX(audioRef, defaultSettings, true, false, 0)
    );

    // It should stay false since initialization failed
    expect(result.current.isInitialized).toBe(false);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Could not create MediaElementSourceNode'), expect.any(Error));
    consoleSpy.mockRestore();
  });
});
