'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    DEFAULT_SYNC_SETTINGS,
    SYNC_SETTINGS_STORAGE_KEY,
    sanitizeSyncSettings,
    type SyncSettings,
} from '@/lib/timeline/syncSettings';

function load(): SyncSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_SYNC_SETTINGS };
    try {
        const raw = window.localStorage.getItem(SYNC_SETTINGS_STORAGE_KEY);
        if (raw) return sanitizeSyncSettings(JSON.parse(raw));
    } catch {
        // Storage blocked or corrupt: fall through to defaults.
    }
    return { ...DEFAULT_SYNC_SETTINGS };
}

/** Sync settings persisted per browser. */
export function useSyncSettings(): [SyncSettings, (patch: Partial<SyncSettings>) => void, () => void] {
    const [settings, setSettings] = useState<SyncSettings>(load);

    useEffect(() => {
        try {
            window.localStorage.setItem(SYNC_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch {
            // Non-fatal: settings just won't survive a reload.
        }
    }, [settings]);

    const update = useCallback((patch: Partial<SyncSettings>) => {
        setSettings(prev => sanitizeSyncSettings({ ...prev, ...patch }));
    }, []);
    const reset = useCallback(() => setSettings({ ...DEFAULT_SYNC_SETTINGS }), []);
    return [settings, update, reset];
}
