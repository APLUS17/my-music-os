import type { SttPhrase } from '../types';

/**
 * Line timing for recorded takes, anchored to the vocal itself.
 *
 * Transcription (live or after the take) tells us WHAT was sung and roughly
 * WHEN. The "when" is only approximate: live text arrives late by a varying
 * amount, and models estimate timestamps in audio loosely. The take's own
 * audio, though, says exactly when the singer comes in. So:
 *
 *   1. measure loudness every 10 ms and find where singing starts after a
 *      pause (or after a clear dip in level),
 *   2. find the overall shift/stretch that best lines the transcribed line
 *      starts up with those entries (fixes systematic lateness or drift),
 *   3. snap each line start to the nearest real entry, keeping order,
 *   4. end each line when the voice stops before the next line.
 *
 * All times here are seconds from the first sample of the take.
 */

const ENVELOPE_HOP_SEC = 0.01;

/** Loudness of each 10 ms frame, in dBFS. */
export function vocalEnvelope(samples: Float32Array, sampleRate: number, hopSec = ENVELOPE_HOP_SEC): Float32Array {
  const hop = Math.max(1, Math.round(sampleRate * hopSec));
  const frames = Math.floor(samples.length / hop);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const o = f * hop;
    for (let i = 0; i < hop; i++) {
      const v = samples[o + i];
      sum += v * v;
    }
    out[f] = 10 * Math.log10(sum / hop + 1e-12);
  }
  return out;
}

interface VoicedRegion {
  start: number;
  end: number;
}

export interface VocalMap {
  /** Stretches of singing, in order. */
  regions: VoicedRegion[];
  /** Moments the voice comes in: region starts, plus re-entries after a deep dip. */
  entries: number[];
  /**
   * Silence before each entry, seconds (0 for a re-entry after a dip). Same order as `entries`.
   */
  gaps: number[];
  /** Seconds of singing in the second after each entry: a line start is followed by sustained voice. */
  sustain: number[];
}

const MERGE_GAP_SEC = 0.12;
const MIN_REGION_SEC = 0.06;
/** A dip this deep inside continuous singing counts as a new entry (e.g. a quick breath). */
const DIP_DB = 9;

function percentile(sorted: Float32Array, p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
}

/**
 * Finds where the take has singing. Returns empty lists when the take has no
 * clear difference between singing and silence (then nothing is snapped).
 */
export function mapVocal(env: Float32Array, hopSec = ENVELOPE_HOP_SEC): VocalMap {
  const none: VocalMap = { regions: [], entries: [], gaps: [], sustain: [] };
  if (env.length < 10) return none;

  const sorted = Float32Array.from(env).sort();
  const floor = percentile(sorted, 0.1);
  const loud = percentile(sorted, 0.95);
  const range = loud - floor;
  if (range < 12) return none;

  // Hysteresis: enter singing at a higher level than the one that ends it.
  const onDb = floor + Math.max(9, range * 0.35);
  const offDb = floor + Math.max(6, range * 0.22);

  const raw: VoicedRegion[] = [];
  let startFrame = -1;
  for (let f = 0; f < env.length; f++) {
    if (startFrame < 0) {
      if (env[f] >= onDb) {
        // Back up to where the level first rose above the "off" line, so the entry isn't late.
        let s = f;
        while (s > 0 && env[s - 1] >= offDb && f - s < 8) s--;
        startFrame = s;
      }
    } else if (env[f] < offDb) {
      raw.push({ start: startFrame * hopSec, end: f * hopSec });
      startFrame = -1;
    }
  }
  if (startFrame >= 0) raw.push({ start: startFrame * hopSec, end: env.length * hopSec });

  // Merge tiny gaps (consonants, short stops) and drop clicks.
  const regions: VoicedRegion[] = [];
  for (const r of raw) {
    const prev = regions[regions.length - 1];
    if (prev && r.start - prev.end < MERGE_GAP_SEC) prev.end = r.end;
    else regions.push({ ...r });
  }
  const kept = regions.filter(r => r.end - r.start >= MIN_REGION_SEC);

  // Re-entries inside long regions: a dip of DIP_DB below both sides, then a rise.
  // The start of the recording counts as a full pause: the first sung line begins there at the latest.
  const found: { t: number; gap: number }[] = kept.map((r, i) => ({ t: r.start, gap: i === 0 ? Math.max(r.start, 1) : r.start - kept[i - 1].end }));
  const win = Math.round(0.25 / hopSec);
  for (const r of kept) {
    const a = Math.round(r.start / hopSec) + win;
    const b = Math.round(r.end / hopSec) - win;
    for (let f = a; f < b; f++) {
      const v = env[f];
      if (!(v <= env[f - 1] && v <= env[f + 1])) continue;
      let left = -Infinity;
      let right = -Infinity;
      for (let i = f - win; i < f; i++) left = Math.max(left, env[i]);
      for (let i = f + 1; i <= f + win; i++) right = Math.max(right, env[i]);
      if (left - v < DIP_DB || right - v < DIP_DB) continue;
      // The entry is where the level climbs halfway back up.
      const target = v + (right - v) / 2;
      let g = f + 1;
      while (g < f + win && env[g] < target) g++;
      found.push({ t: g * hopSec, gap: 0 });
      f += win; // one entry per dip
    }
  }
  found.sort((x, y) => x.t - y.t);
  const sustainAfter = (t: number) => {
    let v = 0;
    for (const r of kept) {
      if (r.end <= t) continue;
      if (r.start >= t + 1) break;
      v += Math.min(r.end, t + 1) - Math.max(r.start, t);
    }
    return v;
  };
  return { regions: kept, entries: found.map(e => e.t), gaps: found.map(e => e.gap), sustain: found.map(e => sustainAfter(e.t)) };
}

function nearest(sorted: number[], t: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  let best = sorted[lo];
  if (lo > 0 && Math.abs(sorted[lo - 1] - t) < Math.abs(best - t)) best = sorted[lo - 1];
  return best;
}

/** Best overall shift and stretch for the line starts against the vocal entries. */
function fitTiming(starts: number[], entries: number[]): { shift: number; scale: number } {
  const identity = { shift: 0, scale: 1 };
  if (starts.length < 2 || entries.length < 2) return identity;
  const score = (shift: number, scale: number) => {
    let s = 0;
    for (const t of starts) {
      const d = (nearest(entries, t * scale + shift) - (t * scale + shift)) / 0.2;
      s += Math.exp(-d * d);
    }
    // Small preference for leaving the timing alone, so a coincidence can't win.
    return s - 0.15 * Math.abs(shift) - 4 * Math.abs(scale - 1);
  };
  let best = identity;
  let bestScore = score(0, 1);
  const base = bestScore;
  for (let scale = 0.94; scale <= 1.0601; scale += 0.01) {
    for (let shift = -3; shift <= 3.0001; shift += 0.02) {
      const sc = score(shift, scale);
      if (sc > bestScore) { bestScore = sc; best = { shift, scale }; }
    }
  }
  // Only move everything when it clearly lines up better.
  return bestScore - base >= Math.max(0.5, starts.length * 0.1) ? best : identity;
}

function insideRegion(regions: VoicedRegion[], t: number): boolean {
  return regions.some(r => t >= r.start && t < r.end);
}

const SNAP_WINDOW_SEC = 0.6;
/** A pause at least this long before an entry marks a likely line start. */
const PHRASE_GAP_SEC = 0.35;
const MIN_LINE_SEC = 0.3;

interface AlignOptions {
  /** Fit an overall shift/stretch first (default true). Off when re-snapping already-aligned lines. */
  fit?: boolean;
}

/** How far from its estimated time a line may be moved onto a vocal entry. */
const ASSIGN_WINDOW_SEC = 1.2;
/** Cost scale for distance from the estimate (seconds per cost unit). */
const DISTANCE_SCALE_SEC = 0.5;
/** Pause shortfall (vs. the longest pause nearby) at which an entry gets the full weak-pause cost. */
const PAUSE_SHORTFALL_SEC = 0.5;
/** Extra cost for an entry that follows a much shorter pause than its neighbours (a gap between words). */
const WEAK_PAUSE_COST = 3;
/** Extra cost for an entry followed by little singing (a breath or a quick ad-lib). */
const BLIP_COST = 3;
/** Cost of leaving a line unsnapped. */
const UNSNAPPED_COST = 6;

/**
 * Picks one vocal entry per line (or none), for all lines at once: entries
 * stay in order, at least MIN_LINE_SEC apart, near each line's estimate, and
 * preferably after the longest pause around it (where a new line begins).
 * Solving the whole song together resolves cases a line-by-line snap gets
 * wrong, e.g. a late estimate that sits closer to the next word than to the
 * real line start.
 */
function assignEntries(mapped: number[], vocal: VocalMap): (number | null)[] {
  const E = vocal.entries;
  const G = vocal.gaps;
  const n = mapped.length;
  const m = E.length;
  // Strongest pause near each line, to judge how "line-like" each entry's pause is.
  const localMax = mapped.map(t => {
    let mx = 0;
    for (let j = 0; j < m; j++) if (Math.abs(E[j] - t) <= ASSIGN_WINDOW_SEC) mx = Math.max(mx, G[j]);
    return mx;
  });
  const cost = (i: number, j: number): number => {
    const d = Math.abs(E[j] - mapped[i]);
    if (d > ASSIGN_WINDOW_SEC) return Infinity;
    // How much shorter this entry's pause is than the longest one nearby (0 = it is the longest).
    const shortfall = Math.min(1, Math.max(0, localMax[i] - G[j]) / PAUSE_SHORTFALL_SEC);
    const strength = 1 - shortfall;
    const sustained = Math.min(1, vocal.sustain[j] / 0.25);
    return d / DISTANCE_SCALE_SEC + WEAK_PAUSE_COST * (1 - strength) + BLIP_COST * (1 - sustained);
  };

  // dp[k+1] = best cost so far with the last used entry k (dp[0] = none used yet).
  let dp = new Float64Array(m + 1).fill(Infinity);
  dp[0] = 0;
  const back: Int32Array[] = []; // per line: chosen entry per state, or -1 = unsnapped
  const from: Int32Array[] = []; // per line: previous state
  for (let i = 0; i < n; i++) {
    const next = new Float64Array(m + 1).fill(Infinity);
    const choice = new Int32Array(m + 1).fill(-2);
    const prev = new Int32Array(m + 1).fill(-1);
    // Option 1: leave this line unsnapped (state unchanged).
    for (let s = 0; s <= m; s++) {
      if (dp[s] + UNSNAPPED_COST < next[s]) { next[s] = dp[s] + UNSNAPPED_COST; choice[s] = -1; prev[s] = s; }
    }
    // Option 2: use entry j, after any state whose entry is at least MIN_LINE_SEC earlier.
    let bestPrev = dp[0];
    let bestPrevState = 0;
    let p = 0; // states 1..p are entries with E <= E[j] - MIN_LINE_SEC
    for (let j = 0; j < m; j++) {
      while (p < m && E[p] <= E[j] - MIN_LINE_SEC) {
        if (dp[p + 1] < bestPrev) { bestPrev = dp[p + 1]; bestPrevState = p + 1; }
        p++;
      }
      const c = cost(i, j);
      if (c === Infinity || bestPrev === Infinity) continue;
      if (bestPrev + c < next[j + 1]) { next[j + 1] = bestPrev + c; choice[j + 1] = j; prev[j + 1] = bestPrevState; }
    }
    back.push(choice);
    from.push(prev);
    dp = next;
  }

  let state = 0;
  for (let s = 1; s <= m; s++) if (dp[s] < dp[state]) state = s;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = n - 1; i >= 0; i--) {
    const c = back[i][state];
    out[i] = c >= 0 ? E[c] : null;
    state = from[i][state];
  }
  return out;
}

/**
 * Lines up transcribed lines with the take's vocal. `lines` and the result
 * are in seconds from the take's first sample. Without a usable vocal map the
 * lines are only cleaned up (ordered, clamped, non-overlapping).
 */
export function alignLinesToVocal(
  lines: SttPhrase[],
  vocal: VocalMap | null,
  durationSec: number,
  options: AlignOptions = {}
): SttPhrase[] {
  const dur = Math.max(0, durationSec);
  const clean = lines
    .filter(l => l.text && l.text.trim())
    .map(l => ({ text: l.text.trim(), startSec: Math.min(dur, Math.max(0, l.startSec)), endSec: Math.min(dur, Math.max(0, l.endSec)) }))
    .sort((a, b) => a.startSec - b.startSec);
  if (clean.length === 0) return [];

  const usable = vocal && vocal.entries.length > 0;
  // Fit against phrase starts (entries after a real pause) when there are enough;
  // word-level entries would let almost any shift look plausible.
  const phraseEntries = usable ? vocal!.entries.filter((_, k) => vocal!.gaps[k] >= PHRASE_GAP_SEC) : [];
  const fitEntries = phraseEntries.length >= clean.length * 0.5 ? phraseEntries : usable ? vocal!.entries : [];
  const { shift, scale } = usable && options.fit !== false
    ? fitTiming(clean.map(l => l.startSec), fitEntries)
    : { shift: 0, scale: 1 };
  const mapped = clean.map(l => Math.min(dur, Math.max(0, l.startSec * scale + shift)));

  const assigned = usable ? assignEntries(mapped, vocal!) : mapped.map(() => null);
  const starts: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const floor = i > 0 ? starts[i - 1] + MIN_LINE_SEC : 0;
    const pick = assigned[i];
    let start = Math.max(pick ?? mapped[i], floor);
    if (usable && pick === null && !insideRegion(vocal!.regions, start)) {
      // No clear entry for this line and it landed in silence: move to where singing next begins, if close.
      const ceiling = i + 1 < mapped.length ? (assigned[i + 1] ?? mapped[i + 1]) - MIN_LINE_SEC : dur;
      const next = vocal!.regions.find(r => r.start >= start);
      if (next && next.start - start <= SNAP_WINDOW_SEC && next.start <= ceiling) start = next.start;
    }
    starts.push(Math.min(dur, start));
  }

  return clean.map((l, i) => {
    const start = starts[i];
    const nextStart = i + 1 < starts.length ? starts[i + 1] : dur;
    let end = nextStart;
    if (usable) {
      // End when the voice last stops before the next line comes in.
      let lastVoiceEnd = -1;
      for (const r of vocal!.regions) {
        if (r.start >= nextStart) break;
        if (r.end > start) lastVoiceEnd = Math.min(r.end, nextStart);
      }
      if (lastVoiceEnd > start) end = lastVoiceEnd;
    } else {
      const scaledEnd = l.endSec * scale + shift;
      if (scaledEnd > start && scaledEnd < nextStart) end = scaledEnd;
    }
    end = Math.min(nextStart, Math.max(end, start + Math.min(MIN_LINE_SEC, Math.max(0, nextStart - start))));
    return { text: l.text, startSec: round3(start), endSec: round3(Math.min(dur, end)) };
  });
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Using the singer's own written lyrics
// ---------------------------------------------------------------------------

function normWord(w: string): string {
  return w.toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
}

function words(text: string): string[] {
  return text.split(/\s+/).map(normWord).filter(Boolean);
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function similar(a: string, b: string): boolean {
  if (a === b) return true;
  const longest = Math.max(a.length, b.length);
  return longest >= 4 && editDistance(a, b) <= (longest >= 7 ? 2 : 1);
}

/** Lyric-sheet lines, minus blank lines and headings like "[Chorus]" or "Verse 2:". */
export function writtenLyricLines(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !/^\[.*\]$/.test(l) && !/^\(?(verse|chorus|hook|bridge|intro|outro|pre-?chorus)\b[^a-z]*\d*\)?:?$/i.test(l));
}

/**
 * If the singer wrote the lyrics, show their words and line breaks instead of
 * the transcriber's, timed from the (already aligned) heard lines. Returns
 * null when the written lyrics don't clearly match what was sung.
 */
export function applyWrittenLyrics(heard: SttPhrase[], writtenText: string): SttPhrase[] | null {
  const written = writtenLyricLines(writtenText);
  if (heard.length === 0 || written.length === 0) return null;

  // Heard words, each with an approximate time inside its line.
  const hw: { w: string; line: number; t: number; first: boolean }[] = [];
  heard.forEach((l, li) => {
    const ws = words(l.text);
    ws.forEach((w, k) => {
      hw.push({ w, line: li, t: l.startSec + ((l.endSec - l.startSec) * k) / Math.max(1, ws.length), first: k === 0 });
    });
  });
  const ww: { w: string; line: number }[] = [];
  written.forEach((l, li) => words(l).forEach(w => ww.push({ w, line: li })));
  if (hw.length === 0 || ww.length === 0) return null;
  if (hw.length * ww.length > 4_000_000) return null; // absurdly long; not worth aligning

  // Global word alignment (Needleman–Wunsch): match +2, mismatch -1, gap -1.
  const n = hw.length;
  const m = ww.length;
  const score = new Int32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = 1; i <= n; i++) score[at(i, 0)] = -i;
  for (let j = 1; j <= m; j++) score[at(0, j)] = -j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = score[at(i - 1, j - 1)] + (similar(hw[i - 1].w, ww[j - 1].w) ? 2 : -1);
      score[at(i, j)] = Math.max(diag, score[at(i - 1, j)] - 1, score[at(i, j - 1)] - 1);
    }
  }
  const matchOf = new Map<number, number>(); // written word index -> heard word index
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const s = score[at(i, j)];
    const isMatch = similar(hw[i - 1].w, ww[j - 1].w);
    if (s === score[at(i - 1, j - 1)] + (isMatch ? 2 : -1)) {
      if (isMatch) matchOf.set(j - 1, i - 1);
      i--; j--;
    } else if (s === score[at(i - 1, j)] - 1) i--;
    else j--;
  }
  if (matchOf.size < hw.length * 0.6) return null;

  // Time each written line from its first matched word; keep heard lines nobody wrote down.
  const out: SttPhrase[] = [];
  const heardLinesCovered = new Set<number>();
  written.forEach((text, li) => {
    const idx = ww.map((w, k) => (w.line === li ? k : -1)).filter(k => k >= 0);
    const matched = idx.filter(k => matchOf.has(k)).map(k => hw[matchOf.get(k)!]);
    if (matched.length === 0) return; // not sung in this take
    matched.forEach(h => heardLinesCovered.add(h.line));
    const firstHeard = matched[0];
    const start = firstHeard.first ? heard[firstHeard.line].startSec : firstHeard.t;
    out.push({ text, startSec: start, endSec: start });
  });
  heard.forEach((l, li) => { if (!heardLinesCovered.has(li)) out.push({ ...l }); });
  out.sort((a, b) => a.startSec - b.startSec);
  // Ends: up to the next line (re-snapping afterwards tightens them to the voice).
  return out.map((l, k) => ({ ...l, endSec: k + 1 < out.length ? out[k + 1].startSec : Math.max(l.startSec, heard[heard.length - 1].endSec) }));
}

/**
 * Full pipeline for a take: align transcribed lines to the vocal, then use the
 * written lyrics if they match. Input and output are relative to the take.
 */
export function timeTakeLyrics(lines: SttPhrase[], vocal: VocalMap | null, durationSec: number, writtenText = ''): SttPhrase[] {
  const aligned = alignLinesToVocal(lines, vocal, durationSec);
  const withWritten = writtenText.trim() ? applyWrittenLyrics(aligned, writtenText) : null;
  return withWritten ? alignLinesToVocal(withWritten, vocal, durationSec, { fit: false }) : aligned;
}
