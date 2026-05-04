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

function mockAudioBuffer(samples: Float32Array, sampleRate = 44100) {
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

describe('analyzeAudioAndSplit', () => {
    describe('Linear Mode (Default)', () => {
        it('should return a single section for short audio', async () => {
            const samples = new Float32Array(44100 * 2); // 2 seconds
            samples.fill(0.1); // Some energy
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer);

            expect(sections).toHaveLength(1);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBe(2);
            expect(sections[0].isBest).toBe(true);
        });

        it('should split audio based on silence', async () => {
            const sampleRate = 44100;
            const samples = new Float32Array(sampleRate * 4); // 4 seconds

            // 0-1s: Sound
            samples.fill(0.1, 0, sampleRate);
            // 1-2.5s: Silence (1.5s > default 1.0s minSilenceDuration)
            samples.fill(0, sampleRate, sampleRate * 2.5);
            // 2.5-4s: Sound
            samples.fill(0.1, Math.floor(sampleRate * 2.5), sampleRate * 4);

            const buffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(buffer);

            expect(sections).toHaveLength(2);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBeCloseTo(1, 1);
            expect(sections[1].startTime).toBeCloseTo(2.5, 1);
            expect(sections[1].endTime).toBe(4);
        });
    });

    describe('Loop Mode', () => {
        const sampleRate = 44100;

        it('should split into multiple passes based on loop duration', async () => {
            const loopStart = 1;
            const loopEnd = 5;
            const loopDuration = loopEnd - loopStart; // 4s
            const startOffset = 1; // Started exactly at loopStart
            const totalDuration = 10; // 2.5 passes

            const samples = new Float32Array(sampleRate * totalDuration);
            samples.fill(0.1);
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer, {
                isLoopSession: true,
                loopStart,
                loopEnd,
                startOffset
            });

            expect(sections).toHaveLength(3);

            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBe(4);
            expect(sections[0].loopPass).toBe(1);

            expect(sections[1].startTime).toBe(4);
            expect(sections[1].endTime).toBe(8);
            expect(sections[1].loopPass).toBe(2);

            expect(sections[2].startTime).toBe(8);
            expect(sections[2].endTime).toBe(10);
            expect(sections[2].loopPass).toBe(3);
            expect(sections[2].isBest).toBe(true);
        });

        it('should handle mid-loop start (startOffset > loopStart)', async () => {
            const loopStart = 0;
            const loopEnd = 4;
            const startOffset = 3; // 1s remaining in first pass
            const totalDuration = 5;

            const samples = new Float32Array(sampleRate * totalDuration);
            samples.fill(0.1);
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
            expect(sections[1].endTime).toBe(5);
        });

        it('should break early if startOffset >= loopEnd', async () => {
            const loopStart = 0;
            const loopEnd = 4;
            const startOffset = 4;
            const totalDuration = 2;

            const samples = new Float32Array(sampleRate * totalDuration);
            samples.fill(0.1);
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer, {
                isLoopSession: true,
                loopStart,
                loopEnd,
                startOffset
            });

            expect(sections).toHaveLength(0);
        });

        it('should handle startOffset < loopStart (potential bug)', async () => {
            const loopStart = 2;
            const loopEnd = 6;
            const startOffset = 1; // 1s before loopStart
            const totalDuration = 10;

            const samples = new Float32Array(sampleRate * totalDuration);
            samples.fill(0.1);
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer, {
                isLoopSession: true,
                loopStart,
                loopEnd,
                startOffset
            });

            // Current implementation flaw verified:
            expect(sections[0].endTime).toBe(5);
            expect(sections[1].startTime).toBe(5);
            expect(sections[1].endTime).toBe(9);
        });

        it('should handle duration < firstPassRemaining', async () => {
            const loopStart = 0;
            const loopEnd = 10;
            const startOffset = 0;
            const totalDuration = 5;

            const samples = new Float32Array(sampleRate * totalDuration);
            samples.fill(0.1);
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer, {
                isLoopSession: true,
                loopStart,
                loopEnd,
                startOffset
            });

            expect(sections).toHaveLength(1);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBe(5);
            expect(sections[0].loopPass).toBe(1);
        });
    });

    describe('Classification Logic', () => {
        const sampleRate = 44100;

        it('should classify zero/silence array as vocal (default)', async () => {
            const samples = new Float32Array(sampleRate * 1);
            samples.fill(0);
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer);
            expect(sections[0].type).toBe('vocal');
        });

        it('should classify high-ZCR noise as speech', async () => {
            const samples = new Float32Array(sampleRate * 1);
            for (let i = 0; i < samples.length; i++) {
                samples[i] = i % 2 === 0 ? 0.5 : -0.5;
            }
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer);
            expect(sections[0].type).toBe('speech');
        });

        it('should classify steady low-ZCR signal as instrumental', async () => {
            const samples = new Float32Array(sampleRate * 1);
            for (let i = 0; i < samples.length; i++) {
                samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * (i / sampleRate));
            }
            const buffer = mockAudioBuffer(samples);

            const sections = await analyzeAudioAndSplit(buffer);
            expect(sections[0].type).toBe('instrumental');
        });

        it('should classify transients as speech', async () => {
            const samples = new Float32Array(sampleRate * 1);
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
