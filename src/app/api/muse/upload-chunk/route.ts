import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// Relays one audio chunk to the Gemini Files API resumable-upload session
// started by /api/muse/upload-init. This runs server-to-server (this
// function calling Google), never browser-to-Google — Google's resumable
// upload only trusts the origin that started the session, which is always
// this server, so a direct browser PUT gets blocked by CORS. Each chunk is
// small enough to stay under Vercel's 4.5 MB request body limit.
export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const uploadId = searchParams.get('uploadId');
        const offset = searchParams.get('offset');
        const isFinal = searchParams.get('isFinal') === 'true';

        if (!uploadId || offset === null) {
            return NextResponse.json(
                { success: false, error: 'Missing uploadId or offset' },
                { status: 400 }
            );
        }

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: 'Gemini API key missing on server' },
                { status: 500 }
            );
        }

        const chunkBytes = await request.arrayBuffer();
        const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}&upload_id=${uploadId}&upload_protocol=resumable`;

        const relayRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Command': isFinal ? 'upload, finalize' : 'upload',
                'X-Goog-Upload-Offset': offset,
                'Content-Length': String(chunkBytes.byteLength)
            },
            body: chunkBytes
        });

        if (!relayRes.ok) {
            const text = await relayRes.text();
            console.error('Gemini chunk relay failed:', relayRes.status, text);
            return NextResponse.json(
                { success: false, error: `Gemini upload failed (${relayRes.status})` },
                { status: 502 }
            );
        }

        if (!isFinal) {
            return NextResponse.json({ success: true });
        }

        const fileJson = await relayRes.json();
        const fileUri: string | undefined = fileJson?.file?.uri;
        const fileName: string | undefined = fileJson?.file?.name;
        const uploadedMime: string | undefined = fileJson?.file?.mimeType;
        if (!fileUri) {
            return NextResponse.json(
                { success: false, error: 'Gemini did not return a file URI on finalize' },
                { status: 502 }
            );
        }

        return NextResponse.json({ success: true, fileUri, fileName, mimeType: uploadedMime });
    } catch (e: any) {
        console.error('upload-chunk route error:', e);
        return NextResponse.json(
            { success: false, error: e?.message || 'Failed to relay upload chunk' },
            { status: 500 }
        );
    }
}
