import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Each request now carries a single ~20s recording chunk (see transcribeAudioChunks
// in lib/audio/audioIntelligence.ts), so this should always be fast — cap it well
// under Vercel's serverless ceiling instead of relying on the platform default.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'GROQ_API_KEY not configured in environment' }, { status: 500 });
    }

    // Forward the multipart form from the client directly to Groq
    const formData = await req.formData();

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
    });

    const body = await groqRes.json();

    if (!groqRes.ok) {
        return NextResponse.json(
            { error: body?.error?.message ?? groqRes.statusText },
            { status: groqRes.status }
        );
    }

    return NextResponse.json(body);
}
