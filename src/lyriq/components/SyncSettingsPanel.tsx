import React, { useState } from 'react';
import { Headphones, Speaker, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import {
  SyncSettings,
  LYRIC_OFFSET_RANGE_MS,
  RECORDING_LATENCY_MAX_MS,
} from '../utils/settings';

interface Props {
  settings: SyncSettings;
  onChange: (patch: Partial<SyncSettings>) => void;
  onReset: () => void;
  className?: string;
}

function formatOffset(ms: number): string {
  if (ms === 0) return '0 ms';
  return `${ms > 0 ? '+' : ''}${ms} ms`;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">{label}</span>
        {hint && <span className="text-[10px] text-zinc-500 text-right">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function SyncSettingsPanel({ settings, onChange, onReset, className = '' }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const autoLatency = settings.recordingLatencyMs === null;

  return (
    <div
      role="dialog"
      aria-label="Audio and sync settings"
      className={`w-[min(92vw,20rem)] max-h-[70dvh] overflow-y-auto overscroll-contain rounded-2xl bg-[#141416]/98 border border-white/10 shadow-2xl p-4 flex flex-col gap-4 text-white select-none ${className}`}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <Row label="Mix">
        <label className="flex items-center gap-3 text-xs text-zinc-300 min-h-[32px]">
          <span className="w-10">Beat</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.beatVolume}
            onChange={e => onChange({ beatVolume: Number(e.target.value) })}
            className="flex-1 h-6 accent-amber-400 touch-pan-x cursor-pointer"
            aria-label="Beat volume"
          />
        </label>
        <label className="flex items-center gap-3 text-xs text-zinc-300 min-h-[32px]">
          <span className="w-10">Vocal</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.vocalVolume}
            onChange={e => onChange({ vocalVolume: Number(e.target.value) })}
            className="flex-1 h-6 accent-amber-400 touch-pan-x cursor-pointer"
            aria-label="Vocal volume"
          />
        </label>
      </Row>

      <Row label="Monitoring" hint={settings.headphones ? 'Clean vocal, no processing' : 'Echo cancellation on'}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ headphones: true })}
            aria-pressed={settings.headphones}
            className={`min-h-[40px] flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs border cursor-pointer transition-colors ${
              settings.headphones ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" /> Headphones
          </button>
          <button
            type="button"
            onClick={() => onChange({ headphones: false })}
            aria-pressed={!settings.headphones}
            className={`min-h-[40px] flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs border cursor-pointer transition-colors ${
              !settings.headphones ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <Speaker className="w-3.5 h-3.5" /> Speakers
          </button>
        </div>
      </Row>

      <div className="border-t border-white/10 pt-2.5 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(prev => !prev)}
          aria-expanded={showAdvanced}
          className="w-full min-h-[40px] flex items-center justify-between text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            {showAdvanced ? (
              <ChevronDown className="w-4 h-4 text-amber-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            )}
            <span>Advanced Timing &amp; Latency</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            {autoLatency ? 'Auto' : `${settings.recordingLatencyMs} ms`}
          </span>
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-4 pt-1">
            <Row label="Lyric timing" hint="Negative = lyrics appear earlier">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ lyricOffsetMs: settings.lyricOffsetMs - 10 })}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-sm cursor-pointer flex items-center justify-center shrink-0"
                  aria-label="Lyrics 10 milliseconds earlier"
                >
                  −
                </button>
                <input
                  type="range"
                  min={-LYRIC_OFFSET_RANGE_MS}
                  max={LYRIC_OFFSET_RANGE_MS}
                  step={10}
                  value={settings.lyricOffsetMs}
                  onChange={e => onChange({ lyricOffsetMs: Number(e.target.value) })}
                  className="flex-1 h-6 accent-amber-400 touch-pan-x cursor-pointer"
                  aria-label="Lyric timing offset in milliseconds"
                />
                <button
                  type="button"
                  onClick={() => onChange({ lyricOffsetMs: settings.lyricOffsetMs + 10 })}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-sm cursor-pointer flex items-center justify-center shrink-0"
                  aria-label="Lyrics 10 milliseconds later"
                >
                  +
                </button>
              </div>
              <span className="font-mono text-xs text-amber-400 text-center">{formatOffset(settings.lyricOffsetMs)}</span>
            </Row>

            <Row label="Recording latency" hint="Shifts new takes to line up with the beat">
              <label className="min-h-[36px] flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoLatency}
                  onChange={e => onChange({ recordingLatencyMs: e.target.checked ? null : 80 })}
                  className="w-4 h-4 accent-amber-400"
                />
                Use what the device reports
              </label>
              {!autoLatency && (
                <>
                  <input
                    type="range"
                    min={0}
                    max={RECORDING_LATENCY_MAX_MS}
                    step={5}
                    value={settings.recordingLatencyMs ?? 0}
                    onChange={e => onChange({ recordingLatencyMs: Number(e.target.value) })}
                    className="h-6 accent-amber-400 touch-pan-x cursor-pointer"
                    aria-label="Recording latency in milliseconds"
                  />
                  <span className="font-mono text-xs text-amber-400 text-center">{settings.recordingLatencyMs} ms</span>
                </>
              )}
            </Row>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="self-end min-h-[36px] px-2 inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
      >
        <RotateCcw className="w-3 h-3" /> Reset to defaults
      </button>
    </div>
  );
}
