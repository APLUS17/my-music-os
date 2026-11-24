import { NextRequest, NextResponse } from 'next/server';
import { decodeBase64Utf8, groqKey, jsonError, lyricsToPrompt, rateLimit } from '@/lib/server/apiGuard';
import { buildLinesFromWhisper, type WhisperResponse } from '@/lib/server/whisperLines';

export const maxDuration = 60;

/** Largest audio body accepted (a 16 kHz mono WAV is ~1.9 MB per minute). */
const MAX_AUDIO_BYTES = 12_000_000;
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3-turbo';

/**
 * Timed, line-by-line transcription of a vocal take, via Groq Whisper.
 * Body: raw `audio/wav`. Headers: `X-Audio-Duration-Sec`, `X-Written-Lyrics-B64`.
 * Response: `{ lines: [{ text, startSec, endSec }] }`.
 */
export async function POST(req: NextRequest) {
    const limited = rateLimit(req);
    if (limited) return limited;

    const apiKey = groqKey();
    if (!apiKey) return jsonError(503, 'ai_unavailable', 'Transcription is not configured on this server.');

    const audio = await req.arrayBuffer();
    if (audio.byteLength === 0) return jsonError(400, 'bad_request', 'Missing audio data.');
    if (audio.byteLength > MAX_AUDIO_BYTES) return jsonError(413, 'audio_too_large', 'Take is too long to transcribe.');

    const durationRaw = Number(req.headers.get('x-audio-duration-sec'));
    const durationSec = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.min(durationRaw, 3600) : null;
    const prompt = lyricsToPrompt(decodeBase64Utf8(req.headers.get('x-written-lyrics-b64')));

    const form = new FormData();
    form.append('file', new Blob([audio], { type: 'audio/wav' }), 'take.wav');
    form.append('model', GROQ_MODEL);
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');
    form.append('language', 'en');
    form.append('temperature', '0');
    // Whisper uses this only as a spelling/style hint, so it can't replace what was sung.
    if (prompt) form.append('prompt', prompt);

    let res: Response;
    try {
        res = await fetch(GROQ_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
            signal: AbortSignal.timeout(55_000),
        });
    } catch (err) {
        const timedOut = err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
        return timedOut
            ? jsonError(504, 'timeout', 'The transcription request timed out.')
            : jsonError(502, 'upstream_unreachable', 'Could not reach the transcription service.');
    }

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        const detail = body?.error?.message ?? res.statusText;
        if (res.status === 429) return jsonError(429, 'rate_limited', 'The transcription service is rate-limited. Try again shortly.');
        if (res.status === 413) return jsonError(413, 'audio_too_large', 'Take is too long to transcribe.');
        if (res.status === 400 || res.status === 422) return jsonError(422, 'unprocessable_audio', detail || 'The audio could not be read.');
        if (res.status === 401 || res.status === 403) return jsonError(502, 'upstream_auth', 'The server\'s transcription key was rejected.');
        return jsonError(res.status >= 500 ? 503 : 502, 'service_busy', 'The transcription service is busy. Try again in a moment.');
    }

    const data = (await res.json()) as WhisperResponse;
    return NextResponse.json({ lines: buildLinesFromWhisper(data, durationSec) });
}
