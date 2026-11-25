import { NextResponse } from 'next/server';

/** The `{ error, message }` envelope the editor's client (`lyriq/services/ai.ts`) parses. */
export function jsonError(status: number, code: string, message: string, headers?: Record<string, string>) {
    return NextResponse.json({ error: code, message }, { status, headers });
}

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

/**
 * Best-effort per-IP limit. Auth is off, so this is what stands between the
 * public internet and your Groq quota. On serverless each instance keeps its own
 * counters, so treat it as a speed bump, not a guarantee.
 */
export function rateLimit(req: Request, max = 30, windowMs = 60_000, now = Date.now()): Response | null {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const entry = buckets.get(ip);
    if (!entry || entry.resetAt <= now) {
        buckets.set(ip, { count: 1, resetAt: now + windowMs });
        // Keep the map from growing forever.
        if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
        return null;
    }
    entry.count++;
    if (entry.count > max) {
        return jsonError(429, 'rate_limited', 'Too many requests. Try again shortly.', {
            'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
        });
    }
    return null;
}

/** Test hook. */
export function resetRateLimits(): void {
    buckets.clear();
}

export function groqKey(): string {
    return process.env.GROQ_API_KEY ?? '';
}

/** What this deployment can do. Only transcription is wired (Groq); the rest stay local. */
export function serverFeatures() {
    const transcription = Boolean(groqKey());
    return { transcription, arrangement: false, suggestions: false };
}

export function decodeBase64Utf8(b64: string | null): string {
    if (!b64) return '';
    try {
        return Buffer.from(b64, 'base64').toString('utf8');
    } catch {
        return '';
    }
}

/** Written lyrics as a single-line spelling hint for the speech model. */
export function lyricsToPrompt(raw: string, maxChars = 600): string {
    return raw
        .replace(/[\u0000-\u001F\u007F]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxChars);
}
