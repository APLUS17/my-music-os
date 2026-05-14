import { describe, it, expect, vi } from 'vitest';
import { analyzeAudioAndSplit } from '../smartSplit';

// Mock randomId to have deterministic IDs in tests
let idCounter = 0;

// Standard Vitest mock (will be used by Vitest)
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

// Bun-specific mock (will be used by Bun)
if (typeof process !== 'undefined' && process.versions && (process.versions as any).bun) {
    const { mock } = require('bun:test');
    mock.module('@/lib/utils/id', () => ({
        randomId: () => `test-id-${++idCounter}`
    }));
}

/**
 * Creates a Float32Array of zeros.
 */
function createSilence(durationSeconds: number, sampleRate = 44100): Float32Array {
    return new Float32Array(Math.floor(durationSeconds * sampleRate));
}

/**
 * Creates a high-frequency alternating signal (high ZCR).
 * Expected to be classified as 'speech' or 'vocal'.
 */
function createNoise(durationSeconds: number, sampleRate = 44100): Float32Array {
    const samples = new Float32Array(Math.floor(durationSeconds * sampleRate));
    for (let i = 0; i < samples.length; i++) {
        // Alternating values for high ZCR
        samples[i] = i % 2 === 0 ? 0.5 : -0.5;
    }
    return samples;
}

/**
 * Creates a steady low-frequency sine wave (low energy variance, low ZCR).
 * Expected to be classified as 'instrumental'.
 */
function createSteadyTone(durationSeconds: number, sampleRate = 44100): Float32Array {
    const samples = new Float32Array(Math.floor(durationSeconds * sampleRate));
    for (let i = 0; i < samples.length; i++) {
        samples[i] = 0.1 * Math.sin(2 * Math.PI * 10 * (i / sampleRate));
    }
    return samples;
}

describe('analyzeAudioAndSplit', () => {
    describe('Linear Mode', () => {
        it('should return a single section for short audio', async () => {
            const samples = createNoise(2); // 2 seconds
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer);

            expect(sections).toHaveLength(1);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBe(2);
            expect(sections[0].isBest).toBe(true);
        });

        it('should split audio into sections based on silence', async () => {
            const noise = createNoise(1);
            const silence = createSilence(1.5); // > default 1.0s
            const samples = new Float32Array(noise.length + silence.length + noise.length);
            samples.set(noise, 0);
            samples.set(silence, noise.length);
            samples.set(noise, noise.length + silence.length);

            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer, {
                energyThreshold: 0.1,
                minSilenceDuration: 1.0
            });

            expect(sections).toHaveLength(2);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBeLessThanOrEqual(1.1);
            expect(sections[1].startTime).toBeGreaterThanOrEqual(2.4);
            expect(sections[1].endTime).toBe(audioBuffer.duration);
        });

        it('should return a single section if no silence is found', async () => {
            const noise = createNoise(2);
            const audioBuffer = mockAudioBuffer(noise);
            const sections = await analyzeAudioAndSplit(audioBuffer);

            expect(sections).toHaveLength(1);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBe(audioBuffer.duration);
        });

        it('should handle audio starting and ending with silence', async () => {
            const silence = createSilence(1);
            const noise = createNoise(1);
            const samples = new Float32Array(silence.length + noise.length + silence.length);
            samples.set(silence, 0);
            samples.set(noise, silence.length);
            samples.set(silence, silence.length + noise.length);

            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer, {
                energyThreshold: 0.1,
                minSilenceDuration: 0.5
            });

            // The leading silence is included in the first section
            expect(sections).toHaveLength(1);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBeLessThanOrEqual(2.1);
        });
    });

    describe('Loop Mode', () => {
        it('should split into multiple passes based on loop duration', async () => {
            const loopStart = 1;
            const loopEnd = 5;
            const startOffset = 1; 
            const totalDuration = 10; // 2.5 passes

            const samples = createNoise(totalDuration);
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer, {
                isLoopSession: true,
                loopStart,
                loopEnd,
                startOffset
            });

            expect(sections).toHaveLength(3);
            expect(sections[0].loopPass).toBe(1);
            expect(sections[1].loopPass).toBe(2);
            expect(sections[2].loopPass).toBe(3);
            expect(sections[2].isBest).toBe(true);
        });

        it('should handle mid-loop start (startOffset > loopStart)', async () => {
            const loopStart = 0;
            const loopEnd = 4;
            const startOffset = 3; 
            const totalDuration = 5;

            const samples = createNoise(totalDuration);
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer, {
                isLoopSession: true,
                loopStart,
                loopEnd,
                startOffset
            });

            expect(sections).toHaveLength(2);
            expect(sections[0].endTime).toBe(1);
            expect(sections[1].startTime).toBe(1);
        });

        it('should handle startOffset >= loopEnd', async () => {
            const samples = createNoise(2);
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer, {
                isLoopSession: true,
                loopStart: 0,
                loopEnd: 2,
                startOffset: 2
            });

            expect(sections).toHaveLength(0);
        });

        it('should handle startOffset < loopStart', async () => {
            const samples = createNoise(4);
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer, {
                isLoopSession: true,
                loopStart: 1,
                loopEnd: 3,
                startOffset: 0
            });

            expect(sections[0].endTime).toBe(3);
            expect(sections[1].startTime).toBe(3);
        });

        it('should fall back to linear mode if loopEnd <= loopStart', async () => {
            const samples = createNoise(2);
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer, {
                isLoopSession: true,
                loopStart: 2,
                loopEnd: 1, 
            });

            expect(sections[0].loopPass).toBeUndefined();
        });

        it('should return empty sections if duration is 0', async () => {
            const samples = new Float32Array(0);
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer);

            expect(sections).toHaveLength(0);
        });
    });

    describe('Classification', () => {
        it('should classify silence as vocal (current behavior for silent audio defaults to vocal)', async () => {
            const silence = createSilence(1);
            const audioBuffer = mockAudioBuffer(silence);
            const sections = await analyzeAudioAndSplit(audioBuffer);
            expect(sections[0].type).toBe('vocal');
        });

        it('should classify high-ZCR noise as speech', async () => {
            const noise = createNoise(1);
            const audioBuffer = mockAudioBuffer(noise);
            const sections = await analyzeAudioAndSplit(audioBuffer);
            expect(sections[0].type).toBe('speech');
        });

        it('should classify steady tone as instrumental', async () => {
            const tone = createSteadyTone(1);
            const audioBuffer = mockAudioBuffer(tone);
            const sections = await analyzeAudioAndSplit(audioBuffer);
            expect(sections[0].type).toBe('instrumental');
        });

        it('should classify transients as speech', async () => {
            const samples = new Float32Array(44100 * 1);
            const blockSize = 2048;
            for (let i = 0; i < samples.length; i++) {
                const block = Math.floor(i / blockSize);
                samples[i] = block % 2 === 0 ? 0.8 : 0.0;
            }
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer);
            expect(sections[0].type).toBe('speech');
        });
    });
});
