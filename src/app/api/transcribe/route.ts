import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
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
