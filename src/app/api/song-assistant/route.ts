import { jsonError } from '@/lib/server/apiGuard';

/** Lyric suggestions are not wired to a service on this server. */
export function POST() {
    return jsonError(503, 'ai_unavailable', 'Lyric suggestions are not configured on this server.');
}
