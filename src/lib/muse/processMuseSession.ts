import { MuseSegment, MuseRecap } from '@/types';

// Client-side pipeline: browser uploads the audio blob directly to Gemini's
// Files API via a resumable URL minted by our server, then calls the
// analyze route with just the fileUri. This bypasses Vercel's 4.5 MB
// API-route body limit and keeps the analyze function's request small.
export async function processMuseSession(args: {
    sessionId: string;
    blob: Blob;
    mimeType: string;
    durationSec: number;
    onProgress?: (p: { stage: 'uploading' | 'analyzing' }) => void;
}): Promise<{ segments: MuseSegment[]; recap: MuseRecap }> {
    const { sessionId, blob, mimeType, durationSec, onProgress } = args;

    onProgress?.({ stage: 'uploading' });

    // 1. Ask our server for a resumable upload URL.
    const initRes = await fetch('/api/muse/upload-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId,
            mimeType,
            sizeBytes: blob.size
        })
    });
    if (!initRes.ok) {
        const msg = await safeErr(initRes);
        throw new Error(`Could not start upload: ${msg}`);
    }
    const { uploadUrl } = await initRes.json();
    if (!uploadUrl) throw new Error('Could not start upload: missing upload URL');

    // 2. Upload the bytes straight to Google. Long-running mobile connections
    // are the norm here, so we let this run without our own AbortController —
    // the browser and platform will surface network failures.
    const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'X-Goog-Upload-Command': 'upload, finalize',
            'X-Goog-Upload-Offset': '0',
            'Content-Length': String(blob.size)
        },
        body: blob
    });
    if (!uploadRes.ok) {
        const msg = await safeErr(uploadRes);
        throw new Error(`Upload to Gemini failed: ${msg}`);
    }
    const uploadJson = await uploadRes.json();
    const fileUri: string | undefined = uploadJson?.file?.uri;
    const fileName: string | undefined = uploadJson?.file?.name;
    const uploadedMime: string = uploadJson?.file?.mimeType || mimeType;
    if (!fileUri) throw new Error('Upload to Gemini failed: missing file URI');

    // 3. Kick off analysis. Give it up to 4 minutes before we give up on the
    // client — the server itself is capped at 5 min via maxDuration.
    onProgress?.({ stage: 'analyzing' });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240000);

    let analyzeRes: Response;
    try {
        analyzeRes = await fetch('/api/muse/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                fileUri,
                fileName,
                mimeType: uploadedMime,
                durationSec
            }),
            signal: controller.signal
        });
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error('Analysis timed out after 4 minutes');
        }
        throw new Error(`Analysis request failed: ${err?.message || 'network error'}`);
    } finally {
        clearTimeout(timeoutId);
    }

    if (!analyzeRes.ok) {
        const msg = await safeErr(analyzeRes);
        throw new Error(`Analysis failed: ${msg}`);
    }

    const data = await analyzeRes.json();
    if (!data.success) {
        throw new Error(`Analysis failed: ${data.error || 'unknown error'}`);
    }

    return { segments: data.segments, recap: data.recap };
}

async function safeErr(res: Response): Promise<string> {
    try {
        const clone = res.clone();
        const json = await clone.json();
        if (json?.error) return String(json.error);
    } catch {
        // fall through
    }
    try {
        const text = await res.text();
        if (text) return text.slice(0, 200);
    } catch {
        // fall through
    }
    return `HTTP ${res.status}`;
}
