/**
 * Decides when a playing vocal take has really drifted from the beat.
 *
 * The vocal plays on the Web Audio clock; the song clock it is compared against usually comes from the
 * beat's media element. iOS Safari reports that element's `currentTime` late and in coarse steps, so
 * the raw difference between the two sits at a steady offset and jitters around it by tens of ms.
 * Restarting the vocal whenever that raw difference passed 80 ms re-cut the vocal every few frames,
 * which is what made playback choppy on iPhone.
 *
 * So the tracker first learns the normal offset right after each start (median of the first samples),
 * then only asks for a correction when the smoothed difference leaves that offset by more than
 * `toleranceSec`, stays out for `sustainSec`, and at least `minGapSec` has passed since the last one.
 * Jumps and loop wraps do not go through here: they restart the vocal directly ("strict").
 */
export interface VocalDriftOptions {
  /** How long after a start the normal offset is learned. */
  learnSec: number;
  /** Samples needed before the offset counts as learned. */
  minLearnSamples: number;
  /** Allowed distance from the learned offset. */
  toleranceSec: number;
  /** How long the drift must stay out of tolerance before it is corrected. */
  sustainSec: number;
  /** Shortest time between two corrections. */
  minGapSec: number;
  /** During learning, a difference this large is a real desync and is corrected straight away. */
  grossSec: number;
  /** Samples in the running median that smooths the coarse steps. */
  smoothSamples: number;
}

export const DEFAULT_VOCAL_DRIFT_OPTIONS: VocalDriftOptions = {
  learnSec: 0.6,
  minLearnSamples: 5,
  toleranceSec: 0.2,
  sustainSec: 0.3,
  minGapSec: 1.5,
  grossSec: 0.75,
  smoothSamples: 7,
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export class VocalDriftTracker {
  private readonly opts: VocalDriftOptions;
  private learnStartedAt: number | null = null;
  private learnSamples: number[] = [];
  private baseline: number | null = null;
  private recent: number[] = [];
  private outSince: number | null = null;
  private lastCorrectionAt = -Infinity;

  constructor(opts: Partial<VocalDriftOptions> = {}) {
    this.opts = { ...DEFAULT_VOCAL_DRIFT_OPTIONS, ...opts };
  }

  /** A fresh start (seek, loop wrap, new take): forget the offset and learn it again. */
  reset(): void {
    this.learnStartedAt = null;
    this.learnSamples = [];
    this.baseline = null;
    this.recent = [];
    this.outSince = null;
  }

  /** The learned normal offset, or null while still learning. */
  get learnedOffsetSec(): number | null {
    return this.baseline;
  }

  /**
   * `drift` is vocal position minus where the song clock says it should be, in seconds.
   * Returns null to leave the vocal alone, or the offset (seconds, added to the target position)
   * at which to restart it so it sits back at its normal relation to the clock.
   */
  check(nowSec: number, drift: number): number | null {
    const o = this.opts;
    if (!Number.isFinite(drift)) return null;

    if (this.baseline === null) {
      if (this.learnStartedAt === null) this.learnStartedAt = nowSec;
      if (Math.abs(drift) > o.grossSec) {
        if (nowSec - this.lastCorrectionAt < o.minGapSec) return null;
        this.lastCorrectionAt = nowSec;
        this.reset();
        return 0;
      }
      this.learnSamples.push(drift);
      if (nowSec - this.learnStartedAt >= o.learnSec && this.learnSamples.length >= o.minLearnSamples) {
        this.baseline = median(this.learnSamples);
        this.learnSamples = [];
      }
      return null;
    }

    this.recent.push(drift);
    if (this.recent.length > o.smoothSamples) this.recent.shift();
    const deviation = median(this.recent) - this.baseline;

    if (Math.abs(deviation) <= o.toleranceSec) {
      this.outSince = null;
      return null;
    }
    if (this.outSince === null) this.outSince = nowSec;
    if (nowSec - this.outSince < o.sustainSec) return null;
    if (nowSec - this.lastCorrectionAt < o.minGapSec) return null;

    // Correct, keeping the learned offset: after the restart the vocal is back where it normally sits.
    this.lastCorrectionAt = nowSec;
    this.recent = [];
    this.outSince = null;
    return this.baseline;
  }
}
