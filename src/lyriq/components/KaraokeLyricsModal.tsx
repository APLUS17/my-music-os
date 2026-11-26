import { lazy, memo, Suspense, useRef, useEffect, useMemo, useState, useCallback, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { X, Play, Pause, Check, Mic, ChevronLeft, ChevronRight, SlidersHorizontal, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SongSection, Take, ImportedBeat, LyricLine, getSectionTakeCode } from '../types';
import { distributeLines, pickActiveLine, resolveSectionTimings, takeAnchorSec } from '../utils/timeline';
import type { SyncSettings } from '../utils/settings';
import { getSectionColorPalette } from './MasterPlaybackDock';
import { Bars } from './Bars';

const SyncSettingsPanel = lazy(() => import('./SyncSettingsPanel'));

export interface KaraokeLyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections?: SongSection[];
  activeSection: SongSection | null;
  displaySection?: SongSection | null;
  activeTake: Take | null;
  currentTakeIndex: number;
  totalTakesCount: number;
  isTranscribingTake?: boolean;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  isRecording: boolean;
  isCountingDown?: boolean;
  countdownVal?: number | null;
  onTogglePlay: () => void;
  onToggleRecord?: () => void;
  onSeekToTime: (timeSec: number) => void;
  onInsertLine: (sectionId: string, lineText: string) => void;
  onCycleTake?: (sectionId: string, direction: 1 | -1) => void;
  onDeleteTake?: (sectionId: string, takeId: string) => void;
  importedBeat: ImportedBeat | null;
  syncSettings: SyncSettings;
  onChangeSyncSettings: (patch: Partial<SyncSettings>) => void;
  onResetSyncSettings: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function KaraokeLyricsModal({
  isOpen,
  onClose,
  sections = [],
  activeSection,
  displaySection,
  activeTake,
  currentTakeIndex,
  totalTakesCount,
  isTranscribingTake = false,
  currentTime,
  totalDuration,
  isPlaying,
  isRecording,
  isCountingDown = false,
  countdownVal = null,
  onTogglePlay,
  onToggleRecord,
  onSeekToTime,
  onInsertLine,
  onCycleTake,
  onDeleteTake,
  importedBeat,
  syncSettings,
  onChangeSyncSettings,
  onResetSyncSettings
}: KaraokeLyricsModalProps) {
  const headerSection = displaySection ?? activeSection;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [confirmDeleteTakeId, setConfirmDeleteTakeId] = useState<string | null>(null);
  useEffect(() => {
    setConfirmDeleteTakeId(null);
  }, [activeTake?.id, isOpen]);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [insertedLines, setInsertedLines] = useState<Record<string, boolean>>({});
  const insertedTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Canvas Segmented Scrubber Engine
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverXRatio, setHoverXRatio] = useState<number | null>(null);
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null);
  const lastScrubEmitRef = useRef<number>(0);
  const pendingScrubTargetRef = useRef<number | null>(null);
  const scrubClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveDuration = Math.max(1, totalDuration || importedBeat?.duration || 0);

  const sectionTimings = useMemo(() => {
    if (!effectiveDuration || sections.length === 0) return [];
    const base = resolveSectionTimings(sections, effectiveDuration);
    return base.map((st, idx) => {
      const sec = sections[idx];
      return {
        ...st,
        type: sec.type,
        title: (sec.type && sec.type !== 'none') ? sec.type.toUpperCase() : `SECTION ${idx + 1}`,
      };
    });
  }, [sections, effectiveDuration]);

  // Timed lines come from the take's transcription. Without them, lyrics are
  // spread across the take (or section) and flagged as estimated.
  const { lyricLines, isEstimated } = useMemo(() => {
    if (activeTake?.sttData && activeTake.sttData.length > 0) {
      const lines: LyricLine[] = activeTake.sttData.map((p, i) => ({
        id: `${activeTake.id}-line-${i}`,
        text: p.text,
        startSec: p.startSec,
        endSec: p.endSec,
      }));
      return { lyricLines: lines, isEstimated: false };
    }

    const timing = sectionTimings.find(st => st.id === activeSection?.id);
    const text = activeSection?.text?.trim() ? activeSection.text : activeTake?.transcript || '';
    const raw = text.split('\n').filter(l => l.trim());
    const hasAudio = Boolean(activeTake?.audioUrl);
    const start = hasAudio && activeTake ? takeAnchorSec(activeTake, timing?.start ?? 0) : timing?.start ?? 0;
    const end = hasAudio && activeTake ? start + activeTake.duration : timing?.end ?? start;
    return { lyricLines: distributeLines(raw, start, end, activeSection?.id ?? 'lyrics'), isEstimated: true };
  }, [activeTake, activeSection?.id, activeSection?.text, sectionTimings]);

  // High-DPI Segmented Timeline Canvas Rendering (Color sections split without waveform bars)
  const drawSegmentedCanvas = useCallback(() => {
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
    const centerY = height / 2;
    const trackHeight = 6;
    const trackY = centerY - trackHeight / 2;

    const displayTime = scrubPreviewTime !== null ? scrubPreviewTime : currentTime;
    const playheadX = effectiveDuration > 0
      ? Math.min(width, Math.max(0, (displayTime / effectiveDuration) * width))
      : 0;

    // 1. Base Track: Render color sections split just like in the editor
    if (sectionTimings.length > 0) {
      sectionTimings.forEach((st) => {
        const secStartX = (st.start / effectiveDuration) * width;
        const secEndX = (st.end / effectiveDuration) * width;
        const secW = Math.max(2, secEndX - secStartX);
        const secPalette = getSectionColorPalette(st.type);
        const isCurrent = Boolean(headerSection && st.id === headerSection.id);

        // Background segment for this section (translucent / dim)
        ctx.fillStyle = isCurrent ? secPalette.translucent : secPalette.dim;
        ctx.beginPath();
        ctx.roundRect(secStartX, trackY, secW, trackHeight, 3);
        ctx.fill();

        // Elapsed Progress fill for this section (solid vibrant section color!)
        if (playheadX > secStartX) {
          const fillEnd = Math.min(secEndX, playheadX);
          const fillW = Math.max(0, fillEnd - secStartX);
          if (fillW > 0) {
            ctx.fillStyle = secPalette.solid;
            ctx.beginPath();
            ctx.roundRect(secStartX, trackY, fillW, trackHeight, 3);
            ctx.fill();
          }
        }
      });

      // 2. Hairline Section Dividers between adjacent sections
      sectionTimings.forEach((st) => {
        const secStartX = (st.start / effectiveDuration) * width;
        if (secStartX > 2 && secStartX < width - 2) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1;
          ctx.moveTo(secStartX, trackY - 2.5);
          ctx.lineTo(secStartX, trackY + trackHeight + 2.5);
          ctx.stroke();
        }
      });
    } else {
      // Fallback if no sections defined
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(0, trackY, width, trackHeight, 3);
      ctx.fill();

      if (playheadX > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(0, trackY, playheadX, trackHeight, 3);
        ctx.fill();
      }
    }

    // 3. High-Precision Playhead Indicator
    // Playhead vertical hairline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, trackY - 3);
    ctx.lineTo(playheadX, trackY + trackHeight + 3);
    ctx.stroke();

    // Playhead outer glowing knob
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(playheadX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Inner core matching current section's solid color
    const currentPlayingSec = sectionTimings.find(st => currentTime >= st.start && currentTime < st.end) || headerSection;
    const currentPalette = getSectionColorPalette(currentPlayingSec?.type);
    ctx.shadowBlur = 0;
    ctx.fillStyle = isPlaying ? currentPalette.solid : '#18181b';
    ctx.beginPath();
    ctx.arc(playheadX, centerY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [currentTime, scrubPreviewTime, effectiveDuration, sectionTimings, headerSection, isPlaying]);

  const drawSegmentedCanvasRef = useRef(drawSegmentedCanvas);
  drawSegmentedCanvasRef.current = drawSegmentedCanvas;

  const rafRef = useRef<number | null>(null);
  const scheduleDraw = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      drawSegmentedCanvasRef.current();
    });
  }, []);

  useEffect(() => {
    if (isOpen) scheduleDraw();
  }, [isOpen, drawSegmentedCanvas, scheduleDraw]);

  useEffect(() => {
    const timers = insertedTimersRef.current;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (scrubClearTimerRef.current) clearTimeout(scrubClearTimerRef.current);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  // Observe canvas resize for responsiveness (bound once while modal is open)
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      scheduleDraw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [isOpen, scheduleDraw]);

  // Scrubbing / Time Seeking Engine
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
    pendingScrubTargetRef.current = targetTime;

    const now = performance.now();
    if (isDirectCommit || now - lastScrubEmitRef.current > 80) {
      lastScrubEmitRef.current = now;
      onSeekToTime(targetTime);
    }
  }, [effectiveDuration, onSeekToTime]);

  const handleScrubEnd = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (pendingScrubTargetRef.current !== null) {
        onSeekToTime(pendingScrubTargetRef.current);
      }
      if (scrubClearTimerRef.current) {
        clearTimeout(scrubClearTimerRef.current);
      }
      scrubClearTimerRef.current = setTimeout(() => {
        setScrubPreviewTime(null);
        pendingScrubTargetRef.current = null;
      }, 120);
    }
    setHoverTime(null);
    setHoverXRatio(null);
  }, [onSeekToTime]);

  const handleScrubRef = useRef(handleScrub);
  handleScrubRef.current = handleScrub;
  const handleScrubEndRef = useRef(handleScrubEnd);
  handleScrubEndRef.current = handleScrubEnd;

  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        handleScrubRef.current(e.clientX, false);
      }
    };
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        handleScrubEndRef.current();
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isOpen]);

  const handleMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    handleScrub(e.clientX, true);
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const ratio = clickX / rect.width;
      setHoverXRatio(ratio);
      setHoverTime(ratio * effectiveDuration);
    }
    if (isDraggingRef.current) {
      handleScrub(e.clientX, false);
    }
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setHoverXRatio(null);
  };

  const handleTouchStart = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      isDraggingRef.current = true;
      handleScrub(e.touches[0].clientX, true);
    }
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current && e.touches.length > 0) {
      handleScrub(e.touches[0].clientX, false);
    }
  };

  const handleTouchEnd = () => {
    handleScrubEnd();
  };

  const handleTouchCancel = () => {
    isDraggingRef.current = false;
    setScrubPreviewTime(null);
    pendingScrubTargetRef.current = null;
    setHoverTime(null);
    setHoverXRatio(null);
  };

  const hoveredSection = useMemo(() => {
    if (hoverTime === null) return null;
    return sectionTimings.find(st => hoverTime >= st.start && hoverTime <= st.end) || null;
  }, [hoverTime, sectionTimings]);

  // Keyboard shortcuts (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing into an input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Which line is being sung, with the user's timing offset applied.
  const activeLineIndex = useMemo(
    () => pickActiveLine(lyricLines, currentTime, syncSettings.lyricOffsetMs),
    [lyricLines, currentTime, syncSettings.lyricOffsetMs]
  );

  // Smoothly center the active lyric line
  useEffect(() => {
    if (!isOpen) return;
    if (activeLineIndex >= 0 && lineRefs.current[activeLineIndex]) {
      lineRefs.current[activeLineIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    } else if (activeLineIndex < 0 && containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeLineIndex, activeSection?.id, isOpen]);

  // Handle selective line insertion into active section lyrics
  const handleInsert = (e: ReactMouseEvent, line: LyricLine) => {
    e.stopPropagation();
    const targetSection = displaySection ?? activeSection;
    if (!targetSection) return;

    onInsertLine(targetSection.id, line.text);
    setInsertedLines((prev) => ({ ...prev, [line.id]: true }));

    const prevTimer = insertedTimersRef.current.get(line.id);
    if (prevTimer) clearTimeout(prevTimer);
    const timer = setTimeout(() => {
      insertedTimersRef.current.delete(line.id);
      setInsertedLines((prev) => {
        const next = { ...prev };
        delete next[line.id];
        return next;
      });
    }, 2000);
    insertedTimersRef.current.set(line.id, timer);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="karaoke-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24 }}
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-3xl flex flex-col select-none overflow-hidden"
      >
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 sm:px-8 pb-5 sm:pb-6 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:pt-[calc(1.5rem+env(safe-area-inset-top))] bg-gradient-to-b from-black/90 via-black/50 to-transparent">
          
          {/* Left: Section Color Dot, Section Name & Take Label */}
          <div className="flex items-center gap-3">
            {(() => {
              const palette = getSectionColorPalette(headerSection?.type);
              return (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 transition-colors"
                  style={{
                    backgroundColor: palette.solid,
                    boxShadow: `0 0 10px ${palette.translucent}`,
                  }}
                />
              );
            })()}
            
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold tracking-wider uppercase font-mono">
              <span className="text-white">
                {headerSection?.type && headerSection.type !== 'none' ? headerSection.type.toUpperCase() : 'VERSE'}
              </span>
              <span className="text-zinc-500">•</span>
              <span className="text-amber-500">
                {isCountingDown
                  ? `PRE-ROLL ${countdownVal ?? 3}`
                  : isRecording
                    ? `REC ${getSectionTakeCode(activeSection?.type || 'verse', totalTakesCount)}`
                    : getSectionTakeCode(activeSection?.type || 'verse', totalTakesCount > 0 ? currentTakeIndex : 0)}
              </span>
              {isTranscribingTake && !isRecording && !isCountingDown && (
                <Bars className="h-3 w-3.5 text-amber-400 shrink-0" />
              )}
            </div>
          </div>

          {/* Right: Delete take (2-tap), Sync settings + close */}
          <div className="relative flex items-center gap-2">
            {activeTake && activeSection && onDeleteTake && !isRecording && !isCountingDown && (
              confirmDeleteTakeId === activeTake.id ? (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteTake(activeSection.id, activeTake.id);
                    setConfirmDeleteTakeId(null);
                  }}
                  className="h-11 px-3 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-xs font-semibold text-red-300 transition-all cursor-pointer active:scale-95"
                  title="Tap again to delete this take"
                >
                  Delete?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteTakeId(activeTake.id)}
                  className="w-11 h-11 rounded-full bg-white/10 hover:bg-red-500/15 active:scale-95 flex items-center justify-center text-zinc-400 hover:text-red-300 transition-all cursor-pointer border border-white/10 shadow-lg"
                  title="Delete this take"
                  aria-label="Delete this take"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(v => !v)}
              aria-expanded={isSettingsOpen}
              className={`w-11 h-11 rounded-full active:scale-95 flex items-center justify-center transition-all cursor-pointer border border-white/10 shadow-lg ${
                isSettingsOpen ? 'bg-amber-500/25 text-amber-300' : 'bg-white/10 hover:bg-white/20 text-zinc-300'
              }`}
              title="Audio and sync settings"
              aria-label="Audio and sync settings"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {isSettingsOpen && (
              <Suspense fallback={null}>
                <SyncSettingsPanel
                  settings={syncSettings}
                  onChange={onChangeSyncSettings}
                  onReset={onResetSyncSettings}
                  className="absolute right-0 top-12"
                />
              </Suspense>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer border border-white/10 shadow-lg group"
              title="Close Live Lyrics (Esc)"
              aria-label="Close Live Lyrics"
            >
              <X className="w-4 h-4 text-zinc-300 group-hover:text-white" />
            </button>
          </div>
        </header>

        {/* Lyric viewport */}
        <main
          ref={containerRef}
          className="flex-1 w-full max-w-3xl mx-auto px-6 sm:px-12 pt-32 pb-48 overflow-y-auto no-scrollbar scroll-smooth"
        >
          {isCountingDown && (
            <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-center animate-pulse">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  Pre-Roll Countdown {countdownVal ?? 3}
                </span>
              </div>
              <p className="text-sm text-amber-200/90 font-medium italic">
                Get ready. Recording starts on the downbeat.
              </p>
            </div>
          )}

          {isRecording && (
            <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-center animate-pulse">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <Mic className="w-4 h-4 text-red-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-red-400 font-semibold">
                  Recording ({getSectionTakeCode(activeSection?.type || 'verse', totalTakesCount)})
                </span>
              </div>
              <p className="text-sm text-red-200 font-medium italic">
                Sing or speak into your microphone...
              </p>
            </div>
          )}

          {lyricLines.length === 0 ? (
            isTranscribingTake && !isRecording && !isCountingDown ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-20" aria-busy="true">
                <Bars className="h-7 w-8 text-amber-400 mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
                  Transcribing take...
                </h3>
                <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
                  Lining up your vocal words with the beat.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors cursor-pointer border border-white/10"
                >
                  Back to Canvas
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-20">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-4">
                  <Mic className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
                  No lyrics yet
                </h3>
                <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
                  Record a take, or write lyrics in this section, and they will show here timed to playback.
                </p>
                <div className="flex items-center gap-3">
                  {onToggleRecord && (
                    <button
                      type="button"
                      onClick={onToggleRecord}
                      className="min-h-[44px] px-5 py-2 rounded-full bg-red-500 hover:bg-red-600 text-xs font-medium text-white transition-colors cursor-pointer shadow-lg flex items-center gap-2"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Record Take Now</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors cursor-pointer border border-white/10"
                  >
                    Back to Canvas
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-6 sm:gap-8">
              {isEstimated && (
                <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 -mb-2">
                  Timing is estimated. Record a take for exact timing.
                </p>
              )}
              {lyricLines.map((line, idx) => {
                const isActive = idx === activeLineIndex;
                const isPast = idx < activeLineIndex;
                const isInserted = insertedLines[line.id];

                return (
                  <div
                    key={line.id}
                    ref={(el) => {
                      lineRefs.current[idx] = el;
                    }}
                    onClick={() => onSeekToTime(Math.max(0, line.startSec + syncSettings.lyricOffsetMs / 1000))}
                    className={`group relative flex items-start justify-between gap-4 p-2 sm:p-3 rounded-2xl transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'scale-[1.02] bg-white/[0.06]'
                        : 'opacity-40 hover:opacity-85'
                    }`}
                  >
                    {/* Synchronized Lyric Phrase */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400 transition-colors">
                          {formatTime(line.startSec)} - {formatTime(line.endSec)}
                        </span>
                      </div>
                      <p
                        className={`font-bold transition-all duration-150 leading-[1.35] tracking-tight ${
                          isActive
                            ? 'text-2xl sm:text-3xl md:text-4xl text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.5)]'
                            : isPast
                              ? 'text-xl sm:text-2xl md:text-3xl text-zinc-400'
                              : 'text-xl sm:text-2xl md:text-3xl text-zinc-500'
                        }`}
                      >
                        {line.text}
                      </p>
                    </div>

                    {/* Selective Phrase Insertion Button */}
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleInsert(e, line)}
                        className={`flex items-center justify-center px-4 py-1.5 rounded-full font-mono text-xs font-medium transition-all cursor-pointer shadow-sm ${
                          isInserted
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : isActive
                              ? 'bg-[#222226] hover:bg-[#2b2b30] text-amber-400 border border-white/[0.08]'
                              : 'opacity-0 group-hover:opacity-100 bg-[#1c1c1f] hover:bg-[#28282c] text-amber-400 border border-white/[0.06]'
                        }`}
                        title="Insert phrase into section lyrics"
                      >
                        {isInserted ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                            <Check className="w-3.5 h-3.5" />
                            <span>Inserted</span>
                          </span>
                        ) : (
                          <span className="text-amber-400 font-mono font-medium">+ Insert</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Floating Playback Dock Bar */}
        <footer className="absolute bottom-0 left-0 right-0 z-20 px-4 sm:px-8 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/85 to-transparent">
          <div className="max-w-xl mx-auto flex flex-col gap-3 px-5 py-3.5 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/10 shadow-2xl">
            {/* Top Row: Track Scrubber & Time Display */}
            <div className="flex items-center gap-3 w-full">
              <span className="font-mono text-xs text-zinc-400 min-w-[32px]">
                {formatTime(currentTime)}
              </span>

              <div
                id="karaoke-playback-scrubber"
                className="flex-1 h-6 relative cursor-pointer group flex items-center select-none"
                title="Seek playback by section"
              >
                {/* Floating section + time tooltip on hover */}
                {hoverTime !== null && hoverXRatio !== null && (
                  <div
                    className="absolute -top-7 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-zinc-900/95 backdrop-blur-md border border-white/20 text-[10px] font-mono text-white shadow-xl pointer-events-none whitespace-nowrap flex items-center gap-1.5 z-30"
                    style={{ left: `${Math.max(6, Math.min(94, hoverXRatio * 100))}%` }}
                  >
                    {hoveredSection && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: getSectionColorPalette(hoveredSection.type).solid }}
                      />
                    )}
                    <span className="font-semibold text-zinc-200">
                      {hoveredSection ? hoveredSection.title : 'SEEK'}
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-300">{formatTime(hoverTime)}</span>
                  </div>
                )}

                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchCancel}
                  className="w-full h-full block cursor-pointer"
                  style={{ touchAction: 'none' }}
                />
              </div>

              <span className="font-mono text-xs text-zinc-400 min-w-[36px] text-right">
                -{formatTime(Math.max(0, totalDuration - currentTime))}
              </span>
            </div>

            {/* Bottom Row: Play Button (Left), Take Switcher (Center), Done Button (Right) */}
            <div className="flex items-center justify-between pt-1">
              {/* Left: Play/Pause Button */}
              <button
                type="button"
                onClick={onTogglePlay}
                disabled={isRecording || isCountingDown}
                className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                title={isRecording || isCountingDown ? 'Use the record button to stop' : isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-black" />
                ) : (
                  <Play className="w-4 h-4 fill-black ml-0.5" />
                )}
              </button>

              {/* Center: Take Switcher Pill */}
              {activeSection && (
                <div className="inline-flex items-center gap-1.5 bg-[#1b1b1d] hover:bg-[#242428] border border-white/[0.08] rounded-full px-3.5 py-1.5 transition-colors shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      if (onCycleTake) onCycleTake(activeSection.id, -1);
                    }}
                    disabled={totalTakesCount <= 1}
                    className="hit-44 p-0.5 text-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed active:scale-90 transition-all cursor-pointer"
                    title="Previous Take"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="font-mono text-xs font-semibold text-amber-400 px-2 whitespace-nowrap">
                    {getSectionTakeCode(activeSection.type, totalTakesCount > 0 ? currentTakeIndex : 0)}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (onCycleTake) onCycleTake(activeSection.id, 1);
                    }}
                    disabled={totalTakesCount <= 1}
                    className="hit-44 p-0.5 text-zinc-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed active:scale-90 transition-all cursor-pointer"
                    title="Next Take"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Right: Done Button */}
              <button
                type="button"
                onClick={onClose}
                className="hit-44 text-xs sm:text-sm font-semibold tracking-wider text-amber-400 hover:text-amber-300 transition-colors uppercase cursor-pointer pr-1"
              >
                Done
              </button>
            </div>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}

export default memo(KaraokeLyricsModal);

