import type { LyricLine, SongSection, Take } from '../types';
import {
  getMinSectionSec,
  round3,
  snapTimeToDownbeat,
  type ArrangementSection,
  type BeatGrid,
} from './arrangement';

export interface SectionTiming {
  id: string;
  start: number;
  end: number;
}

/**
 * Resolves each section's [start, end) on the song timeline. Sections with
 * explicit times keep them; the rest share the duration evenly by position.
 */
export function resolveSectionTimings(sections: SongSection[], totalDuration: number): SectionTiming[] {
  if (!(totalDuration > 0)) return sections.map(s => ({ id: s.id, start: 0, end: 0 }));
  const segLen = totalDuration / Math.max(1, sections.length);
  return sections.map((s, i) => {
    if (s.startTimeSec !== undefined && s.endTimeSec !== undefined) {
      return { id: s.id, start: s.startTimeSec, end: s.endTimeSec };
    }
    return { id: s.id, start: i * segLen, end: (i + 1) * segLen };
  });
}

export function findTimingAt(timings: SectionTiming[], t: number): SectionTiming | undefined {
  return timings.find(st => t >= st.start && t < st.end);
}

export function activeTakeOf(section: SongSection, takeIndices: Record<string, number>): Take | undefined {
  const takes = section.voiceNotes ?? [];
  return takes[takeIndices[section.id] ?? 0] ?? takes[0];
}

/** Where sample 0 of a take sits on the song timeline. */
export function takeAnchorSec(take: Take, fallbackSectionStart: number): number {
  return typeof take.startBeatOffsetSec === 'number' && Number.isFinite(take.startBeatOffsetSec)
    ? take.startBeatOffsetSec
    : fallbackSectionStart;
}

export interface VocalHit {
  take: Take;
  sectionId: string;
  /** Seconds into the take's audio that should be sounding at time `t`. */
  offsetSec: number;
}

/**
 * Finds the take that should be audible at song time `t`.
 *
 * Takes are pinned to the timeline position they were recorded at (their
 * anchor), not to whichever section currently happens to cover that time, so
 * reordering or re-timing sections never desyncs recorded audio.
 * When windows overlap, the section containing `t` wins.
 */
export function findVocalAtTime(
  sections: SongSection[],
  timings: SectionTiming[],
  takeIndices: Record<string, number>,
  t: number
): VocalHit | null {
  const containing = findTimingAt(timings, t)?.id;
  let best: VocalHit | null = null;

  for (const section of sections) {
    const take = activeTakeOf(section, takeIndices);
    if (!take?.audioUrl) continue;
    const timing = timings.find(st => st.id === section.id);
    const anchor = takeAnchorSec(take, timing?.start ?? 0);
    const offset = t - anchor;
    if (offset < 0 || offset >= take.duration) continue;
    const hit: VocalHit = { take, sectionId: section.id, offsetSec: offset };
    if (section.id === containing) return hit;
    if (!best) best = hit;
  }
  return best;
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
 * Spreads lyric lines with no timing across [start, end], weighting by syllable
 * count. The result is an estimate, so callers should label it as such.
 */
export function distributeLines(lines: string[], start: number, end: number, idPrefix: string): LyricLine[] {
  const clean = lines.map(l => l.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const span = Math.max(clean.length * 1.5, end - start);
  const weights = clean.map(syllableWeight);
  const sum = weights.reduce((a, b) => a + b, 0);

  let cursor = start;
  return clean.map((text, i) => {
    const len = (weights[i] / sum) * span;
    const line: LyricLine = { id: `${idPrefix}-${i}`, text, startSec: cursor, endSec: cursor + len };
    cursor += len;
    return line;
  });
}

/**
 * Index of the line that should be highlighted at song time `t`, or -1 before
 * the first line. A line stays active through gaps until the next one starts.
 * `offsetMs` follows SyncSettings.lyricOffsetMs (negative = earlier).
 */
export function pickActiveLine(lines: LyricLine[], t: number, offsetMs: number): number {
  if (lines.length === 0) return -1;
  const effective = t - offsetMs / 1000;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startSec <= effective) idx = i;
    else break;
  }
  return idx;
}

export interface ActiveWorkspaceLine {
  sectionId: string;
  /** 0-based line index within `section.text.split('\n')`, or null if no line is active. */
  lineIndex: number | null;
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
 * Maps an active phrase index from `phrases` onto a 0-based raw line index in
 * `rawLines` (`section.text.split('\n')`), preserving monotonic order so
 * repeated chorus lines map to successive occurrences.
 */
export function matchPhraseToWrittenLine(
  phrases: Pick<LyricLine, 'text'>[],
  activePhraseIdx: number,
  rawLines: string[]
): number | null {
  if (activePhraseIdx < 0 || activePhraseIdx >= phrases.length) return null;

  const nonEmpty: { rawIdx: number; norm: string }[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const norm = normalizeMatchText(rawLines[i]);
    if (norm.length > 0) nonEmpty.push({ rawIdx: i, norm });
  }
  if (nonEmpty.length === 0) return null;

  // Greedily match phrases to non-empty written lines in order.
  const matchedPos = new Array<number>(phrases.length).fill(-1);
  let cursor = 0;
  for (let p = 0; p < phrases.length && cursor < nonEmpty.length; p++) {
    const normP = normalizeMatchText(phrases[p].text);
    if (!normP) continue;
    let bestIdx = -1;
    let bestScore = 0;
    // Look ahead within a small window so an unmatched ad-lib doesn't skip the whole verse.
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
      matchedPos[p] = bestIdx;
      cursor = bestIdx + 1;
    }
  }

  if (matchedPos[activePhraseIdx] >= 0) {
    return nonEmpty[matchedPos[activePhraseIdx]].rawIdx;
  }

  // Interpolate between surrounding matched phrases, or fall back proportionally.
  let prevP = -1;
  for (let p = activePhraseIdx - 1; p >= 0; p--) {
    if (matchedPos[p] >= 0) { prevP = p; break; }
  }
  let nextP = -1;
  for (let p = activePhraseIdx + 1; p < phrases.length; p++) {
    if (matchedPos[p] >= 0) { nextP = p; break; }
  }

  if (prevP >= 0 && nextP >= 0) {
    const frac = (activePhraseIdx - prevP) / (nextP - prevP);
    const interp = Math.round(matchedPos[prevP] + frac * (matchedPos[nextP] - matchedPos[prevP]));
    return nonEmpty[Math.min(nonEmpty.length - 1, Math.max(0, interp))].rawIdx;
  }

  const ratio = phrases.length <= 1 ? 0 : activePhraseIdx / (phrases.length - 1);
  const fallbackPos = Math.min(nonEmpty.length - 1, Math.max(0, Math.round(ratio * (nonEmpty.length - 1))));
  return nonEmpty[fallbackPos].rawIdx;
}

/**
 * Determines which section and raw lyric line index is playing at `currentTime`.
 */
export function resolveActiveWorkspaceLine(
  sections: SongSection[],
  timings: SectionTiming[],
  takeIndices: Record<string, number>,
  currentTime: number,
  offsetMs: number
): ActiveWorkspaceLine | null {
  if (sections.length === 0) return null;

  const hit = findTimingAt(timings, currentTime);
  let section: SongSection | undefined = hit ? sections.find(s => s.id === hit.id) : undefined;
  if (!section) {
    if (timings.length > 0 && currentTime >= timings[timings.length - 1].end) {
      const lastId = timings[timings.length - 1].id;
      section = sections.find(s => s.id === lastId);
    }
    section = section ?? sections[0];
  }

  const rawLines = (section.text || '').split('\n');
  const nonEmptyIndices: number[] = [];
  const nonEmptyTexts: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].trim().length > 0) {
      nonEmptyIndices.push(i);
      nonEmptyTexts.push(rawLines[i]);
    }
  }

  if (nonEmptyIndices.length === 0) {
    return { sectionId: section.id, lineIndex: null };
  }

  const timing = timings.find(st => st.id === section.id);
  const take = activeTakeOf(section, takeIndices);

  if (take?.sttData && take.sttData.length > 0) {
    const timedPhrases: LyricLine[] = take.sttData.map((p, i) => ({
      id: `${take.id}-${i}`,
      text: p.text,
      startSec: p.startSec,
      endSec: p.endSec,
    }));
    const activePhraseIdx = pickActiveLine(timedPhrases, currentTime, offsetMs);
    const matchedRawIdx = matchPhraseToWrittenLine(timedPhrases, activePhraseIdx, rawLines);
    return { sectionId: section.id, lineIndex: matchedRawIdx };
  }

  const hasAudio = Boolean(take?.audioUrl && take.duration > 0);
  const takeStart = hasAudio && take ? takeAnchorSec(take, timing?.start ?? 0) : (timing?.start ?? 0);
  const takeEnd = hasAudio && take ? takeStart + take.duration : (timing?.end ?? takeStart);
  const useTakeWindow = hasAudio && currentTime >= takeStart - 0.5 && currentTime <= takeEnd + 1;
  const start = useTakeWindow ? takeStart : (timing?.start ?? 0);
  const end = useTakeWindow ? takeEnd : (timing?.end ?? start);

  const distributed = distributeLines(nonEmptyTexts, start, end, section.id);
  const activeNonEmptyIdx = pickActiveLine(distributed, currentTime, offsetMs);
  return {
    sectionId: section.id,
    lineIndex: activeNonEmptyIdx >= 0 ? nonEmptyIndices[activeNonEmptyIdx] : null,
  };
}

// ---------------------------------------------------------------------------
// Non-destructive section timeline mutations
// ---------------------------------------------------------------------------

export function hasExplicitTimings(sections: SongSection[]): boolean {
  return sections.some(
    s =>
      typeof s.startTimeSec === 'number' &&
      Number.isFinite(s.startTimeSec) &&
      typeof s.endTimeSec === 'number' &&
      Number.isFinite(s.endTimeSec)
  );
}

/**
 * Stamps explicit `startBeatOffsetSec` onto any take missing one using its
 * section's current timing window so vocal alignment never shifts when section
 * boundaries are edited, split, deleted, or reordered.
 */
export function materializeTakeAnchors(
  sections: SongSection[],
  timings: SectionTiming[]
): SongSection[] {
  const timingById = new Map(timings.map(t => [t.id, t]));
  return sections.map(sec => {
    const notes = sec.voiceNotes ?? [];
    if (notes.length === 0) return sec;
    const timing = timingById.get(sec.id);
    const fallbackStart = round3(timing?.start ?? sec.startTimeSec ?? 0);
    let changed = false;
    const nextNotes = notes.map(t => {
      if (typeof t.startBeatOffsetSec === 'number' && Number.isFinite(t.startBeatOffsetSec)) {
        return t;
      }
      changed = true;
      return { ...t, startBeatOffsetSec: fallbackStart };
    });
    return changed ? { ...sec, voiceNotes: nextNotes } : sec;
  });
}

/** Ensures every section in a list carries explicit contiguous `[0, totalDuration]` bounds. */
function materializeExplicitBounds(
  sections: SongSection[],
  totalDuration: number
): SongSection[] {
  const timings = resolveSectionTimings(sections, totalDuration);
  const anchored = materializeTakeAnchors(sections, timings);
  const total = round3(totalDuration);
  return anchored.map((sec, i) => ({
    ...sec,
    startTimeSec: i === 0 ? 0 : round3(timings[i].start),
    endTimeSec: i === anchored.length - 1 ? total : round3(timings[i].end),
  }));
}

/**
 * Inserts `newSection` after `afterIndex` without resetting unrelated sections.
 * - When `totalDuration <= 0` or no explicit timings exist yet, keeps timestamps
 *   `undefined` so untimed songs fall back cleanly to an even split.
 * - When explicit timings exist, splits the target section at its midpoint (or
 *   nearest valid bar inside bounds), borrowing from adjacent neighbors if the
 *   target is shorter than `2 * minSectionSec`.
 */
export function insertSectionNonDestructive(
  sections: SongSection[],
  afterIndex: number,
  newSection: SongSection,
  totalDuration: number,
  grid?: BeatGrid | null,
  snapEnabled = true
): SongSection[] {
  const insertAt = afterIndex >= 0 && afterIndex < sections.length ? afterIndex : sections.length - 1;

  if (!(totalDuration > 0) || !hasExplicitTimings(sections)) {
    const next = [...sections];
    const cleanNew: SongSection = { ...newSection, startTimeSec: undefined, endTimeSec: undefined };
    if (insertAt < 0) next.push(cleanNew);
    else next.splice(insertAt + 1, 0, cleanNew);
    return next;
  }

  const total = round3(totalDuration);
  const base = materializeExplicitBounds(sections, total);
  if (base.length === 0) {
    return [{ ...newSection, startTimeSec: 0, endTimeSec: total, isUserModified: true }];
  }

  const idx = Math.max(0, Math.min(base.length - 1, insertAt));
  const minSec = getMinSectionSec(grid);
  const target = base[idx];
  let start = target.startTimeSec!;
  let end = target.endTimeSec!;

  // If the target section is narrower than 2 * minSec, borrow time from right then left neighbor.
  if (end - start < 2 * minSec) {
    let deficit = round3(2 * minSec - (end - start));

    if (idx + 1 < base.length && deficit > 0) {
      const right = base[idx + 1];
      const rightSlack = Math.max(0, right.endTimeSec! - right.startTimeSec! - minSec);
      const takeRight = round3(Math.min(deficit, rightSlack));
      if (takeRight > 0) {
        end = round3(end + takeRight);
        base[idx + 1] = { ...right, startTimeSec: end, isUserModified: true };
        deficit = round3(deficit - takeRight);
      }
    }

    if (idx - 1 >= 0 && deficit > 0) {
      const left = base[idx - 1];
      const leftSlack = Math.max(0, left.endTimeSec! - left.startTimeSec! - minSec);
      const takeLeft = round3(Math.min(deficit, leftSlack));
      if (takeLeft > 0) {
        start = round3(start - takeLeft);
        base[idx - 1] = { ...left, endTimeSec: start, isUserModified: true };
        deficit = round3(deficit - takeLeft);
      }
    }

    // Extreme fallback: song is completely packed at minimum width; scale proportionally.
    if (end - start < 0.2) {
      const next = [...base];
      next.splice(idx + 1, 0, { ...newSection, isUserModified: true });
      const seg = total / next.length;
      return next.map((s, i) => ({
        ...s,
        startTimeSec: i === 0 ? 0 : round3(i * seg),
        endTimeSec: i === next.length - 1 ? total : round3((i + 1) * seg),
      }));
    }
  }

  const halfSpan = (end - start) / 2;
  const effectiveMin = Math.min(minSec, halfSpan * 0.9);
  const rawMid = start + halfSpan;
  const split = snapTimeToDownbeat(rawMid, grid, {
    enabled: snapEnabled,
    minSec: round3(start + effectiveMin),
    maxSec: round3(end - effectiveMin),
  });
  const clampedSplit = round3(
    Math.max(start + effectiveMin, Math.min(end - effectiveMin, split))
  );

  base[idx] = {
    ...target,
    startTimeSec: start,
    endTimeSec: clampedSplit,
    isUserModified: true,
  };

  const inserted: SongSection = {
    ...newSection,
    startTimeSec: clampedSplit,
    endTimeSec: end,
    isUserModified: true,
  };

  const out = [...base];
  out.splice(idx + 1, 0, inserted);
  out[0].startTimeSec = 0;
  out[out.length - 1].endTimeSec = total;
  return out;
}

/**
 * Deletes section at `deleteIndex` and merges its span into the previous neighbor
 * (or the next neighbor when deleting index 0), leaving all other sections untouched.
 */
export function deleteSectionNonDestructive(
  sections: SongSection[],
  deleteIndex: number,
  totalDuration: number,
  blankFallback: SongSection
): SongSection[] {
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
  const base = materializeExplicitBounds(sections, total);
  const deleted = base[deleteIndex];
  const remaining = base.filter((_, i) => i !== deleteIndex);

  if (deleteIndex > 0) {
    const prev = remaining[deleteIndex - 1];
    remaining[deleteIndex - 1] = {
      ...prev,
      endTimeSec: deleted.endTimeSec,
      isUserModified: true,
    };
  } else {
    const next = remaining[0];
    remaining[0] = {
      ...next,
      startTimeSec: 0,
      isUserModified: true,
    };
  }

  remaining[0].startTimeSec = 0;
  remaining[remaining.length - 1].endTimeSec = total;
  return remaining;
}

/**
 * Reorders sections while preserving each section's own duration and laying them
 * out sequentially from `0` to `totalDuration` (with vocal take anchors preserved).
 */
export function reorderSectionsNonDestructive(
  reordered: SongSection[],
  previousSections: SongSection[],
  totalDuration: number
): SongSection[] {
  if (reordered.length === 0) return reordered;

  if (!(totalDuration > 0) || !hasExplicitTimings(previousSections)) {
    return reordered;
  }

  const total = round3(totalDuration);
  const prevTimings = resolveSectionTimings(previousSections, total);
  const timingById = new Map(prevTimings.map(t => [t.id, t]));
  const anchored = materializeTakeAnchors(reordered, prevTimings);

  const durations = anchored.map(sec => {
    const prev = timingById.get(sec.id);
    const d = prev ? prev.end - prev.start : (sec.endTimeSec ?? 0) - (sec.startTimeSec ?? 0);
    return Math.max(0.5, Number.isFinite(d) && d > 0 ? d : total / anchored.length);
  });
  const sumDur = durations.reduce((a, b) => a + b, 0);
  const scale = sumDur > 0 ? total / sumDur : 1;

  let cursor = 0;
  return anchored.map((sec, i) => {
    const start = i === 0 ? 0 : round3(cursor);
    const nextCursor = cursor + durations[i] * scale;
    const end = i === anchored.length - 1 ? total : round3(Math.min(total, nextCursor));
    cursor = end;
    return {
      ...sec,
      startTimeSec: start,
      endTimeSec: Math.max(start + 0.1, end),
      isUserModified: true,
    };
  });
}

/**
 * Moves the interior boundary between `sections[boundaryIndex - 1]` and
 * `sections[boundaryIndex]`, applying optional magnetic downbeat snapping and
 * hard minimum-section clamping while keeping all vocal take anchors immutable.
 */
export function moveSectionBoundary(
  sections: SongSection[],
  boundaryIndex: number,
  candidateTimeSec: number,
  totalDuration: number,
  grid?: BeatGrid | null,
  snapEnabled = true
): SongSection[] {
  if (!(totalDuration > 0) || boundaryIndex <= 0 || boundaryIndex >= sections.length) {
    return sections;
  }

  const total = round3(totalDuration);
  const base = materializeExplicitBounds(sections, total);
  const left = base[boundaryIndex - 1];
  const right = base[boundaryIndex];
  const minSec = getMinSectionSec(grid);

  const minBound = round3(left.startTimeSec! + minSec);
  const maxBound = round3(right.endTimeSec! - minSec);
  if (minBound >= maxBound) return base;

  const snapped = snapTimeToDownbeat(candidateTimeSec, grid, {
    enabled: snapEnabled,
    minSec: minBound,
    maxSec: maxBound,
  });
  const clamped = round3(Math.max(minBound, Math.min(maxBound, snapped)));

  base[boundaryIndex - 1] = {
    ...left,
    endTimeSec: clamped,
    isUserModified: true,
  };
  base[boundaryIndex] = {
    ...right,
    startTimeSec: clamped,
    isUserModified: true,
  };
  return base;
}

export interface ReanalyzedArrangementResult {
  sections: SongSection[];
  activeTakeIndices: Record<string, number>;
}

/**
 * Non-destructively applies a fresh AI arrangement to a song that already has
 * lyrics or vocal recordings. Every existing vocal take has its absolute
 * `startBeatOffsetSec` preserved, stays attached to a valid section, and active
 * comp selections (`activeTakeIndices`) are remapped to the matching or nearest
 * section rather than being silently reset.
 */
export function applyReanalyzedArrangement(
  currentSections: SongSection[],
  currentTimings: SectionTiming[],
  arrangement: ArrangementSection[],
  mode: 'markers-only' | 'replace-layout',
  currentActiveTakeIndices: Record<string, number> = {}
): ReanalyzedArrangementResult {
  if (arrangement.length === 0) {
    return {
      sections: currentSections,
      activeTakeIndices: { ...currentActiveTakeIndices },
    };
  }

  const anchored = materializeTakeAnchors(currentSections, currentTimings);
  const allTakes: Take[] = anchored.flatMap(s => s.voiceNotes ?? []);
  const stamp = Date.now();

  // Remember which take was actively selected on each section before reassignment.
  const activeTakeIdByOldSection = new Map<string, string>();
  const activeTakeIds = new Set<string>();
  for (const sec of anchored) {
    const selected = activeTakeOf(sec, currentActiveTakeIndices);
    if (selected) {
      activeTakeIdByOldSection.set(sec.id, selected.id);
      activeTakeIds.add(selected.id);
    }
  }

  const attachTakesByTime = (targetSections: SongSection[]): ReanalyzedArrangementResult => {
    const out = targetSections.map(s => ({ ...s, voiceNotes: [] as Take[] }));
    for (const take of allTakes) {
      const anchor = take.startBeatOffsetSec ?? 0;
      let matchIdx = out.findIndex(
        s =>
          s.startTimeSec !== undefined &&
          s.endTimeSec !== undefined &&
          anchor >= s.startTimeSec &&
          anchor < s.endTimeSec
      );
      if (matchIdx === -1) {
        // Attach to nearest section start.
        let bestDist = Infinity;
        for (let i = 0; i < out.length; i++) {
          const dist = Math.abs((out[i].startTimeSec ?? 0) - anchor);
          if (dist < bestDist) {
            bestDist = dist;
            matchIdx = i;
          }
        }
      }
      if (matchIdx >= 0) out[matchIdx].voiceNotes.push(take);
    }

    const remappedIndices: Record<string, number> = {};
    for (const sec of out) {
      if (!sec.voiceNotes.length) continue;
      const sameSectionSelectedId = activeTakeIdByOldSection.get(sec.id);
      if (sameSectionSelectedId) {
        const directIdx = sec.voiceNotes.findIndex(t => t.id === sameSectionSelectedId);
        if (directIdx >= 0) {
          remappedIndices[sec.id] = directIdx;
          continue;
        }
      }

      const secStart = sec.startTimeSec ?? 0;
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < sec.voiceNotes.length; i++) {
        const take = sec.voiceNotes[i];
        if (!activeTakeIds.has(take.id)) continue;
        const dist = Math.abs((take.startBeatOffsetSec ?? secStart) - secStart);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      remappedIndices[sec.id] = bestIdx >= 0 ? bestIdx : 0;
    }

    return { sections: out, activeTakeIndices: remappedIndices };
  };

  if (mode === 'replace-layout') {
    const fresh: SongSection[] = arrangement.map((sec, idx) => ({
      id: `s-auto-${stamp}-${idx}`,
      type: sec.type,
      repetitions: 1,
      isLooping: false,
      text: '',
      placeholder: sec.suggestedLyricsPrompt || `Write ${sec.title || sec.type}...`,
      voiceNotes: [],
      startTimeSec: sec.startTimeSec,
      endTimeSec: sec.endTimeSec,
      isUserModified: false,
      energy: sec.energy,
    }));
    return attachTakesByTime(fresh);
  }

  // 'markers-only': Keep all written lyrics and re-time onto new AI markers.
  const mapped: SongSection[] = arrangement.map((sec, idx) => {
    const existing = anchored[idx];
    if (existing) {
      return {
        ...existing,
        startTimeSec: sec.startTimeSec,
        endTimeSec: sec.endTimeSec,
        isUserModified: false,
        energy: sec.energy ?? existing.energy,
        placeholder: sec.suggestedLyricsPrompt || existing.placeholder,
        voiceNotes: [],
      };
    }
    return {
      id: `s-auto-${stamp}-${idx}`,
      type: sec.type,
      repetitions: 1,
      isLooping: false,
      text: '',
      placeholder: sec.suggestedLyricsPrompt || `Write ${sec.title || sec.type}...`,
      voiceNotes: [],
      startTimeSec: sec.startTimeSec,
      endTimeSec: sec.endTimeSec,
      isUserModified: false,
      energy: sec.energy,
    };
  });

  // If user had more written sections than AI found, append extra text into the final section so no lyrics are lost.
  if (anchored.length > arrangement.length) {
    const overflowText = anchored
      .slice(arrangement.length)
      .map(s => s.text.trim())
      .filter(Boolean)
      .join('\n\n');
    if (overflowText) {
      const last = mapped[mapped.length - 1];
      mapped[mapped.length - 1] = {
        ...last,
        text: last.text.trim() ? `${last.text.trim()}\n\n${overflowText}` : overflowText,
      };
    }
  }

  return attachTakesByTime(mapped);
}
