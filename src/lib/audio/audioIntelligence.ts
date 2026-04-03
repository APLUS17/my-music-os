import { GoogleGenAI } from "@google/genai";

let _genAI: GoogleGenAI | null = null;
const getGenAI = (): GoogleGenAI => {
    if (!_genAI) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY!;
        _genAI = new GoogleGenAI({ apiKey });
    }
    return _genAI;
};

export interface AudioAnalysisResult {
    sections: {
        startTime: number;
        endTime: number;
        type: 'vocal' | 'instrumental' | 'speech' | 'silence';
        label?: string;
        emojiTag?: string;
    }[];
    transcription?: string;
    lines?: { text: string; startTime: number; endTime: number }[];
    bpm?: number; // Detected BPM for beat-aligned loop snapping (beats per minute)
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
 * Transcribe vocal audio with Gemini AI, returning per-line timestamps.
 * Does NOT detect sections — section detection is only for instrumentals.
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

Return ONLY a JSON object with this exact structure:
{
  "transcription": "full plain text of everything sung or spoken",
  "lines": [
    { "text": "first lyric line or phrase", "startTime": 0.0, "endTime": 2.1 },
    { "text": "second lyric line or phrase", "startTime": 2.3, "endTime": 4.5 }
  ]
}

Split on natural phrasing or breath breaks — one sung phrase per line entry.
Timestamps are seconds from the start of the audio file.
If no vocals are detected, return { "transcription": "", "lines": [] }.`;

    try {
        const response = await getGenAI().models.generateContent({
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
            // Vocal analysis returns lines, not sections — normalise
            if (!parsed.lines) parsed.lines = [];
            if (!parsed.sections) parsed.sections = [];
            console.log("[AudioIntelligence] Vocal transcription complete:", {
                lines: parsed.lines.length,
                hasTranscription: !!parsed.transcription
            });
            return parsed;
        }
        return null;
    } catch (error) {
        console.error("[AudioIntelligence] Gemini transcription failed:", error);
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

IMPORTANT: Ensure all timestamps align with beat boundaries for seamless looping.
Identify distinct musical sections with precise timestamps and classify each with standard music terminology:
- Intro, Verse, Pre-Chorus, Chorus, Bridge, Outro, Drop, Build, Break, Hook, etc.

For each section provide:
1. startTime and endTime (in seconds) — MUST align with musical beat boundaries
2. type: always "instrumental"
3. label: standard section name (e.g., "Intro", "Verse 1", "Chorus", "Bridge", "Drop")
4. emojiTag: relevant emoji for visual context (🎬 for Intro/Outro, 🎵 for Verse, 🔥 for Chorus/Drop, 🌉 for Bridge, ⚡ for Build, 🔇 for Break)

Also detect the tempo:
5. bpm: The beats per minute (BPM) of the track for beat-aligned loop calculations

Return ONLY a JSON object with this exact structure:
{
  "sections": [{"startTime": 0.0, "endTime": 8.0, "type": "instrumental", "label": "Intro", "emojiTag": "🎬"}],
  "transcription": "",
  "bpm": 128
}

Accuracy is critical: timestamps must land on clean beat boundaries so loop regions play smoothly, and BPM must be precise.`;

    try {
        const response = await getGenAI().models.generateContent({
            model: "gemini-3.1-pro",
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
                responseMimeType: "application/json",
                thinking: {
                    type: "enabled",
                    budgetTokens: 5000
                }
            } as any
        });

        const resultText = response.text;
        if (resultText) {
            console.log("[AudioIntelligence] Raw beat analysis response:", resultText.substring(0, 500));
            const parsed = JSON.parse(resultText) as AudioAnalysisResult;
            if (!parsed.sections || !Array.isArray(parsed.sections)) {
                console.warn("[AudioIntelligence] Invalid beat analysis response - no sections in result");
                return null;
            }
            console.log("[AudioIntelligence] Beat structure analysis complete:", {
                sections: parsed.sections.length,
                sectionDetails: parsed.sections.map(s => ({ label: s.label, start: s.startTime, end: s.endTime }))
            });
            return parsed;
        }
        console.warn("[AudioIntelligence] No text in response");
        return null;
    } catch (error) {
        console.error("[AudioIntelligence] Beat analysis failed:", error);
        console.error("[AudioIntelligence] Full error details:", error instanceof Error ? error.message : String(error));
        return null;
    }
};
