import { NextResponse } from 'next/server';
import { serverFeatures } from '@/lib/server/apiGuard';

export const dynamic = 'force-dynamic';

/**
 * `ai` means "take transcription works" (the editor gates on it). `features`
 * lets the client skip calls that would only come back unavailable.
 */
export function GET() {
    const features = serverFeatures();
    return NextResponse.json({ status: 'ok', ai: features.transcription, features });
}
