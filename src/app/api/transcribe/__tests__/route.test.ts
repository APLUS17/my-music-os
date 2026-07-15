import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock Supabase Server client
const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve({
        auth: {
            getUser: mockGetUser,
        },
    })),
}));

describe('POST /api/transcribe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 Unauthorized when no user session is present', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

        const req = new NextRequest('http://localhost/api/transcribe', {
            method: 'POST',
            body: new FormData(),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);

        const data = await res.json();
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 Unauthorized when Supabase auth getUser returns an error', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Auth failure') });

        const req = new NextRequest('http://localhost/api/transcribe', {
            method: 'POST',
            body: new FormData(),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);

        const data = await res.json();
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('passes authentication and fails on missing GROQ_API_KEY when authenticated', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'test-user-id' } }, error: null });

        // Backup existing GROQ_API_KEY if any
        const originalKey = process.env.GROQ_API_KEY;
        delete process.env.GROQ_API_KEY;

        try {
            const req = new NextRequest('http://localhost/api/transcribe', {
                method: 'POST',
                body: new FormData(),
            });

            const res = await POST(req);
            expect(res.status).toBe(500);

            const data = await res.json();
            expect(data).toEqual({ error: 'GROQ_API_KEY not configured in environment' });
        } finally {
            process.env.GROQ_API_KEY = originalKey;
        }
    });
});
