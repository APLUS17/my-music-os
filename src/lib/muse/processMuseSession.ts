import { MuseSegment, MuseRecap } from '@/types';

// Chunk size for the client -> our server leg of the upload. Must be a
// multiple of 256 KiB per Google's resumable-upload alignment requirement.
// 3 MiB keeps every request comfortably under Vercel's 4.5 MB body limit.
const UPLOAD_CHUNK_BYTES = 12 * 262144; // 3 MiB

// Client-side pipeline: our server starts a resumable upload session with
// Gemini's Files API, then the browser relays the audio to Google THROUGH
// our own server in small pieces (never directly to Google) before calling
// the analyze route with just the resulting fileUri.
//
// This two-hop shape is required, not just a size workaround: Google's
// resumable-upload CORS policy only trusts the origin that started the
// session. That's always this server (since it holds the API key), so a
// browser PUT straight to Google's upload URL gets blocked by CORS no
// matter what headers we send — the origins never match. Routing every
// Google-facing byte through our server sidesteps that entirely (CORS only
// applies to browser requests), while chunking the client -> server leg
// keeps each request under Vercel's 4.5 MB body limit.
export async function processMuseSession(args: {
    sessionId: string;
    blob: Blob;
    mimeType: string;
    durationSec: number;
    onProgress?: (p: { stage: 'uploading' | 'analyzing' }) => void;
}): Promise<{ segments: MuseSegment[]; recap: MuseRecap }> {
    const { sessionId, blob, mimeType, durationSec, onProgress } = args;

    onProgress?.({ stage: 'uploading' });

    // 1. Ask our server to start a resumable upload session with Google.
    // We only ever get back an opaque upload_id — never the full upload URL,
    // which embeds the raw API key.
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
    const { uploadId } = await initRes.json();
    if (!uploadId) throw new Error('Could not start upload: missing upload id');

    // 2. Relay the audio to Google through our own server, in chunks small
    // enough for Vercel's body limit. Sequential, not parallel — Google's
    // resumable protocol is a single ordered byte stream per session.
    let offset = 0;
    let fileUri: string | undefined;
    let fileName: string | undefined;
    let uploadedMime: string = mimeType;

    while (offset < blob.size) {
        const end = Math.min(offset + UPLOAD_CHUNK_BYTES, blob.size);
        const chunk = blob.slice(offset, end);
        const isFinal = end >= blob.size;

        const chunkRes = await fetch(
            `/api/muse/upload-chunk?uploadId=${encodeURIComponent(uploadId)}&offset=${offset}&isFinal=${isFinal}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: chunk
            }
        );
        if (!chunkRes.ok) {
            const msg = await safeErr(chunkRes);
            throw new Error(`Upload to Gemini failed: ${msg}`);
        }
        const chunkJson = await chunkRes.json();
        if (isFinal) {
            fileUri = chunkJson?.fileUri;
            fileName = chunkJson?.fileName;
            uploadedMime = chunkJson?.mimeType || mimeType;
        }
        offset = end;
    }
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
