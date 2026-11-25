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

/** True when at least one section carries explicit start/end times. */
export function hasExplicitTimings(sections: LyricSection[]): boolean {
    return sections.some(s =>
        typeof s.startTimeSec === 'number' && Number.isFinite(s.startTimeSec) &&
        typeof s.endTimeSec === 'number' && Number.isFinite(s.endTimeSec)
    );
}

/** True when the user hand-edited any section, so a fresh detection would overwrite their work. */
export function hasUserEdits(sections: LyricSection[]): boolean {
    return sections.some(s => s.isUserModified);
}

/** Gives every section explicit, contiguous bounds covering exactly [0, total]. */
function explicitBounds(sections: LyricSection[], durationSec: number): LyricSection[] {
    const total = round3(durationSec);
    const sized = materializeTimings(sections, total).map(s => ({
        ...s,
        startTimeSec: round3(s.startTimeSec as number),
        endTimeSec: round3(s.endTimeSec as number),
    }));
    if (sized.length > 0) {
        sized[0].startTimeSec = 0;
        sized[sized.length - 1].endTimeSec = total;
        for (let i = 1; i < sized.length; i++) sized[i].startTimeSec = sized[i - 1].endTimeSec;
    }
    return sized;
}

/** Clears timings so the sections fall back to an even split of the song. */
export function clearTimings(sections: LyricSection[]): LyricSection[] {
    return sections.map(s => ({ ...s, startTimeSec: undefined, endTimeSec: undefined, energy: undefined }));
}

export interface BarGrid {
    gridStartSec: number;
    barSec: number;
}

/** Millisecond rounding so bar-snapped boundaries stay clean of float noise. */
export function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}

/**
 * Shortest section the editor allows: one bar, clamped to 1-2 s. A 2-bar
 * pre-chorus at 160 BPM (3 s) never collapses, and slow songs don't force
 * a 5 s minimum.
 */
export function getMinSectionSec(grid?: BarGrid | null): number {
    if (grid && grid.barSec > 0) return round3(Math.max(MIN_SECTION_SEC, Math.min(grid.barSec, 2)));
    return MIN_SECTION_SEC;
}

/**
 * Magnetic bar snapping: pulls `t` to the nearest bar line when it is close
 * (within 35% of a bar, at most 0.75 s), and leaves it exactly where the
 * user put it otherwise. That keeps drags precise away from the grid.
 */
export function snapToBar(t: number, grid: BarGrid | null | undefined, toleranceSec?: number): number {
    if (!grid || !(grid.barSec > 0)) return t;
    const k = Math.max(0, Math.round((t - grid.gridStartSec) / grid.barSec));
    const candidate = Math.max(0, grid.gridStartSec + k * grid.barSec);
    const tol = toleranceSec ?? Math.min(0.75, grid.barSec * 0.35);
    return Math.abs(candidate - t) <= tol ? round3(candidate) : t;
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
        if (i === index - 1) return { ...s, endTimeSec: clamped, isUserModified: true };
        if (i === index) return { ...s, startTimeSec: clamped, isUserModified: true };
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
    const first: LyricSection = { ...s, endTimeSec: t, isUserModified: true };
    const second: LyricSection = {
        id: newId,
        type: s.type,
        repeats: 1,
        text: '',
        startTimeSec: t,
        endTimeSec: end,
        energy: s.energy,
        isUserModified: true,
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
        isUserModified: true,
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
            isUserModified: false,
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
            isUserModified: false,
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
                isUserModified: false,
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
                isUserModified: false,
            });
        }
    }
    // Close any gap at the end so playback never runs past the last section.
    if (out.length > 0 && durationSec > 0) out[out.length - 1] = { ...out[out.length - 1], endTimeSec: durationSec };
    return out;
}

// ---------------------------------------------------------------------------
// Structure edits that keep the timeline whole
//
// Adding, deleting or reordering a section must never leave a gap, a
// zero-width section or an overlap: the song timeline always covers exactly
// [0, duration]. These helpers are only timeline-aware when the song already
// has explicit times; an untimed song stays untimed.
// ---------------------------------------------------------------------------

/**
 * Inserts `newSection` after `afterIndex` by splitting that section: the first
 * half stays, the new section takes the second half. The split sits on a bar
 * line when it is near one. If the target is too short to split, time is
 * borrowed from its neighbours first.
 */
export function insertSectionAfter(
    sections: LyricSection[],
    afterIndex: number,
    newSection: LyricSection,
    totalDuration: number,
    grid?: BarGrid | null,
    snapEnabled = true
): LyricSection[] {
    const insertAt = afterIndex >= 0 && afterIndex < sections.length ? afterIndex : sections.length - 1;

    if (!(totalDuration > 0) || !hasExplicitTimings(sections)) {
        const next = [...sections];
        const clean: LyricSection = { ...newSection, startTimeSec: undefined, endTimeSec: undefined };
        if (insertAt < 0) next.push(clean);
        else next.splice(insertAt + 1, 0, clean);
        return next;
    }

    const total = round3(totalDuration);
    const base = explicitBounds(sections, total);
    if (base.length === 0) {
        return [{ ...newSection, startTimeSec: 0, endTimeSec: total, isUserModified: true }];
    }

    const idx = Math.max(0, Math.min(base.length - 1, insertAt));
    const minSec = getMinSectionSec(grid);
    const target = base[idx];
    let start = target.startTimeSec as number;
    let end = target.endTimeSec as number;

    // Too short to split: borrow from the right neighbour, then the left.
    if (end - start < 2 * minSec) {
        let deficit = round3(2 * minSec - (end - start));
        if (idx + 1 < base.length && deficit > 0) {
            const right = base[idx + 1];
            const slack = Math.max(0, (right.endTimeSec as number) - (right.startTimeSec as number) - minSec);
            const take = round3(Math.min(deficit, slack));
            if (take > 0) {
                end = round3(end + take);
                base[idx + 1] = { ...right, startTimeSec: end, isUserModified: true };
                deficit = round3(deficit - take);
            }
        }
        if (idx - 1 >= 0 && deficit > 0) {
            const left = base[idx - 1];
            const slack = Math.max(0, (left.endTimeSec as number) - (left.startTimeSec as number) - minSec);
            const take = round3(Math.min(deficit, slack));
            if (take > 0) {
                start = round3(start - take);
                base[idx - 1] = { ...left, endTimeSec: start, isUserModified: true };
                deficit = round3(deficit - take);
            }
        }
        // Everything is packed at minimum width: give up on keeping times and share the song evenly.
        if (end - start < 0.2) {
            const next = [...base];
            next.splice(idx + 1, 0, { ...newSection, isUserModified: true });
            const seg = total / next.length;
            return next.map((sec, i) => ({
                ...sec,
                startTimeSec: i === 0 ? 0 : round3(i * seg),
                endTimeSec: i === next.length - 1 ? total : round3((i + 1) * seg),
            }));
        }
    }

    const half = (end - start) / 2;
    const effectiveMin = Math.min(minSec, half * 0.9);
    const lo = round3(start + effectiveMin);
    const hi = round3(end - effectiveMin);
    const mid = start + half;
    const split = round3(Math.max(lo, Math.min(hi, snapEnabled ? snapToBar(mid, grid) : mid)));

    base[idx] = { ...target, startTimeSec: start, endTimeSec: split, isUserModified: true };
    const inserted: LyricSection = { ...newSection, startTimeSec: split, endTimeSec: end, isUserModified: true };
    const out = [...base];
    out.splice(idx + 1, 0, inserted);
    out[0] = { ...out[0], startTimeSec: 0 };
    out[out.length - 1] = { ...out[out.length - 1], endTimeSec: total };
    return out;
}

/**
 * Deletes a section and gives its time to the previous one (or the next one
 * when deleting the first), so the song stays covered end to end.
 */
export function deleteSectionAt(
    sections: LyricSection[],
    deleteIndex: number,
    totalDuration: number,
    blankFallback: LyricSection
): LyricSection[] {
    if (deleteIndex < 0 || deleteIndex >= sections.length) return sections;

    if (sections.length <= 1) {
        if (totalDuration > 0 && hasExplicitTimings(sections)) {
            return [{ ...blankFallback, startTimeSec: 0, endTimeSec: round3(totalDuration) }];
        }
        return [{ ...blankFallback, startTimeSec: undefined, endTimeSec: undefined }];
    }
    if (!(totalDuration > 0) || !hasExplicitTimings(sections)) {
        return sections.filter((_, i) => i !== deleteIndex);
    }

    const total = round3(totalDuration);
    const base = explicitBounds(sections, total);
    const deleted = base[deleteIndex];
    const remaining = base.filter((_, i) => i !== deleteIndex);

    if (deleteIndex > 0) {
        remaining[deleteIndex - 1] = { ...remaining[deleteIndex - 1], endTimeSec: deleted.endTimeSec, isUserModified: true };
    } else {
        remaining[0] = { ...remaining[0], startTimeSec: 0, isUserModified: true };
    }
    remaining[0] = { ...remaining[0], startTimeSec: 0 };
    remaining[remaining.length - 1] = { ...remaining[remaining.length - 1], endTimeSec: total };
    return remaining;
}

/**
 * Applies a new section order. Each section keeps its own length and the
 * sections are laid end to end from 0, so moving the chorus does not stretch
 * or squash anything.
 */
export function reorderSections(
    reordered: LyricSection[],
    previous: LyricSection[],
    totalDuration: number
): LyricSection[] {
    if (reordered.length === 0) return reordered;
    if (!(totalDuration > 0) || !hasExplicitTimings(previous)) return reordered;

    const total = round3(totalDuration);
    const prevTimings = resolveSectionTimings(previous, total);
    const byId = new Map(prevTimings.map(t => [t.id, t]));

    const durations = reordered.map(sec => {
        const prev = byId.get(sec.id);
        const d = prev ? prev.end - prev.start : (sec.endTimeSec ?? 0) - (sec.startTimeSec ?? 0);
        return Math.max(0.5, Number.isFinite(d) && d > 0 ? d : total / reordered.length);
    });
    const sum = durations.reduce((a, b) => a + b, 0);
    const scale = sum > 0 ? total / sum : 1;

    let cursor = 0;
    return reordered.map((sec, i) => {
        const start = i === 0 ? 0 : round3(cursor);
        const end = i === reordered.length - 1 ? total : round3(Math.min(total, cursor + durations[i] * scale));
        cursor = end;
        return { ...sec, startTimeSec: start, endTimeSec: Math.max(start + 0.1, end), isUserModified: true };
    });
}

export function typeLabel(type: SectionType): string {
    return type === 'pre-chorus' ? 'Pre-chorus' : type.charAt(0).toUpperCase() + type.slice(1);
}
