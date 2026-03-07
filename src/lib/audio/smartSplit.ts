import { AutoSection } from '@/types';
import { randomId } from '@/lib/utils/id';

interface SplitOptions {
    energyThreshold?: number; // 0.0 to 1.0 (0.05 default)
    minSilenceDuration?: number; // in seconds (1.0 default)
    loopStart?: number;
    loopEnd?: number;
    isLoopSession?: boolean;
    passCount?: number;
}

export const analyzeAudioAndSplit = async (
    audioBuffer: AudioBuffer,
    options: SplitOptions = {}
): Promise<AutoSection[]> => {
    const {
        energyThreshold = 0.05,
        minSilenceDuration = 1.0,
        isLoopSession = false,
        loopStart = 0,
        loopEnd = 0,
        passCount = 1
    } = options;

    const sections: AutoSection[] = [];
    const duration = audioBuffer.duration;

    if (duration === 0) return sections;

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Helper to classify a chunk of audio
    const classifySection = (start: number, end: number): 'vocal' | 'instrumental' | 'speech' => {
        const startIdx = Math.floor(start * sampleRate);
        const endIdx = Math.floor(end * sampleRate);
        const data = channelData.slice(startIdx, endIdx);

        if (data.length === 0) return 'vocal';

        // 1. Zero Crossing Rate (ZCR)
        let crossings = 0;
        for (let i = 1; i < data.length; i++) {
            if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
                crossings++;
            }
        }
        const zcr = crossings / data.length;

        // 2. Simple Energy Variance
        let sum = 0;
        let sumSq = 0;
        const windowSize = 512;
        const energies = [];

        for (let i = 0; i < data.length; i += windowSize) {
            let winSumSq = 0;
            const winEnd = Math.min(i + windowSize, data.length);
            for (let j = i; j < winEnd; j++) {
                winSumSq += data[j] * data[j];
            }
            const rms = Math.sqrt(winSumSq / (winEnd - i));
            energies.push(rms);
            sum += rms;
            sumSq += rms * rms;
        }

        const meanEnergy = sum / energies.length;
        const energyVar = (sumSq / energies.length) - (meanEnergy * meanEnergy);

        // Heuristics:
        // - Speech: High ZCR (sibilance), High Energy Variance (transients/pauses)
        // - Singing: Lower ZCR than speech, Lower Energy Variance (more sustained notes)
        // - Instrumental: Very low ZCR (often dominated by bass/low freq), Very low variance or very structured

        if (zcr > 0.15) return 'speech';
        if (energyVar > 0.02) return 'speech'; // Transients
        if (zcr < 0.05 && energyVar < 0.01) return 'instrumental';

        return 'vocal'; // Default to vocal (singing) for music app
    };

    // LOOP MODE: Level 2 Split
    if (isLoopSession && loopEnd > loopStart) {
        const loopDuration = loopEnd - loopStart;
        const passes = Math.max(1, passCount);

        for (let i = 0; i < passes; i++) {
            const passStartTime = i * loopDuration;
            let passEndTime = passStartTime + loopDuration;
            if (passEndTime > duration) passEndTime = duration;

            sections.push({
                id: randomId(),
                startTime: passStartTime,
                endTime: passEndTime,
                loopPass: i + 1,
                type: classifySection(passStartTime, passEndTime),
                isBest: i === passes - 1,
                isFavorited: false
            });

            if (passEndTime >= duration) break;
        }
    }
    // LINEAR MODE: Level 1 Split (Energy Thresholding)
    else {
        const windowSize = Math.floor(sampleRate * 0.1); // 100ms window

        let inSilence = false;
        let currentVocalStart = 0;
        let silenceStart = 0;

        for (let i = 0; i < channelData.length; i += windowSize) {
            let sumSquares = 0;
            const endIdx = Math.min(i + windowSize, channelData.length);
            for (let j = i; j < endIdx; j++) {
                sumSquares += channelData[j] * channelData[j];
            }
            const rms = Math.sqrt(sumSquares / (endIdx - i));
            const isQuiet = rms < energyThreshold;

            const currentTime = i / sampleRate;

            if (isQuiet && !inSilence) {
                inSilence = true;
                silenceStart = currentTime;
            } else if (!isQuiet && inSilence) {
                inSilence = false;
                const silenceDuration = currentTime - silenceStart;
                if (silenceDuration >= minSilenceDuration && currentVocalStart < silenceStart) {
                    // Commit the previous vocal section
                    sections.push({
                        id: randomId(),
                        startTime: currentVocalStart,
                        endTime: silenceStart,
                        type: classifySection(currentVocalStart, silenceStart),
                        isBest: true,
                        isFavorited: false
                    });
                    currentVocalStart = currentTime;
                }
            }
        }

        // Add trailing section if needed
        if (currentVocalStart < duration) {
            const finalEndTime = inSilence && silenceStart > currentVocalStart ? silenceStart : duration;
            if (finalEndTime - currentVocalStart > 0.5) {
                sections.push({
                    id: randomId(),
                    startTime: currentVocalStart,
                    endTime: finalEndTime,
                    type: classifySection(currentVocalStart, finalEndTime),
                    isBest: true,
                    isFavorited: false
                });
            }
        }

        if (sections.length === 0) {
            sections.push({
                id: randomId(),
                startTime: 0,
                endTime: duration,
                type: classifySection(0, duration),
                isBest: true,
                isFavorited: false
            });
        }
    }

    return sections;
};

