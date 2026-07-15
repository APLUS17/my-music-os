import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Gemini SDK
const mockConstructor = vi.fn();
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: class {
            constructor(config: { apiKey: string }) {
                mockConstructor(config);
            }
            models = {
                generateContent: mockGenerateContent
            }
        }
    };
});

// Mock Supabase to avoid initialization or auth helper errors during import
vi.mock('@/lib/supabase/server', () => {
    return {
        createClient: vi.fn().mockReturnValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null })
            }
        })
    };
});

// Now import the actions and route
import { analyzeAudioStructure, chatWithFacilitator } from '../actions';
import { POST } from '../api/muse/analyze/route';

describe('Security Vulnerability - Secret Exposure Prevention', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset process.env before each test
        process.env = { ...originalEnv };
        delete process.env.GOOGLE_API_KEY;
        delete process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
        delete process.env.GEMINI_API_KEY;

        mockGenerateContent.mockResolvedValue({
            text: '[{"startTime": 0, "endTime": 10, "label": "Intro", "type": "vocal", "emoji": "🎤"}]'
        });
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('analyzeAudioStructure Server Action', () => {
        it('should fail when all keys are missing', async () => {
            const result = await analyzeAudioStructure('mock-audio-base64');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to analyze');
            expect(mockConstructor).not.toHaveBeenCalled();
        });

        it('should fail and not fall back to NEXT_PUBLIC_GOOGLE_API_KEY if only NEXT_PUBLIC_GOOGLE_API_KEY is present', async () => {
            process.env.NEXT_PUBLIC_GOOGLE_API_KEY = 'insecure-public-key';

            const result = await analyzeAudioStructure('mock-audio-base64');
            expect(result.success).toBe(false);
            expect(mockConstructor).not.toHaveBeenCalled();
        });

        it('should succeed and use GOOGLE_API_KEY when present', async () => {
            process.env.GOOGLE_API_KEY = 'secure-key';

            const result = await analyzeAudioStructure('mock-audio-base64');
            expect(result.success).toBe(true);
            expect(mockConstructor).toHaveBeenCalledWith({ apiKey: 'secure-key' });
        });

        it('should succeed and use GEMINI_API_KEY when GOOGLE_API_KEY is absent', async () => {
            process.env.GEMINI_API_KEY = 'secure-gemini-key';

            const result = await analyzeAudioStructure('mock-audio-base64');
            expect(result.success).toBe(true);
            expect(mockConstructor).toHaveBeenCalledWith({ apiKey: 'secure-gemini-key' });
        });
    });

    describe('chatWithFacilitator Server Action', () => {
        const mockContext = {
            projectTitle: 'My Test Song',
            sections: [],
            scraps: [],
            recentSessions: [],
            activeView: 'flow' as const
        };

        it('should fail with standard fallback warning when all keys are missing', async () => {
            const result = await chatWithFacilitator('hello', mockContext);
            expect(result.success).toBe(false);
            expect(result.reply).toContain('Gemini API key is missing');
            expect(mockConstructor).not.toHaveBeenCalled();
        });

        it('should fail and not fall back to NEXT_PUBLIC_GOOGLE_API_KEY if only NEXT_PUBLIC_GOOGLE_API_KEY is present', async () => {
            process.env.NEXT_PUBLIC_GOOGLE_API_KEY = 'insecure-public-key';

            const result = await chatWithFacilitator('hello', mockContext);
            expect(result.success).toBe(false);
            expect(mockConstructor).not.toHaveBeenCalled();
        });

        it('should succeed and use GOOGLE_API_KEY when present', async () => {
            process.env.GOOGLE_API_KEY = 'secure-key';
            mockGenerateContent.mockResolvedValue({ text: 'Hello, songwriter!' });

            const result = await chatWithFacilitator('hello', mockContext);
            expect(result.success).toBe(true);
            expect(result.reply).toBe('Hello, songwriter!');
            expect(mockConstructor).toHaveBeenCalledWith({ apiKey: 'secure-key' });
        });
    });

    describe('API Route POST /api/muse/analyze', () => {
        it('should return 500 when all keys are missing', async () => {
            const mockFormData = new FormData();
            mockFormData.append('sessionId', 'session-123');
            mockFormData.append('mimeType', 'audio/webm');
            mockFormData.append('durationSec', '30');
            mockFormData.append('audio', new File([new Uint8Array(10)], 'audio.webm', { type: 'audio/webm' }));

            const req = {
                formData: async () => mockFormData
            } as unknown as NextRequest;

            const res = await POST(req);
            expect(res.status).toBe(500);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toContain('Gemini API Key missing');
            expect(mockConstructor).not.toHaveBeenCalled();
        });

        it('should fail and not fall back to NEXT_PUBLIC_GOOGLE_API_KEY if only NEXT_PUBLIC_GOOGLE_API_KEY is present', async () => {
            process.env.NEXT_PUBLIC_GOOGLE_API_KEY = 'insecure-public-key';

            const mockFormData = new FormData();
            mockFormData.append('sessionId', 'session-123');
            mockFormData.append('mimeType', 'audio/webm');
            mockFormData.append('durationSec', '30');
            mockFormData.append('audio', new File([new Uint8Array(10)], 'audio.webm', { type: 'audio/webm' }));

            const req = {
                formData: async () => mockFormData
            } as unknown as NextRequest;

            const res = await POST(req);
            expect(res.status).toBe(500);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toContain('Gemini API Key missing');
            expect(mockConstructor).not.toHaveBeenCalled();
        });
    });
});
