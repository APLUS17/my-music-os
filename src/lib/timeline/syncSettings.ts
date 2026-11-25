/**
 * User-tunable sync settings. Pure part (defaults + sanitising) lives here so
 * it can be tested; the React hook that persists it is in hooks/useSyncSettings.
 *
 * Sign convention for `lyricOffsetMs`: negative = lyrics light up EARLIER than
 * their stored time, positive = later.
 */
export interface SyncSettings {
    lyricOffsetMs: number;
    /** Keep the active line in view while playing. */
    followPlayback: boolean;
}

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
    // Lines are lit a quarter second early so the eye lands on a line before
    // it is sung, the way streaming lyric views feel. Tune to taste.
    lyricOffsetMs: -250,
    followPlayback: true,
};

export const LYRIC_OFFSET_RANGE_MS = 1000;
export const SYNC_SETTINGS_STORAGE_KEY = 'lyriq.syncSettings.v1';

function clamp(n: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, n));
}

/** Coerces unknown input (e.g. parsed localStorage) into valid settings. */
export function sanitizeSyncSettings(input: unknown): SyncSettings {
    const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const offset = typeof src.lyricOffsetMs === 'number' && Number.isFinite(src.lyricOffsetMs) ? src.lyricOffsetMs : null;
    return {
        lyricOffsetMs: offset === null
            ? DEFAULT_SYNC_SETTINGS.lyricOffsetMs
            : Math.round(clamp(offset, -LYRIC_OFFSET_RANGE_MS, LYRIC_OFFSET_RANGE_MS)),
        followPlayback: typeof src.followPlayback === 'boolean' ? src.followPlayback : DEFAULT_SYNC_SETTINGS.followPlayback,
    };
}
