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

/**
 * Strip data URL prefix from base64 string.
 * "data:audio/webm;base64,AAAA" → "AAAA"
 */
const stripDataUrlPrefix = (dataUrl: string): { mimeType: string; data: string } => {
    const match = dataUrl.match(/^data:([^;]+).*?;base64,(.+)$/);
    if (match) {
        return { mimeType: match[1], data: match[2] };
    }
    return { mimeType: "audio/webm", data: dataUrl };
};

/** Map a MIME type to a file extension Groq accepts */
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
 * Transcribe vocal audio using Groq's Whisper API.
 * Sends the recording as a multipart file upload and returns per-line
 * timestamps that drive the lyric scroll in PlayerTab.
 */
export const transcribeAudio = async (audioBase64: string): Promise<AudioAnalysisResult | null> => {
    const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('Groq API key is not configured (NEXT_PUBLIC_GROQ_API_KEY missing in Vercel env vars)');
    }

    const { mimeType } = stripDataUrlPrefix(audioBase64);

    // Convert data URL → Blob for multipart upload
    const blob = await fetch(audioBase64).then(r => r.blob());
    const ext = mimeToExt(mimeType);

    const formData = new FormData();
    formData.append('file', blob, `recording.${ext}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    formData.append('language', 'en');
    formData.append('temperature', '0');

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
        try {
            const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                // Do NOT set Content-Type — browser sets it with the multipart boundary
                body: formData,
            });

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({})) as { error?: { message?: string } };
                const msg = errBody?.error?.message ?? response.statusText;
                const isRateLimit = response.status === 429;
                lastError = new Error(`Groq ${response.status}: ${msg}`);
                if (!isRateLimit || attempt === 2) break;
                console.warn(`[AudioIntelligence] Rate limit hit, retrying (attempt ${attempt + 1}/3)...`);
                continue;
            }

            const result = await response.json() as {
                text: string;
                segments?: { text: string; start: number; end: number }[];
            };

            const lines = (result.segments ?? [])
                .map(seg => ({ text: seg.text.trim(), startTime: seg.start, endTime: seg.end }))
                .filter(l => l.text.length > 0);

            console.log('[AudioIntelligence] Groq transcription complete:', {
                lines: lines.length,
                hasTranscription: !!result.text,
            });

            return { sections: [], transcription: result.text ?? '', lines };
        } catch (error) {
            lastError = error;
            break; // Network / CORS errors — no point retrying
        }
    }

    const raw = lastError instanceof Error ? lastError.message : String(lastError);
    console.error('[AudioIntelligence] Groq transcription failed:', lastError);

    if (raw.includes('401') || raw.includes('invalid_api_key') || raw.includes('Unauthorized')) {
        throw new Error('Groq API key is invalid — check NEXT_PUBLIC_GROQ_API_KEY in Vercel');
    }
    if (raw.includes('429') || raw.includes('rate_limit')) {
        throw new Error('Groq rate limit hit — try again in a moment');
    }
    if (raw.includes('413') || raw.includes('too large')) {
        throw new Error('Recording is too large for Groq (25 MB limit) — try a shorter take');
    }
    if (raw.toLowerCase().includes('cors') || raw.includes('NetworkError') || raw.includes('Failed to fetch')) {
        throw new Error('Groq API blocked by browser (CORS) — transcription needs a server-side route');
    }
    throw new Error(`Groq error: ${raw.slice(0, 120)}`);
};
