import { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import Header, { type BeatImportOptions, type BeatImportOutcome } from './components/Header';
import LyricToolbar from './components/LyricToolbar';
import SectionBlock, { type FocusRequest } from './components/SectionBlock';
import MasterPlaybackDock from './components/MasterPlaybackDock';
import LibraryView from './components/LibraryView';
import {
  SongSection, SectionType, Take, ImportedBeat, SongSession, BeatAnalysis, ArrangementSource,
} from './types';
import { fetchSongSuggestions, formatAiError, getAiFeatures, type AiFeatures } from './services/ai';
import { analyzeBeatStructure, isFinalArrangement, toBeatAnalysis } from './services/structureAnalysis';
import { markRepeatedLyricsAsHook } from './utils/structure';
import {
  createImmediateBeat,
  createStarterBeats,
  decodeBeatFile,
  resolveLocalBeatArrangement,
  validateBeatFile,
} from './services/beatImport';
import { evictVocalBuffer } from './utils/mixer';
import { buildRhymeWordMap, RhymeWordInfo } from './utils/rhyme';
import { useSyncSettings } from './utils/settings';
import {
  beatBlobKey,
  blobUrlRegistry,
  hasAudioWipeMarker,
  loadWorkspace,
  markAudioWiped,
  rehydrateSessions,
  saveWorkspace,
  takeBlobKey,
} from './utils/storage';
import {
  applyGridSnapToArrangement,
  type BeatGrid,
} from './utils/arrangement';
import {
  resolveSectionTimings,
  findTimingAt,
  findVocalAtTime,
  resolveActiveWorkspaceLine,
  hasExplicitTimings,
  insertSectionNonDestructive,
  deleteSectionNonDestructive,
  reorderSectionsNonDestructive,
  moveSectionBoundary,
  applyReanalyzedArrangement,
} from './utils/timeline';
import { useAudioEngine, NO_AUDIO_PLACEHOLDER_SEC } from './hooks/useAudioEngine';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { LocateFixed } from 'lucide-react';
import { Reorder } from 'framer-motion';

const KaraokeLyricsModal = lazy(() => import('./components/KaraokeLyricsModal'));


interface NoticeAction {
  label: string;
  onClick: () => void;
}

interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'error';
  action?: NoticeAction;
}

function newBlankSection(placeholder = 'Start writing your lyrics...'): SongSection {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'verse',
    repetitions: 1,
    isLooping: false,
    text: '',
    placeholder,
    voiceNotes: [],
  };
}

/**
 * Applies an undo/redo snapshot to the current sections without discarding
 * recordings: takes are not part of the undoable text history, so for any
 * section that still exists the current takes win.
 */
function applySnapshot(snapshot: SongSection[], current: SongSection[]): SongSection[] {
  return snapshot.map(s => {
    const live = current.find(c => c.id === s.id);
    return live ? { ...s, voiceNotes: live.voiceNotes } : s;
  });
}

/**
 * Returns a function whose identity never changes but always runs the latest
 * `fn`. Lets memoized children (the section list) skip re-rendering on every
 * clock tick while still calling handlers that see current state.
 */
function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => { ref.current = fn; });
  return useCallback((...args: A) => ref.current(...args), []);
}

export default function App() {
  // --- Sessions & Library State ---
  const [viewMode, setViewMode] = useState<'studio' | 'library'>('studio');
  const viewModeRef = useRef<'studio' | 'library'>('studio');
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  const [sessions, setSessions] = useState<SongSession[]>(() => {
    const now = Date.now();
    return [
      {
        id: 'session-1',
        title: 'Untitled Track',
        isCustomTitle: false,
        updatedAt: 'Just now',
        updatedAtTimestamp: now,
        createdAt: now,
        bpm: 120,
        sections: [newBlankSection()],
        importedBeat: null,
      },
    ];
  });
  const [beats, setBeats] = useState<ImportedBeat[]>([]);
  const [isImportingLibraryBeat, setIsImportingLibraryBeat] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState<string>('session-1');
  const [sections, setSections] = useState<SongSection[]>(() => sessions[0].sections);
  const [importedBeat, setImportedBeat] = useState<ImportedBeat | null>(null);
  const [bpm, setBpm] = useState<number>(120);
  const [arrangementSource, setArrangementSource] = useState<ArrangementSource>('even');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [isAnalyzingBeatBg, setIsAnalyzingBeatBg] = useState<boolean>(false);
  const [pendingReanalysis, setPendingReanalysis] = useState<{
    beat: ImportedBeat;
    analysis: BeatAnalysis;
  } | null>(null);
  const beatAnalysisTokenRef = useRef<number>(0);
  const beatAnalysisAbortRef = useRef<AbortController | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(() => sessions[0].sections[0].id);

  const [syncSettings, updateSyncSettings, resetSyncSettings] = useSyncSettings();

  // --- Transient notices (errors and status the user must see) ---
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = useCallback((text: string, tone: Notice['tone'] = 'info', action?: NoticeAction) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ id: Date.now(), text, tone, action });
    // Notices with a button stay up longer so there is time to use it.
    noticeTimerRef.current = setTimeout(() => setNotice(null), action ? 12000 : tone === 'error' ? 6000 : 4000);
  }, []);
  useEffect(() => () => { if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current); }, []);

  // Global vocal mute (hear the beat solo). Recorded takes are untouched.
  const [isVocalMuted, setIsVocalMuted] = useState<boolean>(false);

  // --- Persistence ---
  // Songs and audio are restored from IndexedDB on load and saved shortly after each change.
  const [hydrated, setHydrated] = useState(false);
  const saveFailureShownRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadWorkspace()
      .then(loaded => {
        if (cancelled) return;
        if (loaded) {
          let { sessions: restored, activeSessionId: restoredActive, beats: restoredBeats } = rehydrateSessions(loaded);
          if (!hasAudioWipeMarker()) {
            markAudioWiped();
            restored = restored.map(s => ({
              ...s,
              importedBeat: null,
              sections: s.sections.map(sec => ({ ...sec, voiceNotes: [] })),
            }));
            const active = restored.find(s => s.id === restoredActive) ?? restored[0];
            setSessions(restored);
            setBeats([]);
            setActiveSessionId(active.id);
            setSections(active.sections);
            setImportedBeat(null);
            setBpm(active.bpm);
            setActiveSectionId(active.sections[0]?.id ?? null);
            showNotice('Wiped all audio recordings and uploaded beat. Lyrics kept.');
            saveWorkspace(restored, active.id, []).catch(() => {});
            setHydrated(true);
            return;
          }

          const active = restored.find(s => s.id === restoredActive) ?? restored[0];
          const initialBeats = restoredBeats.length > 0 ? restoredBeats : createStarterBeats();
          setSessions(restored);
          setBeats(initialBeats);
          setActiveSessionId(active.id);
          setSections(active.sections);
          setImportedBeat(active.importedBeat);
          setBpm(active.bpm);
          setArrangementSource(
            active.arrangementSource ?? (hasExplicitTimings(active.sections) ? 'ai' : 'even')
          );
          setActiveSectionId(active.sections[0]?.id ?? null);
          showNotice('Restored your last session.');
        } else {
          markAudioWiped();
          setBeats(createStarterBeats());
        }
        setHydrated(true);
      })
      .catch(err => {
        console.warn('Could not load saved workspace:', err);
        if (!cancelled) {
          setHydrated(true);
          showNotice('Could not read saved songs in this browser.', 'error');
        }
      });
    return () => { cancelled = true; };
  }, [showNotice]);


  // --- Writing assistance, focus & reorder mode ---
  const [undoStack, setUndoStack] = useState<SongSection[][]>([]);
  const [redoStack, setRedoStack] = useState<SongSection[][]>([]);
  const undoStackRef = useRef<SongSection[][]>(undoStack);
  const redoStackRef = useRef<SongSection[][]>(redoStack);
  useEffect(() => { undoStackRef.current = undoStack; }, [undoStack]);
  useEffect(() => { redoStackRef.current = redoStack; }, [redoStack]);
  /** Takes from deleted sections kept alive until no longer reachable via Undo/Redo. */
  const deferredTakesRef = useRef<Map<string, Take>>(new Map());
  const lastSnapshotTimeRef = useRef<number>(0);
  const [showRhymes, setShowRhymes] = useState<boolean>(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState<boolean>(false);
  const continuationAbortRef = useRef<AbortController | null>(null);
  const [isReorderMode, setIsReorderMode] = useState<boolean>(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [isTextareaFocused, setIsTextareaFocused] = useState<boolean>(false);
  const [hasUserInteractedWithCanvas, setHasUserInteractedWithCanvas] = useState<boolean>(false);
  const [keyboardInsetPx, setKeyboardInsetPx] = useState<number>(0);
  const blurClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialBlankFocusDoneRef = useRef<boolean>(false);

  const requestFocusSection = useCallback((sectionId: string, caret: 'start' | 'end' = 'end') => {
    setFocusRequest({ sectionId, nonce: Date.now() + Math.random(), caret });
  }, []);

  const allLyricsText = useMemo(() => sections.map(s => s.text).join('\n'), [sections]);

  const rhymeWordMap = useMemo(() => {
    if (!showRhymes) return new Map<string, RhymeWordInfo>();
    return buildRhymeWordMap(allLyricsText);
  }, [showRhymes, allLyricsText]);

  const [activeTakeIndices, setActiveTakeIndices] = useState<Record<string, number>>({});
  const [isLiveLyricsOpen, setIsLiveLyricsOpen] = useState<boolean>(false);
  const isLiveLyricsOpenRef = useRef<boolean>(false);
  useEffect(() => { isLiveLyricsOpenRef.current = isLiveLyricsOpen; }, [isLiveLyricsOpen]);
  const [isDockMinimized, setIsDockMinimized] = useState<boolean>(true);
  const workspaceScrollRef = useRef<HTMLElement | null>(null);
  const [isAutoScrollPausedByUser, setIsAutoScrollPausedByUser] = useState<boolean>(false);
  const userScrollResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingAtRef = useRef<number>(0);

  // Auto-exit reorder mode when fewer than 2 stanzas remain or leaving studio
  useEffect(() => {
    if (isReorderMode && (sections.length <= 1 || viewMode !== 'studio')) {
      setIsReorderMode(false);
    }
  }, [isReorderMode, sections.length, viewMode]);

  // Auto-focus blank canvas on initial load so the user can start typing immediately
  useEffect(() => {
    if (!hydrated || initialBlankFocusDoneRef.current) return;
    initialBlankFocusDoneRef.current = true;
    if (viewMode !== 'studio') return;
    const isBlank = sections.every(s => !s.text.trim());
    if (isBlank && sections[0]) {
      requestFocusSection(sections[0].id, 'end');
    }
  }, [hydrated, viewMode, sections, requestFocusSection]);

  // --- Shared recording state refs (read by useAudioEngine, driven by useVoiceRecorder) ---
  const isCountingDownRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  /**
   * True from the Record tap until the take is saved or cancelled, including
   * the moments between the count-in and the mic starting, and while a stopped
   * take is being saved. Earlier takes stay silent and only the Record button
   * drives the transport (Play, seeking and beat changes are ignored), so the
   * take can't be knocked out of step with the beat.
   */
  const takeInProgressRef = useRef<boolean>(false);

  // Mirrors of state for callbacks that outlive a render (timers, audio events).
  const sectionsRef = useRef(sections);
  const activeSectionIdRef = useRef(activeSectionId);
  const takeIndicesRef = useRef(activeTakeIndices);
  const importedBeatRef = useRef(importedBeat);
  const settingsRef = useRef(syncSettings);
  const bpmRef = useRef(bpm);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  useEffect(() => { activeSectionIdRef.current = activeSectionId; }, [activeSectionId]);
  useEffect(() => { takeIndicesRef.current = activeTakeIndices; }, [activeTakeIndices]);
  useEffect(() => { importedBeatRef.current = importedBeat; }, [importedBeat]);
  useEffect(() => { settingsRef.current = syncSettings; }, [syncSettings]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  // The active section must always exist (undo, delete and import can all remove it).
  useEffect(() => {
    if (sections.length > 0 && !sections.some(s => s.id === activeSectionId)) {
      setActiveSectionId(sections[0].id);
    }
  }, [sections, activeSectionId]);

  // The song list with the open song's live edits folded in. Derived rather
  // than copied into `sessions` by an effect: the copy cost a second full
  // render on every keystroke, and on slow phones those back-to-back renders
  // could pile up into React's "maximum update depth" crash.
  // `sessions` keeps the open song's id and title; its lyrics, beat and tempo
  // come from the live state until the song is switched away from.
  // Auto-title from the first non-empty lyric line (Apple Notes style) unless custom-named.
  const autoTitleFromLyrics = useMemo(() => {
    for (const sec of sections) {
      const firstLine = sec.text
        .split('\n')
        .map(line => line.trim())
        .find(Boolean);
      if (firstLine) return firstLine.slice(0, 60);
    }
    return null;
  }, [sections]);

  const liveSessions = useMemo(
    () =>
      sessions.map(s => {
        if (s.id !== activeSessionId) return s;
        const shouldAutoTitle =
          s.isCustomTitle === false ||
          (s.isCustomTitle === undefined &&
            (!s.title || s.title === 'Untitled Track' || s.title === 'Untitled Song' || /^Song #\d+$/.test(s.title)));
        const resolvedTitle = shouldAutoTitle ? autoTitleFromLyrics || 'Untitled Track' : s.title;
        return {
          ...s,
          title: resolvedTitle,
          sections,
          importedBeat,
          bpm,
          arrangementSource,
          updatedAt: 'Just now',
        };
      }),
    [sessions, activeSessionId, sections, importedBeat, bpm, arrangementSource, autoTitleFromLyrics]
  );

  const currentSession = liveSessions.find(s => s.id === activeSessionId) || liveSessions[0];
  const isUntitledTrack = !currentSession?.title || currentSession.title === 'Untitled Track';

  // Autosave, debounced so typing doesn't hit storage on every key.
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      saveWorkspace(liveSessions, activeSessionId, beats).catch(err => {
        console.warn('Autosave failed:', err);
        if (!saveFailureShownRef.current) {
          saveFailureShownRef.current = true;
          showNotice('Could not save to this browser (storage may be full or blocked). Your work will be lost on reload.', 'error');
        }
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [liveSessions, activeSessionId, beats, hydrated, showNotice]);

  // Keep blobUrlRegistry synchronized with all beats and vocal takes still reachable
  // from live sessions, the Beat Vault, or undo/redo history.
  useEffect(() => {
    if (!hydrated) return;
    const activeKeys = new Set<string>();
    for (const beat of beats) {
      activeKeys.add(beatBlobKey(beat.id));
    }
    for (const session of liveSessions) {
      if (session.importedBeat) {
        activeKeys.add(beatBlobKey(session.importedBeat.id));
      }
      for (const sec of session.sections) {
        for (const take of sec.voiceNotes || []) {
          activeKeys.add(takeBlobKey(take.id));
        }
      }
    }
    for (const snap of undoStack) {
      for (const sec of snap) {
        for (const take of sec.voiceNotes || []) {
          activeKeys.add(takeBlobKey(take.id));
        }
      }
    }
    for (const snap of redoStack) {
      for (const sec of snap) {
        for (const take of sec.voiceNotes || []) {
          activeKeys.add(takeBlobKey(take.id));
        }
      }
    }
    blobUrlRegistry.syncActiveIds(activeKeys);
  }, [hydrated, liveSessions, beats, undoStack, redoStack]);

  const realTimelineDuration = useMemo(() => {
    if (importedBeat?.duration && importedBeat.duration > 0) return importedBeat.duration;
    const maxSectionEnd = Math.max(0, ...sections.map(s => s.endTimeSec || 0));
    if (maxSectionEnd > 0) return maxSectionEnd;
    const maxTake = Math.max(
      0,
      ...sections.flatMap(s => (s.voiceNotes || []).map(vn => (vn.startBeatOffsetSec || 0) + (vn.duration || 0)))
    );
    return maxTake > 0 ? maxTake : 0;
  }, [importedBeat, sections]);

  const totalDuration = useMemo(() => {
    if (realTimelineDuration > 0) return realTimelineDuration;
    return importedBeat?.audioUrl || sections.length > 0 ? NO_AUDIO_PLACEHOLDER_SEC : 0;
  }, [realTimelineDuration, importedBeat, sections.length]);

  const activeBeatGrid = useMemo<BeatGrid | null>(() => {
    const gridBpm =
      importedBeat?.bpm && importedBeat.bpm >= 40 && importedBeat.bpm <= 240
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

  const resolvedSectionTimings = useMemo(
    () => resolveSectionTimings(sections, totalDuration),
    [sections, totalDuration]
  );
  const timingsRef = useRef(resolvedSectionTimings);
  useEffect(() => { timingsRef.current = resolvedSectionTimings; }, [resolvedSectionTimings]);
  const totalDurationRef = useRef(totalDuration);
  useEffect(() => { totalDurationRef.current = totalDuration; }, [totalDuration]);

  const resumeAutoScrollNow = useCallback(() => {
    if (userScrollResumeTimerRef.current) {
      clearTimeout(userScrollResumeTimerRef.current);
      userScrollResumeTimerRef.current = null;
    }
    setIsAutoScrollPausedByUser(false);
  }, []);

  const {
    currentTime,
    setCurrentTime,
    currentTimeRef,
    isGlobalPlaying,
    setIsGlobalPlaying,
    isPlayingRef,
    globalBeatAudioRef,
    globalVocalAudioRef,
    playElement,
    seekAudioToTime,
    handleSeekToTime,
    handleUserSeek,
    handleJumpToSection,
    handleTogglePlay,
    pauseVocal,
    stopPlayback,
    resetPlayback,
    jumpWithLoopFade,
  } = useAudioEngine({
    sections,
    importedBeat,
    setImportedBeat,
    activeTakeIndices,
    resolvedSectionTimings,
    totalDuration,
    syncSettings,
    isVocalMuted,
    isRecordingRef,
    isCountingDownRef,
    takeInProgressRef,
    isLiveLyricsOpenRef,
    setActiveSectionId,
    onResumeAutoScroll: resumeAutoScrollNow,
    showNotice,
  });

  const addTakeToSection = useCallback((sectionId: string, take: Take) => {
    const existingCount = sectionsRef.current.find(s => s.id === sectionId)?.voiceNotes?.length ?? 0;
    setSections(prev => prev.map(sec => (sec.id === sectionId ? { ...sec, voiceNotes: [...(sec.voiceNotes || []), take] } : sec)));
    setActiveTakeIndices(prev => {
      const next = { ...prev, [sectionId]: existingCount };
      takeIndicesRef.current = next;
      return next;
    });
  }, []);

  const patchTake = useCallback((sectionId: string, takeId: string, patch: Partial<Take>) => {
    setSections(prev =>
      prev.map(sec =>
        sec.id === sectionId
          ? { ...sec, voiceNotes: (sec.voiceNotes || []).map(t => (t.id === takeId ? { ...t, ...patch } : t)) }
          : sec
      )
    );
  }, []);

  const {
    isCountingDown,
    countdownVal,
    isRecording,
    recordingSectionId,
    transcribingTakeIds,
    isBusyRecording,
    handleToggleRecord,
    abortTakeTranscription,
    abortAllTakeTranscriptions,
    handleRetryTakeTranscription,
  } = useVoiceRecorder({
    sectionsRef,
    activeSectionIdRef,
    importedBeatRef,
    bpmRef,
    timingsRef,
    settingsRef,
    currentTimeRef,
    setCurrentTime,
    globalBeatAudioRef,
    isPlayingRef,
    setIsGlobalPlaying,
    playElement,
    seekAudioToTime,
    handleSeekToTime,
    pauseVocal,
    isCountingDownRef,
    isRecordingRef,
    takeInProgressRef,
    setActiveSectionId,
    setIsReorderMode,
    addTakeToSection,
    patchTake,
    showNotice,
  });

  const currentlyPlayingSection = useMemo(() => {
    const hit = findTimingAt(resolvedSectionTimings, currentTime);
    return sections.find(s => s.id === hit?.id) || sections[0];
  }, [sections, resolvedSectionTimings, currentTime]);

  // Abort pending AI calls, clear UI timers, and release all blob URLs when the app unmounts.
  useEffect(() => {
    return () => {
      continuationAbortRef.current?.abort();
      beatAnalysisAbortRef.current?.abort();
      if (userScrollResumeTimerRef.current) clearTimeout(userScrollResumeTimerRef.current);
      if (blurClearTimerRef.current) clearTimeout(blurClearTimerRef.current);
      blobUrlRegistry.clear();
    };
  }, []);

  const handleCycleTake = (sectionId: string, direction: 1 | -1) => {
    if (isBusyRecording()) return showNotice('Stop recording before switching takes.');
    const sec = sectionsRef.current.find(s => s.id === sectionId);
    const total = sec?.voiceNotes?.length ?? 0;
    if (!sec || total === 0) return;
    setActiveTakeIndices(prev => ({ ...prev, [sectionId]: ((prev[sectionId] ?? 0) + direction + total) % total }));
    // The clock loop picks up the new take on its next tick while playing.
  };

  const reclaimOrphanedDeferredTakes = useCallback(
    (liveSections: SongSection[], nextUndo: SongSection[][], nextRedo: SongSection[][]) => {
      if (deferredTakesRef.current.size === 0) return;
      const retainedIds = new Set<string>();
      const collect = (list: SongSection[]) => {
        for (const sec of list) {
          if (!sec.voiceNotes) continue;
          for (const t of sec.voiceNotes) retainedIds.add(t.id);
        }
      };
      collect(liveSections);
      for (const snap of nextUndo) collect(snap);
      for (const snap of nextRedo) collect(snap);

      for (const takeId of deferredTakesRef.current.keys()) {
        if (!retainedIds.has(takeId)) {
          abortTakeTranscription(takeId);
          evictVocalBuffer(takeId);
          deferredTakesRef.current.delete(takeId);
        }
      }
    },
    [abortTakeTranscription]
  );

  const handleDeleteTake = (sectionId: string, takeId: string) => {
    if (isBusyRecording()) return showNotice('Stop recording before deleting takes.');
    const sec = sectionsRef.current.find(s => s.id === sectionId);
    const take = sec?.voiceNotes?.find(t => t.id === takeId);
    if (!sec || !take) return;
    const remaining = sec.voiceNotes.length - 1;

    abortTakeTranscription(takeId);
    deferredTakesRef.current.delete(takeId);
    const stripTake = (list: SongSection[]) =>
      list.map(s =>
        s.voiceNotes?.some(t => t.id === takeId)
          ? { ...s, voiceNotes: s.voiceNotes.filter(t => t.id !== takeId) }
          : s
      );
    setSections(prev =>
      prev.map(s => (s.id === sectionId ? { ...s, voiceNotes: s.voiceNotes.filter(t => t.id !== takeId) } : s))
    );
    const nextUndo = undoStackRef.current.map(stripTake);
    const nextRedo = redoStackRef.current.map(stripTake);
    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    setUndoStack(nextUndo);
    setRedoStack(nextRedo);
    setActiveTakeIndices(prev => ({ ...prev, [sectionId]: Math.max(0, Math.min(prev[sectionId] ?? 0, remaining - 1)) }));
    evictVocalBuffer(takeId);
    globalVocalAudioRef.current?.pause();
  };

  // --- History ---
  const pushUndoSnapshot = useCallback((snapshot: SongSection[], nextLiveSections?: SongSection[]) => {
    const nextUndo = [...undoStackRef.current.slice(-30), snapshot];
    const nextRedo: SongSection[][] = [];
    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    setUndoStack(nextUndo);
    setRedoStack(nextRedo);
    reclaimOrphanedDeferredTakes(nextLiveSections ?? sectionsRef.current, nextUndo, nextRedo);
  }, [reclaimOrphanedDeferredTakes]);

  const handleUndo = useCallback(() => {
    if (isBusyRecording()) {
      showNotice('Stop recording before undoing changes.');
      return;
    }
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    const nextUndo = undoStack.slice(0, -1);
    const nextRedo = [sections, ...redoStack];
    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    setUndoStack(nextUndo);
    setRedoStack(nextRedo);
    setSections(applySnapshot(previous, sections));
  }, [isBusyRecording, showNotice, undoStack, redoStack, sections]);

  const handleRedo = useCallback(() => {
    if (isBusyRecording()) {
      showNotice('Stop recording before redoing changes.');
      return;
    }
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    const nextRedo = redoStack.slice(1);
    const nextUndo = [...undoStack, sections];
    undoStackRef.current = nextUndo;
    redoStackRef.current = nextRedo;
    setRedoStack(nextRedo);
    setUndoStack(nextUndo);
    setSections(applySnapshot(next, sections));
  }, [isBusyRecording, showNotice, redoStack, undoStack, sections]);

  // Shortcuts: Cmd/Ctrl+Z undo, Cmd+Shift+Z / Ctrl+Y redo, Space play/pause.
  useEffect(() => {
    const isTypingTarget = () => {
      const el = document.activeElement as HTMLElement | null;
      const tag = (el?.tagName || '').toLowerCase();
      return tag === 'textarea' || tag === 'input' || Boolean(el?.isContentEditable);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (viewModeRef.current !== 'studio') return;
      if (e.key === 'Escape' && isReorderMode) {
        e.preventDefault();
        setIsReorderMode(false);
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.code === 'Space' && !isTypingTarget() && !e.repeat) {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    // Space activates a focused button on keyup; suppress that so it can't re-trigger Record.
    const onKeyUp = (e: KeyboardEvent) => {
      if (viewModeRef.current !== 'studio') return;
      if (e.code === 'Space' && !isTypingTarget()) e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleUndo, handleRedo, handleTogglePlay, isReorderMode]);

  // --- Section CRUD ---
  const handleUpdateText = (id: string, text: string) => {
    const now = Date.now();
    lastTypingAtRef.current = now;
    if (now - lastSnapshotTimeRef.current > 1200) {
      pushUndoSnapshot(sections);
      lastSnapshotTimeRef.current = now;
    }
    setSections(prev => prev.map(s => (s.id === id ? { ...s, text } : s)));
  };

  const handleUpdateType = (id: string, type: SectionType) => {
    pushUndoSnapshot(sections);
    setSections(prev => prev.map(s => (s.id === id ? { ...s, type } : s)));
  };

  const handleCycleLoopState = (id: string) => {
    setSections(prev =>
      prev.map(s => (s.id === id ? { ...s, isLooping: !s.isLooping, repetitions: 1 } : s))
    );
  };

  const handleDeleteSection = (id: string) => {
    if (isBusyRecording()) return showNotice('Stop recording before deleting sections.');
    const deleteIdx = sections.findIndex(s => s.id === id);
    if (deleteIdx === -1) return;
    const doomed = sections[deleteIdx];
    // Defer revoking blob URLs & evicting buffers so Undo can restore playable takes.
    if (doomed?.voiceNotes?.length) {
      doomed.voiceNotes.forEach(t => {
        deferredTakesRef.current.set(t.id, t);
      });
      pauseVocal();
    }
    const updated = deleteSectionNonDestructive(
      sections,
      deleteIdx,
      realTimelineDuration,
      newBlankSection()
    );
    pushUndoSnapshot(sections, updated);
    setSections(updated);
    if (hasExplicitTimings(updated)) setArrangementSource('manual');
    if (activeSectionId === id) {
      const nextFocus = updated[Math.max(0, deleteIdx - 1)] || updated[0];
      setActiveSectionId(nextFocus?.id || null);
    }
  };

  const handleDeleteEmptyAndFocusPrev = (id: string) => {
    if (isBusyRecording()) return;
    const idx = sections.findIndex(s => s.id === id);
    if (idx === -1 || sections.length <= 1) return;
    const prevSec = sections[idx > 0 ? idx - 1 : 1];
    handleDeleteSection(id);
    if (prevSec) {
      setActiveSectionId(prevSec.id);
      requestFocusSection(prevSec.id, 'end');
    }
  };

  const handleDuplicateSection = (id: string) => {
    if (isBusyRecording()) return showNotice('Stop recording before editing sections.');
    const idx = sections.findIndex(s => s.id === id);
    if (idx === -1) return;
    const target = sections[idx];
    pushUndoSnapshot(sections);
    const copyOf: SongSection = { ...target, id: `s-${Date.now()}`, voiceNotes: [] };
    const updated = insertSectionNonDestructive(
      sections,
      idx,
      copyOf,
      realTimelineDuration,
      activeBeatGrid,
      snapToGrid
    );
    setSections(updated);
    if (hasExplicitTimings(updated)) setArrangementSource('manual');
    setActiveSectionId(copyOf.id);
    requestFocusSection(copyOf.id, 'end');
  };

  const handleAddSectionBelow = (afterSectionId?: string) => {
    if (isBusyRecording()) return showNotice('Stop recording before adding sections.');
    pushUndoSnapshot(sections);
    const defaultTypes: SectionType[] = ['verse', 'chorus', 'bridge', 'hook'];
    const added: SongSection = {
      ...newBlankSection('Start writing your lyrics...'),
      type: defaultTypes[(sections.length + 1) % defaultTypes.length],
    };
    const idx = afterSectionId ? sections.findIndex(s => s.id === afterSectionId) : sections.length - 1;
    const updated = insertSectionNonDestructive(
      sections,
      idx,
      added,
      realTimelineDuration,
      activeBeatGrid,
      snapToGrid
    );
    setSections(updated);
    if (hasExplicitTimings(updated)) setArrangementSource('manual');
    setActiveSectionId(added.id);
    requestFocusSection(added.id, 'start');
  };

  const handleReorderSections = useCallback((reordered: SongSection[]) => {
    if (isBusyRecording()) return;
    setSections(prev => reorderSectionsNonDestructive(reordered, prev, realTimelineDuration));
    if (realTimelineDuration > 0 && hasExplicitTimings(sectionsRef.current)) {
      setArrangementSource('manual');
    }
  }, [realTimelineDuration]);

  const handleCommitSectionBoundary = useCallback(
    (boundaryIndex: number, newTimeSec: number) => {
      if (isBusyRecording()) return;
      const current = sectionsRef.current;
      const effectiveDur = realTimelineDuration > 0 ? realTimelineDuration : totalDurationRef.current;
      if (!(effectiveDur > 0) || boundaryIndex <= 0 || boundaryIndex >= current.length) return;

      pushUndoSnapshot(current);
      const updated = moveSectionBoundary(
        current,
        boundaryIndex,
        newTimeSec,
        effectiveDur,
        activeBeatGrid,
        snapToGrid
      );
      setSections(updated);
      setArrangementSource('manual');

      // Seamless mid-playback adaptation if a looping section's bounds shifted past/before the playhead
      if (isPlayingRef.current) {
        const nextTimings = resolveSectionTimings(updated, effectiveDur);
        const nowTime = currentTimeRef.current;
        const leftSec = updated[boundaryIndex - 1];
        const rightSec = updated[boundaryIndex];
        const leftTiming = nextTimings[boundaryIndex - 1];
        const rightTiming = nextTimings[boundaryIndex];

        let targetJump: number | null = null;
        if (leftSec?.isLooping && leftTiming && nowTime >= leftTiming.end && nowTime <= rightTiming.end) {
          targetJump = leftTiming.start;
        } else if (rightSec?.isLooping && rightTiming && nowTime < rightTiming.start && nowTime >= leftTiming.start) {
          targetJump = rightTiming.start;
        }

        if (targetJump !== null) {
          jumpWithLoopFade(targetJump);
        }
      }
    },
    [realTimelineDuration, activeBeatGrid, snapToGrid, pushUndoSnapshot, jumpWithLoopFade]
  );

  // --- Beat import & Library beat catalog ---
  const upsertBeatInLibrary = useCallback((beat: ImportedBeat) => {
    const stamped: ImportedBeat = { ...beat, createdAt: beat.createdAt ?? Date.now() };
    setBeats(prev => {
      const idx = prev.findIndex(b => b.id === stamped.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...stamped };
        return next;
      }
      return [stamped, ...prev];
    });
  }, []);

  const cacheBeatMetadata = useCallback((beatId: string, patch: Partial<ImportedBeat>) => {
    setBeats(prev => prev.map(b => (b.id === beatId ? { ...b, ...patch } : b)));
    setSessions(prev =>
      prev.map(s => (s.importedBeat?.id === beatId ? { ...s, importedBeat: { ...s.importedBeat, ...patch } } : s))
    );
    if (importedBeatRef.current?.id === beatId) {
      setImportedBeat(prev => {
        if (!prev || prev.id !== beatId) return prev;
        const merged = { ...prev, ...patch };
        importedBeatRef.current = merged;
        return merged;
      });
    }
  }, []);

  /**
   * Sections a beat in the browser (utils/structure: beats, downbeats, repetition,
   * names) for a newly imported beat, a library beat analysed by an older version,
   * or an explicit "Re-analyze Beat Arrangement". Caches the result on the beat and
   * silently upgrades untouched projects in place. Automatic failures stay silent so
   * the local-first flow is never interrupted.
   */
  const runBackgroundBeatAnalysis = useCallback(
    async (
      beat: ImportedBeat,
      options: {
        explicit?: boolean;
        analysisWav?: Blob;
        bpmPreference?: number;
        fileName?: string;
      } = {}
    ) => {
      if (beat.isStarter) return;
      if (!options.explicit && isFinalArrangement(beat.arrangement)) return;
      const audio = beat.audioBlob ?? options.analysisWav;
      if (!audio) {
        if (options.explicit) showNotice('Audio data for this beat is unavailable to analyze.', 'error');
        return;
      }

      beatAnalysisAbortRef.current?.abort();
      const controller = new AbortController();
      beatAnalysisAbortRef.current = controller;
      const token = ++beatAnalysisTokenRef.current;

      setIsAnalyzingBeatBg(true);
      try {
        // A tempo the user gave (file name or typed in) is kept; a detected one is re-measured.
        const userBpm =
          (beat.bpmSource === 'filename' || beat.bpmSource === 'manual') && beat.bpm && beat.bpm >= 40 && beat.bpm <= 240
            ? beat.bpm
            : undefined;
        const result = await analyzeBeatStructure(audio, userBpm);
        if (token !== beatAnalysisTokenRef.current || controller.signal.aborted) return;
        if (!result || result.sections.length === 0) {
          throw new Error('Could not decode this beat for arrangement analysis.');
        }

        const duration = result.durationSec || beat.duration;
        const finalBpm = userBpm ?? result.bpm;
        const effectiveConfidence = userBpm ? 1 : result.gridConfidence;
        const effectiveOrigin = result.gridOriginSec;
        const grid: BeatGrid = { bpm: finalBpm, gridOriginSec: effectiveOrigin, confidence: effectiveConfidence };
        const snappedSections =
          duration > 0 ? applyGridSnapToArrangement(result.sections, duration, grid, true) : result.sections;
        const finalAnalysis: BeatAnalysis = {
          ...toBeatAnalysis(result),
          estimatedBpm: finalBpm,
          sections: snappedSections,
        };

        // Always persist cached AI arrangement + grid metadata onto the beat in state & IndexedDB.
        cacheBeatMetadata(beat.id, {
          bpm: finalBpm,
          bpmConfidence: effectiveConfidence,
          bpmSource: userBpm ? beat.bpmSource : 'detected',
          gridOriginSec: effectiveOrigin,
          arrangement: finalAnalysis,
        });
        if (importedBeatRef.current?.id === beat.id) setBpm(finalBpm);

        // Only mutate active song if this beat is still the active beat.
        if (importedBeatRef.current?.id !== beat.id) return;

        const current = sectionsRef.current;
        const hasContent = current.some(
          s => (s.text && s.text.trim().length > 0) || (s.voiceNotes && s.voiceNotes.length > 0)
        );
        const hasManualEdits = current.some(s => s.isUserModified);

        if (!hasContent && !hasManualEdits) {
          const stamp = Date.now();
          setSections(
            finalAnalysis.sections.map((sec, idx): SongSection => ({
              id: `s-auto-${stamp}-${idx}`,
              type: sec.type,
              repetitions: 1,
              isLooping: false,
              text: '',
              placeholder: sec.suggestedLyricsPrompt || `Write ${sec.title || sec.type}...`,
              voiceNotes: [],
              startTimeSec: sec.startTimeSec,
              endTimeSec: sec.endTimeSec,
              isUserModified: false,
              energy: sec.energy,
            }))
          );
          setArrangementSource('structure');
          if (options.explicit) {
            showNotice(`Arranged into ${finalAnalysis.sections.length} beat-snapped sections.`);
          }
        } else if (options.explicit) {
          const updatedBeat = {
            ...beat,
            bpm: finalBpm,
            gridOriginSec: effectiveOrigin,
            arrangement: finalAnalysis,
          };
          setPendingReanalysis({ beat: updatedBeat, analysis: finalAnalysis });
        }
      } catch (err) {
        if (token !== beatAnalysisTokenRef.current || controller.signal.aborted) return;
        console.warn('Beat structure analysis failed:', err);
        if (options.explicit) {
          showNotice(`Could not analyze this beat: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
        }
      } finally {
        if (beatAnalysisAbortRef.current === controller) beatAnalysisAbortRef.current = null;
        if (token === beatAnalysisTokenRef.current) setIsAnalyzingBeatBg(false);
      }
    },
    [cacheBeatMetadata, showNotice]
  );

  const handleImportBeat = useCallback(
    (beat: ImportedBeat, analysis?: BeatAnalysis | null, options?: BeatImportOptions): BeatImportOutcome => {
      const previous = importedBeatRef.current;
      const isNewBeat = previous?.id !== beat.id;
      const resolvedAnalysis = analysis ?? resolveLocalBeatArrangement(beat, bpmRef.current);

      if (isNewBeat) {
        // Cancel any in-flight background analysis for the old beat so it cannot overwrite the new one.
        beatAnalysisTokenRef.current += 1;
        beatAnalysisAbortRef.current?.abort();
        beatAnalysisAbortRef.current = null;
        setIsAnalyzingBeatBg(false);
      }

      const enrichedBeat: ImportedBeat = resolvedAnalysis
        ? { ...beat, arrangement: resolvedAnalysis }
        : beat;

      setImportedBeat(enrichedBeat);
      importedBeatRef.current = enrichedBeat;
      if (enrichedBeat.bpm && enrichedBeat.bpm >= 40 && enrichedBeat.bpm <= 240) setBpm(enrichedBeat.bpm);
      upsertBeatInLibrary(enrichedBeat);

      const current = sectionsRef.current;
      const currentHasContent = current.some(
        s => (s.text && s.text.trim().length > 0) || (s.voiceNotes && s.voiceNotes.length > 0)
      );
      const currentHasManualEdits = current.some(s => s.isUserModified);
      let outcome: BeatImportOutcome;
      if (!resolvedAnalysis?.sections?.length) {
        outcome = { arrangementApplied: false, reason: 'no-analysis' };
      } else if (currentHasManualEdits) {
        outcome = { arrangementApplied: false, reason: 'manual-edits' };
      } else if (currentHasContent) {
        outcome = { arrangementApplied: false, reason: 'has-content' };
      } else {
        outcome = { arrangementApplied: true, sectionCount: resolvedAnalysis.sections.length };
      }

      setSections(prev => {
        const hasContent = prev.some(
          s => (s.text && s.text.trim().length > 0) || (s.voiceNotes && s.voiceNotes.length > 0)
        );
        const hasManualEdits = prev.some(s => s.isUserModified);
        const isProjectEmpty = !hasContent;

        if (resolvedAnalysis?.sections?.length && isProjectEmpty && !hasManualEdits) {
          const grid: BeatGrid | null =
            enrichedBeat.bpm && enrichedBeat.bpm >= 40 && enrichedBeat.bpm <= 240
              ? {
                  bpm: enrichedBeat.bpm,
                  gridOriginSec: resolvedAnalysis.gridOriginSec ?? enrichedBeat.gridOriginSec ?? 0,
                  confidence: enrichedBeat.bpmConfidence,
                }
              : null;
          const snappedSections =
            enrichedBeat.duration > 0
              ? applyGridSnapToArrangement(resolvedAnalysis.sections, enrichedBeat.duration, grid, true)
              : resolvedAnalysis.sections;

          const stamp = Date.now();
          setArrangementSource(resolvedAnalysis.source === 'local-energy' ? 'energy' : resolvedAnalysis.source === 'local-structure' ? 'structure' : 'ai');
          return snappedSections.map((sec, idx): SongSection => ({
            id: `s-auto-${stamp}-${idx}`,
            type: sec.type,
            repetitions: 1,
            isLooping: false,
            text: '',
            placeholder: sec.suggestedLyricsPrompt || `Write ${sec.title || sec.type}...`,
            voiceNotes: [],
            startTimeSec: sec.startTimeSec,
            endTimeSec: sec.endTimeSec,
            isUserModified: false,
            energy: sec.energy,
          }));
        }
        // A different beat invalidates timings derived from the previous one;
        // sections then fall back to an even split of the new duration.
        if (isNewBeat) {
          setArrangementSource('even');
          return prev.map(s => ({ ...s, startTimeSec: undefined, endTimeSec: undefined, isUserModified: false }));
        }
        return prev;
      });

      if (
        options?.triggerBackgroundAnalysis &&
        !enrichedBeat.isStarter &&
        !isFinalArrangement(enrichedBeat.arrangement) &&
        (options.analysisWav || enrichedBeat.audioBlob)
      ) {
        void runBackgroundBeatAnalysis(enrichedBeat, {
          analysisWav: options.analysisWav,
          bpmPreference: options.bpmPreference,
          fileName: options.fileName,
        });
      }

      return outcome;
    },
    [runBackgroundBeatAnalysis, upsertBeatInLibrary]
  );

  const handleExplicitReanalyzeBeat = useCallback(() => {
    const activeBeat = importedBeatRef.current;
    if (!activeBeat || isBusyRecording()) return;
    void runBackgroundBeatAnalysis(activeBeat, { explicit: true });
  }, [runBackgroundBeatAnalysis]);

  const handleConfirmReanalysis = useCallback(
    (mode: 'markers-only' | 'replace-layout') => {
      if (!pendingReanalysis) return;
      const { analysis } = pendingReanalysis;
      const { sections: reTimed, activeTakeIndices: remappedIndices } = applyReanalyzedArrangement(
        sectionsRef.current,
        timingsRef.current,
        analysis.sections,
        mode,
        takeIndicesRef.current
      );
      // Lyrics that repeat mark the hook better than the audio alone can.
      const { sections: updated, changed: lyricHooks } = markRepeatedLyricsAsHook(reTimed);
      pushUndoSnapshot(sectionsRef.current, updated);
      setSections(updated);
      takeIndicesRef.current = remappedIndices;
      setActiveTakeIndices(remappedIndices);
      setArrangementSource(analysis.source === 'local-structure' ? 'structure' : 'ai');
      if (updated[0] && !updated.some(s => s.id === activeSectionIdRef.current)) {
        setActiveSectionId(updated[0].id);
      }
      setPendingReanalysis(null);
      showNotice(
        (mode === 'markers-only'
          ? `Updated section markers (${updated.length} sections). Lyrics and vocal sync preserved.`
          : `Replaced section layout (${updated.length} sections). Vocal recordings preserved.`) +
          (lyricHooks > 0 ? ` Repeated lyrics marked ${lyricHooks === 1 ? 'a section' : `${lyricHooks} sections`} as hook.` : '')
      );
    },
    [pendingReanalysis, pushUndoSnapshot, showNotice]
  );

  const handleRemoveBeat = useCallback(() => {
    if (takeInProgressRef.current) return showNotice('Stop recording before removing the beat.');
    setImportedBeat(null);
    setIsGlobalPlaying(false);
  }, [showNotice]);

  const handleWipeAudioAndBeat = useCallback(() => {
    if (takeInProgressRef.current) return showNotice('Stop recording before wiping audio.');
    abortAllTakeTranscriptions();
    // 1. Clear beat audio
    setBeats([]);
    setImportedBeat(null);
    importedBeatRef.current = null;
    resetPlayback();

    // 2. Wipe voice notes in live sections and deferred undo history
    deferredTakesRef.current.forEach(t => {
      evictVocalBuffer(t.id);
    });
    deferredTakesRef.current.clear();
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoStack([]);
    setRedoStack([]);
    setSections(prev =>
      prev.map(sec => {
        (sec.voiceNotes || []).forEach(vn => {
          evictVocalBuffer(vn.id);
        });
        return { ...sec, voiceNotes: [] };
      })
    );
    setActiveTakeIndices({});

    // 3. Clear all stored audio in sessions and save to IndexedDB
    {
      const updated = liveSessions.map(s => ({
        ...s,
        importedBeat: null,
        sections: s.sections.map(sec => {
          (sec.voiceNotes || []).forEach(vn => {
            evictVocalBuffer(vn.id);
          });
          return { ...sec, voiceNotes: [] };
        }),
      }));
      saveWorkspace(updated, activeSessionId, []).catch(() => {});
      setSessions(updated);
    }

    showNotice('Audio recordings and uploaded beat wiped. Lyrics kept.');
  }, [activeSessionId, liveSessions, showNotice, abortAllTakeTranscriptions, resetPlayback]);

  // Insert a transcribed line from Live Lyrics into a section.
  const handleInsertLyricLine = useCallback((sectionId: string, lineText: string) => {
    setSections(prev =>
      prev.map(s => {
        if (s.id !== sectionId) return s;
        const existing = s.text.trim();
        return { ...s, text: existing ? `${existing}\n${lineText.trim()}` : lineText.trim() };
      })
    );
  }, []);

  // --- Sessions & Library Actions ---
  const switchToSession = (target: SongSession) => {
    // Fold the song being left into the list before its live state is replaced.
    const leavingId = activeSessionId;
    const leavingTitle = currentSession?.title;
    const now = Date.now();
    setSessions(prev =>
      prev.map(s =>
        s.id === leavingId
          ? {
              ...s,
              title: leavingTitle || s.title,
              sections,
              importedBeat,
              bpm,
              arrangementSource,
              updatedAt: 'Just now',
              updatedAtTimestamp: now,
            }
          : s
      )
    );
    beatAnalysisTokenRef.current += 1;
    beatAnalysisAbortRef.current?.abort();
    beatAnalysisAbortRef.current = null;
    setIsAnalyzingBeatBg(false);
    setPendingReanalysis(null);
    resetPlayback();
    setIsReorderMode(false);
    setIsTextareaFocused(false);
    setHasUserInteractedWithCanvas(false);
    setActiveSessionId(target.id);
    setSections(target.sections);
    setImportedBeat(target.importedBeat);
    setBpm(target.bpm);
    setArrangementSource(
      target.arrangementSource ?? (hasExplicitTimings(target.sections) ? 'ai' : 'even')
    );
    setActiveSectionId(target.sections[0]?.id || null);
    reclaimOrphanedDeferredTakes(sections, [], []);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoStack([]);
    setRedoStack([]);
  };

  const handleSelectSession = (id: string) => {
    const target = sessions.find(s => s.id === id);
    if (!target) return;
    if (id === activeSessionId) {
      setViewMode('studio');
      return;
    }
    if (isBusyRecording()) return showNotice('Stop recording before switching songs.');
    switchToSession(target);
    setViewMode('studio');
    const isBlank = target.sections.every(s => !s.text.trim());
    if (isBlank && target.sections[0]) {
      requestFocusSection(target.sections[0].id, 'start');
    }
  };

  const handleCreateNewSession = () => {
    if (isBusyRecording()) return showNotice('Stop recording before starting a new song.');
    const blank = newBlankSection();
    const now = Date.now();
    const newSession: SongSession = {
      id: `session-${now}`,
      title: 'Untitled Track',
      isCustomTitle: false,
      updatedAt: 'Just now',
      updatedAtTimestamp: now,
      createdAt: now,
      bpm: 120,
      sections: [blank],
      importedBeat: null,
    };
    setSessions(prev => [newSession, ...prev]);
    switchToSession(newSession);
    setViewMode('studio');
    requestFocusSection(blank.id, 'start');
  };

  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) return;
    if (id === activeSessionId && isBusyRecording()) return showNotice('Stop recording before deleting this song.');

    const doomed = liveSessions.find(s => s.id === id);
    const remaining = liveSessions.filter(s => s.id !== id);
    if (activeSessionId === id) switchToSession(remaining[0]);
    setSessions(remaining);

    // Release vocal takes this song was holding in memory (beats remain in the Beat Vault unless deleted there).
    if (doomed) {
      doomed.sections.forEach(sec =>
        sec.voiceNotes?.forEach(t => {
          abortTakeTranscription(t.id);
          evictVocalBuffer(t.id);
        })
      );
    }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    const now = Date.now();
    setSessions(prev =>
      prev.map(s =>
        s.id === id
          ? {
              ...s,
              title: trimmed || 'Untitled Track',
              isCustomTitle: trimmed.length > 0 && trimmed !== 'Untitled Track',
              updatedAtTimestamp: now,
            }
          : s
      )
    );
  };

  const handleToggleFavoriteSession = useCallback((id: string) => {
    setSessions(prev => prev.map(s => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s)));
  }, []);

  const handleImportBeatFilesToLibrary = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setIsImportingLibraryBeat(true);
    let added = 0;
    try {
      for (const file of list) {
        const err = validateBeatFile(file);
        if (err) {
          showNotice(err, 'error');
          continue;
        }
        const { beat: immediate, nameBpm } = createImmediateBeat(file, 120);
        let decoded: Awaited<ReturnType<typeof decodeBeatFile>> = null;
        try {
          decoded = await decodeBeatFile(file, immediate, nameBpm, 120);
        } catch (decodeErr) {
          blobUrlRegistry.release(beatBlobKey(immediate.id));
          throw decodeErr;
        }
        if (!decoded) {
          blobUrlRegistry.release(beatBlobKey(immediate.id));
          showNotice(`Could not decode "${file.name}". Try WAV or MP3.`, 'error');
          continue;
        }
        upsertBeatInLibrary(decoded.beat);
        added++;
      }
      if (added > 0) {
        showNotice(`Added ${added} ${added === 1 ? 'beat' : 'beats'} to your library.`);
      }
    } finally {
      setIsImportingLibraryBeat(false);
    }
  }, [showNotice, upsertBeatInLibrary]);

  const handleDeleteBeatFromLibrary = useCallback((beatId: string) => {
    setBeats(prev => prev.filter(b => b.id !== beatId));
    setSessions(prev => prev.map(s => (s.importedBeat?.id === beatId ? { ...s, importedBeat: null } : s)));
    if (importedBeatRef.current?.id === beatId) {
      setImportedBeat(null);
      setIsGlobalPlaying(false);
    }
    showNotice('Beat deleted from library.');
  }, [showNotice, setIsGlobalPlaying]);

  const handleRenameBeat = useCallback((beatId: string, newName: string) => {
    setBeats(prev => prev.map(b => (b.id === beatId ? { ...b, name: newName } : b)));
    setSessions(prev =>
      prev.map(s => (s.importedBeat?.id === beatId ? { ...s, importedBeat: { ...s.importedBeat, name: newName } } : s))
    );
    if (importedBeatRef.current?.id === beatId) {
      setImportedBeat(prev => (prev ? { ...prev, name: newName } : prev));
    }
  }, []);

  const handleToggleFavoriteBeat = useCallback((beatId: string) => {
    setBeats(prev => prev.map(b => (b.id === beatId ? { ...b, isFavorite: !b.isFavorite } : b)));
  }, []);

  const handleUseBeatInCurrentSong = useCallback((beat: ImportedBeat) => {
    if (isBusyRecording()) return showNotice('Stop recording before changing the beat.');
    const immediateArrangement = resolveLocalBeatArrangement(beat, bpmRef.current);
    const readyBeat: ImportedBeat =
      immediateArrangement && !beat.arrangement
        ? { ...beat, arrangement: immediateArrangement }
        : beat;
    handleImportBeat(readyBeat, immediateArrangement);
    setViewMode('studio');
    showNotice(`Loaded "${readyBeat.name}" into current song.`);
    if (!readyBeat.isStarter && !isFinalArrangement(readyBeat.arrangement) && readyBeat.audioBlob) {
      void runBackgroundBeatAnalysis(readyBeat);
    }
  }, [handleImportBeat, runBackgroundBeatAnalysis, showNotice]);

  const handleCreateSongWithBeat = useCallback((beat: ImportedBeat) => {
    if (isBusyRecording()) return showNotice('Stop recording before starting a new song.');
    const now = Date.now();
    const resolvedBpm = beat.bpm && beat.bpm >= 40 && beat.bpm <= 240 ? beat.bpm : 120;
    const immediateArrangement = resolveLocalBeatArrangement(beat, resolvedBpm);
    const readyBeat: ImportedBeat =
      immediateArrangement && !beat.arrangement
        ? { ...beat, arrangement: immediateArrangement }
        : beat;

    let initialSections: SongSection[];
    let initialArrangementSource: ArrangementSource = 'even';
    if (immediateArrangement?.sections?.length) {
      const grid: BeatGrid = {
        bpm: resolvedBpm,
        gridOriginSec: immediateArrangement.gridOriginSec ?? readyBeat.gridOriginSec ?? 0,
        confidence: readyBeat.bpmConfidence,
      };
      const snappedSections =
        readyBeat.duration > 0
          ? applyGridSnapToArrangement(immediateArrangement.sections, readyBeat.duration, grid, true)
          : immediateArrangement.sections;
      initialSections = snappedSections.map((sec, idx): SongSection => ({
        id: `s-auto-${now}-${idx}`,
        type: sec.type,
        repetitions: 1,
        isLooping: false,
        text: '',
        placeholder: sec.suggestedLyricsPrompt || `Write ${sec.title || sec.type}...`,
        voiceNotes: [],
        startTimeSec: sec.startTimeSec,
        endTimeSec: sec.endTimeSec,
        isUserModified: false,
        energy: sec.energy,
      }));
      initialArrangementSource = immediateArrangement.source === 'local-energy' ? 'energy' : immediateArrangement.source === 'local-structure' ? 'structure' : 'ai';
    } else {
      initialSections = [newBlankSection()];
    }

    const hasBeatName = Boolean(readyBeat.name?.trim());
    const newSession: SongSession = {
      id: `session-${now}`,
      title: hasBeatName ? readyBeat.name : 'Untitled Track',
      isCustomTitle: hasBeatName,
      updatedAt: 'Just now',
      updatedAtTimestamp: now,
      createdAt: now,
      bpm: resolvedBpm,
      arrangementSource: initialArrangementSource,
      sections: initialSections,
      importedBeat: readyBeat,
    };
    if (immediateArrangement && !beat.arrangement) {
      cacheBeatMetadata(beat.id, { arrangement: immediateArrangement });
    }
    setSessions(prev => [newSession, ...prev]);
    switchToSession(newSession);
    setViewMode('studio');
    requestFocusSection(initialSections[0].id, 'start');
    showNotice(`Created "${newSession.title}" with beat.`);
    if (!readyBeat.isStarter && !isFinalArrangement(readyBeat.arrangement) && readyBeat.audioBlob) {
      void runBackgroundBeatAnalysis(readyBeat);
    }
  }, [cacheBeatMetadata, requestFocusSection, runBackgroundBeatAnalysis, showNotice]);

  const handleOpenLibrary = useCallback(() => {
    if (isBusyRecording()) return showNotice('Stop recording before opening the Library.');
    stopPlayback();
    setIsReorderMode(false);
    setViewMode('library');
  }, [showNotice, stopPlayback]);

  // --- AI Line Continuation ---
  const handleGenerateNextLines = useCallback(async (requestedSectionId?: string) => {
    if (isGeneratingLyrics) return;
    const targetId = typeof requestedSectionId === 'string' ? requestedSectionId : activeSectionIdRef.current;
    const sec = sectionsRef.current.find(s => s.id === targetId) || sectionsRef.current[0];
    const source = (sec?.text || '').trim() || allLyricsText.trim();
    if (!sec || !source) {
      showNotice('Write a line or two first, then ask for the next lines.');
      return;
    }

    continuationAbortRef.current?.abort();
    const controller = new AbortController();
    continuationAbortRef.current = controller;
    setIsGeneratingLyrics(true);

    try {
      const data = await fetchSongSuggestions(
        { writtenLyrics: source, targetSyllables: 8 },
        controller.signal
      );
      if (controller.signal.aborted) return;
      const ideas = data.lines.slice(0, 2);
      if (ideas.length === 0) {
        showNotice('No line ideas came back. Try again.');
        return;
      }
      pushUndoSnapshot(sectionsRef.current);
      setSections(prev =>
        prev.map(s => {
          if (s.id !== sec.id) return s;
          const existing = s.text.trim();
          const next = ideas.join('\n');
          return { ...s, text: existing ? `${existing}\n${next}` : next };
        })
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      showNotice(formatAiError(err, 'suggestions'), 'error');
    } finally {
      setIsGeneratingLyrics(false);
    }
  }, [isGeneratingLyrics, allLyricsText, pushUndoSnapshot, showNotice]);

  const effectiveLiveSectionId =
    recordingSectionId ??
    (isGlobalPlaying ? currentlyPlayingSection?.id : null) ??
    activeSectionId ??
    currentlyPlayingSection?.id ??
    sections[0]?.id;
  const rawLiveSection =
    sections.find(s => s.id === effectiveLiveSectionId) || sections[0] || null;
  const soundingVocalHit = useMemo(() => {
    if (recordingSectionId) return null;
    if (rawLiveSection && (rawLiveSection.voiceNotes?.length ?? 0) > 0) return null;
    return (
      findVocalAtTime(sections, resolvedSectionTimings, activeTakeIndices, currentTime) ??
      (totalDuration > 0 && currentTime >= totalDuration
        ? findVocalAtTime(sections, resolvedSectionTimings, activeTakeIndices, Math.max(0, totalDuration - 0.05))
        : null)
    );
  }, [recordingSectionId, rawLiveSection, sections, resolvedSectionTimings, activeTakeIndices, currentTime, totalDuration]);
  const effectiveLiveSection =
    (soundingVocalHit ? sections.find(s => s.id === soundingVocalHit.sectionId) : null) ||
    rawLiveSection;
  const effectiveLiveTakeIdx = effectiveLiveSection ? (activeTakeIndices[effectiveLiveSection.id] ?? 0) : 0;
  const effectiveLiveTake = effectiveLiveSection?.voiceNotes?.[effectiveLiveTakeIdx] || effectiveLiveSection?.voiceNotes?.[0] || null;

  // --- Section list ---
  // Built once per real change (lyrics, structure, focus, playing section),
  // not on every 50ms clock tick during playback. Handlers are wrapped so
  // their identity is stable while they still run against current state.
  const onSectionUpdateText = useStableCallback(handleUpdateText);
  const onSectionUpdateType = useStableCallback(handleUpdateType);
  const onSectionCycleLoop = useStableCallback(handleCycleLoopState);
  const onSectionDelete = useStableCallback(handleDeleteSection);
  const onSectionDeleteEmptyPrev = useStableCallback(handleDeleteEmptyAndFocusPrev);
  const onSectionDuplicate = useStableCallback(handleDuplicateSection);
  const onSectionAddBelow = useStableCallback(handleAddSectionBelow);
  const onSectionRecordTake = useStableCallback((secId: string) => { void handleToggleRecord(secId); });
  const onSectionSuggestNextLines = useStableCallback((secId: string) => { void handleGenerateNextLines(secId); });
  const onSectionSelect = useStableCallback((id: string) => setActiveSectionId(id));
  const onSectionFocus = useStableCallback((id: string) => {
    if (blurClearTimerRef.current) {
      clearTimeout(blurClearTimerRef.current);
      blurClearTimerRef.current = null;
    }
    setActiveSectionId(id);
    setIsTextareaFocused(true);
  });
  const onSectionBlur = useStableCallback(() => {
    if (blurClearTimerRef.current) clearTimeout(blurClearTimerRef.current);
    blurClearTimerRef.current = setTimeout(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el?.tagName?.toLowerCase() !== 'textarea') {
        setIsTextareaFocused(false);
        setHasUserInteractedWithCanvas(false);
      }
    }, 120);
  });
  const onCanvasUserInteract = useCallback(() => {
    setHasUserInteractedWithCanvas(true);
  }, []);
  const onEnterReorderMode = useCallback(() => {
    if (isBusyRecording()) {
      showNotice('Stop recording before reordering sections.');
      return;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsTextareaFocused(false);
    setHasUserInteractedWithCanvas(false);
    setIsReorderMode(true);
  }, [isBusyRecording, showNotice]);
  const onExitReorderMode = useCallback(() => {
    setIsReorderMode(false);
  }, []);
  const onAccessoryDone = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsTextareaFocused(false);
    setHasUserInteractedWithCanvas(false);
  }, []);
  const onSectionJump = useStableCallback(handleJumpToSection);
  const playingSectionId = isGlobalPlaying ? currentlyPlayingSection?.id ?? null : null;

  const activePlaybackLine = useMemo(() => {
    if (!isGlobalPlaying) return null;
    return resolveActiveWorkspaceLine(
      sections,
      resolvedSectionTimings,
      activeTakeIndices,
      currentTime,
      syncSettings.lyricOffsetMs
    );
  }, [isGlobalPlaying, sections, resolvedSectionTimings, activeTakeIndices, currentTime, syncSettings.lyricOffsetMs]);

  const activeLineSectionId = activePlaybackLine?.sectionId ?? null;
  const activeLineIdx = activePlaybackLine?.lineIndex ?? null;

  const scrollWorkspaceToActiveLine = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = workspaceScrollRef.current;
    if (!container) return;

    const targetEl =
      (container.querySelector('[data-active-lyric-line="true"]') as HTMLElement | null) ??
      (activeLineSectionId
        ? (container.querySelector(`#section-block-${CSS.escape(activeLineSectionId)}`) as HTMLElement | null)
        : null);
    if (!targetEl) return;

    const containerRect = container.getBoundingClientRect();
    if (containerRect.height <= 0) return;
    const targetRect = targetEl.getBoundingClientRect();

    const targetCenterInView = (targetRect.top - containerRect.top) + targetRect.height / 2;
    let visibleHeight = containerRect.height;
    if (!isDockMinimized && typeof window !== 'undefined') {
      const dockEl = document.getElementById('master-playback-dock');
      let dockTop = window.innerHeight - 196;
      if (dockEl && dockEl.offsetHeight > 0) {
        const dockBottom = parseFloat(window.getComputedStyle(dockEl).bottom) || 12;
        dockTop = window.innerHeight - dockBottom - dockEl.offsetHeight;
      }
      const unobstructed = dockTop - containerRect.top;
      if (unobstructed > 80 && unobstructed < visibleHeight) {
        visibleHeight = unobstructed;
      }
    }
    const desiredCenter = visibleHeight / 2;
    const delta = targetCenterInView - desiredCenter;

    if (Math.abs(delta) < 4) return;

    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const nextTop = Math.max(0, Math.min(maxScroll, container.scrollTop + delta));

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    container.scrollTo({
      top: nextTop,
      behavior: prefersReducedMotion ? 'auto' : behavior,
    });
  }, [activeLineSectionId, isDockMinimized]);

  useEffect(() => {
    if (!isGlobalPlaying) {
      setIsAutoScrollPausedByUser(false);
      if (userScrollResumeTimerRef.current) {
        clearTimeout(userScrollResumeTimerRef.current);
        userScrollResumeTimerRef.current = null;
      }
      return;
    }
    if (isAutoScrollPausedByUser || isLiveLyricsOpen) return;
    if (Date.now() - lastTypingAtRef.current < 2500) return;

    scrollWorkspaceToActiveLine('smooth');

    // When expanding the dock, AnimatePresence mounts #master-playback-dock after ~180ms;
    // re-align once it's in the DOM so we use its exact rendered height.
    if (!isDockMinimized && !document.getElementById('master-playback-dock')) {
      const timer = setTimeout(() => scrollWorkspaceToActiveLine('smooth'), 220);
      return () => clearTimeout(timer);
    }
  }, [
    isGlobalPlaying,
    isAutoScrollPausedByUser,
    isLiveLyricsOpen,
    isDockMinimized,
    activeLineSectionId,
    activeLineIdx,
    playingSectionId,
    scrollWorkspaceToActiveLine,
  ]);

  const handleManualWorkspaceScroll = useCallback(() => {
    if (!isPlayingRef.current || isLiveLyricsOpen) return;
    setIsAutoScrollPausedByUser(true);
    if (userScrollResumeTimerRef.current) clearTimeout(userScrollResumeTimerRef.current);
    userScrollResumeTimerRef.current = setTimeout(() => {
      setIsAutoScrollPausedByUser(false);
    }, 4000);
  }, [isLiveLyricsOpen]);

  const handleRecenterWorkspace = useCallback(() => {
    resumeAutoScrollNow();
    requestAnimationFrame(() => scrollWorkspaceToActiveLine('smooth'));
  }, [resumeAutoScrollNow, scrollWorkspaceToActiveLine]);

  // Stable callback wrappers for memoized Header, Keyboard Accessory Bar, Dock, and Modal
  const onHeaderRenameSession = useStableCallback((title: string) => handleRenameSession(activeSessionId, title));
  const onHeaderSelectSession = useStableCallback(handleSelectSession);
  const onHeaderCreateSession = useStableCallback(handleCreateNewSession);
  const onHeaderDeleteSession = useStableCallback(handleDeleteSession);
  const onHeaderChangeBpm = useCallback((nextBpm: number) => {
    if (isBusyRecording()) {
      showNotice('Stop recording before changing tempo.');
      return;
    }
    if (Number.isFinite(nextBpm) && nextBpm >= 40 && nextBpm <= 240) {
      setBpm(Math.round(nextBpm));
    }
  }, [isBusyRecording, showNotice]);
  const onToolbarToggleRhyme = useCallback(() => setShowRhymes(prev => !prev), []);
  const onToolbarMagicWand = useStableCallback(() => { void handleGenerateNextLines(); });
  // The Suggest button only exists when the server can actually serve it.
  const [aiFeatures, setAiFeatures] = useState<AiFeatures | null>(null);
  useEffect(() => {
    let alive = true;
    void getAiFeatures().then(f => { if (alive) setAiFeatures(f); });
    return () => { alive = false; };
  }, []);
  const suggestionsAvailable = aiFeatures?.suggestions === true;
  const onToolbarAddSection = useStableCallback(() => handleAddSectionBelow(activeSectionId || undefined));
  const onDockToggleRecord = useCallback(() => { void handleToggleRecord(); }, [handleToggleRecord]);
  const onDockCycleTake = useStableCallback(handleCycleTake);
  const onDockDeleteTake = useStableCallback(handleDeleteTake);
  const onDockToggleMuteVocal = useCallback(() => setIsVocalMuted(m => !m), []);
  const onOpenLiveLyrics = useCallback(() => setIsLiveLyricsOpen(true), []);
  const onCloseLiveLyrics = useCallback(() => setIsLiveLyricsOpen(false), []);

  const isAccessoryBarVisible =
    isTextareaFocused &&
    hasUserInteractedWithCanvas &&
    !isReorderMode &&
    isDockMinimized &&
    !isLiveLyricsOpen;

  const sectionList = useMemo(() => (
    <Reorder.Group axis="y" values={sections} onReorder={handleReorderSections} className="flex flex-col">
      {sections.map(section => (
        <SectionBlock
          key={section.id}
          section={section}
          totalSectionsCount={sections.length}
          onUpdateText={onSectionUpdateText}
          onUpdateType={onSectionUpdateType}
          onCycleLoopState={onSectionCycleLoop}
          onDelete={onSectionDelete}
          onDeleteEmptyAndFocusPrev={onSectionDeleteEmptyPrev}
          onDuplicate={onSectionDuplicate}
          onAddSectionBelow={onSectionAddBelow}
          onRecordTake={onSectionRecordTake}
          onSuggestNextLines={suggestionsAvailable ? onSectionSuggestNextLines : undefined}
          onToggleRhymes={onToolbarToggleRhyme}
          isGeneratingLyrics={isGeneratingLyrics}
          onFocus={onSectionFocus}
          onBlur={onSectionBlur}
          onUserInteract={onCanvasUserInteract}
          onSelectSection={onSectionSelect}
          onJumpToSection={onSectionJump}
          isCurrentlyPlaying={playingSectionId === section.id}
          activeLineIndex={activeLineSectionId === section.id ? activeLineIdx : null}
          isFocused={activeSectionId === section.id}
          showRhymes={showRhymes}
          rhymeWordMap={rhymeWordMap}
          isReorderMode={isReorderMode}
          onEnterReorderMode={onEnterReorderMode}
          focusRequest={focusRequest}
        />
      ))}
    </Reorder.Group>
  ), [
    sections, handleReorderSections, playingSectionId, activeLineSectionId, activeLineIdx, activeSectionId, showRhymes, rhymeWordMap,
    isReorderMode, isGeneratingLyrics, focusRequest, suggestionsAvailable,
    onSectionUpdateText, onSectionUpdateType, onSectionCycleLoop, onSectionDelete, onSectionDeleteEmptyPrev, onSectionDuplicate,
    onSectionAddBelow, onSectionRecordTake, onSectionSuggestNextLines, onToolbarToggleRhyme,
    onSectionFocus, onSectionBlur, onCanvasUserInteract, onSectionSelect, onSectionJump, onEnterReorderMode,
  ]);

  return (
    <div className="bg-ios-bg text-ios-text font-sans h-screen flex flex-col relative overflow-hidden w-full select-text">
      {viewMode === 'library' ? (
        <LibraryView
          sessions={liveSessions}
          activeSessionId={activeSessionId}
          beats={beats}
          onCloseLibrary={() => setViewMode('studio')}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateNewSession}
          onDeleteSession={handleDeleteSession}
          onToggleFavoriteSession={handleToggleFavoriteSession}
          onImportBeatFiles={handleImportBeatFilesToLibrary}
          onDeleteBeat={handleDeleteBeatFromLibrary}
          onRenameBeat={handleRenameBeat}
          onToggleFavoriteBeat={handleToggleFavoriteBeat}
          onUseBeatInCurrentSong={handleUseBeatInCurrentSong}
          onCreateSongWithBeat={handleCreateSongWithBeat}
          isImportingBeat={isImportingLibraryBeat}
        />
      ) : (
        <>
          <Header
            activeSessionTitle={currentSession?.title || 'Untitled Track'}
            isUntitled={isUntitledTrack}
            isReorderMode={isReorderMode}
            onExitReorderMode={onExitReorderMode}
            onRenameSession={onHeaderRenameSession}
            sessions={liveSessions}
            activeSessionId={activeSessionId}
            onSelectSession={onHeaderSelectSession}
            onCreateSession={onHeaderCreateSession}
            onDeleteSession={onHeaderDeleteSession}
            bpm={bpm}
            onChangeBpm={onHeaderChangeBpm}
            importedBeat={importedBeat}
            onImportBeat={handleImportBeat}
            onRemoveBeat={handleRemoveBeat}
            onWipeAudioAndBeat={handleWipeAudioAndBeat}
            onNotify={showNotice}
            isGlobalPlaying={isGlobalPlaying}
            onToggleGlobalPlayback={handleTogglePlay}
            isTakeInProgress={isRecording || isCountingDown || recordingSectionId !== null}
            onOpenLibrary={handleOpenLibrary}
            isAnalyzingBeatExternal={isAnalyzingBeatBg}
            onReanalyzeBeat={handleExplicitReanalyzeBeat}
          />

          {isGlobalPlaying && isAutoScrollPausedByUser && !isLiveLyricsOpen && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 animate-fadeIn">
              <button
                type="button"
                onClick={handleRecenterWorkspace}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ios-glass border border-amber-500/40 text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-500/15 shadow-xl cursor-pointer transition-all active:scale-95"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Recenter active line</span>
              </button>
            </div>
          )}

          <main
            ref={workspaceScrollRef}
            onWheel={handleManualWorkspaceScroll}
            onTouchMove={handleManualWorkspaceScroll}
            onClick={(e) => {
              if (isReorderMode) return;
              const target = e.target as HTMLElement;
              if (target === e.currentTarget || target.id === 'apple-notes-workspace') {
                const last = sections[sections.length - 1];
                if (last) {
                  setActiveSectionId(last.id);
                  setHasUserInteractedWithCanvas(true);
                  requestFocusSection(last.id, 'end');
                }
              }
            }}
            className="flex-1 max-w-3xl w-full mx-auto px-5 sm:px-8 pt-6 sm:pt-10 pb-48 sm:pb-[38vh] overflow-y-auto cursor-text"
          >
            <div id="apple-notes-workspace" className="flex flex-col min-h-full">
              {sectionList}
            </div>
          </main>

          {/* Contextual Keyboard Accessory Bar (hidden until actively typing) */}
          <LyricToolbar
            visible={isAccessoryBarVisible}
            onMagicWand={suggestionsAvailable ? onToolbarMagicWand : undefined}
            onRhymeStructure={onToolbarToggleRhyme}
            onAddSection={onToolbarAddSection}
            onDone={onAccessoryDone}
            isRhymeActive={showRhymes}
            isGenerating={isGeneratingLyrics}
            onKeyboardInsetChange={setKeyboardInsetPx}
          />

          {/* Single Centered Bottom Audio Capture & Playback Dock */}
          <MasterPlaybackDock
            sections={sections}
            activeSectionId={activeSectionId}
            currentlyPlayingSectionId={recordingSectionId ?? (isGlobalPlaying ? currentlyPlayingSection?.id || null : null)}
            currentTime={currentTime}
            totalDuration={totalDuration}
            sectionTimings={resolvedSectionTimings}
            isPlaying={isGlobalPlaying}
            isRecording={isRecording}
            isCountingDown={isCountingDown}
            countdownVal={countdownVal}
            importedBeat={importedBeat}
            activeTakeIndices={activeTakeIndices}
            transcribingTakeIds={transcribingTakeIds}
            onSeekToTime={handleUserSeek}
            onTogglePlay={handleTogglePlay}
            onToggleRecord={onDockToggleRecord}
            onCycleTake={onDockCycleTake}
            onRetryTranscription={handleRetryTakeTranscription}
            isVocalMuted={isVocalMuted}
            onToggleMuteVocal={onDockToggleMuteVocal}
            onOpenLiveLyrics={onOpenLiveLyrics}
            syncSettings={syncSettings}
            onChangeSyncSettings={updateSyncSettings}
            onResetSyncSettings={resetSyncSettings}
            onMinimizedChange={setIsDockMinimized}
            hideCollapsedPill={keyboardInsetPx > 0 && !isGlobalPlaying && !isRecording && !isCountingDown}
            bpm={bpm}
            snapToGrid={snapToGrid}
            onToggleSnapToGrid={() => setSnapToGrid(v => !v)}
            onCommitSectionBoundary={handleCommitSectionBoundary}
            onToggleSectionLoop={onSectionCycleLoop}
          />

          {/* Non-Destructive Re-analyze Beat Arrangement Confirmation Modal */}
          {pendingReanalysis && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reanalyze-modal-title"
            >
              <div className="w-full max-w-md rounded-2xl bg-[#18181b] border border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.85)] p-5 text-white">
                <h3 id="reanalyze-modal-title" className="text-sm font-semibold tracking-tight text-white">
                  Apply New Beat Arrangement ({pendingReanalysis.analysis.sections.length} sections)
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                  This song already has lyrics, manual boundaries, or vocal takes. All recorded vocal takes will stay locked to their exact beat timestamps either way.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmReanalysis('markers-only')}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-amber-300">
                      Update Section Markers Only (Recommended)
                    </div>
                    <div className="text-[11px] text-zinc-300 mt-0.5">
                      Keeps all written lyrics and vocal takes, updating section start/end markers to the new beat grid.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmReanalysis('replace-layout')}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-zinc-200">
                      Replace Section Layout (Keep Vocals)
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Resets stanza labels &amp; clears text for fresh AI sections while keeping all recorded vocal takes synced.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingReanalysis(null)}
                    className="w-full py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer mt-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {isLiveLyricsOpen && (
            <Suspense fallback={null}>
              <KaraokeLyricsModal
                isOpen={isLiveLyricsOpen}
                onClose={onCloseLiveLyrics}
                sections={sections}
                activeSection={effectiveLiveSection}
                displaySection={rawLiveSection}
                activeTake={effectiveLiveTake}
                currentTakeIndex={effectiveLiveTakeIdx}
                totalTakesCount={effectiveLiveSection?.voiceNotes?.length || 0}
                isTranscribingTake={Boolean(effectiveLiveTake && transcribingTakeIds[effectiveLiveTake.id])}
                currentTime={currentTime}
                totalDuration={totalDuration}
                isPlaying={isGlobalPlaying}
                isRecording={isRecording}
                isCountingDown={isCountingDown}
                countdownVal={countdownVal}
                onTogglePlay={handleTogglePlay}
                onToggleRecord={onDockToggleRecord}
                onSeekToTime={handleUserSeek}
                onInsertLine={handleInsertLyricLine}
                onCycleTake={onDockCycleTake}
                onDeleteTake={onDockDeleteTake}
                importedBeat={importedBeat}
                syncSettings={syncSettings}
                onChangeSyncSettings={updateSyncSettings}
                onResetSyncSettings={resetSyncSettings}
              />
            </Suspense>
          )}
        </>
      )}

      {notice && (
        <div
          key={notice.id}
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-[60] max-w-[min(92vw,28rem)] px-4 py-2.5 rounded-xl text-xs font-medium shadow-2xl border backdrop-blur-xl animate-fadeIn ${
            notice.tone === 'error'
              ? 'bg-red-950/90 border-red-500/30 text-red-100'
              : 'bg-zinc-900/90 border-white/10 text-zinc-100'
          }`}
        >
          <span>{notice.text}</span>
          {notice.action && (
            <button
              type="button"
              onClick={() => {
                const run = notice.action!.onClick;
                if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
                setNotice(null);
                run();
              }}
              className="ml-3 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold cursor-pointer"
            >
              {notice.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
