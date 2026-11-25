import type { BeatAnalysis, SectionType } from '../types';

export interface ArrangementSection {
  type: SectionType;
  title: string;
  startTimeSec: number;
  endTimeSec: number;
  energy?: 'low' | 'medium' | 'high';
  suggestedLyricsPrompt?: string;
}

export interface BeatGrid {
  bpm: number;
  gridOriginSec: number;
  beatsPerBar?: number;
  /** Confidence (0..1); defaults to trusted when omitted. */
  confidence?: number;
}

export interface SnapOptions {
  enabled?: boolean;
  /** Maximum distance (sec) for magnetic pull toward a downbeat bar. */
  maxSnapDeltaSec?: number;
  minSec?: number;
  maxSec?: number;
}

export interface NormalizeSectionsOptions {
  grid?: BeatGrid | null;
  snapToGrid?: boolean;
}

const VALID_TYPES: SectionType[] = ['intro', 'verse', 'chorus', 'hook', 'bridge', 'pre-chorus', 'outro'];
const VALID_ENERGY = ['low', 'medium', 'high'] as const;

const MIN_RAW_SECTION_SEC = 2;
const DEFAULT_SECTION_SEC = 8;
export const MIN_GRID_CONFIDENCE = 0.45;

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Millisecond precision rounding so bar-snapped boundaries stay sample-tight without float noise. */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function barDurationSec(bpm: number, beatsPerBar = 4): number {
  const safeBpm = Number.isFinite(bpm) && bpm >= 40 && bpm <= 240 ? bpm : 120;
  return (60 / safeBpm) * beatsPerBar;
}

export function isGridReliable(grid?: BeatGrid | null): grid is BeatGrid {
  if (!grid) return false;
  if (!(typeof grid.bpm === 'number' && Number.isFinite(grid.bpm) && grid.bpm >= 40 && grid.bpm <= 240)) {
    return false;
  }
  if (!(typeof grid.gridOriginSec === 'number' && Number.isFinite(grid.gridOriginSec) && grid.gridOriginSec >= 0)) {
    return false;
  }
  if (grid.confidence !== undefined && (!Number.isFinite(grid.confidence) || grid.confidence < MIN_GRID_CONFIDENCE)) {
    return false;
  }
  return true;
}

/**
 * Direct multiplication `gridOriginSec + barIndex * barDurationSec` avoids iterative `+=` drift.
 */
export function barIndexToSec(barIndex: number, grid: BeatGrid): number {
  const barSec = barDurationSec(grid.bpm, grid.beatsPerBar ?? 4);
  return round3(Math.max(0, grid.gridOriginSec + barIndex * barSec));
}

/**
 * Minimum valid section duration: 1 bar at fast tempos (clamped to [1.0s, 2.0s]),
 * so a 2-bar pre-chorus at 160 BPM (3.0s) never collapses.
 */
export function getMinSectionSec(grid?: BeatGrid | null): number {
  if (grid && Number.isFinite(grid.bpm) && grid.bpm >= 40 && grid.bpm <= 240) {
    const barSec = barDurationSec(grid.bpm, grid.beatsPerBar ?? 4);
    return round3(Math.max(1.0, Math.min(barSec, 2.0)));
  }
  return 1.0;
}

/**
 * Magnetically snaps a timestamp to the nearest bar downbeat when grid snapping is
 * enabled and the candidate lies within tolerance. Always clamps to `[minSec, maxSec]`
 * if provided so adjacent boundaries can never cross or collapse.
 */
export function snapTimeToDownbeat(
  timeSec: number,
  grid: BeatGrid | null | undefined,
  options: SnapOptions = {}
): number {
  const clamp = (v: number): number => {
    let out = v;
    if (options.minSec !== undefined) out = Math.max(options.minSec, out);
    if (options.maxSec !== undefined) out = Math.min(options.maxSec, out);
    return round3(out);
  };

  if (options.enabled === false || !grid || !(grid.bpm >= 40 && grid.bpm <= 240)) {
    return clamp(timeSec);
  }

  const barSec = barDurationSec(grid.bpm, grid.beatsPerBar ?? 4);
  const origin = Number.isFinite(grid.gridOriginSec) && grid.gridOriginSec >= 0 ? grid.gridOriginSec : 0;
  const exactBar = (timeSec - origin) / barSec;
  const nearestIdx = Math.max(0, Math.round(exactBar));
  const candidate = barIndexToSec(nearestIdx, { ...grid, gridOriginSec: origin });
  const tol = options.maxSnapDeltaSec ?? Math.min(0.75, barSec * 0.35);

  if (Math.abs(candidate - timeSec) > tol) {
    return clamp(timeSec);
  }

  const minSec = options.minSec ?? -Infinity;
  const maxSec = options.maxSec ?? Infinity;
  if (candidate >= minSec && candidate <= maxSec) {
    return candidate;
  }

  // If the nearest bar falls just outside [minSec, maxSec], check adjacent bars strictly inside bounds.
  const floorBar = Math.max(0, Math.floor(exactBar));
  const ceilBar = Math.max(0, Math.ceil(exactBar));
  const altBars = [floorBar, ceilBar, floorBar - 1, ceilBar + 1]
    .filter(b => b >= 0)
    .map(b => barIndexToSec(b, { ...grid, gridOriginSec: origin }))
    .filter(t => t >= minSec && t <= maxSec && Math.abs(t - timeSec) <= tol)
    .sort((a, b) => Math.abs(a - timeSec) - Math.abs(b - timeSec));

  if (altBars.length > 0) return altBars[0];
  return clamp(timeSec);
}

/**
 * Applies optional magnetic downbeat snapping strictly to interior boundaries
 * (`b_1 .. b_{n-1}`), preserving `sections[0].startTimeSec = 0` and
 * `sections[last].endTimeSec = round3(durationSec)`, and dropping collapsed duplicates.
 */
export function applyGridSnapToArrangement(
  sections: ArrangementSection[],
  durationSec: number,
  grid?: BeatGrid | null,
  snapToGrid = true
): ArrangementSection[] {
  if (sections.length === 0 || !(durationSec > 0)) return [];
  const total = round3(durationSec);
  if (sections.length === 1 || !snapToGrid || !isGridReliable(grid)) {
    const copy = sections.map(s => ({ ...s }));
    copy[0].startTimeSec = 0;
    copy[copy.length - 1].endTimeSec = total;
    return copy;
  }

  const barSec = barDurationSec(grid.bpm, grid.beatsPerBar ?? 4);
  const minSec = getMinSectionSec(grid);
  const tol = Math.min(0.75, barSec * 0.35);

  const kept: ArrangementSection[] = [];
  let prevBoundary = 0;

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const isLast = i === sections.length - 1;

    if (isLast) {
      if (total - prevBoundary >= minSec || kept.length === 0) {
        kept.push({ ...sec, startTimeSec: prevBoundary, endTimeSec: total });
      } else {
        // Tail section collapsed below minSec: absorb into previous section.
        kept[kept.length - 1].endTimeSec = total;
      }
      break;
    }

    const rawEnd = Math.min(total, Math.max(prevBoundary, sec.endTimeSec));
    const maxEnd = round3(total - minSec);
    if (prevBoundary + minSec > maxEnd) {
      // No room left for further interior splits; stretch last kept or current to total.
      if (kept.length > 0) {
        kept[kept.length - 1].endTimeSec = total;
      } else {
        kept.push({ ...sec, startTimeSec: 0, endTimeSec: total });
      }
      break;
    }

    const snappedEnd = snapTimeToDownbeat(rawEnd, grid, {
      enabled: true,
      maxSnapDeltaSec: tol,
      minSec: round3(prevBoundary + minSec),
      maxSec: maxEnd,
    });

    // Guard against collapsed/duplicate interior boundaries.
    if (snappedEnd <= prevBoundary + 1e-4) {
      continue;
    }

    kept.push({
      ...sec,
      startTimeSec: prevBoundary,
      endTimeSec: snappedEnd,
    });
    prevBoundary = snappedEnd;
  }

  if (kept.length > 0) {
    kept[0].startTimeSec = 0;
    kept[kept.length - 1].endTimeSec = total;
    for (let i = 1; i < kept.length; i++) {
      kept[i].startTimeSec = kept[i - 1].endTimeSec;
    }
  }
  return kept;
}

/**
 * Turns an untrusted section list (e.g. model output) into a contiguous,
 * non-overlapping arrangement that exactly covers `[0, durationSec]`.
 *
 * Pipeline:
 * 1. Extract & filter valid sections (drop out-of-range starts, sort monotonically).
 * 2. Clamp & close contiguous raw bounds in `[0, durationSec]` with ms precision (`round3`).
 * 3. Optional magnetic bar snapping on interior boundaries only when BPM confidence is sufficient.
 * 4. Enforce final boundary invariants (`start=0`, `end=durationSec`, `end > start`).
 */
export function normalizeSections(
  raw: unknown,
  durationSec: number,
  options: NormalizeSectionsOptions = {}
): ArrangementSection[] {
  if (!Array.isArray(raw) || !(durationSec > 0)) return [];

  const total = round3(durationSec);

  // Stage 1: Extract & filter
  const candidates = raw
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .map(s => ({
      type: String(s.type ?? 'verse').toLowerCase().trim(),
      title: typeof s.title === 'string' ? s.title.trim() : '',
      start: finite(s.startTimeSec),
      end: finite(s.endTimeSec),
      energy: typeof s.energy === 'string' ? s.energy.toLowerCase() : undefined,
      hint: typeof s.suggestedLyricsPrompt === 'string' ? s.suggestedLyricsPrompt.trim() : undefined,
    }))
    .filter(s => s.start === null || (s.start >= -0.5 && s.start < total - 0.5));

  if (candidates.length === 0) return [];

  // Order by reported start; sections without a start keep their relative position.
  const indexed = candidates.map((c, i) => ({ c, i }));
  indexed.sort((a, b) => (a.c.start ?? Infinity) - (b.c.start ?? Infinity) || a.i - b.i);

  // Stage 2: Clamp & close contiguous raw bounds
  const minRawSec = options.grid ? getMinSectionSec(options.grid) : MIN_RAW_SECTION_SEC;
  const out: ArrangementSection[] = [];
  let cursor = 0;

  for (const { c } of indexed) {
    if (cursor >= total - 0.5) break;
    const wantedEnd = c.end !== null ? Math.min(total, Math.max(0, c.end)) : cursor + DEFAULT_SECTION_SEC;
    const end = round3(Math.min(total, Math.max(cursor + minRawSec, wantedEnd)));
    if (end <= cursor) continue;
    const type = (VALID_TYPES as string[]).includes(c.type) ? (c.type as SectionType) : 'verse';
    out.push({
      type,
      title: c.title || type.charAt(0).toUpperCase() + type.slice(1),
      startTimeSec: round3(cursor),
      endTimeSec: end,
      energy: (VALID_ENERGY as readonly string[]).includes(c.energy ?? '')
        ? (c.energy as ArrangementSection['energy'])
        : undefined,
      suggestedLyricsPrompt: c.hint && c.hint.length <= 40 ? c.hint : undefined,
    });
    cursor = end;
  }

  if (out.length === 0) return [];

  // Close any trailing gap so playback never runs past the last section.
  out[0].startTimeSec = 0;
  out[out.length - 1].endTimeSec = total;

  // Stage 3 & 4: Optional interior bar snapping + final invariants
  return applyGridSnapToArrangement(out, total, options.grid, options.snapToGrid ?? true);
}

/**
 * Deterministic local arrangement fallback using an RMS/energy curve and the
 * detected BPM + downbeat bar grid. Produces labeled, bar-snapped sections
 * (e.g. Intro, Verse, Chorus, Bridge, Outro) covering `[0, durationSec]`.
 */
export function buildLocalEnergyArrangement(
  energyCurve: number[],
  durationSec: number,
  grid?: BeatGrid | null
): BeatAnalysis {
  const total = round3(Math.max(0, durationSec));
  if (!(total > 0)) {
    return { source: 'local-energy', sections: [] };
  }

  const hasUsableGrid = Boolean(grid && Number.isFinite(grid.bpm) && grid.bpm >= 40 && grid.bpm <= 240);
  const safeBpm = hasUsableGrid ? grid!.bpm : 120;
  const origin = hasUsableGrid && Number.isFinite(grid!.gridOriginSec) && grid!.gridOriginSec >= 0 ? grid!.gridOriginSec : 0;
  const effectiveGrid: BeatGrid = {
    bpm: safeBpm,
    gridOriginSec: origin,
    beatsPerBar: grid?.beatsPerBar ?? 4,
    confidence: hasUsableGrid ? (grid?.confidence ?? 1) : 0,
  };
  const barSec = barDurationSec(safeBpm, effectiveGrid.beatsPerBar ?? 4);

  // Very short clips / loops (< 14s): single section covering the full clip.
  if (total < 14) {
    return {
      source: 'local-energy',
      estimatedBpm: hasUsableGrid ? safeBpm : undefined,
      gridOriginSec: origin,
      sections: [
        {
          type: 'verse',
          title: 'Verse 1',
          startTimeSec: 0,
          endTimeSec: total,
          energy: 'medium',
          suggestedLyricsPrompt: 'Write your opening verse',
        },
      ],
    };
  }

  // Normalize energy samples to [0, 1]; fall back to flat medium curve if missing.
  const rawSamples =
    Array.isArray(energyCurve) && energyCurve.length >= 4
      ? energyCurve.map(v => (Number.isFinite(v) && v >= 0 ? v : 0))
      : Array.from({ length: 32 }, () => 0.5);

  const maxRaw = Math.max(...rawSamples, 1e-6);
  const normSamples = rawSamples.map(v => v / maxRaw);

  const sampleAtTime = (tSec: number): number => {
    const pos = Math.max(0, Math.min(normSamples.length - 1, (tSec / total) * (normSamples.length - 1)));
    const i0 = Math.floor(pos);
    const i1 = Math.min(normSamples.length - 1, i0 + 1);
    const frac = pos - i0;
    return normSamples[i0] * (1 - frac) + normSamples[i1] * frac;
  };

  const meanEnergyBetween = (startSec: number, endSec: number): number => {
    if (endSec <= startSec) return sampleAtTime(startSec);
    const steps = 16;
    let sum = 0;
    for (let k = 0; k < steps; k++) {
      const t = startSec + ((k + 0.5) / steps) * (endSec - startSec);
      sum += sampleAtTime(t);
    }
    return sum / steps;
  };

  // Determine target section count and minimum section span in bars/seconds.
  const targetSections = total < 32 ? 2 : Math.max(4, Math.min(7, Math.round(total / 26)));
  const minSectionBars = total < 45 ? 4 : 8;
  const minSectionSec = Math.max(getMinSectionSec(effectiveGrid) * 2, Math.min(total * 0.14, minSectionBars * barSec));
  const halfWindowSec = Math.max(barSec * 2, Math.min(10, total * 0.08));

  // Build candidate interior split points snapped to bar downbeats (prefer 4-bar multiples on full songs).
  const stepBars = total >= 45 ? 4 : 2;
  const totalBars = Math.max(1, Math.floor((total - origin) / barSec));
  const candidates: Array<{ timeSec: number; novelty: number }> = [];

  for (let b = stepBars; b < totalBars; b += stepBars) {
    const t = barIndexToSec(b, effectiveGrid);
    if (t < minSectionSec || t > total - minSectionSec) continue;
    const leftMean = meanEnergyBetween(Math.max(0, t - halfWindowSec), t);
    const rightMean = meanEnergyBetween(t, Math.min(total, t + halfWindowSec));
    const novelty = Math.abs(rightMean - leftMean);
    candidates.push({ timeSec: t, novelty });
  }

  // Select top energy-change peaks with minimum spacing; blend in balanced bar splits if needed.
  const selectedBoundaries: number[] = [];
  const neededInterior = Math.max(1, targetSections - 1);

  const sortedByNovelty = [...candidates].sort((a, b) => b.novelty - a.novelty || a.timeSec - b.timeSec);
  const maxNovelty = sortedByNovelty[0]?.novelty ?? 0;

  if (maxNovelty > 0.045) {
    for (const cand of sortedByNovelty) {
      if (selectedBoundaries.length >= neededInterior) break;
      const tooClose = selectedBoundaries.some(b => Math.abs(b - cand.timeSec) < minSectionSec);
      if (!tooClose && cand.novelty >= maxNovelty * 0.35) {
        selectedBoundaries.push(cand.timeSec);
      }
    }
  }

  // If the beat has very consistent loudness or fewer boundaries than needed, fill longest gaps on bar lines.
  while (selectedBoundaries.length < neededInterior) {
    const allBounds = [0, ...selectedBoundaries.slice().sort((a, b) => a - b), total];
    let widestIdx = -1;
    let widestGap = 0;
    for (let i = 0; i < allBounds.length - 1; i++) {
      const gap = allBounds[i + 1] - allBounds[i];
      if (gap > widestGap) {
        widestGap = gap;
        widestIdx = i;
      }
    }
    if (widestIdx < 0 || widestGap < minSectionSec * 2) break;
    const mid = (allBounds[widestIdx] + allBounds[widestIdx + 1]) / 2;
    const snappedMid = hasUsableGrid
      ? snapTimeToDownbeat(mid, effectiveGrid, {
          enabled: true,
          maxSnapDeltaSec: Math.max(barSec * 2, 4),
          minSec: allBounds[widestIdx] + minSectionSec,
          maxSec: allBounds[widestIdx + 1] - minSectionSec,
        })
      : round3(mid);
    if (snappedMid > allBounds[widestIdx] + 1 && snappedMid < allBounds[widestIdx + 1] - 1) {
      selectedBoundaries.push(snappedMid);
    } else {
      break;
    }
  }

  selectedBoundaries.sort((a, b) => a - b);
  const boundaries = [0, ...selectedBoundaries, total];

  // Compute segment energy and classify low / medium / high relative to the track.
  const segStats: Array<{ startTimeSec: number; endTimeSec: number; avg: number }> = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startTimeSec = boundaries[i];
    const endTimeSec = boundaries[i + 1];
    const avg = meanEnergyBetween(startTimeSec, endTimeSec);
    segStats.push({ startTimeSec, endTimeSec, avg });
  }

  const avgs = segStats.map(s => s.avg);
  const trackMin = Math.min(...avgs);
  const trackMax = Math.max(...avgs);
  const trackSpan = Math.max(1e-4, trackMax - trackMin);
  const trackMean = avgs.reduce((acc, v) => acc + v, 0) / Math.max(1, avgs.length);

  const classifyEnergy = (avg: number): 'low' | 'medium' | 'high' => {
    if (trackSpan < 0.06) return 'medium';
    const rel = (avg - trackMin) / trackSpan;
    if (rel >= 0.65 || avg >= trackMean * 1.1) return 'high';
    if (rel <= 0.32 || avg <= trackMean * 0.85) return 'low';
    return 'medium';
  };

  const count = segStats.length;
  const energies = segStats.map(s => classifyEnergy(s.avg));

  // Assign musical labels (Intro, Verse, Chorus, Bridge, Outro) using energy contour & position.
  const types: SectionType[] = segStats.map((seg, i) => {
    const dur = seg.endTimeSec - seg.startTimeSec;
    const e = energies[i];
    if (count === 2) {
      return i === 0 ? (e === 'low' ? 'intro' : 'verse') : 'chorus';
    }
    if (i === 0) {
      return dur <= Math.max(24, barSec * 8.5) || e === 'low' ? 'intro' : 'verse';
    }
    if (i === count - 1 && count >= 3) {
      const prevAvg = segStats[i - 1].avg;
      return dur <= Math.max(28, barSec * 8.5) || e === 'low' || seg.avg < prevAvg * 0.94 ? 'outro' : 'chorus';
    }
    if (e === 'high') {
      return 'chorus';
    }
    if (i >= Math.floor(count * 0.6) && i === count - 2 && e === 'low' && count >= 5) {
      return 'bridge';
    }
    if (i > 0 && i < count - 1 && energies[i + 1] === 'high' && e === 'medium' && dur <= Math.max(18, barSec * 4.5) && count >= 5) {
      return 'pre-chorus';
    }
    return 'verse';
  });

  // Ensure at least one chorus exists on multi-section songs so the arrangement feels actionable.
  if (count >= 3 && !types.includes('chorus')) {
    let bestInterior = 1;
    for (let i = 1; i < count - 1; i++) {
      if (segStats[i].avg > segStats[bestInterior].avg) bestInterior = i;
    }
    types[bestInterior] = 'chorus';
    energies[bestInterior] = 'high';
  }

  let verseNum = 0;
  let chorusNum = 0;
  const prompts: Record<SectionType, string> = {
    none: 'Write your lines...',
    intro: 'Set the mood...',
    verse: 'Tell the story...',
    'pre-chorus': 'Build the tension...',
    chorus: 'Deliver the main hook...',
    hook: 'Drop the catchy hook...',
    bridge: 'Shift perspective...',
    outro: 'Bring it home...',
  };

  const rawSections: ArrangementSection[] = segStats.map((seg, i) => {
    const type = types[i];
    let title: string;
    if (type === 'verse') {
      verseNum += 1;
      title = `Verse ${verseNum}`;
    } else if (type === 'chorus') {
      chorusNum += 1;
      title = chorusNum > 1 ? `Chorus ${chorusNum}` : 'Chorus';
    } else if (type === 'pre-chorus') {
      title = 'Pre-Chorus';
    } else {
      title = type.charAt(0).toUpperCase() + type.slice(1);
    }

    return {
      type,
      title,
      startTimeSec: seg.startTimeSec,
      endTimeSec: seg.endTimeSec,
      energy: energies[i],
      suggestedLyricsPrompt: prompts[type],
    };
  });

  // Snap strictly to bar downbeats if reliable, preserving [0, total] invariants.
  const snapped = applyGridSnapToArrangement(
    rawSections,
    total,
    hasUsableGrid ? { ...effectiveGrid, confidence: Math.max(effectiveGrid.confidence ?? 0, MIN_GRID_CONFIDENCE) } : null,
    hasUsableGrid
  );

  return {
    source: 'local-energy',
    estimatedBpm: hasUsableGrid ? safeBpm : undefined,
    gridOriginSec: origin,
    sections: snapped,
  };
}

