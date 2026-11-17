'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeBeatStructure, computePeaks, mixToMono, type BeatStructure } from '@/lib/timeline/beatSections';

export interface BeatAudioInfo {
    status: 'idle' | 'loading' | 'ready' | 'error';
    durationSec: number;
    /** 0..1 waveform heights for drawing. */
    peaks: number[];
}

const ANALYSIS_RATE = 22050;
const PEAK_COUNT = 400;

const EMPTY: BeatAudioInfo = { status: 'idle', durationSec: 0, peaks: [] };

/**
 * Decodes the loaded beat to mono PCM (kept in a ref, off React state) so it
 * can be drawn as a waveform and analysed into sections on demand.
 */
export function useBeatAudio(url: string | null): BeatAudioInfo & {
    analyze: () => Promise<BeatStructure | null>;
} {
    const [info, setInfo] = useState<BeatAudioInfo>(EMPTY);
    const pcmRef = useRef<{ samples: Float32Array; sampleRate: number } | null>(null);

    useEffect(() => {
        pcmRef.current = null;
        if (!url) {
            setInfo(EMPTY);
            return;
        }
        let cancelled = false;
        setInfo({ status: 'loading', durationSec: 0, peaks: [] });

        (async () => {
            try {
                const res = await fetch(url);
                const data = await res.arrayBuffer();
                const Ctor: typeof OfflineAudioContext | undefined =
                    window.OfflineAudioContext ||
                    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
                if (!Ctor) throw new Error('OfflineAudioContext unavailable');
                // Decoding through a 22.05 kHz context resamples for us: smaller, and plenty for tempo and energy.
                const ctx = new Ctor(1, 1, ANALYSIS_RATE);
                const buffer = await ctx.decodeAudioData(data);
                if (cancelled) return;
                const mono = mixToMono(buffer);
                pcmRef.current = { samples: mono, sampleRate: buffer.sampleRate };
                setInfo({
                    status: 'ready',
                    durationSec: buffer.duration,
                    peaks: computePeaks(mono, PEAK_COUNT),
                });
            } catch (err) {
                if (cancelled) return;
                console.warn('[useBeatAudio] could not decode beat:', err);
                setInfo({ status: 'error', durationSec: 0, peaks: [] });
            }
        })();

        return () => { cancelled = true; };
    }, [url]);

    const analyze = useCallback(async (): Promise<BeatStructure | null> => {
        const pcm = pcmRef.current;
        if (!pcm) return null;
        // Let the "analysing" state paint before the (synchronous) number crunching.
        await new Promise<void>(resolve => setTimeout(resolve, 30));
        return analyzeBeatStructure(pcm.samples, pcm.sampleRate);
    }, []);

    return { ...info, analyze };
}
