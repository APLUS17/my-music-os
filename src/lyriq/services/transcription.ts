import { blobToTranscriptionWav } from '../utils/audio';
import type { SttPhrase } from '../types';
import { fetchWithTimeout, readApiError } from './ai';

function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface TakeTranscriptionHints {
  /** Exact take length, so the model keeps its timestamps inside the audio. */
  durationSec?: number;
  /** The singer's written lyrics for this section: used for spelling, never as a substitute for what was sung. */
  writtenLyrics?: string;
  /** True when the caller already supplies a 16 kHz mono WAV built from in-memory PCM. */
  isPreparedWav?: boolean;
}

/**
 * Timed, line-by-line transcription of a finished take. Phrase times are
 * seconds from the start of the audio and only approximate: callers line them
 * up with the vocal itself (see utils/lyricAlign).
 * Returns null when nothing intelligible was transcribed; throws ApiError when
 * the service is unavailable.
 */
export async function transcribeTakeBatch(
  blob: Blob,
  hints: TakeTranscriptionHints = {},
  signal?: AbortSignal
): Promise<SttPhrase[] | null> {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
  const wav = hints.isPreparedWav ? blob : await blobToTranscriptionWav(blob);
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'audio/wav',
  };
  if (hints.durationSec !== undefined && Number.isFinite(hints.durationSec)) {
    headers['X-Audio-Duration-Sec'] = String(hints.durationSec);
  }
  const trimmedLyrics = hints.writtenLyrics?.trim();
  if (trimmedLyrics) {
    headers['X-Written-Lyrics-B64'] = encodeUtf8Base64(hints.writtenLyrics!.slice(0, 4000));
  }

  const res = await fetchWithTimeout(
    '/api/transcribe-audio',
    {
      method: 'POST',
      headers,
      body: wav,
    },
    65_000,
    signal
  );
  if (!res.ok) throw await readApiError(res);

  const data = (await res.json()) as { lines?: unknown };
  if (!Array.isArray(data.lines)) return null;

  const phrases: SttPhrase[] = [];
  for (const raw of data.lines) {
    const l = raw as { text?: unknown; startSec?: unknown; endSec?: unknown } | null;
    if (!l || typeof l.text !== 'string' || !l.text.trim()) continue;
    const start = Number(l.startSec);
    const end = Number(l.endSec);
    if (!Number.isFinite(start)) continue;
    phrases.push({
      text: l.text.trim(),
      startSec: Math.max(0, start),
      endSec: Number.isFinite(end) && end > start ? end : start + 2,
    });
  }
  return phrases.length > 0 ? phrases : null;
}
