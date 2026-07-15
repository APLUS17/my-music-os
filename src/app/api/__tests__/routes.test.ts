import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST as transcribePOST } from '../transcribe/route';
import { POST as analyzePOST } from '../muse/analyze/route';

// Mock Supabase Server Client
const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn().mockImplementation(() => {
        return Promise.resolve({
            auth: {
                getUser: mockGetUser,
            },
        });
    }),
}));

describe('API Route Security Authentication Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('/api/transcribe', () => {
        it('should return 401 Unauthorized when no user is authenticated', async () => {
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Auth session invalid'),
            });

            const req = new NextRequest('http://localhost/api/transcribe', {
                method: 'POST',
            });

            const res = await transcribePOST(req);
            expect(res.status).toBe(401);

            const body = await res.json();
            expect(body).toEqual({ error: 'Unauthorized' });
        });

        it('should bypass the 401 auth gate and return 500 (missing GROQ_API_KEY) when user is authenticated', async () => {
            mockGetUser.mockResolvedValue({
                data: { user: { id: 'authenticated-user-id' } },
                error: null,
            });

            const originalGroqKey = process.env.GROQ_API_KEY;
            delete process.env.GROQ_API_KEY;

            try {
                const req = new NextRequest('http://localhost/api/transcribe', {
                    method: 'POST',
                });

                const res = await transcribePOST(req);
                expect(res.status).toBe(500);

                const body = await res.json();
                expect(body.error).toContain('GROQ_API_KEY not configured');
            } finally {
                process.env.GROQ_API_KEY = originalGroqKey;
            }
        });
    });

    describe('/api/muse/analyze', () => {
        it('should return 401 Unauthorized when no user is authenticated', async () => {
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Auth session invalid'),
            });

            const req = new NextRequest('http://localhost/api/muse/analyze', {
                method: 'POST',
            });

            const res = await analyzePOST(req);
            expect(res.status).toBe(401);

            const body = await res.json();
            expect(body).toEqual({ success: false, error: 'Unauthorized' });
        });

        it('should bypass the 401 auth gate and return 400 (Missing parameters) when user is authenticated', async () => {
            mockGetUser.mockResolvedValue({
                data: { user: { id: 'authenticated-user-id' } },
                error: null,
            });

            const req = new NextRequest('http://localhost/api/muse/analyze', {
                method: 'POST',
                body: JSON.stringify({}), // Sending empty JSON body
            });

            const res = await analyzePOST(req);
            expect(res.status).toBe(400);

            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('Missing sessionId, fileUri, mimeType, or durationSec');
        });
    });
});
