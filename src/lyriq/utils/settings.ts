import { useCallback, useEffect, useState } from 'react';

/**
 * User-tunable audio and lyric-sync settings, persisted per browser.
 *
 * Sign convention for `lyricOffsetMs`: negative = lyric highlights fire earlier
 * than the stored timestamp, positive = later.
 */
export interface SyncSettings {
  lyricOffsetMs: number;
  /** `null` = use the latency the browser reports for the audio device. */
  recordingLatencyMs: number | null;
  beatVolume: number;
  vocalVolume: number;
  /**
   * true  = headphones: mic processing (echo cancel / noise suppression / AGC) off,
   *         which keeps the vocal clean.
   * false = speakers: processing on so the beat bleeding into the mic is reduced.
   */
  headphones: boolean;
}

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  // Line times are snapped to where the singing starts; lighting each line a
  // quarter second early gives the eye time to land on it before it's sung
  // (the feel of streaming apps' lyric views). Tune this to taste.
  lyricOffsetMs: -250,
  recordingLatencyMs: null,
  beatVolume: 1,
  vocalVolume: 1,
  headphones: true,
};

export const LYRIC_OFFSET_RANGE_MS = 1000;
export const RECORDING_LATENCY_MAX_MS = 500;

const STORAGE_KEY = 'lyriq.syncSettings.v1';

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Coerces unknown input (e.g. parsed localStorage) into a valid settings object. */
export function sanitizeSyncSettings(input: unknown): SyncSettings {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const offset = num(src.lyricOffsetMs);
  const latency = src.recordingLatencyMs === null ? null : num(src.recordingLatencyMs);
  const beat = num(src.beatVolume);
  const vocal = num(src.vocalVolume);

  return {
    lyricOffsetMs:
      offset === null
        ? DEFAULT_SYNC_SETTINGS.lyricOffsetMs
        : Math.round(clamp(offset, -LYRIC_OFFSET_RANGE_MS, LYRIC_OFFSET_RANGE_MS)),
    recordingLatencyMs:
      latency === null ? null : Math.round(clamp(latency, 0, RECORDING_LATENCY_MAX_MS)),
    beatVolume: beat === null ? DEFAULT_SYNC_SETTINGS.beatVolume : clamp(beat, 0, 1),
    vocalVolume: vocal === null ? DEFAULT_SYNC_SETTINGS.vocalVolume : clamp(vocal, 0, 1),
    headphones: typeof src.headphones === 'boolean' ? src.headphones : DEFAULT_SYNC_SETTINGS.headphones,
  };
}

function loadSyncSettings(): SyncSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitizeSyncSettings(JSON.parse(raw));
  } catch {
    // Storage blocked or corrupt: fall through to defaults.
  }
  return { ...DEFAULT_SYNC_SETTINGS };
}

function saveSyncSettings(settings: SyncSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Non-fatal: settings just won't survive a reload.
  }
}

export function useSyncSettings(): [SyncSettings, (patch: Partial<SyncSettings>) => void, () => void] {
  const [settings, setSettings] = useState<SyncSettings>(() => loadSyncSettings());

  useEffect(() => {
    saveSyncSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<SyncSettings>) => {
    setSettings(prev => sanitizeSyncSettings({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings({ ...DEFAULT_SYNC_SETTINGS }), []);

  return [settings, update, reset];
}
