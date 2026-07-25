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

const TRANSCRIBE_TIMEOUT_MS = 30000;

/**
 * Transcribe a single audio Blob via the /api/transcribe Next.js route, which
 * forwards the audio to Groq Whisper server-side (no CORS issues). Shared by
 * both the single-call path (transcribeAudio) and the chunked path
 * (transcribeAudioChunks) below.
 */
const transcribeBlob = async (blob: Blob, mimeType: string): Promise<AudioAnalysisResult | null> => {
    // Pre-flight size check — Groq Whisper has a 25 MB limit
    const MAX_GROQ_BYTES = 25 * 1024 * 1024; // 25 MB
    if (blob.size > MAX_GROQ_BYTES) {
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
        throw new Error(`Recording is ${sizeMB} MB — exceeds Groq's 25 MB limit. Try a shorter take.`);
    }

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);
        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
                signal: controller.signal,
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
            if (error instanceof Error && error.name === 'AbortError') {
                lastError = new Error('Transcription request timed out');
                console.warn(`[AudioIntelligence] Timed out, retrying (${attempt + 1}/3)...`);
                continue;
            }
            lastError = error;
            break;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    const raw = lastError instanceof Error ? lastError.message : String(lastError);
    console.error('[AudioIntelligence] Groq transcription failed:', lastError);

    if (raw.includes('401') || raw.includes('invalid_api_key')) throw new Error('Groq API key is invalid — check GROQ_API_KEY in Vercel');
    if (raw.includes('429') || raw.includes('rate_limit')) throw new Error('Groq rate limit — try again in a moment');
    if (raw.includes('413')) throw new Error('Recording too large for Groq (25 MB limit)');
    throw new Error(`Transcription error: ${raw.slice(0, 120)}`);
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
    return transcribeBlob(blob, mimeType);
};

/**
 * Transcribe a long recording by sending its real recording-time chunks
 * (e.g. the 20s MediaRecorder timeslices captured during a live take)
 * individually, then stitching the results back together with each chunk's
 * segment timestamps shifted by its offset into the full recording. Avoids
 * pushing one huge multipart body through the transcribe route, and lets a
 * single stalled/failed chunk be skipped instead of failing the whole take.
 */
export const transcribeAudioChunks = async (
    chunks: { blob: Blob; offsetSec: number }[],
    mimeType: string,
    concurrency = 3
): Promise<AudioAnalysisResult | null> => {
    if (chunks.length === 0) return null;

    const results: (AudioAnalysisResult | null)[] = new Array(chunks.length).fill(null);
    let nextIndex = 0;

    const worker = async () => {
        while (true) {
            const i = nextIndex++;
            if (i >= chunks.length) return;
            try {
                results[i] = await transcribeBlob(chunks[i].blob, mimeType);
            } catch (err) {
                console.error(`[AudioIntelligence] Chunk ${i} transcription failed, skipping:`, err);
                results[i] = null;
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));

    const transcriptionParts: string[] = [];
    const lines: { text: string; startTime: number; endTime: number }[] = [];

    chunks.forEach((chunk, i) => {
        const result = results[i];
        if (!result) return;
        if (result.transcription) transcriptionParts.push(result.transcription.trim());
        for (const line of result.lines ?? []) {
            lines.push({
                text: line.text,
                startTime: line.startTime + chunk.offsetSec,
                endTime: line.endTime + chunk.offsetSec,
            });
        }
    });

    if (transcriptionParts.length === 0 && lines.length === 0) {
        throw new Error('All transcription chunks failed');
    }

    return { sections: [], transcription: transcriptionParts.join(' '), lines };
};
