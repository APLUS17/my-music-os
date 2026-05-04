import { describe, it, expect, vi } from 'vitest';
import { analyzeAudioAndSplit } from '../smartSplit';

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
        numberOfChannels: 1,
    } as unknown as AudioBuffer;
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
        it('should split audio into sections based on silence', async () => {
            const noise = createNoise(1);
            const silence = createSilence(2);
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
            expect(sections[1].startTime).toBeGreaterThanOrEqual(3.0);
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

        it('should return a single section if entire audio is silent', async () => {
            const silence = createSilence(2);
            const audioBuffer = mockAudioBuffer(silence);
            const sections = await analyzeAudioAndSplit(audioBuffer);

            expect(sections).toHaveLength(1);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBe(audioBuffer.duration);
        });

        it('should handle audio starting and ending with silence', async () => {
            // 1s silence, 1s noise, 1s silence
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

            // Depending on implementation, it might include or exclude leading/trailing silence.
            // Based on code: it commits when !isQuiet && inSilence.
            // If it starts with silence, currentVocalStart remains 0 until noise starts.
            // When noise starts, inSilence becomes false, but it only commits if silenceDuration >= minSilenceDuration AND currentVocalStart < silenceStart.
            // If it starts with silence at 0, silenceStart is 0, so currentVocalStart < silenceStart is false.
            // This means the leading silence is INCLUDED in the first vocal section if it's at the very beginning.
            expect(sections).toHaveLength(1);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBeLessThanOrEqual(2.1); // Ends after noise
        });
    });

    describe('Loop Mode', () => {
        it('should split audio into passes', async () => {
            const samples = createNoise(5);
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer, {
                isLoopSession: true,
                loopStart: 0,
                loopEnd: 2,
                startOffset: 0
            });

            expect(sections).toHaveLength(3);
            expect(sections[0].loopPass).toBe(1);
            expect(sections[1].loopPass).toBe(2);
            expect(sections[2].loopPass).toBe(3);
            expect(sections[2].isBest).toBe(true);
        });

        it('should handle startOffset within the loop', async () => {
            const samples = createNoise(3);
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer, {
                isLoopSession: true,
                loopStart: 0,
                loopEnd: 2,
                startOffset: 1
            });

            expect(sections).toHaveLength(2);
            expect(sections[0].endTime - sections[0].startTime).toBeCloseTo(1);
            expect(sections[1].endTime - sections[1].startTime).toBeCloseTo(2);
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

        it('should handle startOffset < loopStart (potential bug case)', async () => {
            const samples = createNoise(4);
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer, {
                isLoopSession: true,
                loopStart: 1,
                loopEnd: 3,
                startOffset: 0
            });

            // If startOffset (0) < loopStart (1), firstPassRemaining = 3 - 0 = 3
            expect(sections[0].endTime).toBe(3);
            expect(sections[1].startTime).toBe(3);
        });

        it('should finish in one pass if duration < firstPassRemaining', async () => {
            const samples = createNoise(1); // 1s recording
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer, {
                isLoopSession: true,
                loopStart: 0,
                loopEnd: 4,
                startOffset: 2
            });

            // firstPassRemaining = 4 - 2 = 2. duration = 1.
            // 1 < 2, so should have 1 section from 0 to 1s.
            expect(sections).toHaveLength(1);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBe(1);
        });

        it('should fall back to linear mode if loopEnd <= loopStart', async () => {
            const samples = createNoise(2);
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer, {
                isLoopSession: true,
                loopStart: 2,
                loopEnd: 1, // Invalid loop
            });

            // Should treat as linear mode (1 section since no silence)
            expect(sections).toHaveLength(1);
            expect(sections[0].loopPass).toBeUndefined();
        });

        it('should return empty sections if duration is 0', async () => {
            const samples = new Float32Array(0);
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer);

            expect(sections).toHaveLength(0);
        });

        it('should return a single section if no splits occur and duration > 0', async () => {
            // Very short non-zero duration that doesn't trigger trailing section (<= 0.5s)
            const samples = createNoise(0.4);
            const audioBuffer = mockAudioBuffer(samples);
            const sections = await analyzeAudioAndSplit(audioBuffer);

            expect(sections).toHaveLength(1);
            expect(sections[0].startTime).toBe(0);
            expect(sections[0].endTime).toBe(audioBuffer.duration);
        });
    });

    describe('Classification', () => {
        it('should classify silence as instrumental (current behavior)', async () => {
            const silence = createSilence(1);
            const audioBuffer = mockAudioBuffer(silence);
            const sections = await analyzeAudioAndSplit(audioBuffer);
            // Currently returns 'instrumental' because ZCR=0 and EnergyVar=0
            expect(sections[0].type).toBe('instrumental');
        });

        it('should classify high-ZCR signal as speech', async () => {
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
    });
});
