/**
 * Editing the section timeline: drag a boundary, split at the playhead, merge
 * two sections, apply an analysed beat structure to the lyric sections.
 * All pure: they take sections and return new sections, never mutate.
 */

import type { LyricSection, SectionType } from '@/types';
import { resolveSectionTimings } from './timeline';
import type { BeatSegment } from './beatSections';

/** Shortest section the editor allows, seconds. Keeps handles from collapsing onto each other. */
export const MIN_SECTION_SEC = 1;

/** Gives every section explicit start/end times (even-splitting any that lack them). */
export function materializeTimings(sections: LyricSection[], durationSec: number): LyricSection[] {
    const timings = resolveSectionTimings(sections, durationSec);
    return sections.map((s, i) => ({ ...s, startTimeSec: timings[i].start, endTimeSec: timings[i].end }));
}

/** Clears timings so the sections fall back to an even split of the song. */
export function clearTimings(sections: LyricSection[]): LyricSection[] {
    return sections.map(s => ({ ...s, startTimeSec: undefined, endTimeSec: undefined, energy: undefined }));
}

export interface BarGrid {
    gridStartSec: number;
    barSec: number;
}

/** Snaps `t` to the nearest bar line, or returns it unchanged when there is no grid. */
export function snapToBar(t: number, grid: BarGrid | null | undefined): number {
    if (!grid || !(grid.barSec > 0)) return t;
    const k = Math.round((t - grid.gridStartSec) / grid.barSec);
    return Math.max(0, grid.gridStartSec + k * grid.barSec);
}

/**
 * Moves the boundary between sections[index - 1] and sections[index] to `t`,
 * clamped so both neighbours keep at least `minLen` seconds.
 */
export function moveBoundary(
    sections: LyricSection[],
    index: number,
    t: number,
    durationSec: number,
    minLen = MIN_SECTION_SEC
): LyricSection[] {
    if (index < 1 || index >= sections.length) return sections;
    const sized = materializeTimings(sections, durationSec);
    const left = sized[index - 1];
    const right = sized[index];
    const lo = (left.startTimeSec as number) + minLen;
    const hi = (right.endTimeSec as number) - minLen;
    if (hi < lo) return sections;
    const clamped = Math.min(hi, Math.max(lo, t));
    return sized.map((s, i) => {
        if (i === index - 1) return { ...s, endTimeSec: clamped };
        if (i === index) return { ...s, startTimeSec: clamped };
        return s;
    });
}

/**
 * Splits the section containing `t` in two. The first half keeps the text;
 * the second half is new and empty. Returns the input if `t` is too close to
 * an edge to leave both halves at least `minLen` long.
 */
export function splitSectionAt(
    sections: LyricSection[],
    t: number,
    durationSec: number,
    newId: string,
    minLen = MIN_SECTION_SEC
): LyricSection[] {
    const sized = materializeTimings(sections, durationSec);
    const idx = sized.findIndex(s => t >= (s.startTimeSec as number) && t < (s.endTimeSec as number));
    if (idx < 0) return sections;
    const s = sized[idx];
    const start = s.startTimeSec as number;
    const end = s.endTimeSec as number;
    if (t - start < minLen || end - t < minLen) return sections;
    const first: LyricSection = { ...s, endTimeSec: t };
    const second: LyricSection = {
        id: newId,
        type: s.type,
        repeats: 1,
        text: '',
        startTimeSec: t,
        endTimeSec: end,
        energy: s.energy,
    };
    return [...sized.slice(0, idx), first, second, ...sized.slice(idx + 1)];
}

/** Merges sections[index] into sections[index + 1]'s predecessor: one section spanning both, text joined. */
export function mergeWithNext(sections: LyricSection[], index: number, durationSec: number): LyricSection[] {
    if (index < 0 || index >= sections.length - 1) return sections;
    const sized = materializeTimings(sections, durationSec);
    const a = sized[index];
    const b = sized[index + 1];
    const text = [a.text, b.text].filter(t => t.trim().length > 0).join('\n');
    const merged: LyricSection = {
        ...a,
        text,
        endTimeSec: b.endTimeSec,
        pinnedSessionId: a.pinnedSessionId ?? b.pinnedSessionId,
    };
    return [...sized.slice(0, index), merged, ...sized.slice(index + 2)];
}

/** True when every section is empty (no lyrics typed), so it is safe to replace the structure outright. */
export function isBlankSongStructure(sections: LyricSection[]): boolean {
    return sections.every(s => s.text.trim().length === 0);
}

/**
 * Puts an analysed beat structure onto the song's sections.
 *
 * - Blank song: sections are created straight from the analysis.
 * - Song with lyrics: existing sections keep their text and order and take the
 *   analysed times by position. Extra beat segments become new empty
 *   sections; extra lyric sections share the final beat segment evenly, so no
 *   lyric is ever dropped.
 */
export function applyBeatSegments(
    sections: LyricSection[],
    segments: BeatSegment[],
    durationSec: number,
    makeId: () => string
): LyricSection[] {
    if (segments.length === 0) return sections;

    if (isBlankSongStructure(sections)) {
        return segments.map(seg => ({
            id: makeId(),
            type: seg.type,
            repeats: 1,
            text: '',
            startTimeSec: seg.startSec,
            endTimeSec: seg.endSec,
            energy: seg.energy,
        }));
    }

    const out: LyricSection[] = [];
    const n = Math.min(sections.length, segments.length);
    for (let i = 0; i < n; i++) {
        out.push({
            ...sections[i],
            startTimeSec: segments[i].startSec,
            endTimeSec: segments[i].endSec,
            energy: segments[i].energy,
        });
    }
    if (sections.length > segments.length) {
        // Spread the leftover lyric sections across the last beat segment's time.
        const rest = sections.slice(n - 1);
        const last = segments[segments.length - 1];
        const lastStart = last.startSec;
        const each = (last.endSec - lastStart) / rest.length;
        rest.forEach((s, k) => {
            const idx = n - 1 + k;
            out[idx] = {
                ...s,
                startTimeSec: lastStart + k * each,
                endTimeSec: lastStart + (k + 1) * each,
                energy: last.energy,
            };
        });
    } else if (segments.length > sections.length) {
        for (let i = sections.length; i < segments.length; i++) {
            const seg = segments[i];
            out.push({
                id: makeId(),
                type: seg.type,
                repeats: 1,
                text: '',
                startTimeSec: seg.startSec,
                endTimeSec: seg.endSec,
                energy: seg.energy,
            });
        }
    }
    // Close any gap at the end so playback never runs past the last section.
    if (out.length > 0 && durationSec > 0) out[out.length - 1] = { ...out[out.length - 1], endTimeSec: durationSec };
    return out;
}

export function typeLabel(type: SectionType): string {
    return type === 'pre-chorus' ? 'Pre-chorus' : type.charAt(0).toUpperCase() + type.slice(1);
}
