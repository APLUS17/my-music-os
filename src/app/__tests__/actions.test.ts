import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeAudioStructure, chatWithFacilitator } from '../actions';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';

// Mock supabase server client
vi.mock('@/lib/supabase/server', () => {
    const mockGetUser = vi.fn();
    const mockSupabase = {
        auth: {
            getUser: mockGetUser
        }
    };
    return {
        createClient: vi.fn().mockResolvedValue(mockSupabase)
    };
});

// Mock @google/genai using a standard function so it can be instantiated as a constructor
vi.mock('@google/genai', () => {
    const mockGenerateContent = vi.fn();
    return {
        GoogleGenAI: vi.fn().mockImplementation(function(this: any) {
            this.models = {
                generateContent: mockGenerateContent
            };
            return this;
        })
    };
});

describe('Server Actions Security & Authentication', () => {
    let originalEnv: NodeJS.ProcessEnv;
    let mockGetUser: any;
    let mockGenerateContent: any;

    beforeEach(async () => {
        originalEnv = { ...process.env };
        process.env.GOOGLE_API_KEY = 'test-api-key';

        // Retrieve the mocked functions to configure them per-test
        const supabaseInstance = await createClient();
        mockGetUser = supabaseInstance.auth.getUser;

        const aiInstance = new GoogleGenAI({ apiKey: 'key' });
        mockGenerateContent = aiInstance.models.generateContent;
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.clearAllMocks();
    });

    describe('analyzeAudioStructure', () => {
        it('should return unauthorized error response if user is unauthenticated', async () => {
            // Mock auth error or no user
            mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Session invalid') });

            const result = await analyzeAudioStructure('audio-base64', 'some lyrics context');

            expect(result).toEqual({
                success: false,
                error: 'Unauthorized'
            });
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });

        it('should return unauthorized error response if auth.getUser returns no user and no error', async () => {
            mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

            const result = await analyzeAudioStructure('audio-base64');

            expect(result).toEqual({
                success: false,
                error: 'Unauthorized'
            });
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });

        it('should perform analysis and return sections if user is successfully authenticated', async () => {
            // Mock authenticated user
            mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });

            // Mock Gemini response
            const mockSections = [
                { startTime: 0, endTime: 10, label: 'Intro', type: 'instrumental', emoji: '🎸', summary: 'Intro beat' }
            ];
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify(mockSections)
            });

            const result = await analyzeAudioStructure('audio-base64-data', 'some lyrics');

            expect(result).toEqual({
                success: true,
                sections: mockSections
            });
            expect(mockGenerateContent).toHaveBeenCalled();
        });

        it('should return failed response if Gemini API key is missing', async () => {
            // Mock authenticated user
            mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });

            // Remove API key from env
            delete process.env.GOOGLE_API_KEY;
            delete process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
            delete process.env.GEMINI_API_KEY;

            const result = await analyzeAudioStructure('audio-base64-data');

            expect(result).toEqual({
                success: false,
                error: 'Failed to analyze audio structure'
            });
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });
    });

    describe('chatWithFacilitator', () => {
        const dummyContext = {
            projectTitle: 'My Hit Song',
            sections: [],
            scraps: [],
            recentSessions: []
        };

        it('should return unauthorized reply response if user is unauthenticated', async () => {
            mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('No active session') });

            const result = await chatWithFacilitator('Help me with a rhyme', dummyContext);

            expect(result).toEqual({
                success: false,
                reply: 'You must be signed in to use the Facilitator AI.'
            });
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });

        it('should return reply from Gemini if user is successfully authenticated', async () => {
            mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-123' } }, error: null });

            mockGenerateContent.mockResolvedValueOnce({
                text: 'Here is a songwriting tip based on the playbook...'
            });

            const result = await chatWithFacilitator('Help me with a rhyme', dummyContext);

            expect(result).toEqual({
                success: true,
                reply: 'Here is a songwriting tip based on the playbook...'
            });
            expect(mockGenerateContent).toHaveBeenCalled();
        });
    });
});
