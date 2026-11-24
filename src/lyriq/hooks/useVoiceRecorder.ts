import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  getSectionTakeCode,
  type ImportedBeat,
  type SongSection,
  type SttPhrase,
  type Take,
} from '../types';
import { UniversalVoiceRecorder, computeRecordingAnchorSec } from '../utils/audio';
import { transcribeTakeBatch } from '../services/transcription';
import { checkAiHealth } from '../services/ai';
import { unlockMixer, preloadVocalBuffer } from '../utils/mixer';
import type { SyncSettings } from '../utils/settings';
import { barDurationSec } from '../utils/arrangement';
import type { SectionTiming } from '../utils/timeline';
import { timeTakeLyrics, type VocalMap } from '../utils/lyricAlign';
import { blobUrlRegistry, takeBlobKey } from '../utils/storage';

function describeMicError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return "Microphone access is blocked. Allow it in your browser's site settings, then try again.";
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone found. Connect one and try again.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The microphone is in use by another app.';
  }
  return (err as Error)?.message || 'Could not start the microphone.';
}

export interface UseVoiceRecorderOptions {
  sectionsRef: RefObject<SongSection[]>;
  activeSectionIdRef: RefObject<string | null>;
  importedBeatRef: RefObject<ImportedBeat | null>;
  bpmRef: RefObject<number>;
  timingsRef: RefObject<SectionTiming[]>;
  settingsRef: RefObject<SyncSettings>;
  currentTimeRef: MutableRefObject<number>;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  globalBeatAudioRef: RefObject<HTMLAudioElement | null>;
  isPlayingRef: RefObject<boolean>;
  setIsGlobalPlaying: Dispatch<SetStateAction<boolean>>;
  playElement: (el: HTMLAudioElement) => void;
  seekAudioToTime: (timeSec: number, shouldPlay: boolean) => void;
  handleSeekToTime: (timeSec: number) => void;
  pauseVocal: () => void;
  isCountingDownRef: MutableRefObject<boolean>;
  isRecordingRef: MutableRefObject<boolean>;
  takeInProgressRef: MutableRefObject<boolean>;
  setActiveSectionId: Dispatch<SetStateAction<string | null>>;
  setIsReorderMode: Dispatch<SetStateAction<boolean>>;
  addTakeToSection: (sectionId: string, take: Take) => void;
  patchTake: (sectionId: string, takeId: string, patch: Partial<Take>) => void;
  showNotice: (text: string, tone?: 'info' | 'error') => void;
}

export interface UseVoiceRecorderReturn {
  isCountingDown: boolean;
  countdownVal: number | null;
  isRecording: boolean;
  recordingSectionId: string | null;
  transcribingTakeIds: Readonly<Record<string, true>>;
  isBusyRecording: () => boolean;
  cancelCountIn: () => void;
  handleToggleRecord: (requestedSectionId?: string) => Promise<void>;
  abortTakeTranscription: (takeId: string) => void;
  abortAllTakeTranscriptions: () => void;
  handleRetryTakeTranscription: (sectionId: string, takeId: string) => void;
}

export function useVoiceRecorder({
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
}: UseVoiceRecorderOptions): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [countdownVal, setCountdownVal] = useState<number | null>(null);
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recordingBusyRef = useRef<boolean>(false);
  /** True while the recorder is spinning up after the count-in. */
  const startingCaptureRef = useRef<boolean>(false);
  const isBusyRecording = useCallback(
    () => takeInProgressRef.current || isRecordingRef.current || isCountingDownRef.current || startingCaptureRef.current,
    [takeInProgressRef, isRecordingRef, isCountingDownRef]
  );
  const recorderRef = useRef<UniversalVoiceRecorder | null>(null);
  const recordingTargetRef = useRef<{ sectionId: string; startSec: number } | null>(null);
  /** Section being counted in or recorded, so the dock labels the right one. */
  const [recordingSectionId, setRecordingSectionId] = useState<string | null>(null);
  const [transcribingTakeIds, setTranscribingTakeIds] = useState<Readonly<Record<string, true>>>({});
  const transcribeAbortsRef = useRef<Map<string, AbortController>>(new Map());
  /** Whether the server has AI configured: null until /api/health answers. */
  const aiAvailableRef = useRef<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    checkAiHealth(controller.signal).then(ai => {
      if (!controller.signal.aborted && ai !== null) aiAvailableRef.current = ai;
    });
    return () => controller.abort();
  }, []);
  /** Song-timeline position when the first mic sample arrived. */
  const firstChunkTimelineRef = useRef<number | null>(null);

  // Abort pending take transcriptions and drop mic/timer resources on unmount.
  useEffect(() => {
    const aborts = transcribeAbortsRef.current;
    return () => {
      aborts.forEach(ctrl => ctrl.abort());
      aborts.clear();

      const activeRecorder = recorderRef.current;
      recorderRef.current = null;
      if (activeRecorder) {
        void activeRecorder.stop().catch(() => {});
      }
      UniversalVoiceRecorder.releaseMic();

      countdownTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Keep mobile clean when backgrounded: cancel an active count-in (OS timer throttling
  // would fire recording late) and release idle mic streams when not actively recording.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      if (isCountingDownRef.current) {
        countdownTimersRef.current.forEach(clearTimeout);
        countdownTimersRef.current = [];
        setIsCountingDown(false);
        isCountingDownRef.current = false;
        setCountdownVal(null);
        takeInProgressRef.current = false;
        recordingTargetRef.current = null;
        setRecordingSectionId(null);
        if (isPlayingRef.current) {
          setIsGlobalPlaying(false);
          globalBeatAudioRef.current?.pause();
        }
        UniversalVoiceRecorder.releaseMic();
        return;
      }
      if (!isRecordingRef.current) {
        UniversalVoiceRecorder.releaseMic();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [
    isCountingDownRef,
    isRecordingRef,
    takeInProgressRef,
    isPlayingRef,
    setIsGlobalPlaying,
    globalBeatAudioRef,
  ]);

  const abortTakeTranscription = useCallback((takeId: string) => {
    const ctrl = transcribeAbortsRef.current.get(takeId);
    if (ctrl) {
      ctrl.abort();
      transcribeAbortsRef.current.delete(takeId);
    }
    setTranscribingTakeIds(prev => {
      if (!prev[takeId]) return prev;
      const next = { ...prev };
      delete next[takeId];
      return next;
    });
  }, []);

  const abortAllTakeTranscriptions = useCallback(() => {
    transcribeAbortsRef.current.forEach(ctrl => ctrl.abort());
    transcribeAbortsRef.current.clear();
    setTranscribingTakeIds(prev => (Object.keys(prev).length === 0 ? prev : {}));
  }, []);

  const clearCountdown = useCallback(() => {
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];
    setIsCountingDown(false);
    isCountingDownRef.current = false;
    setCountdownVal(null);
  }, [isCountingDownRef]);

  const triggerTakeTranscription = useCallback(
    (
      sectionId: string,
      take: Take,
      options?: { preparedWav?: Blob; writtenLyrics?: string; vocalMap?: VocalMap | null }
    ) => {
      const sourceBlob = options?.preparedWav ?? take.audioBlob;
      if (!sourceBlob) {
        patchTake(sectionId, take.id, { transcriptionStatus: 'failed' });
        return;
      }

      const prevController = transcribeAbortsRef.current.get(take.id);
      if (prevController) {
        prevController.abort();
      }

      const controller = new AbortController();
      transcribeAbortsRef.current.set(take.id, controller);
      patchTake(sectionId, take.id, { transcriptionStatus: 'pending' });
      setTranscribingTakeIds(prev => (prev[take.id] ? prev : { ...prev, [take.id]: true }));

      const anchor = take.startBeatOffsetSec ?? 0;
      const toTimeline = (p: SttPhrase): SttPhrase => ({
        ...p,
        startSec: p.startSec + anchor,
        endSec: p.endSec + anchor,
      });
      const writtenLyrics = options?.writtenLyrics ?? sectionsRef.current.find(s => s.id === sectionId)?.text ?? '';

      transcribeTakeBatch(
        sourceBlob,
        {
          durationSec: take.duration,
          writtenLyrics,
          isPreparedWav: Boolean(options?.preparedWav),
        },
        controller.signal
      )
        .then(phrases => {
          if (controller.signal.aborted) return;
          if (!phrases || phrases.length === 0) {
            patchTake(sectionId, take.id, { transcriptionStatus: 'done' });
            return;
          }
          const timed = timeTakeLyrics(phrases, options?.vocalMap ?? null, take.duration, writtenLyrics).map(toTimeline);
          patchTake(sectionId, take.id, {
            transcriptionStatus: 'done',
            sttData: timed,
            transcript: timed.map(p => p.text).join('\n'),
            sttSource: 'batch',
          });
        })
        .catch(err => {
          if (controller.signal.aborted) return;
          console.warn('Batch transcription failed:', err);
          patchTake(sectionId, take.id, { transcriptionStatus: 'failed' });
        })
        .finally(() => {
          if (transcribeAbortsRef.current.get(take.id) === controller) {
            transcribeAbortsRef.current.delete(take.id);
          }
          setTranscribingTakeIds(prev => {
            if (!prev[take.id]) return prev;
            const next = { ...prev };
            delete next[take.id];
            return next;
          });
        });
    },
    [patchTake, sectionsRef]
  );

  const handleRetryTakeTranscription = useCallback(
    (sectionId: string, takeId: string) => {
      if (transcribeAbortsRef.current.has(takeId)) return;
      const section = sectionsRef.current.find(s => s.id === sectionId);
      const take = section?.voiceNotes?.find(t => t.id === takeId);
      if (!take || !take.audioBlob) return;
      triggerTakeTranscription(sectionId, take, {
        writtenLyrics: section?.text ?? '',
      });
    },
    [triggerTakeTranscription, sectionsRef]
  );

  const finishRecording = useCallback(async () => {
    if (recordingBusyRef.current || !isRecordingRef.current) return;
    recordingBusyRef.current = true;

    const target = recordingTargetRef.current;
    const recorder = recorderRef.current;
    recorderRef.current = null;

    isRecordingRef.current = false;
    setIsRecording(false);
    setIsGlobalPlaying(false);

    try {
      if (!recorder || !target) return;
      const result = await recorder.stop();

      if (result.durationSec < 0.3) {
        showNotice('That recording was too short, so nothing was saved.');
        return;
      }

      // Place the take on the timeline where its first sample actually landed,
      // subtracting hardware round-trip latency and the initial capture buffer
      // duration (2048/sampleRate for AudioWorklet, 4096/sampleRate for ScriptProcessor)
      // when automatic device latency compensation is enabled.
      const settings = settingsRef.current;
      const anchor = computeRecordingAnchorSec({
        firstChunkTimelineSec: firstChunkTimelineRef.current,
        targetStartSec: target.startSec,
        manualLatencyMs: settings.recordingLatencyMs,
        reportedLatencySec: result.reportedLatencySec,
        firstChunkBufferSec: result.firstChunkBufferSec,
      });

      const section = sectionsRef.current.find(s => s.id === target.sectionId);
      const writtenLyrics = section?.text ?? '';

      const takeId = `take-${Date.now()}`;
      const take: Take = {
        id: takeId,
        name: getSectionTakeCode(section?.type ?? 'verse', section?.voiceNotes?.length ?? 0),
        duration: result.durationSec,
        audioUrl: blobUrlRegistry.acquire(takeBlobKey(takeId), result.blob),
        audioBlob: result.blob,
        waveform: result.waveform,
        hasRecorded: true,
        transcript: '',
        transcriptionStatus: 'idle',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: Date.now(),
        startBeatOffsetSec: anchor,
        beatId: importedBeatRef.current?.id,
        warnings: result.warnings.length ? result.warnings : undefined,
      };
      addTakeToSection(target.sectionId, take);
      void preloadVocalBuffer(take.id, take.audioBlob, take.audioUrl);

      // Park the playhead at the start of the new take, so the next Play
      // plays it back over the beat instead of starting after it ends.
      currentTimeRef.current = anchor;
      setCurrentTime(anchor);
      seekAudioToTime(anchor, false);

      // Surface local capture warnings only; transcription runs silently in the background.
      if (result.warnings.includes('silent')) showNotice('No input was detected on that take. Check your microphone and input level.', 'error');
      else if (result.warnings.includes('clipped')) showNotice('That take clipped. Lower your input level for a cleaner vocal.');
      else if (result.warnings.includes('interrupted')) showNotice('Audio was interrupted during that take (call, Siri or a device change).');

      if (!result.warnings.includes('silent')) {
        if (aiAvailableRef.current === false) {
          patchTake(target.sectionId, take.id, { transcriptionStatus: 'failed' });
        } else {
          triggerTakeTranscription(target.sectionId, take, {
            preparedWav: result.transcriptionBlob,
            writtenLyrics,
            vocalMap: result.vocal,
          });
        }
      }
    } catch (err) {
      console.error('Error finishing recording:', err);
      showNotice('Something went wrong saving that take.', 'error');
    } finally {
      recordingTargetRef.current = null;
      setRecordingSectionId(null);
      firstChunkTimelineRef.current = null;
      recordingBusyRef.current = false;
      // Only now (take saved and playhead parked) may Play and seeking work again.
      takeInProgressRef.current = false;
    }
  }, [
    addTakeToSection,
    patchTake,
    triggerTakeTranscription,
    showNotice,
    seekAudioToTime,
    setIsGlobalPlaying,
    setCurrentTime,
    currentTimeRef,
    isRecordingRef,
    takeInProgressRef,
    settingsRef,
    sectionsRef,
    importedBeatRef,
  ]);

  const cancelCountIn = useCallback(() => {
    clearCountdown();
    takeInProgressRef.current = false;
    recordingTargetRef.current = null;
    setRecordingSectionId(null);
    if (isPlayingRef.current) {
      setIsGlobalPlaying(false);
      globalBeatAudioRef.current?.pause();
    }
  }, [clearCountdown, takeInProgressRef, isPlayingRef, setIsGlobalPlaying, globalBeatAudioRef]);

  /** Starts the beat (if needed) and recorder at the downbeat. */
  const startCapture = useCallback(async (startSec: number, leadIn: boolean) => {
    const beat = globalBeatAudioRef.current;
    const hasBeat = Boolean(beat && importedBeatRef.current?.audioUrl);

    try {
      if (!leadIn) {
        handleSeekToTime(startSec);
        setIsGlobalPlaying(true);
        seekAudioToTime(startSec, true);
      } else if (beat && beat.paused) {
        playElement(beat);
      }

      // Don't open the mic until the beat is audibly running: the take's
      // timeline anchor is read from the beat clock on the first captured sample.
      if (hasBeat && beat!.paused) {
        await new Promise<void>(resolve => {
          const done = () => { beat!.removeEventListener('playing', done); clearTimeout(timer); resolve(); };
          const timer = setTimeout(done, 600);
          beat!.addEventListener('playing', done);
        });
      }

      firstChunkTimelineRef.current = null;

      const recorder = new UniversalVoiceRecorder();
      recorderRef.current = recorder;
      await recorder.start({
        headphones: settingsRef.current.headphones,
        onFirstChunk: () => {
          const b = globalBeatAudioRef.current;
          firstChunkTimelineRef.current = b && !b.paused ? b.currentTime : currentTimeRef.current;
        },
        onLimit: () => {
          showNotice('Reached the 15 minute limit. Saving your take.');
          void finishRecording();
        },
      });

      setIsRecording(true);
      isRecordingRef.current = true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      recorderRef.current = null;
      recordingTargetRef.current = null;
      setRecordingSectionId(null);
      isRecordingRef.current = false;
      takeInProgressRef.current = false;
      setIsRecording(false);
      setIsGlobalPlaying(false);
      showNotice(describeMicError(err), 'error');
    }
  }, [
    handleSeekToTime,
    seekAudioToTime,
    playElement,
    finishRecording,
    showNotice,
    globalBeatAudioRef,
    importedBeatRef,
    setIsGlobalPlaying,
    settingsRef,
    currentTimeRef,
    isRecordingRef,
    takeInProgressRef,
  ]);

  const beginRecording = useCallback(async (requestedSectionId?: string) => {
    if (recordingBusyRef.current) return;
    recordingBusyRef.current = true;

    try {
      const list = sectionsRef.current;
      const targetSec = list.find(s => s.id === (requestedSectionId ?? activeSectionIdRef.current)) || list[0];
      if (!targetSec) return;

      // Ask for the mic on the tap itself so the permission prompt appears now, not mid count-in.
      try {
        await UniversalVoiceRecorder.prepareMicStream({ headphones: settingsRef.current.headphones });
      } catch (micErr) {
        console.error('Microphone unavailable:', micErr);
        showNotice(describeMicError(micErr), 'error');
        return;
      }

      setIsReorderMode(false);
      setActiveSectionId(targetSec.id);
      setRecordingSectionId(targetSec.id);
      const timing = timingsRef.current.find(st => st.id === targetSec.id);
      const startSec = timing?.start ?? 0;
      recordingTargetRef.current = { sectionId: targetSec.id, startSec };

      // From here until the take is saved or cancelled, earlier takes stay silent.
      takeInProgressRef.current = true;
      pauseVocal();

      // Exact 1- or 2-bar pre-roll at the song tempo (no arbitrary second clamping so beat stays locked).
      const effectiveBpm = bpmRef.current >= 40 && bpmRef.current <= 240 ? bpmRef.current : 120;
      const singleBarSec = barDurationSec(effectiveBpm);
      const preRollBars = effectiveBpm >= 115 ? 2 : 1;
      const preRollSec = preRollBars * singleBarSec;
      const beatMs = (60 / effectiveBpm) * 1000;
      const totalPreRollMs = Math.round(preRollSec * 1000);

      const hasBeat = Boolean(importedBeatRef.current?.audioUrl);
      const fullLeadIn = hasBeat && startSec >= preRollSec - 0.05;
      const partialLeadIn = hasBeat && !fullLeadIn && startSec > 0.05;
      const leadIn = fullLeadIn || partialLeadIn;
      const preRollStart = fullLeadIn ? Math.max(0, startSec - preRollSec) : 0;

      handleSeekToTime(preRollStart);
      if (fullLeadIn) {
        setIsGlobalPlaying(true);
        seekAudioToTime(preRollStart, true);
      } else {
        globalBeatAudioRef.current?.pause();
        setIsGlobalPlaying(false);
      }

      setIsCountingDown(true);
      isCountingDownRef.current = true;
      const totalBeats = preRollBars * 4;
      setCountdownVal(totalBeats);

      const timers: ReturnType<typeof setTimeout>[] = [];
      for (let b = 1; b < totalBeats; b++) {
        timers.push(
          setTimeout(() => {
            if (isCountingDownRef.current) setCountdownVal(totalBeats - b);
          }, Math.round(b * beatMs))
        );
      }

      // If startSec < preRollSec (e.g. bar 1), start the beat from 0:00 after the silent gap so it hits startSec on the downbeat.
      if (partialLeadIn) {
        const silentDelayMs = Math.max(0, Math.round((preRollSec - startSec) * 1000));
        timers.push(
          setTimeout(() => {
            if (!isCountingDownRef.current) return;
            setIsGlobalPlaying(true);
            seekAudioToTime(0, true);
          }, silentDelayMs)
        );
      }

      timers.push(
        setTimeout(async () => {
          if (!isCountingDownRef.current) return;
          clearCountdown();
          startingCaptureRef.current = true;
          try {
            await startCapture(startSec, leadIn);
          } finally {
            startingCaptureRef.current = false;
          }
        }, totalPreRollMs)
      );
      countdownTimersRef.current = timers;
    } finally {
      recordingBusyRef.current = false;
    }
  }, [
    clearCountdown,
    handleSeekToTime,
    seekAudioToTime,
    startCapture,
    pauseVocal,
    showNotice,
    sectionsRef,
    activeSectionIdRef,
    settingsRef,
    setIsReorderMode,
    setActiveSectionId,
    timingsRef,
    takeInProgressRef,
    bpmRef,
    importedBeatRef,
    setIsGlobalPlaying,
    globalBeatAudioRef,
    isCountingDownRef,
  ]);

  const handleToggleRecord = useCallback(async (requestedSectionId?: string) => {
    if (startingCaptureRef.current) return;
    // The count-in later starts the beat outside the tap, so wake the mixer now.
    unlockMixer();
    if (isCountingDownRef.current) return cancelCountIn();
    if (isRecordingRef.current) return finishRecording();
    UniversalVoiceRecorder.warmUp();
    return beginRecording(typeof requestedSectionId === 'string' ? requestedSectionId : undefined);
  }, [cancelCountIn, finishRecording, beginRecording, isCountingDownRef, isRecordingRef]);

  return {
    isCountingDown,
    countdownVal,
    isRecording,
    recordingSectionId,
    transcribingTakeIds,
    isBusyRecording,
    cancelCountIn,
    handleToggleRecord,
    abortTakeTranscription,
    abortAllTakeTranscriptions,
    handleRetryTakeTranscription,
  };
}
