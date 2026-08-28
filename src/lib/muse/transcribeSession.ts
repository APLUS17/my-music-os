import { GoogleGenAI } from '@google/genai';

// Gemini 3.5 Transcribe, pre-recorded path — reached via the Interactions
// API (ai.interactions.create), distinct from ai.models.generateContent used
// for the segmentation pass below. Up to 3-speaker diarization, word-level
// timestamps, and up to 1000 custom vocabulary phrases, per a single request
// (session audio is capped well under its 1-hour limit).
export const MUSE_TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';

// Biases recognition toward studio/songwriting terms Whisper/Gemini
// otherwise mishear as generic words (e.g. "punch-in" -> "punching").
const MUSE_CUSTOM_VOCABULARY = [
    'freestyle', 'punch-in', 'punch in', 'ad-lib', 'ad-libs', 'hook', 'pre-chorus',
    'bridge', 'verse', 'outro', 'intro', 'acapella', 'mixdown', 'bounce', 'stem',
    'stems', 'BPM', 'sixteen bars', 'eight bars', 'pocket', 'flow', 'cadence',
    'double', 'harmony', 'reverb', 'delay', 'vocal chain', 'take two', 'run it back',
];

interface WordAnnotation {
    type: string;
    text?: string;
    speaker?: string;
    start_offset?: string;
    end_offset?: string;
}

function formatOffset(offset?: string): string {
    if (!offset) return '';
    const seconds = parseFloat(offset.replace(/s$/, ''));
    if (!Number.isFinite(seconds)) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Groups the word-level diarization annotations Gemini 3.5 Transcribe
 * returns into speaker-labeled, timestamped lines, e.g.
 * "[0:12] spk_1: yeah let's run that one back". Falls back to the plain
 * concatenated transcript if word/speaker annotations weren't returned.
 */
function formatTranscript(interaction: unknown): string {
    const words: WordAnnotation[] = [];
    const steps = (interaction as { steps?: unknown[] })?.steps ?? [];

    for (const step of steps) {
        const s = step as { type?: string; content?: unknown[] };
        if (s?.type !== 'model_output') continue;
        for (const content of s.content ?? []) {
            const c = content as { type?: string; annotations?: unknown[] };
            if (c?.type !== 'text') continue;
            for (const ann of c.annotations ?? []) {
                const a = ann as WordAnnotation;
                if (a?.type === 'word_info') words.push(a);
            }
        }
    }

    if (words.length === 0) {
        const outputText = (interaction as { output_text?: string })?.output_text;
        return typeof outputText === 'string' ? outputText : '';
    }

    const lines: string[] = [];
    let speaker: string | undefined;
    let lineStart: string | undefined;
    let buffer: string[] = [];

    const flush = () => {
        if (buffer.length === 0) return;
        const ts = formatOffset(lineStart);
        const label = speaker ? `${speaker}: ` : '';
        lines.push(`${ts ? `[${ts}] ` : ''}${label}${buffer.join(' ')}`);
        buffer = [];
    };

    for (const word of words) {
        if (word.speaker !== speaker) {
            flush();
            speaker = word.speaker;
            lineStart = word.start_offset;
        }
        if (!lineStart) lineStart = word.start_offset;
        if (word.text) buffer.push(word.text);
    }
    flush();

    return lines.join('\n');
}

/**
 * Runs a verbatim, diarized, word-timestamped transcription of the session
 * audio via Gemini 3.5 Transcribe, so the Muse segmentation pass
 * (gemini-2.5-flash, see museSchema.ts) can ground its quotes and labels in
 * real words instead of inferring them purely from raw audio understanding.
 *
 * Verbatim mode (not Smart) is used deliberately: diarization and word
 * timestamps — both needed here — are incompatible with Smart mode.
 *
 * Best-effort: returns null on any failure (including on API keys/regions
 * without preview access to this model) so callers fall back to the
 * audio-only segmentation pass rather than failing the whole recap.
 */
export async function transcribeMuseSession(
    ai: GoogleGenAI,
    fileUri: string,
    mimeType: string
): Promise<string | null> {
    try {
        const interaction = await ai.interactions.create({
            model: MUSE_TRANSCRIBE_MODEL,
            input: [{ type: 'audio', uri: fileUri, mime_type: mimeType }],
            generation_config: {
                transcription_config: {
                    custom_vocabulary: MUSE_CUSTOM_VOCABULARY,
                    mode: {
                        type: 'verbatim',
                        diarization_mode: 'speaker',
                        timestamp_granularities: ['word'],
                    },
                },
            },
        });

        const transcript = formatTranscript(interaction).trim();
        return transcript.length > 0 ? transcript : null;
    } catch (err) {
        console.warn('[Muse] Gemini 3.5 Transcribe failed, falling back to audio-only segmentation:', err);
        return null;
    }
}
