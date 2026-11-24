import { jsonError } from '@/lib/server/apiGuard';

/** Beat sectioning runs locally in the editor. No AI service is wired for it. */
export function POST() {
    return jsonError(503, 'ai_unavailable', 'Beat analysis runs in your browser on this server.');
}
