/**
 * Song-timeline logic: where each lyric section and line sits in time, and
 * which line is "now". Pure functions only, so the editor highlight, the
 * auto-scroll and the karaoke view all agree because they share one result.
 *
 * Everything here is on the SONG timeline: seconds from the start of the beat
 * (or of the take when there is no beat). Callers convert audio-element time
 * to song time first (see `toSongTime`).
 */

export interface TimelineSection {
    id: string;
    text: string;
    startTimeSec?: number;
    endTimeSec?: number;
}

export interface SectionTiming {
    id: string;
    start: number;
    end: number;
}

/** A transcribed phrase, already placed on the song timeline. */
export interface TimedPhrase {
    text: string;
    startSec: number;
    endSec: number;
}

export interface TimedLine {
    /** `${sectionId}:${rawLineIndex}` — stable across renders. */
    key: string;
    sectionId: string;
    sectionIndex: number;
    /** Index into `section.text.split('\n')`. */
    lineIndex: number;
    text: string;
    startSec: number;
    endSec: number;
    /** True when the time is a guess (spread across the section) rather than measured from a take. */
    estimated: boolean;
}

function hasTimes(s: TimelineSection): s is TimelineSection & { startTimeSec: number; endTimeSec: number } {
    return (
        typeof s.startTimeSec === 'number' && Number.isFinite(s.startTimeSec) &&
        typeof s.endTimeSec === 'number' && Number.isFinite(s.endTimeSec) &&
        s.endTimeSec > s.startTimeSec
    );
}

/**
 * Resolves every section's [start, end) on the song timeline.
 *
 * Sections with explicit times keep them. Runs of sections without times
 * share the unclaimed time between their neighbours evenly, so a mix of timed
 * and untimed sections never overlaps.
 */
export function resolveSectionTimings(sections: TimelineSection[], totalDuration: number): SectionTiming[] {
    if (sections.length === 0) return [];
    if (!(totalDuration > 0)) {
        // No audio to measure against: keep explicit times, zero the rest.
        return sections.map(s => hasTimes(s)
            ? { id: s.id, start: s.startTimeSec, end: s.endTimeSec }
            : { id: s.id, start: 0, end: 0 });
    }

    const out: SectionTiming[] = new Array(sections.length);
    let cursor = 0;
    let i = 0;
    while (i < sections.length) {
        const s = sections[i];
        if (hasTimes(s)) {
            out[i] = { id: s.id, start: s.startTimeSec, end: s.endTimeSec };
            cursor = Math.max(cursor, s.endTimeSec);
            i++;
            continue;
        }
        // Gather the run of untimed sections.
        let j = i;
        while (j < sections.length && !hasTimes(sections[j])) j++;
        const runEnd = j < sections.length ? (sections[j] as { startTimeSec: number }).startTimeSec : totalDuration;
        const start = Math.min(cursor, runEnd);
        const span = Math.max(0, runEnd - start);
        const each = span / (j - i);
        for (let k = i; k < j; k++) {
            out[k] = { id: sections[k].id, start: start + (k - i) * each, end: start + (k - i + 1) * each };
        }
        cursor = runEnd;
        i = j;
    }
    return out;
}

export function findTimingAt(timings: SectionTiming[], t: number): SectionTiming | undefined {
    for (const st of timings) if (t >= st.start && t < st.end) return st;
    return undefined;
}

/**
 * Index of the section "now": the one containing `t`, else the last section
 * once the song has run past its end, else the first.
 */
export function activeSectionIndex(timings: SectionTiming[], t: number): number {
    if (timings.length === 0) return -1;
    for (let i = 0; i < timings.length; i++) if (t >= timings[i].start && t < timings[i].end) return i;
    if (t >= timings[timings.length - 1].end) return timings.length - 1;
    return 0;
}

/** Converts audio-element time to song-timeline time. `anchorSec` is where the take's first sample sits on the beat. */
export function toSongTime(mediaTime: number, anchorSec: number | undefined): number {
    return mediaTime + (Number.isFinite(anchorSec) ? (anchorSec as number) : 0);
}

/** Inverse of `toSongTime`, floored at 0 (a take cannot play before it starts). */
export function toMediaTime(songTime: number, anchorSec: number | undefined): number {
    return Math.max(0, songTime - (Number.isFinite(anchorSec) ? (anchorSec as number) : 0));
}

function syllableWeight(text: string): number {
    const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
    let total = 0;
    for (const w of words) {
        const groups = w.replace(/e$/, '').match(/[aeiouy]+/g);
        total += Math.max(1, groups ? groups.length : 1);
    }
    return Math.max(1, total);
}

/**
 * Spreads lines across [start, end], weighted by syllable count. An estimate;
 * callers label it as such. `minPerLine` stops very short windows from
 * flashing lines past in a blink (set 0 to fill a gap exactly).
 */
export function distributeLines(
    texts: string[],
    start: number,
    end: number,
    minPerLine = 1.5
): Array<{ text: string; startSec: number; endSec: number }> {
    const clean = texts.map(t => t.trim()).filter(Boolean);
    if (clean.length === 0) return [];
    const span = Math.max(clean.length * minPerLine, end - start);
    const weights = clean.map(syllableWeight);
    const sum = weights.reduce((a, b) => a + b, 0);
    let cursor = start;
    return clean.map((text, i) => {
        const len = (weights[i] / sum) * span;
        const line = { text, startSec: cursor, endSec: cursor + len };
        cursor += len;
        return line;
    });
}

/**
 * Index of the line to highlight at song time `t`, or -1 before the first
 * line. A line stays active through gaps until the next one starts.
 * `offsetMs` < 0 lights lines earlier than their stored time.
 */
export function pickActiveLine(lines: Array<{ startSec: number }>, t: number, offsetMs: number): number {
    if (lines.length === 0) return -1;
    const effective = t - offsetMs / 1000;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startSec <= effective) idx = i;
        else break;
    }
    return idx;
}

function normalizeMatchText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[’']/g, '')
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function wordSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.85;
    const wordsA = new Set(a.split(' '));
    const wordsB = new Set(b.split(' '));
    let shared = 0;
    for (const w of wordsA) if (wordsB.has(w)) shared++;
    return shared / Math.max(wordsA.size, wordsB.size);
}

/**
 * Strictly matches transcribed phrases to written lines, in order. Returns,
 * per phrase, an index into `rawLines` or -1 when nothing matched well enough.
 * Order is preserved so a repeated chorus line maps to successive occurrences,
 * and a small look-ahead stops one unmatched ad-lib from derailing the rest.
 */
export function matchPhrasesToLines(phrases: Array<{ text: string }>, rawLines: string[]): number[] {
    const nonEmpty: Array<{ rawIdx: number; norm: string }> = [];
    for (let i = 0; i < rawLines.length; i++) {
        const norm = normalizeMatchText(rawLines[i]);
        if (norm.length > 0) nonEmpty.push({ rawIdx: i, norm });
    }
    const out = new Array<number>(phrases.length).fill(-1);
    let cursor = 0;
    for (let p = 0; p < phrases.length && cursor < nonEmpty.length; p++) {
        const normP = normalizeMatchText(phrases[p].text);
        if (!normP) continue;
        let bestIdx = -1;
        let bestScore = 0;
        const limit = Math.min(nonEmpty.length, cursor + 4);
        for (let k = cursor; k < limit; k++) {
            const score = wordSimilarity(normP, nonEmpty[k].norm);
            if (score >= 0.5 && score > bestScore) {
                bestScore = score;
                bestIdx = k;
                if (score === 1) break;
            }
        }
        if (bestIdx >= 0) {
            out[p] = nonEmpty[bestIdx].rawIdx;
            cursor = bestIdx + 1;
        }
    }
    return out;
}

/**
 * Builds the timed line list for the whole song. This is the single source of
 * truth for "what is playing now": the editor highlight, auto-scroll and the
 * karaoke view all read it.
 *
 * Per section: lines are spread across the section's window (estimated). When
 * `phrases` (transcribed takes on the song timeline) overlap the section,
 * matched lines take the measured times and the unmatched lines in between are
 * interpolated, so timing stays monotonic.
 */
export function buildTimedLines(
    sections: TimelineSection[],
    timings: SectionTiming[],
    phrases: TimedPhrase[] | null = null
): TimedLine[] {
    const out: TimedLine[] = [];
    sections.forEach((section, sectionIndex) => {
        const timing = timings.find(t => t.id === section.id);
        if (!timing) return;

        const rawLines = (section.text ?? '').split('\n');
        const present: Array<{ rawIdx: number; text: string }> = [];
        rawLines.forEach((text, rawIdx) => {
            if (text.trim().length > 0) present.push({ rawIdx, text: text.trim() });
        });
        if (present.length === 0) return;

        const { start, end } = timing;
        const inWindow = (phrases ?? []).filter(p => p.startSec >= start - 0.25 && p.startSec < end);

        // Measured start/end per present-line, where a phrase matched.
        const measured: Array<{ startSec: number; endSec: number } | null> = present.map(() => null);
        if (inWindow.length > 0) {
            const matches = matchPhrasesToLines(inWindow, present.map(p => p.text));
            matches.forEach((presentIdx, phraseIdx) => {
                if (presentIdx < 0 || measured[presentIdx]) return;
                const ph = inWindow[phraseIdx];
                measured[presentIdx] = { startSec: ph.startSec, endSec: Math.max(ph.endSec, ph.startSec + 0.1) };
            });
        }

        const times: Array<{ startSec: number; endSec: number; estimated: boolean }> = present.map(() => ({
            startSec: 0, endSec: 0, estimated: true,
        }));

        if (measured.every(m => m === null)) {
            distributeLines(present.map(p => p.text), start, end).forEach((d, i) => {
                times[i] = { startSec: d.startSec, endSec: d.endSec, estimated: true };
            });
        } else {
            // Fill each run of unmatched lines from the gap between measured neighbours.
            let i = 0;
            let prevEnd = start;
            while (i < present.length) {
                const m = measured[i];
                if (m) {
                    times[i] = { ...m, estimated: false };
                    prevEnd = m.endSec;
                    i++;
                    continue;
                }
                let j = i;
                while (j < present.length && !measured[j]) j++;
                const gapEnd = j < present.length ? (measured[j] as { startSec: number }).startSec : Math.max(end, prevEnd);
                const gapStart = Math.min(prevEnd, gapEnd);
                const dist = distributeLines(present.slice(i, j).map(p => p.text), gapStart, gapEnd, 0);
                dist.forEach((d, k) => { times[i + k] = { startSec: d.startSec, endSec: d.endSec, estimated: true }; });
                i = j;
            }
        }

        // Force non-decreasing starts: a bad match must never run the highlight backwards.
        let floor = -Infinity;
        present.forEach((p, i) => {
            const t = times[i];
            const startSec = Math.max(t.startSec, floor);
            floor = startSec;
            out.push({
                key: `${section.id}:${p.rawIdx}`,
                sectionId: section.id,
                sectionIndex,
                lineIndex: p.rawIdx,
                text: p.text,
                startSec,
                endSec: Math.max(t.endSec, startSec),
                estimated: t.estimated,
            });
        });
    });
    return out;
}
