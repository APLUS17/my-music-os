import { GoogleGenAI } from "@google/genai";

export interface AudioAnalysisResult {
    sections: {
        startTime: number;
        endTime: number;
        type: 'vocal' | 'instrumental' | 'speech' | 'silence';
        label?: string;
        emojiTag?: string;
    }[];
    transcription?: string;
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
 * Analyze audio with Gemini AI for section classification, BPM, and transcription.
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

    const prompt = `Analyze this songwriting session audio recording. Provide:
1. SECTIONS: Identify distinct musical sections with timestamps (start/end in seconds). Classify each as: vocal, instrumental, speech, or silence.
2. LABELS & TAGS: For each section, provide a short descriptive label (e.g., "verse melody", "guitar riff", "spoken idea") and a relevant emoji tag (🎤 for vocal, 🎸 for instrumental, 💬 for speech, 🔇 for silence).
3. TRANSCRIPTION: Provide a combined transcript of any spoken or sung words. If none, set to empty string.

Return ONLY a JSON object with this exact structure:
{
  "sections": [{"startTime": 0.0, "endTime": 1.5, "type": "vocal", "label": "verse idea", "emojiTag": "🎤"}],
  "transcription": "the words spoken or sung"
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
                console.warn("[AudioIntelligence] Invalid response structure");
                return null;
            }
            console.log("[AudioIntelligence] Analysis complete:", {
                sections: parsed.sections.length,
                hasTranscription: !!parsed.transcription
            });
            return parsed;
        }
        return null;
    } catch (error) {
        console.error("[AudioIntelligence] Gemini analysis failed:", error);
        return null;
    }
};
