import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as transcribePOST } from '../transcribe/route';
import { POST as analyzePOST } from '../muse/analyze/route';

// Auth is intentionally disabled for now: these routes must not require a
// signed-in user, but they must still validate their input.
describe('API routes (no auth)', () => {
    it('/api/transcribe is reachable without a session and reports a missing GROQ key', async () => {
        const originalGroqKey = process.env.GROQ_API_KEY;
        delete process.env.GROQ_API_KEY;
        try {
            const res = await transcribePOST(
                new NextRequest('http://localhost/api/transcribe', { method: 'POST' })
            );
            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error).toContain('GROQ_API_KEY not configured');
        } finally {
            if (originalGroqKey !== undefined) process.env.GROQ_API_KEY = originalGroqKey;
        }
    });

    it('/api/muse/analyze is reachable without a session and validates its body', async () => {
        const res = await analyzePOST(
            new NextRequest('http://localhost/api/muse/analyze', {
                method: 'POST',
                body: JSON.stringify({}),
            })
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain('Missing sessionId, fileUri, mimeType, or durationSec');
    });
});
