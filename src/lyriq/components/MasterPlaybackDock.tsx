import { lazy, memo, Suspense, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  MoreHorizontal,
  SlidersHorizontal,
  Magnet,
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
  /** Unused by the dock since the redesign: loop a section from its menu in the editor. */
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

/**
 * Dock waveform colours: every bar takes its section's colour (verse amber, hook blue, ...),
 * so the song reads as coloured blocks. The section that is playing is brightest; played
 * bars are fuller than upcoming ones.
 */
export function sectionBarFill(type: SectionType | undefined, isActive: boolean, isPast: boolean): string {
  const palette = getSectionColorPalette(type);
  if (isActive) return isPast ? palette.solid : palette.translucent;
  return isPast ? palette.translucent : palette.dim;
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
}: MasterPlaybackDockProps) {
  const dragControls = useDragControls();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Starts minimized as the floating pill at the bottom
  const [isMinimized, setIsMinimized] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMenuOpenRef = useRef(false);
  useEffect(() => {
    isMenuOpenRef.current = isMenuOpen;
  }, [isMenuOpen]);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The canvas mounts in both the collapsed bar and the sheet, and AnimatePresence
  // swaps them one after the other, so effects follow the element, not isMinimized.
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const setCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    setCanvasEl(el);
  }, []);
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
        if (isMenuOpenRef.current) {
          setIsMenuOpen(false);
          return;
        }
        setIsSettingsOpen(false);
        setIsMinimized(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close the ⋯ menu on an outside press, and whenever the dock collapses or expands
  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [isMinimized]);

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

  // Boundaries are only editable in the expanded sheet; the collapsed bar just scrubs.
  const boundaryEditable = canDragBoundaries && !isMinimized;

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
      if (isMinimized) {
        // Collapsed bar: one compact lane (loudest of vocal / beat per bar)
        const centerY = height / 2;
        const maxBarH = Math.max(6, height - 6);

        for (let i = 0; i < barCount; i++) {
          const x = i * step;
          const barTime = (x / width) * effectiveDuration;

          const sectionMatch = renderTimings.find(st => barTime >= st.start && barTime < st.end);
          const isActiveSection = Boolean(sectionMatch && sectionMatch.id === activeSection?.id);
          const isPast = barTime <= displayTime;

          let norm = 0.1;
          if (beatWaveform.length > 0) {
            const waveIdx = Math.floor((i / barCount) * beatWaveform.length);
            norm = Math.max(norm, Math.min(1.0, (beatWaveform[waveIdx] || 15) / 100));
          } else if (hasBeatAudio) {
            norm = 0.2;
          }
          const vocalHit = activeVocalSpans.find(s => barTime >= s.anchor && barTime < (s.anchor + s.duration));
          if (vocalHit) {
            let vocalNorm = 0.25;
            if (vocalHit.waveform.length > 0) {
              const vocalProgress = Math.max(0, Math.min(1, (barTime - vocalHit.anchor) / Math.max(0.01, vocalHit.duration)));
              const waveIdx = Math.floor(vocalProgress * vocalHit.waveform.length);
              vocalNorm = Math.max(0.12, Math.min(1.0, (vocalHit.waveform[waveIdx] || 15) / 100));
            }
            norm = Math.max(norm, vocalNorm);
          }

          const barH = Math.max(3, norm * maxBarH);
          ctx.fillStyle = sectionBarFill(sectionMatch?.type, isActiveSection, isPast);
          ctx.beginPath();
          ctx.roundRect(x, centerY - barH / 2, barWidth, barH, 1.2);
          ctx.fill();
        }
      } else if (hasBeatAudio) {
        // Dual-Lane: Top Lane = Vocal Takes, Bottom Lane = Backing Beat
        const midY = Math.floor(height / 2);
        const topCenterY = midY / 2;
        const topMaxBarH = Math.max(4, midY - 4);
        const bottomCenterY = midY + (height - midY) / 2;
        const bottomMaxBarH = Math.max(4, height - midY - 4);

        for (let i = 0; i < barCount; i++) {
          const x = i * step;
          const barTime = (x / width) * effectiveDuration;

          // Determine which section this bar belongs to (each section keeps its own colour across both lanes)
          const sectionMatch = renderTimings.find(st => barTime >= st.start && barTime < st.end);
          const isActiveSection = Boolean(sectionMatch && sectionMatch.id === activeSection?.id);
          const isPast = barTime <= displayTime;
          const barColor = sectionBarFill(sectionMatch?.type, isActiveSection, isPast);

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

      } else {
        // Single Full-Height Lane: Vocal Take (no beat imported)
        for (let i = 0; i < barCount; i++) {
          const x = i * step;
          const barTime = (x / width) * effectiveDuration;

          const sectionMatch = renderTimings.find(st => barTime >= st.start && barTime < st.end);
          const isActiveSection = Boolean(sectionMatch && sectionMatch.id === activeSection?.id);
          const isPast = barTime <= displayTime;
          const barColor = sectionBarFill(sectionMatch?.type, isActiveSection, isPast);

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
          const isCurrent = st.id === activeSection?.id;
          const secPalette = getSectionColorPalette(st.type);

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
        ctx.fillStyle = getSectionColorPalette(activeSection?.type).solid;
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
          if (boundaryEditable) {
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
    if (isMinimized) {
      // Collapsed bar: a slim amber line, no knob
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(playheadX, 1);
      ctx.lineTo(playheadX, height - 1);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead knob at the top of the lanes
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.min(Math.max(playheadX, 6), width - 6), 6, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [currentTime, scrubPreviewTime, effectiveDuration, sectionTimings, beatWaveform, hasBeatAudio, hasRealAudio, hasTimeline, activeVocalSpans, activeSection, isPlaying, isVocalMuted, boundaryEditable, isMinimized, snapToGrid, activeBeatGrid]);

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

  // ResizeObserver follows the canvas element (bar or sheet), never torn down on 20Hz ticks
  useEffect(() => {
    if (!canvasEl) return;

    const ro = new ResizeObserver(() => {
      scheduleDraw();
    });
    ro.observe(canvasEl);

    return () => ro.disconnect();
  }, [canvasEl, scheduleDraw]);

  // Redraw waveform on playhead or state update smoothly via rAF
  useEffect(() => {
    if (canvasEl) scheduleDraw();
  }, [canvasEl, drawWaveform, scheduleDraw]);

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
      if (!boundaryEditable) return null;
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
    [boundaryEditable, sectionTimings, effectiveDuration]
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

  // --- SHARED PIECES (used by both the collapsed bar and the expanded sheet) ---
  const displayedTime =
    dragBoundaryFeedback !== null
      ? dragBoundaryFeedback.timeSec
      : isDraggingRef.current && scrubPreviewTime !== null
        ? scrubPreviewTime
        : currentTime;
  const sectionLabel =
    activeSection && activeSection.type !== 'none' ? activeSection.type.toUpperCase() : 'STANZA';
  const playheadPct =
    hasTimeline && effectiveDuration > 0
      ? Math.min(100, Math.max(0, (displayedTime / effectiveDuration) * 100))
      : 0;

  const renderCanvas = (className: string) => (
    <canvas
      ref={setCanvasRef}
      className={className}
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
  );

  const renderPlayButton = (compact: boolean) => (
    <button
      type="button"
      onClick={onTogglePlay}
      disabled={isRecording || isCountingDown}
      className={
        compact
          ? 'w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-white hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed'
          : 'w-11 h-11 shrink-0 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed'
      }
      title={isRecording || isCountingDown ? 'Use the record button to stop' : isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      aria-label={isPlaying ? 'Pause' : 'Play'}
    >
      {isPlaying ? (
        <Pause className={compact ? 'w-5 h-5 fill-white' : 'w-6 h-6 fill-white stroke-white'} />
      ) : (
        compact ? (
          <Play className="w-5 h-5 fill-white ml-0.5" />
        ) : (
          <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden="true" className="ml-1">
            <path d="M2 1 L21 12 L2 23Z" fill="currentColor" strokeLinejoin="round" />
          </svg>
        )
      )}
    </button>
  );

  const renderRecordButton = (compact: boolean) => {
    const label = isCountingDown
      ? 'Cancel Pre-Roll'
      : isRecording
        ? 'Stop Recording'
        : compact
          ? 'Start Recording'
          : 'Record Voice Memo';
    return (
      <button
        type="button"
        onClick={onToggleRecord}
        className={
          compact
            ? `w-11 h-11 shrink-0 rounded-full border-2 p-1 flex items-center justify-center active:scale-95 transition-all cursor-pointer group ${
                isCountingDown ? 'border-amber-400/80 bg-amber-500/10' : 'border-white/85 hover:bg-white/[0.06]'
              }`
            : `w-[92px] h-[52px] shrink-0 rounded-[26px] flex items-center justify-center active:scale-95 transition-all cursor-pointer group ${
                isCountingDown ? 'bg-amber-500/15' : 'bg-[#1c1c1f] hover:bg-[#232327]'
              }`
        }
        title={label}
        aria-label={label}
      >
        {isCountingDown ? (
          <span className="font-mono text-sm font-black text-amber-400 animate-pulse">{countdownVal ?? 3}</span>
        ) : (
          <div
            className={`transition-all duration-200 bg-red-500 ${
              isRecording
                ? compact ? 'w-4.5 h-4.5 rounded-[3px] animate-pulse' : 'w-[18px] h-[18px] rounded-[4px] animate-pulse'
                : compact ? 'w-7.5 h-7.5 rounded-full group-hover:scale-105' : 'w-[22px] h-[22px] rounded-full'
            }`}
          />
        )}
      </button>
    );
  };

  const hasSnapOption = Boolean(canDragBoundaries && onToggleSnapToGrid);
  const hasMuteOption = Boolean(onToggleMuteVocal && activeTakes.length > 0);
  const hasRetryOption = Boolean(
    isCurrentTakeTranscriptionFailed && takeSection && currentTake && onRetryTranscription
  );
  const hasMenuItems = hasSnapOption || hasMuteOption || hasRetryOption;
  const canSwipeUpForLyrics = Boolean(onOpenLiveLyrics && activeTakes.length > 0);
  const dockHint = getDockHint({
    isRecording: isRecording || isCountingDown,
    canOpenLyrics: canSwipeUpForLyrics,
  });

  const renderMenuButton = (compact: boolean) => (
    <div className="relative shrink-0" ref={menuWrapRef}>
      {isMenuOpen && (
        <div
          role="menu"
          aria-label="Dock options"
          className="absolute bottom-full left-0 mb-2 w-56 rounded-2xl bg-[#1c1c1f] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.6)] z-50 animate-fadeIn"
        >
          {hasMuteOption && (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={isVocalMuted}
              onClick={() => onToggleMuteVocal?.()}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-2.5 text-sm text-zinc-200 hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors cursor-pointer"
              aria-label={isVocalMuted ? 'Unmute vocals' : 'Mute vocals'}
            >
              {isVocalMuted ? <VolumeX className="w-4 h-4 text-zinc-400" /> : <Volume2 className="w-4 h-4 text-zinc-400" />}
              <span className="flex-1 text-left">Mute vocals</span>
              <span className={`font-mono text-[11px] ${isVocalMuted ? 'text-amber-400' : 'text-zinc-500'}`}>
                {isVocalMuted ? 'On' : 'Off'}
              </span>
            </button>
          )}
          {hasRetryOption && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                if (takeSection && currentTake) onRetryTranscription?.(takeSection.id, currentTake.id);
              }}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-2.5 text-sm text-zinc-200 hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors cursor-pointer"
              aria-label={`Retry transcription for ${currentTakeCode}`}
            >
              <RotateCw className="w-4 h-4 text-zinc-400" />
              <span className="flex-1 text-left">Retry transcription</span>
            </button>
          )}
          {hasSnapOption && (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={snapToGrid}
              onClick={onToggleSnapToGrid}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-2.5 text-sm text-zinc-200 hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors cursor-pointer"
              title={snapToGrid ? 'Downbeat snap: On (hold Alt to drag freely)' : 'Downbeat snap: Off'}
              aria-label={snapToGrid ? 'Disable downbeat grid snap' : 'Enable downbeat grid snap'}
            >
              <Magnet className="w-4 h-4 text-zinc-400" />
              <span className="flex-1 text-left">Snap to bar</span>
              <span className={`font-mono text-[11px] ${snapToGrid ? 'text-amber-400' : 'text-zinc-500'}`}>
                {snapToGrid ? 'On' : 'Off'}
              </span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsMenuOpen(false);
              setIsSettingsOpen(v => !v);
            }}
            className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-2.5 text-sm text-zinc-200 hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors cursor-pointer"
            aria-label="Audio and sync settings"
          >
            <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
            <span className="flex-1 text-left">Sync settings</span>
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          // With nothing but Sync settings to offer, skip the one-item menu and open the panel.
          if (!hasMenuItems) {
            setIsMenuOpen(false);
            setIsSettingsOpen(v => !v);
            return;
          }
          setIsMenuOpen(v => !v);
        }}
        aria-haspopup={hasMenuItems ? 'menu' : 'dialog'}
        aria-expanded={hasMenuItems ? isMenuOpen : isSettingsOpen}
        className={`${
          compact ? 'w-11 h-11' : 'w-11 h-11'
        } rounded-full flex items-center justify-center cursor-pointer transition-colors active:scale-95 ${
          isMenuOpen || isSettingsOpen ? 'text-amber-300' : compact ? 'text-zinc-400 hover:text-zinc-100' : 'text-zinc-200 hover:text-white'
        }`}
        title="More options"
        aria-label="More dock options"
      >
        <MoreHorizontal className={compact ? 'w-5 h-5' : 'w-6 h-6 fill-current'} strokeWidth={compact ? 2 : 2.5} />
      </button>
    </div>
  );

  const settingsPanel = isSettingsOpen && (
    <Suspense fallback={null}>
      <SyncSettingsPanel
        settings={syncSettings}
        onChange={onChangeSyncSettings}
        onReset={onResetSyncSettings}
        className="absolute bottom-full right-0 mb-2"
      />
    </Suspense>
  );

  // --- RENDER DOCK WITH SMOOTH SPRING ANIMATION ---
  return (
    <AnimatePresence mode="wait">
      {isMinimized ? (
        !hideCollapsedPill && (
          /* COLLAPSED: one flat transport bar. Scrub and play only; boundary editing lives in the sheet. */
          <motion.div
            key="dock-bar"
            id="master-playback-bar"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 450, damping: 34 }}
            onPanEnd={(_, info) => {
              if (info.offset.y < -28 && Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
                setIsMinimized(false);
              }
            }}
            className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-5 inset-x-3 sm:inset-x-6 max-w-xl mx-auto z-40 h-14 rounded-full bg-[#141416] px-1.5 flex items-center gap-1 select-none touch-pan-x"
          >
            {settingsPanel}

            {renderPlayButton(true)}

            {/* Mini sectioned waveform; the bubble above the playhead names the section and expands the sheet */}
            <div
              className="relative flex-1 min-w-0 h-11 flex items-center"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                style={{ left: `clamp(56px, ${playheadPct}%, calc(100% - 56px))` }}
                className="absolute bottom-full mb-1 -translate-x-1/2 z-10 h-6 px-2.5 rounded-full bg-amber-400 text-black text-[11px] font-semibold font-mono tabular-nums whitespace-nowrap flex items-center cursor-pointer active:scale-95 before:absolute before:-inset-x-2 before:-inset-y-2.5"
                title="Expand playback & waveform dock (Esc)"
                aria-label="Expand playback and waveform dock"
              >
                {hasBeatAudio || hasAnyTakes || sectionTimings.length > 1 ? `${sectionLabel} ` : ''}
                {formatTime(displayedTime)}
              </button>
              {renderCanvas(
                `w-full h-9 block touch-none ${isRecording || isCountingDown ? 'cursor-default' : 'cursor-pointer'}`
              )}
            </div>

            {renderMenuButton(true)}
            {renderRecordButton(true)}
          </motion.div>
        )
      ) : (
        /* EXPANDED: flat sheet. Same canvas, boundary drag, takes and loop as before. */
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
            if (isRecording || isCountingDown) return;
            if (info.offset.y > 40 || info.velocity.y > 300) {
              setIsMinimized(true);
            } else if (canSwipeUpForLyrics && (info.offset.y < -40 || info.velocity.y < -300)) {
              onOpenLiveLyrics?.();
            }
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-5 inset-x-3 sm:inset-x-6 max-w-xl mx-auto z-40 rounded-[30px] bg-[#111113] pt-2 pb-4 px-[18px] select-none"
        >
          {/* Tactile Swipe Handle (sole vertical drag initiator so touch waveform/buttons never conflict) */}
          <div
            onPointerDown={(e) => {
              if (!isRecording && !isCountingDown) {
                dragControls.start(e);
              }
            }}
            onClick={() => setIsMinimized(true)}
            className="w-full flex items-center justify-center pt-1 pb-2.5 cursor-pointer group touch-none"
            title="Swipe up for lyrics, down to minimize (Esc)"
          >
            <div className="w-10 h-[5px] rounded-full bg-white/[0.22] group-hover:bg-white/50 group-active:bg-white/70 transition-colors" />
          </div>

          {settingsPanel}

          <div className="w-full flex flex-col">

            {/* 1. Active section. Looping lives in each section's menu in the editor. */}
            <div
              className="flex items-center gap-2 min-w-0 h-9 touch-none"
              onPointerDown={(e) => {
                if (!isRecording && !isCountingDown) dragControls.start(e);
              }}
            >
              {activeSection && (
                <span
                  className={`w-[9px] h-[9px] rounded-full shrink-0 transition-colors ${isPlaying ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: getSectionColorPalette(activeSection.type).solid,
                    boxShadow: isPlaying ? `0 0 8px ${getSectionColorPalette(activeSection.type).solid}` : undefined,
                  }}
                />
              )}
              <span className="font-bold uppercase tracking-[0.12em] text-[13px] text-white truncate">
                {sectionLabel}
              </span>
            </div>

            {/* 2. Lanes: names on the left (take switcher, Beat), waveform on the right */}
            <div className="flex items-stretch mt-2.5">
              {(hasBeatAudio || activeTakes.length > 0) && (
                <div
                  className={`w-[74px] shrink-0 flex flex-col gap-2 ${hasBeatAudio ? 'h-[88px]' : 'h-10'}`}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="flex-1 flex items-center min-w-0">
                    {isRecording || isCountingDown ? (
                      <span className="text-[13px] font-semibold text-red-400 tabular-nums truncate">
                        {isCountingDown ? `PRE-ROLL ${countdownVal ?? 3}` : `REC ${recordingTakeCode}`}
                      </span>
                    ) : activeTakes.length > 0 ? (
                      <div className="flex items-center -ml-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (takeSection) onCycleTake(takeSection.id, -1); }}
                          disabled={activeTakes.length <= 1}
                          className="hit-44 w-5 h-10 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed active:scale-90 transition-all cursor-pointer"
                          title="Previous take"
                          aria-label="Previous take"
                        >
                          <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenLiveLyrics?.()}
                          aria-busy={isCurrentTakeTranscribing || undefined}
                          style={{ color: isVocalMuted ? undefined : getSectionColorPalette(takeSection?.type).solid }}
                          className={`h-10 inline-flex items-center gap-1 text-[15px] font-semibold px-0.5 cursor-pointer whitespace-nowrap active:scale-95 ${
                            isVocalMuted ? 'text-zinc-500 line-through' : ''
                          }`}
                          title={isCurrentTakeTranscribing ? 'Transcribing take…' : 'View timed lyrics'}
                          aria-label={`Take ${currentTakeCode}${isVocalMuted ? ' (muted)' : ''}. View timed lyrics`}
                        >
                          <span>{currentTakeCode}</span>
                          {isCurrentTakeTranscribing && <Bars className="h-2.5 w-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (takeSection) onCycleTake(takeSection.id, 1); }}
                          disabled={activeTakes.length <= 1}
                          className="hit-44 w-5 h-10 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed active:scale-90 transition-all cursor-pointer"
                          title="Next take"
                          aria-label="Next take"
                        >
                          <ChevronRight className="w-[18px] h-[18px]" strokeWidth={1.75} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[15px] text-zinc-600">Vocal</span>
                    )}
                  </div>
                  {hasBeatAudio && (
                    <div className="flex-1 flex items-center gap-[7px] text-[15px] text-zinc-400">
                      <span aria-hidden="true">&#x266B;</span>
                      <span>Beat</span>
                    </div>
                  )}
                </div>
              )}

              {/* Waveform: dual-lane display, section splits and draggable boundaries */}
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className={`relative flex-1 min-w-0 ${hasBeatAudio ? 'h-[88px]' : 'h-10'} overflow-visible group touch-none ${
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
                  {renderCanvas('w-full h-full block touch-none')}
                </div>
              </div>
            </div>

            {/* 3. Time, centered */}
            <div className="mt-1.5 text-center text-[15px] whitespace-nowrap tabular-nums">
              <span className="text-zinc-300">{formatTime(displayedTime)}</span>
              <span className="text-zinc-500"> / </span>
              <span className="text-zinc-500">{hasTimeline ? formatTime(totalDuration) : '–:––'}</span>
            </div>

            {/* 4. Transport: more, record, play */}
            <div className="grid grid-cols-3 items-center px-[26px] pt-3.5">
              <div className="flex justify-start">{renderMenuButton(false)}</div>
              <div className="flex justify-center">{renderRecordButton(false)}</div>
              <div className="flex justify-end">{renderPlayButton(false)}</div>
            </div>

            {dockHint && (
              <p className="mt-3 text-center text-[12.5px] text-zinc-500">{dockHint}</p>
            )}

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** One quiet hint line under the dock transport. */
export function getDockHint({ isRecording, canOpenLyrics }: { isRecording: boolean; canOpenLyrics: boolean }): string | null {
  if (isRecording) return null;
  if (canOpenLyrics) return 'Swipe up for lyrics';
  return null;
}

export default memo(MasterPlaybackDock);
