import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
    buildMusePrompt,
    mapMuseResponse,
    museResponseSchema,
    MUSE_MODEL
} from '@/lib/muse/museSchema';

export const maxDuration = 300; // Vercel Fluid Compute timeout (5 min)

export async function POST(request: NextRequest) {
    let uploadResponse: any = null;
    let ai: any = null;

    try {
        const formData = await request.formData();
        const sessionId = formData.get('sessionId') as string | null;
        const mimeType = formData.get('mimeType') as string | null;
        const durationSec = Number(formData.get('durationSec'));
        const audioFile = formData.get('audio') as File | null;

        if (!sessionId || !mimeType || !audioFile || isNaN(durationSec)) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }

        // 1. Initialize Gemini
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Gemini API Key missing on server' }, { status: 500 });
        }
        ai = new GoogleGenAI({ apiKey });

        // 2. Convert uploaded file to native File object
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileObj = new File([buffer], `session_${sessionId}`, { type: mimeType });

        // 3. Upload file
        uploadResponse = await ai.files.upload({ file: fileObj });

        // 4. Poll until ACTIVE
        let fileInfo = await ai.files.get({ name: uploadResponse.name });
        const startTime = Date.now();
        const timeoutMs = 180000; // 3 minutes

        while (fileInfo.state === 'PROCESSING') {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error('Gemini file processing timed out');
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
            fileInfo = await ai.files.get({ name: uploadResponse.name });
        }

        if (fileInfo.state === 'FAILED') {
            throw new Error('Gemini file processing failed');
        }

        // 5. Generate content using prompts
        const promptText = buildMusePrompt(durationSec);
        const generateResponse = await ai.models.generateContent({
            model: MUSE_MODEL,
            contents: [
                { text: promptText },
                {
                    fileData: {
                        fileUri: fileInfo.uri,
                        mimeType: fileInfo.mimeType
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
        return NextResponse.json({ success: false, error: e.message || 'An error occurred during session analysis' }, { status: 500 });
    } finally {
        // Clean up Gemini Files API file
        if (ai && uploadResponse?.name) {
            try {
                await ai.files.delete({ name: uploadResponse.name });
            } catch (err) {
                console.warn('Failed to delete Gemini file:', err);
            }
        }
    }
}
