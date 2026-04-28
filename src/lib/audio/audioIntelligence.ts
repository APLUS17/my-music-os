export interface AudioAnalysisResult {
    sections: {
        startTime: number;
        endTime: number;
        type: 'vocal' | 'instrumental' | 'speech' | 'silence';
        label?: string;
        emojiTag?: string;
    }[];
    transcription?: string;
    lines?: { text: string; startTime: number; endTime: number }[];
}

const stripDataUrlPrefix = (dataUrl: string): { mimeType: string; data: string } => {
    const match = dataUrl.match(/^data:([^;]+).*?;base64,(.+)$/);
    if (match) return { mimeType: match[1], data: match[2] };
    return { mimeType: 'audio/webm', data: dataUrl };
};

const mimeToExt = (mimeType: string): string => {
    const map: Record<string, string> = {
        'audio/webm': 'webm',
        'audio/mp4': 'mp4',
        'audio/mpeg': 'mp3',
        'audio/mpga': 'mp3',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'audio/flac': 'flac',
        'audio/m4a': 'm4a',
    };
    return map[mimeType] ?? 'webm';
};

/**
 * Transcribe vocal audio via the /api/transcribe Next.js route, which
 * forwards the audio to Groq Whisper server-side (no CORS issues).
 * Requires GROQ_API_KEY set in Vercel environment variables.
 * NEXT_PUBLIC_GROQ_ENABLED=true must also be set so the client knows
 * transcription is active.
 */
export const transcribeAudio = async (audioBase64: string): Promise<AudioAnalysisResult | null> => {
    const { mimeType } = stripDataUrlPrefix(audioBase64);

    // Convert data URL → Blob for multipart upload
    const blob = await fetch(audioBase64).then(r => r.blob());

    const formData = new FormData();
    formData.append('file', blob, `recording.${mimeToExt(mimeType)}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    formData.append('language', 'en');
    formData.append('temperature', '0');

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
                // No Authorization header — key lives server-side in the route
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({})) as { error?: string };
                const msg = body?.error ?? response.statusText;
                lastError = new Error(`Transcription ${response.status}: ${msg}`);
                if (response.status !== 429 || attempt === 2) break;
                console.warn(`[AudioIntelligence] Rate limit, retrying (${attempt + 1}/3)...`);
                continue;
            }

            const result = await response.json() as {
                text: string;
                segments?: { text: string; start: number; end: number }[];
            };

            const lines = (result.segments ?? [])
                .map(s => ({ text: s.text.trim(), startTime: s.start, endTime: s.end }))
                .filter(l => l.text.length > 0);

            console.log('[AudioIntelligence] Groq transcription complete:', { lines: lines.length });
            return { sections: [], transcription: result.text ?? '', lines };
        } catch (error) {
            lastError = error;
            break;
        }
    }

    const raw = lastError instanceof Error ? lastError.message : String(lastError);
    console.error('[AudioIntelligence] Groq transcription failed:', lastError);

    if (raw.includes('401') || raw.includes('invalid_api_key')) throw new Error('Groq API key is invalid — check GROQ_API_KEY in Vercel');
    if (raw.includes('429') || raw.includes('rate_limit')) throw new Error('Groq rate limit — try again in a moment');
    if (raw.includes('413')) throw new Error('Recording too large for Groq (25 MB limit)');
    throw new Error(`Transcription error: ${raw.slice(0, 120)}`);
};
