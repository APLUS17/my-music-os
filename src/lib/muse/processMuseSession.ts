import { MuseSegment, MuseRecap } from '@/types';

export async function processMuseSession(args: {
    sessionId: string;
    blob: Blob;
    mimeType: string;
    durationSec: number;
    onProgress?: (p: { stage: 'uploading' | 'analyzing' }) => void;
}): Promise<{ segments: MuseSegment[]; recap: MuseRecap }> {
    const { sessionId, blob, mimeType, durationSec, onProgress } = args;

    // Send the audio straight to the analyze route as a file upload —
    // no Supabase relay, no auth gate.
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('mimeType', mimeType);
    formData.append('durationSec', String(durationSec));
    formData.append('audio', blob, `session_${sessionId}`);

    try {
        onProgress?.({ stage: 'uploading' });
        onProgress?.({ stage: 'analyzing' });
        const response = await fetch('/api/muse/analyze', {
            method: 'POST',
            body: formData
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
