import { lazy, memo, Suspense, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Mic,
  MicOff,
  AudioLines,
  Magnet,
  Repeat,
  RotateCw
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { SongSection, ImportedBeat, SectionType, getSectionTakeCode } from '../types';
import type { SyncSettings } from '../utils/settings';
import { activeTakeOf, findVocalAtTime, takeAnchorSec, type SectionTiming } from '../utils/timeline';
import {
  barDurationSec,
  barIndexToSec,
  getMinSectionSec,
  round3,
  snapTimeToDownbeat,
  type BeatGrid,
} from '../utils/arrangement';
import { Bars } from './Bars';

const SyncSettingsPanel = lazy(() => import('./SyncSettingsPanel'));

export interface MasterPlaybackDockProps {
  sections: SongSection[];
  activeSectionId: string | null;
  currentlyPlayingSectionId: string | null;
  currentTime: number;
  totalDuration: number;
  /** The app's resolved section windows; the dock never computes its own. */
  sectionTimings: SectionTiming[];
  isPlaying: boolean;
  isRecording: boolean;
  isCountingDown?: boolean;
  countdownVal?: number | null;
  importedBeat: ImportedBeat | null;
  activeTakeIndices: Record<string, number>;
  transcribingTakeIds?: Readonly<Record<string, true>>;
  onSeekToTime: (timeSec: number) => void;
  onTogglePlay: () => void;
  onToggleRecord: () => void;
  onCycleTake: (sectionId: string, direction: 1 | -1) => void;
  onRetryTranscription?: (sectionId: string, takeId: string) => void;
  isVocalMuted?: boolean;
  onToggleMuteVocal?: () => void;
  onOpenLiveLyrics?: () => void;
  syncSettings: SyncSettings;
  onChangeSyncSettings: (patch: Partial<SyncSettings>) => void;
  onResetSyncSettings: () => void;
  onMinimizedChange?: (minimized: boolean) => void;
  /** Hide the collapsed pill while a mobile virtual keyboard is up so it never crowds the accessory bar. */
  hideCollapsedPill?: boolean;
  bpm?: number;
  snapToGrid?: boolean;
  onToggleSnapToGrid?: () => void;
  onCommitSectionBoundary?: (boundaryIndex: number, newTimeSec: number) => void;
  onToggleSectionLoop?: (sectionId: string) => void;
}

export interface SectionColorPalette {
  solid: string;
  translucent: string;
  dim: string;
}

export function getSectionColorPalette(type?: SectionType): SectionColorPalette {
  switch (type) {
    case 'verse':
      return {
        solid: '#f59e0b', // Amber / Gold
        translucent: 'rgba(245, 158, 11, 0.55)',
        dim: 'rgba(245, 158, 11, 0.22)'
      };
    case 'chorus':
    case 'hook':
      return {
        solid: '#38bdf8', // Sky / Cyan
        translucent: 'rgba(56, 189, 248, 0.55)',
        dim: 'rgba(56, 189, 248, 0.22)'
      };
    case 'bridge':
      return {
        solid: '#a855f7', // Purple / Violet
        translucent: 'rgba(168, 85, 247, 0.55)',
        dim: 'rgba(168, 85, 247, 0.22)'
      };
    case 'pre-chorus':
      return {
        solid: '#34d399', // Emerald / Mint
        translucent: 'rgba(52, 211, 153, 0.55)',
        dim: 'rgba(52, 211, 153, 0.22)'
      };
    case 'intro':
      return {
        solid: '#fb7185', // Coral / Rose
        translucent: 'rgba(251, 113, 133, 0.55)',
        dim: 'rgba(251, 113, 133, 0.22)'
      };
    case 'outro':
      return {
        solid: '#818cf8', // Indigo / Lavender
        translucent: 'rgba(129, 140, 248, 0.55)',
        dim: 'rgba(129, 140, 248, 0.22)'
      };
    default:
      return {
        solid: '#f59e0b',
        translucent: 'rgba(245, 158, 11, 0.55)',
        dim: 'rgba(245, 158, 11, 0.22)'
      };
  }
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function MasterPlaybackDock({
  sections,
  activeSectionId,
  currentlyPlayingSectionId,
  currentTime,
  totalDuration,
  sectionTimings: resolvedTimings,
  isPlaying,
  isRecording,
  isCountingDown = false,
  countdownVal = null,
  importedBeat,
  activeTakeIndices,
  transcribingTakeIds,
  onSeekToTime,
  onTogglePlay,
  onToggleRecord,
  onCycleTake,
  onRetryTranscription,
  isVocalMuted = false,
  onToggleMuteVocal,
  onOpenLiveLyrics,
  syncSettings,
  onChangeSyncSettings,
  onResetSyncSettings,
  onMinimizedChange,
  hideCollapsedPill = false,
  bpm = 120,
  snapToGrid = true,
  onToggleSnapToGrid,
  onCommitSectionBoundary,
  onToggleSectionLoop,
}: MasterPlaybackDockProps) {
  const dragControls = useDragControls();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Starts minimized as the floating pill at the bottom
  const [isMinimized, setIsMinimized] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null);
  const boundaryDragRef = useRef<{
    index: number;
    timeSec: number;
    minSec: number;
    maxSec: number;
    snapped: boolean;
  } | null>(null);
  const hoveredBoundaryRef = useRef<number | null>(null);
  const [isBoundaryCursor, setIsBoundaryCursor] = useState(false);
  const [dragBoundaryFeedback, setDragBoundaryFeedback] = useState<{ timeSec: number; snapped: boolean } | null>(null);

  // Auto-expand dock when countdown or recording begins so user sees real-time wave & controls
  useEffect(() => {
    if (isRecording || isCountingDown) {
      setIsMinimized(false);
    }
  }, [isRecording, isCountingDown]);

  useEffect(() => {
    onMinimizedChange?.(isMinimized);
  }, [isMinimized, onMinimizedChange]);

  // Active section resolution
  const effectiveSectionId = currentlyPlayingSectionId || activeSectionId || sections[0]?.id;
  const activeSection = sections.find(s => s.id === effectiveSectionId) || sections[0];

  // If the current section has no takes of its own, fall back to any take spanning currentTime (e.g. full-beat vocal)
  const takeSection = useMemo(() => {
    if ((activeSection?.voiceNotes?.length ?? 0) > 0) return activeSection;
    const hit =
      findVocalAtTime(sections, resolvedTimings, activeTakeIndices, currentTime) ??
      (totalDuration > 0 && currentTime >= totalDuration
        ? findVocalAtTime(sections, resolvedTimings, activeTakeIndices, Math.max(0, totalDuration - 0.05))
        : null);
    if (hit) {
      return sections.find(s => s.id === hit.sectionId) || activeSection;
    }
    return activeSection;
  }, [activeSection, sections, resolvedTimings, activeTakeIndices, currentTime, totalDuration]);

  const activeTakes = takeSection?.voiceNotes || [];
  const currentTakeIdx = takeSection ? (activeTakeIndices[takeSection.id] ?? 0) : 0;
  const currentTake = activeTakes[currentTakeIdx];
  const isCurrentTakeTranscribing = Boolean(
    currentTake && (transcribingTakeIds?.[currentTake.id] || currentTake.transcriptionStatus === 'pending')
  );
  const isCurrentTakeTranscriptionFailed = Boolean(
    currentTake && !isCurrentTakeTranscribing && currentTake.transcriptionStatus === 'failed'
  );

  // Concise first-letter take codes (e.g. V1, V2, H1, I1)
  const recordingTakeCode = activeSection ? getSectionTakeCode(activeSection.type, activeSection.voiceNotes?.length ?? 0) : 'V1';
  const currentTakeCode = takeSection ? getSectionTakeCode(takeSection.type, currentTakeIdx) : 'V1';

  // Global Esc shortcut to toggle dock minimize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        setIsSettingsOpen(false);
        setIsMinimized(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const beatWaveform = importedBeat?.waveform || [];
  const hasBeatAudio = Boolean(importedBeat?.audioUrl || beatWaveform.length > 0);
  const hasAnyTakes = useMemo(
    () => sections.some(s => (s.voiceNotes || []).some(take => Boolean(take.audioUrl || (take.waveform && take.waveform.length > 0)))),
    [sections]
  );
  const hasRealAudio = hasBeatAudio || hasAnyTakes;

  // Same length and section windows as the rest of the app (one source of truth).
  // Clamped to 1s only so drawing never divides by zero.
  const effectiveDuration = Math.max(1, totalDuration);
  // Without a beat, takes or timed sections the length is only a placeholder, so it isn't shown.
  const hasTimeline = hasRealAudio || sections.some(s => s.endTimeSec !== undefined);

  const sectionTimings = useMemo(() => {
    return resolvedTimings.map(t => {
      const sec = sections.find(s => s.id === t.id);
      return { id: t.id, start: t.start, end: t.end, type: sec?.type, hasTakes: (sec?.voiceNotes?.length || 0) > 0 };
    });
  }, [resolvedTimings, sections]);

  const activeBeatGrid = useMemo<BeatGrid | null>(() => {
    const gridBpm = importedBeat?.bpm && importedBeat.bpm >= 40 && importedBeat.bpm <= 240
      ? importedBeat.bpm
      : bpm >= 40 && bpm <= 240
        ? bpm
        : 0;
    if (!gridBpm) return null;
    return {
      bpm: gridBpm,
      gridOriginSec: importedBeat?.gridOriginSec ?? 0,
      confidence: importedBeat?.bpmConfidence,
    };
  }, [importedBeat?.bpm, importedBeat?.gridOriginSec, importedBeat?.bpmConfidence, bpm]);

  const canDragBoundaries = Boolean(
    onCommitSectionBoundary &&
    !isRecording &&
    !isCountingDown &&
    hasTimeline &&
    sectionTimings.length > 1 &&
    effectiveDuration > 0
  );

  const activeVocalSpans = useMemo(() => {
    return sections
      .map(section => {
        const take = activeTakeOf(section, activeTakeIndices);
        if (!take || (!take.audioUrl && (!take.waveform || take.waveform.length === 0))) return null;
        const timing = sectionTimings.find(st => st.id === section.id);
        const anchor = takeAnchorSec(take, timing?.start ?? 0);
        const duration = take.duration > 0 ? take.duration : Math.max(0.1, (timing?.end ?? anchor + 1) - anchor);
        return {
          sectionId: section.id,
          take,
          anchor,
          duration,
          waveform: take.waveform || [],
        };
      })
      .filter((span): span is NonNullable<typeof span> => span !== null);
  }, [sections, activeTakeIndices, sectionTimings]);

  // High-DPI Continuous Waveform Rendering
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const width = rect.width;
    const height = rect.height;
    const barWidth = 2.5;
    const barGap = 2;
    const step = barWidth + barGap;
    const barCount = Math.floor(width / step);

    const isActivelyScrubbing = isDraggingRef.current && scrubPreviewTime !== null;
    const displayTime = isActivelyScrubbing ? scrubPreviewTime : currentTime;
    const playheadX = effectiveDuration > 0
      ? Math.min(width, Math.max(0, (displayTime / effectiveDuration) * width))
      : 0;

    // Live 60fps preview timings: reflects any in-flight boundary drag without touching React state
    const activeDrag = boundaryDragRef.current;
    const renderTimings = activeDrag
      ? sectionTimings.map((st, idx) => {
          if (idx === activeDrag.index - 1) return { ...st, end: activeDrag.timeSec };
          if (idx === activeDrag.index) return { ...st, start: activeDrag.timeSec };
          return st;
        })
      : sectionTimings;

    if (hasRealAudio && effectiveDuration > 0) {
      if (hasBeatAudio) {
        // Dual-Lane: Top Lane = Vocal Takes, Bottom Lane = Backing Beat
        const midY = Math.floor(height / 2);
        const topCenterY = midY / 2;
        const topMaxBarH = Math.max(4, midY - 4);
        const bottomCenterY = midY + (height - midY) / 2;
        const bottomMaxBarH = Math.max(4, height - midY - 4);

        for (let i = 0; i < barCount; i++) {
          const x = i * step;
          const barTime = (x / width) * effectiveDuration;

          // Determine which section this bar belongs to (retaining section colors across both lanes)
          const sectionMatch = renderTimings.find(st => barTime >= st.start && barTime < st.end);
          const sectionPalette = getSectionColorPalette(sectionMatch?.type);
          const isActiveSection = Boolean(sectionMatch && sectionMatch.id === activeSection?.id);
          const isPast = barTime <= displayTime;

          let barColor: string;
          if (isActiveSection) {
            barColor = isPast ? sectionPalette.solid : sectionPalette.translucent;
          } else {
            barColor = isPast ? sectionPalette.translucent : sectionPalette.dim;
          }

          // Top Row: Vocal Takes
          const vocalHit = activeVocalSpans.find(s => barTime >= s.anchor && barTime < (s.anchor + s.duration));
          if (vocalHit) {
            let vocalNorm = 0.25;
            if (vocalHit.waveform.length > 0) {
              const vocalProgress = Math.max(0, Math.min(1, (barTime - vocalHit.anchor) / Math.max(0.01, vocalHit.duration)));
              const waveIdx = Math.floor(vocalProgress * vocalHit.waveform.length);
              vocalNorm = Math.max(0.12, Math.min(1.0, (vocalHit.waveform[waveIdx] || 15) / 100));
            }
            const vocalBarH = Math.max(3, vocalNorm * topMaxBarH);
            const vocalY = topCenterY - vocalBarH / 2;

            ctx.fillStyle = isVocalMuted ? (isPast ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)') : barColor;
            ctx.beginPath();
            ctx.roundRect(x, vocalY, barWidth, vocalBarH, 1.2);
            ctx.fill();
          } else {
            // Subtle resting baseline for vocal row when silence / no take
            ctx.fillStyle = isPast ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
            ctx.beginPath();
            ctx.roundRect(x, topCenterY - 1, barWidth, 2, 1);
            ctx.fill();
          }

          // Bottom Row: Backing Beat
          let beatNorm = 0.12;
          if (beatWaveform.length > 0) {
            const waveIdx = Math.floor((i / barCount) * beatWaveform.length);
            beatNorm = Math.max(0.12, Math.min(1.0, (beatWaveform[waveIdx] || 15) / 100));
          }
          const beatBarH = Math.max(3, beatNorm * bottomMaxBarH);
          const beatY = bottomCenterY - beatBarH / 2;

          ctx.fillStyle = barColor;
          ctx.beginPath();
          ctx.roundRect(x, beatY, barWidth, beatBarH, 1.2);
          ctx.fill();
        }

        // Horizontal hairline divider separating Vocal and Beat lanes
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
        ctx.lineWidth = 1;
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
      } else {
        // Single Full-Height Lane: Vocal Take (no beat imported)
        for (let i = 0; i < barCount; i++) {
          const x = i * step;
          const barTime = (x / width) * effectiveDuration;

          const sectionMatch = renderTimings.find(st => barTime >= st.start && barTime < st.end);
          const sectionPalette = getSectionColorPalette(sectionMatch?.type);
          const isActiveSection = Boolean(sectionMatch && sectionMatch.id === activeSection?.id);
          const isPast = barTime <= displayTime;

          let barColor: string;
          if (isActiveSection) {
            barColor = isPast ? sectionPalette.solid : sectionPalette.translucent;
          } else {
            barColor = isPast ? sectionPalette.translucent : sectionPalette.dim;
          }

          const vocalHit = activeVocalSpans.find(s => barTime >= s.anchor && barTime < (s.anchor + s.duration));
          let normalizedAmp = 0.08;
          if (vocalHit && vocalHit.waveform.length > 0) {
            const vocalProgress = Math.max(0, Math.min(1, (barTime - vocalHit.anchor) / Math.max(0.01, vocalHit.duration)));
            const waveIdx = Math.floor(vocalProgress * vocalHit.waveform.length);
            normalizedAmp = Math.max(0.12, Math.min(1.0, (vocalHit.waveform[waveIdx] || 15) / 100));
          } else if (vocalHit) {
            normalizedAmp = 0.25;
          }

          const barH = Math.max(4, normalizedAmp * (height - 10));
          const y = (height - barH) / 2;

          ctx.fillStyle = isVocalMuted ? (isPast ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)') : barColor;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barH, 1.2);
          ctx.fill();
        }
      }
    } else {
      // 1B. Minimalist Apple Arrangement Timeline Ribbon with Section Color Zoning
      const centerY = height / 2;
      const trackHeight = 4;
      const trackY = centerY - trackHeight / 2;

      // Base Track: Render subtle color segments for each section type across timeline
      if (renderTimings.length > 0) {
        renderTimings.forEach((st) => {
          const secStartX = (st.start / effectiveDuration) * width;
          const secEndX = (st.end / effectiveDuration) * width;
          const secW = Math.max(2, secEndX - secStartX);
          const secPalette = getSectionColorPalette(st.type);
          const isCurrent = st.id === activeSection?.id;

          ctx.fillStyle = isCurrent ? secPalette.translucent : secPalette.dim;
          ctx.beginPath();
          ctx.roundRect(secStartX, trackY, secW, trackHeight, 2);
          ctx.fill();
        });
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(0, trackY, width, trackHeight, 2);
        ctx.fill();
      }

      // Elapsed Progress (Highlighted with active section color)
      if (playheadX > 0) {
        const activePalette = getSectionColorPalette(activeSection?.type);
        ctx.fillStyle = activePalette.solid;
        ctx.beginPath();
        ctx.roundRect(0, trackY, Math.min(width, playheadX), trackHeight, 2);
        ctx.fill();
      }
    }

    // 1C. Subtle bar-grid ticks while dragging a section boundary with grid snap active
    if (activeDrag && snapToGrid && activeBeatGrid && effectiveDuration > 0) {
      const barSec = barDurationSec(activeBeatGrid.bpm);
      const maxBars = Math.min(256, Math.ceil(effectiveDuration / barSec) + 1);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.lineWidth = 1;
      for (let b = 0; b <= maxBars; b++) {
        const barTime = barIndexToSec(b, activeBeatGrid);
        if (barTime <= 0 || barTime >= effectiveDuration) continue;
        const bx = (barTime / effectiveDuration) * width;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, 5);
        ctx.moveTo(bx, height - 5);
        ctx.lineTo(bx, height);
        ctx.stroke();
      }
    }

    // 2. Section Partition Dividers & Draggable Boundary Handles
    if (hasTimeline && effectiveDuration > 0) {
      renderTimings.forEach((st, idx) => {
        if (idx === 0) return;
        const startX = (st.start / effectiveDuration) * width;
        if (startX > 0 && startX < width) {
          const isDragged = activeDrag?.index === idx;
          const isHovered = hoveredBoundaryRef.current === idx;
          ctx.beginPath();
          ctx.strokeStyle = isDragged
            ? '#f59e0b'
            : isHovered
              ? 'rgba(245, 158, 11, 0.85)'
              : 'rgba(255, 255, 255, 0.24)';
          ctx.lineWidth = isDragged ? 2 : isHovered ? 1.5 : 1;
          ctx.moveTo(startX, 0);
          ctx.lineTo(startX, height);
          ctx.stroke();

          // Subtle top/bottom handle caps so draggable boundaries are discoverable
          if (canDragBoundaries) {
            ctx.fillStyle = isDragged
              ? '#fbbf24'
              : isHovered
                ? 'rgba(245, 158, 11, 0.9)'
                : 'rgba(255, 255, 255, 0.35)';
            const capW = isDragged || isHovered ? 4 : 3;
            const capH = isDragged || isHovered ? 6 : 4;
            ctx.beginPath();
            ctx.roundRect(startX - capW / 2, 0, capW, capH, 1.5);
            ctx.roundRect(startX - capW / 2, height - capH, capW, capH, 1.5);
            ctx.fill();
          }
        }
      });
    }

    // 3. High-Precision Playhead Indicator
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead thumb knob
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(playheadX, height / 2, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Inner core of thumb
    ctx.fillStyle = isPlaying ? '#f59e0b' : '#18181b';
    ctx.beginPath();
    ctx.arc(playheadX, height / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [currentTime, scrubPreviewTime, effectiveDuration, sectionTimings, beatWaveform, hasBeatAudio, hasRealAudio, hasTimeline, activeVocalSpans, activeSection, isPlaying, isVocalMuted, canDragBoundaries, snapToGrid, activeBeatGrid]);

  const drawWaveformRef = useRef(drawWaveform);
  drawWaveformRef.current = drawWaveform;

  const rafRef = useRef<number | null>(null);
  const scheduleDraw = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      drawWaveformRef.current();
    });
  }, []);

  const scrubClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (scrubClearTimerRef.current) clearTimeout(scrubClearTimerRef.current);
    };
  }, []);

  // ResizeObserver created only when the expanded canvas mounts (never torn down on 20Hz ticks)
  useEffect(() => {
    if (isMinimized) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => {
      scheduleDraw();
    });
    ro.observe(canvas);

    return () => ro.disconnect();
  }, [isMinimized, scheduleDraw]);

  // Redraw waveform on playhead or state update smoothly via rAF
  useEffect(() => {
    if (!isMinimized) scheduleDraw();
  }, [isMinimized, drawWaveform, scheduleDraw]);

  // --- SCRUBBING / TIME SEEKING ENGINE ---
  const lastSeekEmitTimeRef = useRef<number>(0);
  const pendingSeekTargetRef = useRef<number | null>(null);
  /** Last target actually sent, so releasing a tap doesn't seek a second time. */
  const lastEmittedTargetRef = useRef<number | null>(null);

  const handleScrub = useCallback((clientX: number, isDirectCommit: boolean = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;

    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = clickX / rect.width;
    const targetTime = ratio * effectiveDuration;

    if (scrubClearTimerRef.current) {
      clearTimeout(scrubClearTimerRef.current);
    }

    setScrubPreviewTime(targetTime);
    pendingSeekTargetRef.current = targetTime;

    const now = performance.now();
    // Direct commit on tap/click or throttle to ~80ms during continuous swipe to prevent audio decoder stalls on mobile
    if (isDirectCommit || now - lastSeekEmitTimeRef.current > 80) {
      lastSeekEmitTimeRef.current = now;
      lastEmittedTargetRef.current = targetTime;
      onSeekToTime(targetTime);
    }
  }, [effectiveDuration, onSeekToTime]);

  const handleScrubEnd = useCallback(() => {
    const wasDragging = isDraggingRef.current;
    isDraggingRef.current = false;
    const target = pendingSeekTargetRef.current;
    if (wasDragging && target !== null && target !== lastEmittedTargetRef.current) {
      onSeekToTime(target);
    }
    lastEmittedTargetRef.current = null;
    if (scrubClearTimerRef.current) {
      clearTimeout(scrubClearTimerRef.current);
    }
    setScrubPreviewTime(null);
    pendingSeekTargetRef.current = null;
  }, [onSeekToTime]);

  // --- SECTION BOUNDARY DRAGGING (60fps ref preview -> commit on pointerup) ---
  const hitTestBoundary = useCallback(
    (clientX: number, pointerType: string): number | null => {
      if (!canDragBoundaries) return null;
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const x = clientX - rect.left;
      const hitRadius = pointerType === 'touch' ? 22 : 9;
      let bestIdx: number | null = null;
      let bestDist = hitRadius;
      for (let i = 1; i < sectionTimings.length; i++) {
        const dividerX = (sectionTimings[i].start / effectiveDuration) * rect.width;
        const dist = Math.abs(x - dividerX);
        if (dist <= bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      return bestIdx;
    },
    [canDragBoundaries, sectionTimings, effectiveDuration]
  );

  const updateBoundaryDrag = useCallback(
    (clientX: number, freeOverride: boolean) => {
      const drag = boundaryDragRef.current;
      const canvas = canvasRef.current;
      if (!drag || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;

      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const rawTime = (clickX / rect.width) * effectiveDuration;
      const useSnap = snapToGrid && !freeOverride;
      const snapped = snapTimeToDownbeat(rawTime, activeBeatGrid, {
        enabled: useSnap,
        minSec: drag.minSec,
        maxSec: drag.maxSec,
      });
      const clamped = round3(Math.max(drag.minSec, Math.min(drag.maxSec, snapped)));
      drag.timeSec = clamped;
      drag.snapped = useSnap && Math.abs(clamped - rawTime) > 0.005;
      setDragBoundaryFeedback({ timeSec: clamped, snapped: drag.snapped });
      scheduleDraw();
    },
    [effectiveDuration, snapToGrid, activeBeatGrid, scheduleDraw]
  );

  const finishBoundaryDrag = useCallback(
    (commit: boolean) => {
      const drag = boundaryDragRef.current;
      boundaryDragRef.current = null;
      setDragBoundaryFeedback(null);
      if (commit && drag && onCommitSectionBoundary) {
        onCommitSectionBoundary(drag.index, drag.timeSec);
      }
      scheduleDraw();
    },
    [onCommitSectionBoundary, scheduleDraw]
  );

  // Cancel any in-flight boundary drag or scrub immediately if recording/count-in starts
  useEffect(() => {
    if (isRecording || isCountingDown) {
      if (boundaryDragRef.current) {
        boundaryDragRef.current = null;
        setDragBoundaryFeedback(null);
        scheduleDraw();
      }
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        pendingSeekTargetRef.current = null;
        setScrubPreviewTime(null);
      }
    }
  }, [isRecording, isCountingDown, scheduleDraw]);

  // Clear any lingering preview time whenever playback starts or active time updates
  useEffect(() => {
    if (isPlaying && !isDraggingRef.current) {
      setScrubPreviewTime(null);
    }
  }, [isPlaying]);

  // Scrubbing uses pointer events only: one event stream covers mouse, touch and
  // pen, and pointer capture keeps a drag tracking outside the canvas. Adding
  // mouse/touch handlers too would fire every tap two or three times.

  // --- RENDER DOCK WITH SMOOTH SPRING ANIMATION ---
  return (
    <AnimatePresence mode="wait">
      {isMinimized ? (
        !hideCollapsedPill && (
          <div
            key="collapsed-pill-wrapper"
            className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none px-4"
          >
            <motion.div
              key="collapsed-pill"
              initial={{ opacity: 0, scale: 0.9, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 14 }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              className="pointer-events-auto ios-glass border border-white/12 rounded-full shadow-[0_14px_38px_rgba(0,0,0,0.78)] flex items-center p-1"
            >
              {/* Direct 1-tap Record button */}
              <button
                type="button"
                onClick={onToggleRecord}
                className="min-h-[44px] pl-4 pr-3.5 rounded-full flex items-center gap-2 text-xs font-medium text-white hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                title={isCountingDown ? 'Cancel Pre-Roll' : isRecording ? 'Stop Recording' : 'Start Recording'}
                aria-label={isCountingDown ? 'Cancel Pre-Roll' : isRecording ? 'Stop Recording' : 'Start Recording'}
              >
                {isRecording ? (
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#ff453a] animate-pulse shadow-[0_0_8px_rgba(255,69,58,0.9)] shrink-0" />
                ) : isCountingDown ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff453a] shadow-[0_0_8px_rgba(255,69,58,0.65)] shrink-0" />
                )}
                <span className="text-xs font-semibold tracking-tight text-white">
                  {isCountingDown
                    ? `Pre-Roll ${countdownVal ?? 3}`
                    : isRecording
                      ? `Rec ${recordingTakeCode}`
                      : 'Record'}
                </span>
              </button>

              <span className="w-px h-4 bg-white/12 shrink-0" aria-hidden="true" />

              {/* Time & Expand Playback Dock */}
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="min-h-[44px] pl-3.5 pr-4 rounded-full flex items-center gap-1.5 text-xs hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer group whitespace-nowrap"
                title="Expand playback & waveform dock (Esc)"
                aria-label="Expand playback and waveform dock"
              >
                <span className={`font-mono tabular-nums text-xs ${isPlaying ? 'text-amber-400 font-medium' : 'text-zinc-300'}`}>
                  {formatTime(currentTime)}
                </span>
                <ChevronUp className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 transition-colors shrink-0" />
              </button>
            </motion.div>
          </div>
        )
      ) : (
        <motion.div
          key="full-dock"
          id="master-playback-dock"
          ref={containerRef}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (!isRecording && !isCountingDown && (info.offset.y > 40 || info.velocity.y > 300)) {
              setIsMinimized(true);
            }
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-5 inset-x-3 sm:inset-x-6 max-w-xl mx-auto z-40 rounded-3xl bg-[#141416]/95 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] pt-1.5 pb-3.5 sm:pb-4 px-3.5 sm:px-5 select-none"
        >
          {/* Tactile Swipe Handle (sole vertical drag initiator so touch waveform/buttons never conflict) */}
          <div
            onPointerDown={(e) => {
              if (!isRecording && !isCountingDown) {
                dragControls.start(e);
              }
            }}
            onClick={() => setIsMinimized(true)}
            className="w-full flex items-center justify-center py-2 -mt-0.5 cursor-pointer group touch-none"
            title="Swipe or tap to minimize (Esc)"
          >
            <div className="w-11 h-1.5 rounded-full bg-white/25 group-hover:bg-white/50 group-active:bg-white/70 transition-colors" />
          </div>

          {isSettingsOpen && (
            <Suspense fallback={null}>
              <SyncSettingsPanel
                settings={syncSettings}
                onChange={onChangeSyncSettings}
                onReset={onResetSyncSettings}
                className="absolute bottom-full right-0 mb-2"
              />
            </Suspense>
          )}

          <div className="w-full flex flex-col gap-2">
            
            {/* 1. Section Header & Time */}
            <div className="flex items-center justify-between gap-2 text-xs min-h-[36px]">
              {/* Left: Active section pill */}
              <div className="flex items-center gap-2 min-w-0 shrink">
                {activeSection && (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                      isPlaying ? 'animate-pulse' : ''
                    }`}
                    style={{
                      backgroundColor: getSectionColorPalette(activeSection.type).solid,
                      boxShadow: isPlaying
                        ? `0 0 8px ${getSectionColorPalette(activeSection.type).solid}`
                        : undefined
                    }}
                  />
                )}
                <span className="font-semibold uppercase tracking-wider text-xs text-white truncate">
                  {activeSection?.type.toUpperCase() || 'STANZA'}
                </span>
              </div>

              {/* Right: loop + grid snap + settings + time */}
              <div className="ml-auto flex items-center gap-0.5">
                {activeSection && onToggleSectionLoop && (
                  <button
                    type="button"
                    onClick={() => onToggleSectionLoop(activeSection.id)}
                    aria-pressed={Boolean(activeSection.isLooping)}
                    className={`min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center cursor-pointer transition-colors active:scale-95 ${
                      activeSection.isLooping
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                    title={activeSection.isLooping ? 'Section loop: On (tap to disable)' : 'Loop this section'}
                    aria-label={activeSection.isLooping ? 'Disable section loop' : 'Loop this section'}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>
                )}
                {canDragBoundaries && onToggleSnapToGrid && (
                  <button
                    type="button"
                    onClick={onToggleSnapToGrid}
                    aria-pressed={snapToGrid}
                    className={`min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center cursor-pointer transition-colors active:scale-95 ${
                      snapToGrid ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                    title={snapToGrid ? 'Downbeat snap: On (hold Alt to drag freely)' : 'Downbeat snap: Off'}
                    aria-label={snapToGrid ? 'Disable downbeat grid snap' : 'Enable downbeat grid snap'}
                  >
                    <Magnet className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(v => !v)}
                  aria-expanded={isSettingsOpen}
                  className={`min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center cursor-pointer transition-colors active:scale-95 ${
                    isSettingsOpen ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                  title="Audio and sync settings"
                  aria-label="Audio and sync settings"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="min-h-[36px] pl-1 flex items-center gap-1 font-mono text-xs tracking-tight whitespace-nowrap shrink-0 cursor-pointer text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Click to minimize (Esc)"
                aria-label="Minimize playback dock"
              >
                <span className="text-white font-medium tabular-nums">
                  {formatTime(
                    dragBoundaryFeedback !== null
                      ? dragBoundaryFeedback.timeSec
                      : isDraggingRef.current && scrubPreviewTime !== null
                        ? scrubPreviewTime
                        : currentTime
                  )}
                </span>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-400 tabular-nums">
                  {hasTimeline ? formatTime(totalDuration) : '–:––'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 ml-0.5" />
              </button>
            </div>

            {/* 2. Waveform ribbon with dual-lane display, section splits & draggable boundaries */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className={`relative w-full h-12 rounded-xl bg-black/55 border border-white/[0.08] overflow-visible group touch-none ${
                isRecording || isCountingDown
                  ? 'cursor-default'
                  : isBoundaryCursor
                    ? 'cursor-ew-resize'
                    : 'cursor-pointer'
              }`}
            >
              {dragBoundaryFeedback !== null && (
                <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-full bg-zinc-900/95 border border-amber-500/40 text-[11px] font-mono text-amber-300 shadow-lg whitespace-nowrap">
                  {formatTime(dragBoundaryFeedback.timeSec)}
                  {dragBoundaryFeedback.snapped ? ' • Bar' : ''}
                </div>
              )}
              <div className="relative w-full h-full rounded-xl overflow-hidden touch-none">
              {hasBeatAudio && (
                <div className="absolute inset-x-2 top-0 bottom-0 pointer-events-none flex flex-col justify-between py-1.5 select-none z-10">
                  <div className="flex items-center">
                    {isVocalMuted ? (
                      <MicOff className="w-2.5 h-2.5 text-zinc-500/85" aria-label="Vocals muted" />
                    ) : (
                      <Mic className="w-2.5 h-2.5 text-amber-400/85" aria-label="Vocals" />
                    )}
                  </div>
                  <div className="flex items-center">
                    <AudioLines className="w-2.5 h-2.5 text-zinc-400/85" aria-label="Beat audio" />
                  </div>
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="w-full h-full block touch-none"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (isRecording || isCountingDown) return;
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
                  const hitIdx = hitTestBoundary(e.clientX, e.pointerType);
                  if (hitIdx !== null) {
                    const minSec = getMinSectionSec(activeBeatGrid);
                    const left = sectionTimings[hitIdx - 1];
                    const right = sectionTimings[hitIdx];
                    const minBound = round3(left.start + minSec);
                    const maxBound = round3(right.end - minSec);
                    if (minBound < maxBound) {
                      boundaryDragRef.current = {
                        index: hitIdx,
                        timeSec: right.start,
                        minSec: minBound,
                        maxSec: maxBound,
                        snapped: false,
                      };
                      setIsBoundaryCursor(true);
                      updateBoundaryDrag(e.clientX, e.altKey);
                      return;
                    }
                  }
                  isDraggingRef.current = true;
                  handleScrub(e.clientX, true);
                }}
                onPointerMove={(e) => {
                  if (boundaryDragRef.current) {
                    updateBoundaryDrag(e.clientX, e.altKey);
                    return;
                  }
                  if (isDraggingRef.current) {
                    handleScrub(e.clientX, false);
                    return;
                  }
                  if (e.pointerType !== 'touch') {
                    const hitIdx = hitTestBoundary(e.clientX, e.pointerType);
                    if (hoveredBoundaryRef.current !== hitIdx) {
                      hoveredBoundaryRef.current = hitIdx;
                      setIsBoundaryCursor(hitIdx !== null);
                      scheduleDraw();
                    }
                  }
                }}
                onPointerLeave={() => {
                  if (!boundaryDragRef.current && hoveredBoundaryRef.current !== null) {
                    hoveredBoundaryRef.current = null;
                    setIsBoundaryCursor(false);
                    scheduleDraw();
                  }
                }}
                onPointerUp={(e) => {
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
                  if (boundaryDragRef.current) {
                    finishBoundaryDrag(true);
                    setIsBoundaryCursor(false);
                    return;
                  }
                  handleScrubEnd();
                }}
                onPointerCancel={(e) => {
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
                  if (boundaryDragRef.current) {
                    finishBoundaryDrag(false);
                    setIsBoundaryCursor(false);
                    return;
                  }
                  handleScrubEnd();
                }}
              />
              </div>
            </div>

            {/* 3. Transport: play, take switcher or beat status, record */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              
              {/* Left Transport: Single Play/Pause Button */}
              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={onTogglePlay}
                  disabled={isRecording || isCountingDown}
                  className="w-12 h-12 sm:w-11 sm:h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                  title={isRecording || isCountingDown ? 'Use the record button to stop' : isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-black ml-0.5" />
                  )}
                </button>
              </div>

              {/* Center: Dynamic Contextual Status */}
              <div className="flex-1 flex items-center justify-center min-w-0 px-1 text-center">
                {isCountingDown ? (
                  /* Non-obtrusive 3-2-1 Countdown Pill */
                  <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/35 rounded-full px-3.5 py-2 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span className="font-mono text-xs font-bold text-amber-400 tracking-wider">
                      PRE-ROLL {countdownVal ?? 3}
                    </span>
                  </div>
                ) : isRecording ? (
                  /* Live Recording Indicator */
                  <div className="inline-flex items-center gap-2 bg-red-500/15 border border-red-500/35 rounded-full px-3.5 py-2 shadow-[0_0_12px_rgba(255,69,58,0.25)]">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="font-mono text-xs font-bold text-red-400 tracking-wider">
                      REC {recordingTakeCode}
                    </span>
                  </div>
                ) : activeTakes.length > 0 ? (
                  /* Take switcher (< V1 >) with vocal mute */
                  <div className="inline-flex items-center gap-0.5 bg-[#1b1b1d] border border-white/[0.08] rounded-full px-1.5 py-1 shadow-sm">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (takeSection) onCycleTake(takeSection.id, -1); }}
                      disabled={activeTakes.length <= 1 || isRecording || isCountingDown}
                      className="min-w-[34px] min-h-[34px] rounded-full flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed active:scale-90 transition-all cursor-pointer"
                      title="Previous take"
                      aria-label="Previous take"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenLiveLyrics?.()}
                      aria-busy={isCurrentTakeTranscribing || undefined}
                      className="min-h-[34px] inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-amber-400 hover:text-amber-300 px-2 cursor-pointer transition-colors whitespace-nowrap active:scale-95"
                      title={isCurrentTakeTranscribing ? 'Transcribing take…' : 'View timed lyrics'}
                    >
                      <span>{currentTakeCode}</span>
                      {isCurrentTakeTranscribing && <Bars className="h-2.5 w-3 text-amber-400" />}
                    </button>
                    {isCurrentTakeTranscriptionFailed && takeSection && currentTake && onRetryTranscription && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetryTranscription(takeSection.id, currentTake.id);
                        }}
                        className="min-h-[28px] inline-flex items-center gap-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-2 py-0.5 text-[11px] font-medium text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer active:scale-95 whitespace-nowrap"
                        title="Retry lyrics transcription"
                        aria-label={`Retry transcription for ${currentTakeCode}`}
                      >
                        <RotateCw className="w-3 h-3 shrink-0" />
                        <span>Retry</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (takeSection) onCycleTake(takeSection.id, 1); }}
                      disabled={activeTakes.length <= 1 || isRecording || isCountingDown}
                      className="min-w-[34px] min-h-[34px] rounded-full flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed active:scale-90 transition-all cursor-pointer"
                      title="Next take"
                      aria-label="Next take"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    {onToggleMuteVocal && (
                      <>
                        <span className="w-px h-4 bg-white/10 mx-0.5" />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onToggleMuteVocal(); }}
                          aria-pressed={isVocalMuted}
                          className={`min-w-[34px] min-h-[34px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${isVocalMuted ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-300 hover:text-white'}`}
                          title={isVocalMuted ? 'Unmute vocals' : 'Mute vocals (hear the beat solo)'}
                          aria-label={isVocalMuted ? 'Unmute vocals' : 'Mute vocals'}
                        >
                          {isVocalMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Right Transport: Authentic iOS Voice Memos Record Button */}
              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={onToggleRecord}
                  className={`w-12 h-12 sm:w-11 sm:h-11 rounded-full border-2 p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer group ${
                    isCountingDown
                      ? 'border-amber-400/80 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                      : 'border-white/85 shadow-[0_0_12px_rgba(255,69,58,0.25)]'
                  }`}
                  title={isCountingDown ? 'Cancel Pre-Roll' : isRecording ? 'Stop Recording' : 'Record Voice Memo'}
                  aria-label={isCountingDown ? 'Cancel Pre-Roll' : isRecording ? 'Stop Recording' : 'Record Voice Memo'}
                >
                  {isCountingDown ? (
                    <span className="font-mono text-sm font-black text-amber-400 animate-pulse">
                      {countdownVal ?? 3}
                    </span>
                  ) : (
                    <div
                      className={`transition-all duration-200 bg-red-500 ${
                        isRecording
                          ? 'w-4.5 h-4.5 rounded-[3px] shadow-[0_0_14px_rgba(255,69,58,0.95)] animate-pulse'
                          : 'w-7.5 h-7.5 rounded-full shadow-[0_0_8px_rgba(255,69,58,0.6)] group-hover:scale-105'
                      }`}
                    />
                  )}
                </button>
              </div>

            </div>

          </div>
        </motion.div>
    )}
  </AnimatePresence>
  );
}

export default memo(MasterPlaybackDock);
