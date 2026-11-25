'use client';

import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { LYRIC_OFFSET_RANGE_MS, type SyncSettings } from '@/lib/timeline/syncSettings';

interface SyncSettingsPanelProps {
    settings: SyncSettings;
    /** Recording latency compensation in ms (shared with the recorder). */
    latencyMs: number;
    onChange: (patch: Partial<SyncSettings>) => void;
    onChangeLatency: (ms: number) => void;
    onReset: () => void;
    onClose: () => void;
}

function Row({ label, hint, value, children }: { label: string; hint: string; value: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-main)]">{label}</span>
                <span className="text-[11px] mono text-[var(--accent)] tabular-nums">{value}</span>
            </div>
            {children}
            <span className="text-[10px] text-[var(--text-tertiary)] leading-snug">{hint}</span>
        </div>
    );
}

export function SyncSettingsPanel({ settings, latencyMs, onChange, onChangeLatency, onReset, onClose }: SyncSettingsPanelProps) {
    return (
        <div
            role="dialog"
            aria-label="Sync settings"
            className="w-[min(92vw,20rem)] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] shadow-2xl p-4 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
            data-testid="sync-settings"
        >
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Sync settings</span>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={onReset} title="Reset to defaults" className="p-1.5 rounded-full hover:bg-white/10 text-[var(--text-secondary)]"><RotateCcw size={14} /></button>
                    <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-white/10 text-[var(--text-secondary)]"><X size={14} /></button>
                </div>
            </div>

            <Row
                label="Lyric timing"
                value={`${settings.lyricOffsetMs > 0 ? '+' : ''}${settings.lyricOffsetMs} ms`}
                hint="Negative lights each line earlier. Nudge until the highlight lands just as the word is sung."
            >
                <input
                    type="range"
                    min={-LYRIC_OFFSET_RANGE_MS}
                    max={LYRIC_OFFSET_RANGE_MS}
                    step={10}
                    value={settings.lyricOffsetMs}
                    onChange={e => onChange({ lyricOffsetMs: Number(e.target.value) })}
                    className="w-full accent-[var(--accent)]"
                    aria-label="Lyric timing offset"
                    data-testid="offset-slider"
                />
            </Row>

            <Row
                label="Recording latency"
                value={`${latencyMs} ms`}
                hint="Shifts new takes earlier to cancel the delay between pressing record and the mic hearing you. Wired headphones: ~50 ms. Bluetooth: 150 ms or more."
            >
                <input
                    type="range"
                    min={0}
                    max={500}
                    step={5}
                    value={latencyMs}
                    onChange={e => onChangeLatency(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                    aria-label="Recording latency"
                />
            </Row>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex flex-col">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Follow playback</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">Scroll the editor to the line being sung</span>
                </span>
                <input
                    type="checkbox"
                    checked={settings.followPlayback}
                    onChange={e => onChange({ followPlayback: e.target.checked })}
                    className="w-5 h-5 accent-[var(--accent)]"
                    aria-label="Follow playback"
                />
            </label>
        </div>
    );
}
