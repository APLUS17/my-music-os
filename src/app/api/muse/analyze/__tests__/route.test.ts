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

// Mock GoogleGenAI to prevent real API calls during authenticated path tests
vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: vi.fn().mockImplementation(() => {
            return {
                files: {
                    upload: vi.fn().mockResolvedValue({ name: 'mock-file' }),
                    get: vi.fn().mockResolvedValue({ state: 'ACTIVE', uri: 'mock-uri', mimeType: 'audio/webm' }),
                },
                models: {
                    generateContent: vi.fn().mockResolvedValue({
                        text: JSON.stringify({
                            title: 'Mock Session',
                            summary: 'Summary',
                            segments: [],
                            highlights: [],
                        }),
                    }),
                },
            };
        }),
    };
});

describe('POST /api/muse/analyze', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 Unauthorized when no user session is present', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

        const req = new NextRequest('http://localhost/api/muse/analyze', {
            method: 'POST',
            body: new FormData(),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);

        const data = await res.json();
        expect(data).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns 401 Unauthorized when Supabase auth getUser returns an error', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Auth failure') });

        const req = new NextRequest('http://localhost/api/muse/analyze', {
            method: 'POST',
            body: new FormData(),
        });

        const res = await POST(req);
        expect(res.status).toBe(401);

        const data = await res.json();
        expect(data).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('passes authentication and proceeds to validate request parameters when authenticated', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'test-user-id' } }, error: null });

        const req = new NextRequest('http://localhost/api/muse/analyze', {
            method: 'POST',
            body: new FormData(), // Missing required parameters, so it should return 400
        });

        const res = await POST(req);
        expect(res.status).toBe(400);

        const data = await res.json();
        expect(data).toEqual({ success: false, error: 'Missing required parameters' });
    });
});
