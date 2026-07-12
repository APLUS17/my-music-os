import { createClient } from '@/lib/supabase/client';
import { MuseSegment, MuseRecap } from '@/types';

export async function processMuseSession(args: {
    sessionId: string;
    blob: Blob;
    mimeType: string;
    durationSec: number;
    onProgress?: (p: { stage: 'uploading' | 'analyzing' }) => void;
}): Promise<{ segments: MuseSegment[]; recap: MuseRecap }> {
    const { sessionId, blob, mimeType, durationSec, onProgress } = args;

    // 1. Get browser supabase client & authenticate user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error('not-signed-in');
    }

    // 2. Map mimeType to extension
    let ext = 'webm';
    if (mimeType.includes('mp4')) {
        ext = 'mp4';
    } else if (mimeType.includes('aac')) {
        ext = 'aac';
    } else if (mimeType.includes('m4a')) {
        ext = 'm4a';
    } else if (mimeType.includes('audio/ogg')) {
        ext = 'ogg';
    }

    const storagePath = `${user.id}/${sessionId}.${ext}`;

    // 3. Upload to Supabase Storage with backoff retries
    let uploadError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            onProgress?.({ stage: 'uploading' });
            const { error } = await supabase.storage
                .from('muse-uploads')
                .upload(storagePath, blob, {
                    contentType: mimeType,
                    upsert: true
                });
            if (error) throw error;
            uploadError = null;
            break; // Success
        } catch (err) {
            uploadError = err;
            if (attempt < 3) {
                // Exponential backoff: 2s, 4s
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    if (uploadError) {
        console.error('Supabase audio chunk upload failed after 3 attempts:', uploadError);
        throw new Error('upload-failed');
    }

    // 4. Fetch the analysis endpoint
    try {
        onProgress?.({ stage: 'analyzing' });
        const response = await fetch('/api/muse/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId,
                storagePath,
                mimeType,
                durationSec
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Analysis API endpoint returned error:', errorText);
            throw new Error('analysis-failed');
        }

        const data = await response.json();
        if (!data.success) {
            console.error('Analysis processing failed:', data.error);
            throw new Error('analysis-failed');
        }

        return {
            segments: data.segments,
            recap: data.recap
        };
    } catch (err) {
        console.error('Fetch analysis error:', err);
        throw new Error('analysis-failed');
    }
}
