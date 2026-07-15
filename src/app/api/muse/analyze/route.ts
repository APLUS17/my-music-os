import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
    buildMusePrompt,
    mapMuseResponse,
    museResponseSchema,
    MUSE_MODEL
} from '@/lib/muse/museSchema';

export const maxDuration = 300; // Vercel Fluid Compute timeout (5 min)

// Audio bytes are uploaded to Gemini directly from the browser via
// /api/muse/upload-init — this route only takes the resulting fileUri
// and runs the analysis, keeping the request body tiny.
export async function POST(request: NextRequest) {
    let ai: GoogleGenAI | null = null;
    let fileName: string | null = null;

    try {
        const { sessionId, fileUri, fileName: fileNameIn, mimeType, durationSec } =
            await request.json();

        if (!sessionId || !fileUri || !mimeType || typeof durationSec !== 'number') {
            return NextResponse.json(
                { success: false, error: 'Missing sessionId, fileUri, mimeType, or durationSec' },
                { status: 400 }
            );
        }

        const apiKey =
            process.env.GOOGLE_API_KEY ||
            process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
            process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: 'Gemini API key missing on server' },
                { status: 500 }
            );
        }
        ai = new GoogleGenAI({ apiKey });
        fileName = fileNameIn || null;

        // Poll until the uploaded file is ACTIVE.
        if (fileName) {
            let fileInfo = await ai.files.get({ name: fileName });
            const startTime = Date.now();
            const timeoutMs = 180000; // 3 minutes

            while (fileInfo.state === 'PROCESSING') {
                if (Date.now() - startTime > timeoutMs) {
                    throw new Error('Gemini file processing timed out');
                }
                await new Promise((resolve) => setTimeout(resolve, 2000));
                fileInfo = await ai.files.get({ name: fileName });
            }

            if (fileInfo.state === 'FAILED') {
                throw new Error('Gemini file processing failed');
            }
        }

        const promptText = buildMusePrompt(durationSec);
        const generateResponse = await ai.models.generateContent({
            model: MUSE_MODEL,
            contents: [
                { text: promptText },
                {
                    fileData: {
                        fileUri,
                        mimeType
                    }
                }
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: museResponseSchema
            }
        });

        const responseText = generateResponse.text || '';
        const { segments, recap } = mapMuseResponse(responseText, durationSec);

        return NextResponse.json({ success: true, segments, recap });
    } catch (e: any) {
        console.error('API Muse Analyze Route Error:', e);
        return NextResponse.json(
            { success: false, error: e?.message || 'An error occurred during session analysis' },
            { status: 500 }
        );
    } finally {
        // Clean up the uploaded file — best effort.
        if (ai && fileName) {
            try {
                await ai.files.delete({ name: fileName });
            } catch (err) {
                console.warn('Failed to delete Gemini file:', err);
            }
        }
    }
}
