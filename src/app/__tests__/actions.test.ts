import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeAudioStructure, chatWithFacilitator } from "../actions";

// Mock the GoogleGenAI sdk class
vi.mock("@google/genai", () => {
    class MockGoogleGenAI {
        apiKey: string;
        models: { generateContent: any };
        constructor(config: { apiKey: string }) {
            this.apiKey = config.apiKey;
            this.models = {
                generateContent: vi.fn().mockResolvedValue({
                    text: JSON.stringify([{ startTime: 0, endTime: 10, label: "Intro", type: "instrumental", emoji: "🎸" }])
                })
            };
        }
    }
    return {
        GoogleGenAI: MockGoogleGenAI
    };
});

// Mock the supabase server client as it is not needed for this test
vi.mock("@/lib/supabase/server", () => {
    return {
        createClient: vi.fn().mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-id" } }, error: null })
            }
        })
    };
});

describe("Gemini Server Actions Security and Key Fallbacks", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        // Clear all keys first to start in a clean state
        delete process.env.GOOGLE_API_KEY;
        delete process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
        delete process.env.GEMINI_API_KEY;
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.clearAllMocks();
    });

    describe("analyzeAudioStructure", () => {
        it("should successfully initialize when GOOGLE_API_KEY is provided", async () => {
            process.env.GOOGLE_API_KEY = "secure-google-api-key";

            const result = await analyzeAudioStructure("base64data", "lyrics context");
            expect(result.success).toBe(true);
        });

        it("should successfully initialize when GEMINI_API_KEY is provided", async () => {
            process.env.GEMINI_API_KEY = "secure-gemini-api-key";

            const result = await analyzeAudioStructure("base64data", "lyrics context");
            expect(result.success).toBe(true);
        });

        it("should throw an error and fail when only NEXT_PUBLIC_GOOGLE_API_KEY is provided", async () => {
            process.env.NEXT_PUBLIC_GOOGLE_API_KEY = "leaked-public-api-key";

            const result = await analyzeAudioStructure("base64data", "lyrics context");
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe("Failed to analyze audio structure");
            }
        });

        it("should fail when no API keys are provided", async () => {
            const result = await analyzeAudioStructure("base64data", "lyrics context");
            expect(result.success).toBe(false);
        });
    });

    describe("chatWithFacilitator", () => {
        const dummyContext = {
            projectTitle: "Test Project",
            sections: [],
            scraps: [],
            recentSessions: [],
        };

        it("should successfully process when GOOGLE_API_KEY is provided", async () => {
            process.env.GOOGLE_API_KEY = "secure-google-api-key";

            const result = await chatWithFacilitator("Hello", dummyContext);
            expect(result.success).toBe(true);
        });

        it("should successfully process when GEMINI_API_KEY is provided", async () => {
            process.env.GEMINI_API_KEY = "secure-gemini-api-key";

            const result = await chatWithFacilitator("Hello", dummyContext);
            expect(result.success).toBe(true);
        });

        it("should fail gracefully when only NEXT_PUBLIC_GOOGLE_API_KEY is provided", async () => {
            process.env.NEXT_PUBLIC_GOOGLE_API_KEY = "leaked-public-api-key";

            const result = await chatWithFacilitator("Hello", dummyContext);
            expect(result.success).toBe(false);
            expect(result.reply).toContain("Gemini API key is missing");
        });

        it("should fail gracefully when no API keys are provided", async () => {
            const result = await chatWithFacilitator("Hello", dummyContext);
            expect(result.success).toBe(false);
            expect(result.reply).toContain("Gemini API key is missing");
        });
    });
});
