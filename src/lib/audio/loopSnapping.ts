/**
 * Beat snapping utility for aligning loop points to musical boundaries
 * Ensures loop regions start and end on clean beat boundaries for seamless playback
 */

/**
 * Snap a time position to the nearest beat boundary
 * @param timeMs - Time in milliseconds
 * @param bpm - Beats per minute (detected from audio)
 * @param bars - Number of bars to snap to (4, 8, 16, etc.)
 * @returns Snapped time in milliseconds
 */
export const snapToBeatBoundary = (timeMs: number, bpm: number, bars: number = 8): number => {
    if (!bpm || bpm <= 0) return timeMs;

    // Calculate milliseconds per beat
    const msPerBeat = (60 * 1000) / bpm;

    // Calculate milliseconds per bar (4 beats per bar)
    const msPerBar = msPerBeat * 4;

    // Calculate milliseconds for the desired number of bars
    const msPerSnap = msPerBar * bars;

    // Find the nearest snap point
    const snapIndex = Math.round(timeMs / msPerSnap);
    const snappedMs = snapIndex * msPerSnap;

    return Math.max(0, snappedMs);
};

/**
 * Snap both start and end times of a loop region to beat boundaries
 * @param startMs - Start time in milliseconds
 * @param endMs - End time in milliseconds
 * @param bpm - Beats per minute
 * @returns Object with snapped start and end times in milliseconds
 */
export const snapLoopRegion = (
    startMs: number,
    endMs: number,
    bpm: number
): { start: number; end: number } => {
    // Snap start to nearest 4-bar boundary
    const snappedStart = snapToBeatBoundary(startMs, bpm, 4);

    // Snap end to nearest 8-bar boundary (gives more flexibility for loop length)
    const snappedEnd = snapToBeatBoundary(endMs, bpm, 8);

    // Ensure end is after start
    if (snappedEnd <= snappedStart) {
        // If snap resulted in same or earlier time, add one bar
        const msPerBeat = (60 * 1000) / bpm;
        const msPerBar = msPerBeat * 4;
        return {
            start: snappedStart,
            end: snappedStart + msPerBar * 8
        };
    }

    return {
        start: snappedStart,
        end: snappedEnd
    };
};

/**
 * Convert milliseconds to seconds
 */
export const msToSeconds = (ms: number): number => ms / 1000;

/**
 * Convert seconds to milliseconds
 */
export const secondsToMs = (seconds: number): number => seconds * 1000;
