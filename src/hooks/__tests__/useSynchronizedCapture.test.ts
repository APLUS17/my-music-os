import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSynchronizedCapture } from '../useSynchronizedCapture';

// Mock Worker and browser audio APIs
class MockWorker {
  onmessage: ((this: Worker, ev: MessageEvent) => any) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

const mockAudioWorklet = {
  addModule: vi.fn().mockResolvedValue(undefined),
};

class MockAudioContext {
  state = 'suspended';
  sampleRate = 44100;
  currentTime = 0;
  audioWorklet = mockAudioWorklet;

  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });

  close = vi.fn().mockResolvedValue(undefined);

  createMediaStreamSource = vi.fn().mockReturnValue({
    connect: vi.fn(),
  });

  createBufferSource = vi.fn().mockReturnValue({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });

  onstatechange: (() => void) | null = null;
}

const mockMediaStream = {
  getTracks: vi.fn().mockReturnValue([
    { stop: vi.fn() },
  ]),
};

const mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream);

describe('useSynchronizedCapture Hook', () => {
  beforeEach(() => {
    class MockAudioWorkletNode {
      port = {
        onmessage: null,
        postMessage: vi.fn(),
      };
      connect = vi.fn();
    }

    vi.stubGlobal('Worker', MockWorker);
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('initializes in idle state', () => {
    const onTakeComplete = vi.fn();
    const { result } = renderHook(() =>
      useSynchronizedCapture({
        beatUrl: null,
        onTakeComplete,
      })
    );

    expect(result.current.isRecording).toBe(false);
    expect(result.current.ready).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('successfully starts and stops a synchronized recording take', async () => {
    const onTakeComplete = vi.fn();
    const { result } = renderHook(() =>
      useSynchronizedCapture({
        beatUrl: null,
        onTakeComplete,
      })
    );

    // Ensure the state updates have run and hook is ready
    expect(result.current.ready).toBe(true);

    await act(async () => {
      await result.current.startTake(12.5); // Start at 12.5s beat offset
    });

    expect(result.current.isRecording).toBe(true);
    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
        channelCount: 1,
      },
    });

    // Simulate stopping the take
    act(() => {
      result.current.stopTake();
    });

    expect(result.current.isRecording).toBe(false);
  });
});
