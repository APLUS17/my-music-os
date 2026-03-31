import { GoogleGenAI } from "@google/genai";

export interface AudioAnalysisResult {
    sections?: {
        startTime: number;
        endTime: number;
        type: 'vocal' | 'instrumental' | 'speech' | 'silence';
        label?: string;
        emojiTag?: string;
    }[];
    transcription?: string;
    lines?: {
        text: string;
        startTime: number;
        endTime: number;
    }[];
}

/**
 * Strip data URL prefix from base64 string.
 * "data:audio/webm;base64,AAAA" → "AAAA"
 */
const stripDataUrlPrefix = (dataUrl: string): { mimeType: string; data: string } => {
    // Matches data:[mime/type];[params];base64,[data]
    // Captures mime/type in group 1 and data in group 2
    const match = dataUrl.match(/^data:([^;]+).*?;base64,(.+)$/);
    if (match) {
        return { mimeType: match[1], data: match[2] };
    }
    // Already raw base64 or unknown format
    return { mimeType: "audio/webm", data: dataUrl };
};

/**
 * Analyze audio with Gemini AI for line-by-line transcription.
 * Uses lazy initialization of the GenAI client to avoid module-level crashes
 * when the API key env var isn't yet available in the client bundle.
 */
export const analyzeAudioWithGemini = async (audioBase64: string): Promise<AudioAnalysisResult | null> => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!apiKey) {
        console.warn("[AudioIntelligence] No API key — skipping AI analysis");
        return null;
    }

    // Strip data URL prefix if present
    const { mimeType, data } = stripDataUrlPrefix(audioBase64);

    const prompt = `Transcribe the vocals or speech in this audio recording.
Return ONLY a JSON object:
{
  "transcription": "full plain text of everything sung/spoken",
  "lines": [
    { "text": "line of lyrics here", "startTime": 0.0, "endTime": 2.1 }
  ]
}
Split on natural phrasing/breath breaks. Times are seconds from audio start.
If no vocals detected, return { "transcription": "", "lines": [] }.`;

    try {
        const genAI = new GoogleGenAI({ apiKey });

        const response = await genAI.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType,
                        data
                    }
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        const resultText = response.text;
        if (resultText) {
            const parsed = JSON.parse(resultText) as AudioAnalysisResult;
            console.log("[AudioIntelligence] Vocal analysis complete:", {
                hasTranscription: !!parsed.transcription,
                lineCount: parsed.lines?.length || 0
            });
            return parsed;
        }
        return null;
    } catch (error) {
        console.error("[AudioIntelligence] Gemini analysis failed:", error);
        return null;
    }
};

/**
 * Analyze instrumental/beat audio with Gemini AI for song structure identification.
 * Identifies sections like Intro, Verse, Chorus, Bridge, Outro, Drop, Build, etc.
 */
export const analyzeInstrumentalWithGemini = async (audioBase64: string): Promise<AudioAnalysisResult | null> => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!apiKey) {
        console.warn("[AudioIntelligence] No API key — skipping beat analysis");
        return null;
    }

    const { mimeType, data } = stripDataUrlPrefix(audioBase64);

    const prompt = `Analyze this instrumental music track and identify its song structure sections.
Identify distinct musical sections with timestamps and classify each with standard music terminology:
- Intro, Verse, Pre-Chorus, Chorus, Bridge, Outro, Drop, Build, Break, Hook, etc.

For each section provide:
1. startTime and endTime (in seconds)
2. type: always "instrumental"
3. label: standard section name (e.g., "Intro", "Verse 1", "Chorus", "Bridge", "Drop")
4. emojiTag: relevant emoji for visual context (🎬 for Intro/Outro, 🎵 for Verse, 🔥 for Chorus/Drop, 🌉 for Bridge, ⚡ for Build, 🔇 for Break)

Return ONLY a JSON object with this exact structure:
{
  "sections": [{"startTime": 0.0, "endTime": 8.0, "type": "instrumental", "label": "Intro", "emojiTag": "🎬"}],
  "transcription": ""
}`;

    try {
        const genAI = new GoogleGenAI({ apiKey });

        const response = await genAI.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType,
                        data
                    }
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        const resultText = response.text;
        if (resultText) {
            const parsed = JSON.parse(resultText) as AudioAnalysisResult;
            if (!parsed.sections || !Array.isArray(parsed.sections)) {
                console.warn("[AudioIntelligence] Invalid beat analysis response");
                return null;
            }
            console.log("[AudioIntelligence] Beat structure analysis complete:", {
                sections: parsed.sections.length
            });
            return parsed;
        }
        return null;
    } catch (error) {
        console.error("[AudioIntelligence] Beat analysis failed:", error);
        return null;
    }
};
