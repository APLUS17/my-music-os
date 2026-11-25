/**
 * Turns Groq Whisper's `verbose_json` into the lyric lines the editor expects:
 * `[{ text, startSec, endSec }]`, seconds from the start of the audio.
 *
 * Whisper's segment times are loose, but its WORD times are tight. So each
 * segment is re-timed from its own words, and long segments are split into
 * phrases wherever the singer pauses, which is what a lyric line is.
 */

export interface WhisperWord { word: string; start: number; end: number }
export interface WhisperSegment {
    text: string;
    start: number;
    end: number;
    avg_logprob?: number;
    no_speech_prob?: number;
    compression_ratio?: number;
}
export interface WhisperResponse {
    text?: string;
    segments?: WhisperSegment[];
    words?: WhisperWord[];
}
export interface LyricLineOut { text: string; startSec: number; endSec: number }

/** A pause this long between words starts a new line. */
const PAUSE_SPLIT_SEC = 0.45;
/** A line this long (in words) is split even without a pause. */
const MAX_WORDS_PER_LINE = 10;

const r2 = (n: number) => Math.round(n * 100) / 100;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Whisper invents text over silence and loops on repetitive audio; drop those segments. */
export function isLikelyHallucination(seg: WhisperSegment): boolean {
    if (finite(seg.compression_ratio) && seg.compression_ratio > 2.4) return true;
    if (finite(seg.no_speech_prob) && seg.no_speech_prob > 0.7 && (!finite(seg.avg_logprob) || seg.avg_logprob < -0.8)) return true;
    return false;
}

function splitWordsIntoPhrases(words: WhisperWord[]): WhisperWord[][] {
    const phrases: WhisperWord[][] = [];
    let cur: WhisperWord[] = [];
    for (const w of words) {
        const prev = cur[cur.length - 1];
        if (prev && (w.start - prev.end >= PAUSE_SPLIT_SEC || cur.length >= MAX_WORDS_PER_LINE)) {
            phrases.push(cur);
            cur = [];
        }
        cur.push(w);
    }
    if (cur.length) phrases.push(cur);
    return phrases;
}

const cleanWord = (w: string) => w.replace(/\s+/g, ' ').trim();

export function buildLinesFromWhisper(resp: WhisperResponse, durationSec?: number | null): LyricLineOut[] {
    const segments = Array.isArray(resp.segments) ? resp.segments : [];
    const words = (Array.isArray(resp.words) ? resp.words : [])
        .filter(w => w && typeof w.word === 'string' && finite(w.start) && finite(w.end) && cleanWord(w.word))
        .sort((a, b) => a.start - b.start);

    const out: LyricLineOut[] = [];

    if (segments.length === 0 && words.length > 0) {
        // No segments: build lines from words alone.
        for (const phrase of splitWordsIntoPhrases(words)) {
            out.push({ text: phrase.map(w => cleanWord(w.word)).join(' '), startSec: phrase[0].start, endSec: phrase[phrase.length - 1].end });
        }
    }

    let cursor = 0; // words are consumed in order, each to exactly one segment
    for (const seg of segments) {
        if (!seg || typeof seg.text !== 'string' || !finite(seg.start) || !finite(seg.end)) continue;
        if (isLikelyHallucination(seg)) {
            // Still consume its words so they don't leak into the next segment.
            while (cursor < words.length && words[cursor].start < seg.end - 0.05) cursor++;
            continue;
        }
        const own: WhisperWord[] = [];
        while (cursor < words.length && words[cursor].start < seg.end - 0.05) {
            if (words[cursor].start >= seg.start - 0.3) own.push(words[cursor]);
            cursor++;
        }

        if (own.length === 0) {
            const text = seg.text.replace(/\s+/g, ' ').trim();
            if (text) out.push({ text, startSec: seg.start, endSec: seg.end });
            continue;
        }
        for (const phrase of splitWordsIntoPhrases(own)) {
            out.push({
                text: phrase.map(w => cleanWord(w.word)).join(' '),
                startSec: phrase[0].start,
                endSec: phrase[phrase.length - 1].end,
            });
        }
    }

    const limit = finite(durationSec) && durationSec > 0 ? durationSec : null;
    return out
        .filter(l => l.text.length > 0)
        // A line that starts after the audio ends is a hallucination, not a timing error.
        .filter(l => limit === null || l.startSec < limit + 0.5)
        .map(l => {
            const startSec = Math.max(0, limit === null ? l.startSec : Math.min(l.startSec, limit));
            const endRaw = limit === null ? l.endSec : Math.min(l.endSec, limit);
            return { text: l.text, startSec: r2(startSec), endSec: r2(Math.max(endRaw, startSec + 0.1)) };
        })
        .sort((a, b) => a.startSec - b.startSec);
}
