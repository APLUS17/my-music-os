import { describe, it, expect, vi } from 'vitest';
import { analyzeAudioAndSplit } from '../smartSplit';

// Mock randomId to have deterministic IDs in tests
let idCounter = 0;

if (typeof vi !== 'undefined' && vi.mock) {
    vi.mock('@/lib/utils/id', () => ({
        randomId: () => `test-id-${++idCounter}`
    }));
}

/**
 * Minimal AudioBuffer mock factory.
 * Provides the subset of the AudioBuffer interface used by analyzeAudioAndSplit.
 */
function mockAudioBuffer(samples: Float32Array, sampleRate = 44100): AudioBuffer {
    return {
        duration: samples.length / sampleRate,
        sampleRate,
        getChannelData: () => samples,
        length: samples.length,
        numberOfChannels: 1
    } as unknown as AudioBuffer;
}

describe('analyzeAudioAndSplit', () => {
    it('should split simple silence', async () => {
        const samples = new Float32Array(44100); // 1s silence
        const buffer = mockAudioBuffer(samples);
        const sections = await analyzeAudioAndSplit(buffer, { isLoopSession: false });
        expect(sections.length).toBeGreaterThan(0);
    });
});
