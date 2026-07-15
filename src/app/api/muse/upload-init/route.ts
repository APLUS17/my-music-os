import { NextRequest, NextResponse } from 'next/server';

// Starts a resumable upload with the Gemini Files API and returns the
// upload URL to the browser, so the client can PUT the audio bytes
// directly to Google — bypassing Vercel's 4.5 MB API-route body limit
// and freeing this function to return in milliseconds.
export async function POST(request: NextRequest) {
    try {
        const { sessionId, mimeType, sizeBytes } = await request.json();

        if (!sessionId || !mimeType || !sizeBytes || typeof sizeBytes !== 'number') {
            return NextResponse.json(
                { success: false, error: 'Missing sessionId, mimeType, or sizeBytes' },
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

        const initRes = await fetch(
            `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'X-Goog-Upload-Protocol': 'resumable',
                    'X-Goog-Upload-Command': 'start',
                    'X-Goog-Upload-Header-Content-Length': String(sizeBytes),
                    'X-Goog-Upload-Header-Content-Type': mimeType,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file: { display_name: `session_${sessionId}` }
                })
            }
        );

        if (!initRes.ok) {
            const text = await initRes.text();
            console.error('Gemini upload init failed:', initRes.status, text);
            return NextResponse.json(
                { success: false, error: `Gemini upload init failed (${initRes.status})` },
                { status: 502 }
            );
        }

        const uploadUrl = initRes.headers.get('x-goog-upload-url');
        if (!uploadUrl) {
            return NextResponse.json(
                { success: false, error: 'Gemini did not return an upload URL' },
                { status: 502 }
            );
        }

        return NextResponse.json({ success: true, uploadUrl });
    } catch (e: any) {
        console.error('upload-init route error:', e);
        return NextResponse.json(
            { success: false, error: e?.message || 'Failed to start upload' },
            { status: 500 }
        );
    }
}
