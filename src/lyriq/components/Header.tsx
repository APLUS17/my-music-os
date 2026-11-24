import { memo, useState, useRef, useEffect, type ChangeEvent } from 'react';
import {
  Plus,
  Trash2,
  Check,
  Music,
  Play,
  Square,
  UploadCloud,
  X,
  Pencil,
  Disc3,
  ChevronLeft,
  RefreshCw
} from 'lucide-react';
import { SongSession, ImportedBeat, BeatAnalysis } from '../types';
import {
  createImmediateBeat,
  decodeBeatFile,
  isAudioFile,
  resolveLocalBeatArrangement,
  validateBeatFile,
} from '../services/beatImport';

export type BeatImportOutcome =
  | { arrangementApplied: true; sectionCount: number }
  | { arrangementApplied: false; reason: 'has-content' | 'manual-edits' | 'no-analysis' };

export interface BeatImportOptions {
  analysisWav?: Blob;
  bpmPreference?: number;
  fileName?: string;
  triggerBackgroundAnalysis?: boolean;
}

interface HeaderProps {
  activeSessionTitle: string;
  onRenameSession: (newTitle: string) => void;
  sessions: SongSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  bpm: number;
  onChangeBpm?: (newBpm: number) => void;
  importedBeat: ImportedBeat | null;
  onImportBeat?: (
    beat: ImportedBeat,
    analysis?: BeatAnalysis | null,
    options?: BeatImportOptions
  ) => BeatImportOutcome | void;
  onNotify?: (text: string, tone?: 'info' | 'error', action?: { label: string; onClick: () => void }) => void;
  onRemoveBeat?: () => void;
  onWipeAudioAndBeat?: () => void;
  isGlobalPlaying?: boolean;
  onToggleGlobalPlayback?: () => void;
  /** A take is counting in or recording: the beat must not change underneath it. */
  isTakeInProgress?: boolean;
  onOpenLibrary?: () => void;
  /** True while the track has not yet been titled or auto-filled from Line 1. */
  isUntitled?: boolean;
  /** True when stanzas are in reorder mode; displays a Done button in the top bar. */
  isReorderMode?: boolean;
  onExitReorderMode?: () => void;
  /** True when App.tsx is running a background or re-analyze beat arrangement job. */
  isAnalyzingBeatExternal?: boolean;
  /** Triggers explicit non-destructive re-analysis of the active beat. */
  onReanalyzeBeat?: () => void;
}

function Header({
  activeSessionTitle,
  onRenameSession,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  bpm,
  onChangeBpm,
  importedBeat,
  onImportBeat,
  onRemoveBeat,
  onWipeAudioAndBeat,
  onNotify,
  isGlobalPlaying = false,
  onToggleGlobalPlayback,
  isTakeInProgress = false,
  onOpenLibrary,
  isUntitled = false,
  isReorderMode = false,
  onExitReorderMode,
  isAnalyzingBeatExternal = false,
  onReanalyzeBeat,
}: HeaderProps) {
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempTitle, setTempTitle] = useState(activeSessionTitle);
  const [isBpmEditing, setIsBpmEditing] = useState(false);
  const [tempBpm, setTempBpm] = useState(String(bpm));
  const sessionMenuRef = useRef<HTMLDivElement>(null);

  // Direct Beat Menu State
  const [isBeatMenuOpen, setIsBeatMenuOpen] = useState(false);
  const [isBeatAudioPreviewPlaying, setIsBeatAudioPreviewPlaying] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const beatMenuRef = useRef<HTMLDivElement>(null);
  const beatFileInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setTempTitle(activeSessionTitle);
  }, [activeSessionTitle]);

  useEffect(() => {
    setTempBpm(String(bpm));
  }, [bpm]);

  useEffect(() => {
    if (isTakeInProgress) {
      setIsBpmEditing(false);
      setTempBpm(String(bpm));
    }
  }, [isTakeInProgress, bpm]);

  // Stop preview audio when closing menu
  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.onended = null;
      previewAudioRef.current.removeAttribute('src');
      previewAudioRef.current = null;
    }
    setIsBeatAudioPreviewPlaying(false);
  };

  // Click outside listener for session dropdown & beat menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target as Node)) {
        setIsSessionDropdownOpen(false);
      }
      if (beatMenuRef.current && !beatMenuRef.current.contains(e.target as Node)) {
        setIsBeatMenuOpen(false);
        stopPreviewAudio();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Subtle Floating Upload Feedback State
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = (msg: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setUploadFeedback(msg);
    feedbackTimerRef.current = setTimeout(() => {
      setUploadFeedback(null);
    }, 3800);
  };

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      stopPreviewAudio();
    };
  }, []);

  const handleTitleSubmit = () => {
    setIsRenaming(false);
    if (tempTitle.trim() && tempTitle !== activeSessionTitle) {
      onRenameSession(tempTitle.trim());
    } else {
      setTempTitle(activeSessionTitle);
    }
  };

  const handleBpmSubmit = () => {
    setIsBpmEditing(false);
    if (isTakeInProgress) {
      setTempBpm(String(bpm));
      onNotify?.('Stop recording before changing tempo.');
      return;
    }
    const parsed = parseInt(tempBpm, 10);
    if (!isNaN(parsed) && parsed >= 40 && parsed <= 240 && onChangeBpm) {
      onChangeBpm(parsed);
    } else {
      setTempBpm(String(bpm));
    }
  };

  // Each import gets a token so a slow decode of an old file can't overwrite a newer beat.
  const importTokenRef = useRef(0);

  const handleAudioFileUpload = async (file: File) => {
    if (!file || !onImportBeat) return;
    if (isTakeInProgress) return onNotify?.('Stop recording before changing the beat.');

    const validationError = validateBeatFile(file);
    if (validationError) return onNotify?.(validationError, 'error');

    stopPreviewAudio();
    const token = ++importTokenRef.current;

    const { beat: immediate, nameBpm } = createImmediateBeat(file, bpm);
    onImportBeat(immediate, null);
    setIsBeatMenuOpen(false);
    showFeedback(`Importing "${immediate.name}"...`);

    const decoded = await decodeBeatFile(file, immediate, nameBpm, bpm);
    if (token !== importTokenRef.current) return;

    if (!decoded) {
      onRemoveBeat?.();
      onNotify?.('This audio file could not be read. Try exporting it as WAV or MP3.', 'error');
      return;
    }

    const localArrangement =
      decoded.fallbackArrangement?.sections?.length
        ? decoded.fallbackArrangement
        : resolveLocalBeatArrangement(decoded.beat, bpm);
    const readyBeat: ImportedBeat = localArrangement
      ? { ...decoded.beat, arrangement: localArrangement }
      : decoded.beat;

    const outcome = onImportBeat(readyBeat, localArrangement, {
      analysisWav: decoded.analysisWav,
      bpmPreference: decoded.bpmPreference,
      fileName: file.name,
      triggerBackgroundAnalysis: true,
    });

    if (outcome?.arrangementApplied) {
      showFeedback(`✓ "${readyBeat.name}" • ${readyBeat.bpm} BPM • ${outcome.sectionCount} sections`);
    } else if (outcome?.reason === 'manual-edits') {
      showFeedback(`✓ "${readyBeat.name}" loaded • kept your custom section boundaries`);
    } else if (outcome?.reason === 'has-content') {
      showFeedback(`✓ "${readyBeat.name}" loaded • kept your existing lyrics & takes`);
    } else {
      showFeedback(`✓ "${readyBeat.name}" loaded • ${readyBeat.bpm} BPM (${decoded.bpmSource})`);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleAudioFileUpload(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleToggleCurrentBeatPreview = () => {
    if (!importedBeat?.audioUrl) return;

    if (isBeatAudioPreviewPlaying && previewAudioRef.current) {
      stopPreviewAudio();
    } else {
      if (isGlobalPlaying && onToggleGlobalPlayback) {
        onToggleGlobalPlayback();
      }
      stopPreviewAudio();
      const audio = new Audio(importedBeat.audioUrl);
      audio.volume = 0.8;
      audio.onended = () => setIsBeatAudioPreviewPlaying(false);
      audio.play().catch(err => {
        setIsBeatAudioPreviewPlaying(false);
        if (err?.name === 'NotAllowedError') {
          onNotify?.('Your browser blocked audio preview. Tap again to play.', 'error');
        }
      });
      previewAudioRef.current = audio;
      setIsBeatAudioPreviewPlaying(true);
    }
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="w-full transition-colors duration-200 sticky top-0 z-40 shrink-0 bg-black">
      {/* Hidden File Input for Direct Audio Upload */}
      <input
        type="file"
        ref={beatFileInputRef}
        accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.aif,.aiff,audio/*,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/flac"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div className="max-w-4xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Back Chevron + Song Title (iOS Notes navigation) */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0" ref={sessionMenuRef}>
          {onOpenLibrary && (
            <button
              id="btn-header-back-library"
              type="button"
              onClick={onOpenLibrary}
              aria-label="Back to Library"
              title="Songs & Beats Library"
              className="min-w-[40px] min-h-[40px] -ml-1.5 rounded-xl flex items-center justify-center text-amber-400 hover:text-amber-300 hover:bg-white/[0.05] active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
          )}

          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') {
                    setIsRenaming(false);
                    setTempTitle(activeSessionTitle);
                  }
                }}
                autoFocus
                className="text-sm px-2.5 py-1 rounded-lg border outline-none font-medium w-36 sm:w-56 font-serif bg-black/90 border-amber-400 text-white"
                placeholder="Song title..."
              />
              <button
                type="button"
                onClick={handleTitleSubmit}
                className="p-1.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 cursor-pointer transition"
                title="Save title (Enter)"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRenaming(false);
                  setTempTitle(activeSessionTitle);
                }}
                className="p-1.5 rounded-lg border opacity-60 hover:opacity-100 transition cursor-pointer bg-white/5 border-white/10 text-zinc-300"
                title="Cancel (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative min-w-0">
              {/* Song Switcher Dropdown */}
              <button
                id="header-session-title-btn"
                type="button"
                onClick={() => setIsSessionDropdownOpen(!isSessionDropdownOpen)}
                onDoubleClick={() => {
                  setTempTitle(isUntitled ? '' : activeSessionTitle);
                  setIsRenaming(true);
                }}
                className={`flex items-center transition-colors cursor-pointer text-left py-1.5 hover:opacity-90 ${
                  isUntitled ? 'text-zinc-500' : 'text-zinc-100'
                }`}
                title="Switch songs or double-click to rename"
              >
                <span
                  className={`max-w-[155px] sm:max-w-[280px] truncate font-serif text-base sm:text-lg tracking-tight transition-colors ${
                    isUntitled ? 'font-normal' : 'font-semibold'
                  }`}
                >
                  {activeSessionTitle || 'Untitled Track'}
                </span>
              </button>

              {/* Session Management Popover */}
              {isSessionDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 rounded-xl shadow-2xl z-50 py-1.5 border backdrop-blur-xl animate-fadeIn bg-[#18181A]/95 border-white/10 text-white">
                  <div className="px-3 py-1.5 flex items-center justify-between border-b border-zinc-500/10 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Your Songs</span>
                    <button
                      type="button"
                      onClick={() => {
                        onCreateSession();
                        setIsSessionDropdownOpen(false);
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:text-amber-400 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Song</span>
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto py-1">
                    {sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className={`flex items-center justify-between px-3 py-2 text-xs transition cursor-pointer ${
                          sess.id === activeSessionId
                            ? 'bg-amber-500/15 text-amber-300 font-semibold'
                            : 'hover:bg-white/5 text-gray-300'
                        }`}
                        onClick={() => {
                          onSelectSession(sess.id);
                          setIsSessionDropdownOpen(false);
                        }}
                      >
                        <div className="flex flex-col truncate pr-2">
                          <span className="truncate">{sess.title}</span>
                          <span className="text-[10px] opacity-50 font-mono">{sess.sections?.length || 0} sections &bull; {sess.bpm} BPM</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {sess.id === activeSessionId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsSessionDropdownOpen(false);
                                setTempTitle(sess.title);
                                setIsRenaming(true);
                              }}
                              className="p-1 hover:text-amber-400 opacity-50 hover:opacity-100 transition"
                              title="Rename song"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          {sessions.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(sess.id);
                              }}
                              className="p-1 hover:text-red-500 opacity-40 hover:opacity-100 transition"
                              title="Delete song"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {onOpenLibrary && (
                    <div className="px-2 pt-1.5 mt-1 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSessionDropdownOpen(false);
                          onOpenLibrary();
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-zinc-200 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Disc3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Open Full Library</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Done (when reordering) or Minimal Add Beat Trigger */}
        <div className="flex items-center shrink-0">
          {isReorderMode && onExitReorderMode ? (
            <button
              type="button"
              onClick={onExitReorderMode}
              className="min-h-[40px] px-3 py-1.5 text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              Done
            </button>
          ) : (
            <div className="relative" ref={beatMenuRef}>
              <button
                id="btn-header-add-beat"
                type="button"
                onClick={() => {
                  setIsBeatMenuOpen(!isBeatMenuOpen);
                  stopPreviewAudio();
                }}
                className={`min-h-[40px] flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  importedBeat
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
                title={importedBeat ? `Beat: ${importedBeat.name}` : 'Add backing beat'}
              >
                {isAnalyzingBeatExternal ? (
                  <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0" title="Analyzing beat arrangement...">
                    <svg className="w-3.5 h-3.5 -rotate-90 animate-spin" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" className="stroke-amber-500/20" strokeWidth="3" fill="none" />
                      <circle cx="12" cy="12" r="9" className="stroke-amber-500" strokeWidth="3" strokeDasharray="56" strokeDashoffset="18" strokeLinecap="round" fill="none" />
                    </svg>
                  </div>
                ) : (
                  <Music className={`w-3.5 h-3.5 shrink-0 ${importedBeat ? 'text-amber-400' : 'text-amber-500/80'}`} />
                )}
                <span className="text-xs font-medium max-w-[120px] sm:max-w-[190px] truncate">
                  {importedBeat ? importedBeat.name : 'Add Beat'}
                </span>
              </button>

            {/* DIRECT BACKING BEAT POPOVER MODAL */}
            {isBeatMenuOpen && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 rounded-2xl z-50 p-4 border backdrop-blur-2xl animate-fadeIn bg-[#18181A]/95 border-white/10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
                {/* Header Row */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-500/10 mb-3">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">Backing Track</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBeatMenuOpen(false);
                      stopPreviewAudio();
                    }}
                    className="p-1 rounded-md transition cursor-pointer hover:bg-white/10 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Currently Loaded Beat Card (If Present) */}
                {importedBeat ? (
                  <div className="space-y-2">
                    <div className="p-3.5 rounded-xl border transition bg-amber-500/10 border-amber-500/30 text-amber-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-amber-500 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span>Active Audio Track</span>
                          </div>
                          <h4 className="text-sm font-bold truncate mt-1">
                            {importedBeat.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] font-mono opacity-80 mt-1">
                            <span>{importedBeat.bpm || bpm} BPM</span>
                            <span>&bull;</span>
                            <span>{formatDuration(importedBeat.duration)}</span>
                          </div>
                        </div>

                        {/* Quick Playback Preview & Remove Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={handleToggleCurrentBeatPreview}
                            className={`p-2 rounded-lg transition cursor-pointer border ${
                              isBeatAudioPreviewPlaying
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-black/40 text-amber-300 border-amber-500/40 hover:bg-amber-500/20'
                            }`}
                            title={isBeatAudioPreviewPlaying ? 'Pause Preview' : 'Play Beat Preview'}
                          >
                            {isBeatAudioPreviewPlaying ? (
                              <Square className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              stopPreviewAudio();
                              if (onRemoveBeat) onRemoveBeat();
                              showFeedback('Beat removed');
                            }}
                            className="p-2 rounded-lg transition cursor-pointer border text-red-500 hover:bg-red-500/15 border-red-500/30 bg-black/40"
                            title="Remove backing beat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Re-analyze Beat Arrangement Button */}
                    {onReanalyzeBeat && !importedBeat.isStarter && (
                      <button
                        type="button"
                        disabled={isAnalyzingBeatExternal || isTakeInProgress}
                        onClick={() => {
                          stopPreviewAudio();
                          setIsBeatMenuOpen(false);
                          onReanalyzeBeat();
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-amber-500/25 hover:border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15 text-xs font-medium text-amber-300 hover:text-amber-200 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingBeatExternal ? 'animate-spin' : ''}`} />
                        <span>{isAnalyzingBeatExternal ? 'Analyzing Arrangement...' : 'Re-analyze Beat Arrangement'}</span>
                      </button>
                    )}

                    {/* Replace Beat Button */}
                    <button
                      type="button"
                      onClick={() => {
                        stopPreviewAudio();
                        beatFileInputRef.current?.click();
                      }}
                      className="w-full py-2 px-3 rounded-xl border border-white/10 hover:border-amber-500/40 bg-white/5 hover:bg-amber-500/10 text-xs font-medium text-zinc-300 hover:text-amber-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload Different Audio File</span>
                    </button>

                    {onWipeAudioAndBeat && (
                      <button
                        type="button"
                        onClick={() => {
                          stopPreviewAudio();
                          setIsBeatMenuOpen(false);
                          onWipeAudioAndBeat();
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-red-500/20 hover:border-red-500/40 bg-red-500/10 hover:bg-red-500/15 text-xs font-medium text-red-400 hover:text-red-300 transition-colors flex items-center justify-center gap-2 cursor-pointer mt-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Wipe Audio Recordings & Beat</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(true);
                    }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && isAudioFile(file)) {
                        void handleAudioFileUpload(file);
                      } else if (file) {
                        onNotify?.('That file does not look like audio. Try MP3, WAV or M4A.', 'error');
                      }
                    }}
                    onClick={() => beatFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 group ${
                      isDraggingOver
                        ? 'border-amber-500 bg-amber-500/10 scale-[1.02]'
                        : 'border-white/15 hover:border-amber-500 hover:bg-amber-500/5 bg-black/20'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 bg-amber-500/20 text-amber-400">
                      <UploadCloud className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold tracking-tight">
                        Click to browse or drag audio here
                      </p>
                      <p className="text-[10px] opacity-60 mt-0.5">
                        Supports MP3, WAV, M4A, AAC, FLAC
                      </p>
                    </div>
                  </div>
                )}

                {onChangeBpm && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Count-in tempo</span>
                    {isBpmEditing && !isTakeInProgress ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={40}
                          max={240}
                          value={tempBpm}
                          onChange={(e) => setTempBpm(e.target.value)}
                          onBlur={handleBpmSubmit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleBpmSubmit();
                            if (e.key === 'Escape') {
                              setIsBpmEditing(false);
                              setTempBpm(String(bpm));
                            }
                          }}
                          autoFocus
                          className="w-16 px-2 py-1 text-base sm:text-xs font-mono font-bold rounded-lg border outline-none text-center bg-black/90 border-amber-400 text-amber-300"
                        />
                        <span className="text-[10px] font-mono text-zinc-400">BPM</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isTakeInProgress}
                        onClick={() => {
                          if (isTakeInProgress) {
                            onNotify?.('Stop recording before changing tempo.');
                            return;
                          }
                          setTempBpm(String(bpm));
                          setIsBpmEditing(true);
                        }}
                        title={isTakeInProgress ? 'Stop recording before changing tempo' : 'Edit count-in tempo'}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-mono text-xs text-zinc-200 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="font-bold text-amber-400">{bpm}</span>{' '}
                        <span className="text-zinc-400">BPM</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          )}
        </div>
      </div>

      {/* Subtle Floating Audio Upload Feedback Toast */}
      {uploadFeedback && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fadeIn">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#161619]/95 text-white border border-amber-500/40 shadow-[0_12px_32px_rgba(0,0,0,0.85)] backdrop-blur-2xl text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            <span className="font-medium text-amber-200">{uploadFeedback}</span>
          </div>
        </div>
      )}
    </header>
  );
}

export default memo(Header);
