import type { BeatAnalysis } from '../types';

export class ApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Parses the server's { error, message } envelope into a typed error. */
export async function readApiError(res: Response): Promise<ApiError> {
  let code = 'request_failed';
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    if (typeof body?.error === 'string') code = body.error;
    if (typeof body?.message === 'string') message = body.message;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(message, code, res.status);
}

export type AiErrorContext = 'transcription' | 'arrangement' | 'suggestions';

/**
 * Formats API, rate-limit (429), service-unavailable (503), timeout (504),
 * and network errors into consistent user-facing messages.
 */
export function formatAiError(err: unknown, context: AiErrorContext): string {
  if (err instanceof ApiError) {
    if (err.code === 'ai_unavailable') {
      if (context === 'suggestions') return 'AI suggestions are not configured on this server.';
      if (context === 'arrangement') return 'Beat loaded. Auto-arrangement is not set up on this server, so add sections by hand.';
      return 'Take saved. Lyrics are not transcribed because AI is not set up on this server.';
    }
    if (err.status === 429 || err.code === 'rate_limited') {
      return 'The AI service is temporarily rate-limited. Wait a moment and try again.';
    }
    if (err.status === 503 || err.code === 'service_busy') {
      return 'The AI service is experiencing high demand. Try again in a moment.';
    }
    if (err.status === 504 || err.code === 'timeout') {
      return 'The AI request timed out. Try again in a moment.';
    }
    if (err.status === 413 || err.code === 'audio_too_large' || err.code === 'payload_too_large') {
      return context === 'transcription'
        ? 'That take is too long to transcribe automatically.'
        : 'That audio clip is too large to analyze.';
    }
    if (err.status === 422 || err.code === 'unprocessable_audio') {
      return 'The AI service could not read this audio format.';
    }
    if (err.code === 'ai_bad_request' || err.status === 400) {
      return err.message || 'The AI arrangement service could not process this request.';
    }
    if (err.message) return err.message;
  }

  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'The AI request timed out. Try again in a moment.';
  }

  if (err instanceof TypeError) {
    return 'Network error: check your internet connection and try again.';
  }

  if (context === 'suggestions') return 'Could not generate lines right now. Try again in a moment.';
  if (context === 'arrangement') return 'the AI could not analyse it';
  return 'Lyrics could not be transcribed for that take.';
}

/**
 * Runs `fn` with a combined timeout + optional caller AbortSignal,
 * guaranteeing timer cleanup.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/** What this server can do. Older servers only report `ai`, which then stands for all three. */
export interface AiFeatures {
  transcription: boolean;
  arrangement: boolean;
  suggestions: boolean;
}

let featuresCache: Promise<AiFeatures | null> | null = null;

/**
 * Reads /api/health once and remembers it. Lets callers skip requests the server
 * has already said it cannot serve (for example uploading a whole beat just to be
 * told arrangement is unavailable). Null when the server does not answer.
 */
export function getAiFeatures(signal?: AbortSignal): Promise<AiFeatures | null> {
  if (!featuresCache) {
    featuresCache = (async () => {
      try {
        const res = await fetchWithTimeout('/api/health', { method: 'GET' }, 8_000, signal);
        if (!res.ok) return null;
        const body = (await res.json()) as { ai?: unknown; features?: Partial<AiFeatures> };
        if (body.features && typeof body.features === 'object') {
          return {
            transcription: body.features.transcription === true,
            arrangement: body.features.arrangement === true,
            suggestions: body.features.suggestions === true,
          };
        }
        return typeof body.ai === 'boolean'
          ? { transcription: body.ai, arrangement: body.ai, suggestions: body.ai }
          : null;
      } catch {
        return null;
      }
    })();
    // A failed lookup should be retried next time, not remembered.
    featuresCache.then(f => { if (f === null) featuresCache = null; });
  }
  return featuresCache;
}

export async function checkAiHealth(signal?: AbortSignal): Promise<boolean | null> {
  const features = await getAiFeatures(signal);
  return features ? features.transcription : null;
}

export interface AnalyzeBeatParams {
  audioBlob: Blob;
  mimeType?: string;
  fileName: string;
  audioDurationSec: number;
  bpm?: number;
  gridOriginSec?: number;
  bpmConfidence?: number;
}

export async function analyzeBeatArrangement(
  params: AnalyzeBeatParams,
  signal?: AbortSignal
): Promise<BeatAnalysis> {
  const features = await getAiFeatures(signal);
  if (features && !features.arrangement) {
    throw new ApiError('Auto-arrangement is not set up on this server.', 'ai_unavailable', 503);
  }
  const headers: Record<string, string> = {
    'Content-Type': params.mimeType ?? 'audio/wav',
    'X-File-Name': encodeURIComponent(params.fileName),
    'X-Audio-Duration-Sec': String(params.audioDurationSec),
  };
  if (params.bpm !== undefined && Number.isFinite(params.bpm)) {
    headers['X-Audio-Bpm'] = String(params.bpm);
  }
  if (params.gridOriginSec !== undefined && Number.isFinite(params.gridOriginSec)) {
    headers['X-Grid-Origin-Sec'] = String(params.gridOriginSec);
  }
  if (params.bpmConfidence !== undefined && Number.isFinite(params.bpmConfidence)) {
    headers['X-Bpm-Confidence'] = String(params.bpmConfidence);
  }

  const res = await fetchWithTimeout(
    '/api/analyze-beat',
    {
      method: 'POST',
      headers,
      body: params.audioBlob,
    },
    45_000,
    signal
  );
  if (!res.ok) throw await readApiError(res);
  return (await res.json()) as BeatAnalysis;
}

export interface SongSuggestionsParams {
  writtenLyrics: string;
  queryWord?: string;
  targetSyllables?: number;
}

export interface SongSuggestionsResult {
  rhymes: string[];
  words: string[];
  lines: string[];
}

export async function fetchSongSuggestions(
  params: SongSuggestionsParams,
  signal?: AbortSignal
): Promise<SongSuggestionsResult> {
  const features = await getAiFeatures(signal);
  if (features && !features.suggestions) {
    throw new ApiError('AI suggestions are not configured on this server.', 'ai_unavailable', 503);
  }
  const res = await fetchWithTimeout(
    '/api/song-assistant',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    30_000,
    signal
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as Partial<SongSuggestionsResult>;
  return {
    rhymes: Array.isArray(data.rhymes) ? data.rhymes : [],
    words: Array.isArray(data.words) ? data.words : [],
    lines: Array.isArray(data.lines) ? data.lines : [],
  };
}
