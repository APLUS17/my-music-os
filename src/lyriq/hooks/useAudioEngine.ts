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
import type { ImportedBeat, SongSection } from '../types';
import {
  unlockMixer,
  resumeMixerIfNeeded,
  attachToMixer,
  detachFromMixer,
  setMixerLevel,
  preloadVocalBuffer,
  syncVocalBufferPlayback,
  stopVocalBufferPlayback,
  triggerLoopWrapFade,
} from '../utils/mixer';
import type { SyncSettings } from '../utils/settings';
import {
  findTimingAt,
  findVocalAtTime,
  takeAnchorSec,
  type SectionTiming,
} from '../utils/timeline';

export const NO_AUDIO_PLACEHOLDER_SEC = 120;
/** How often the playhead is published to React state. The audio loop itself runs faster. */
const CLOCK_PUBLISH_MS = 50;
/** Longest the clock waits on a seek before carrying on anyway. */
const SEEK_GUARD_MAX_MS = 400;

export interface UseAudioEngineOptions {
  sections: SongSection[];
  importedBeat: ImportedBeat | null;
  setImportedBeat: Dispatch<SetStateAction<ImportedBeat | null>>;
  activeTakeIndices: Record<string, number>;
  resolvedSectionTimings: SectionTiming[];
  totalDuration: number;
  syncSettings: SyncSettings;
  isVocalMuted: boolean;
  isRecordingRef: RefObject<boolean>;
  isCountingDownRef: RefObject<boolean>;
  takeInProgressRef: RefObject<boolean>;
  isLiveLyricsOpenRef: RefObject<boolean>;
  setActiveSectionId: Dispatch<SetStateAction<string | null>>;
  onResumeAutoScroll: () => void;
  showNotice: (text: string, tone?: 'info' | 'error') => void;
}

export interface UseAudioEngineReturn {
  currentTime: number;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  currentTimeRef: MutableRefObject<number>;
  isGlobalPlaying: boolean;
  setIsGlobalPlaying: Dispatch<SetStateAction<boolean>>;
  isPlayingRef: MutableRefObject<boolean>;
  globalBeatAudioRef: MutableRefObject<HTMLAudioElement | null>;
  globalVocalAudioRef: MutableRefObject<HTMLAudioElement | null>;
  playElement: (el: HTMLAudioElement) => void;
  seekAudioToTime: (timeSec: number, shouldPlay: boolean) => void;
  syncVocalPlayback: (timeSec: number, shouldPlay: boolean, strict?: boolean, fadeInMs?: number) => void;
  handleSeekToTime: (timeSec: number) => void;
  handleUserSeek: (timeSec: number) => void;
  handleJumpToSection: (sectionId: string, customTimeSec?: number) => void;
  handleTogglePlay: () => void;
  pauseVocal: () => void;
  stopPlayback: () => void;
  resetPlayback: () => void;
  jumpWithLoopFade: (targetTimeSec: number) => void;
}

export function useAudioEngine({
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
  onResumeAutoScroll,
  showNotice,
}: UseAudioEngineOptions): UseAudioEngineReturn {
  // --- Playback clock ---
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isGlobalPlaying, setIsGlobalPlaying] = useState<boolean>(false);

  // Audio elements live for the app's lifetime (never unmounted) so playback survives UI changes.
  const globalBeatAudioRef = useRef<HTMLAudioElement | null>(null);
  const globalVocalAudioRef = useRef<HTMLAudioElement | null>(null);
  const desiredVocalOffsetRef = useRef<number>(0);
  const lastVocalSeekRef = useRef<number>(0);

  // Mirrors of state for callbacks that outlive a render (timers, audio events).
  const sectionsRef = useRef(sections);
  const importedBeatRef = useRef(importedBeat);
  const takeIndicesRef = useRef(activeTakeIndices);
  const timingsRef = useRef(resolvedSectionTimings);
  const totalDurationRef = useRef(totalDuration);
  const settingsRef = useRef(syncSettings);
  const isVocalMutedRef = useRef(isVocalMuted);
  const isPlayingRef = useRef(isGlobalPlaying);
  const currentTimeRef = useRef(currentTime);

  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  useEffect(() => { importedBeatRef.current = importedBeat; }, [importedBeat]);
  useEffect(() => { takeIndicesRef.current = activeTakeIndices; }, [activeTakeIndices]);
  useEffect(() => { timingsRef.current = resolvedSectionTimings; }, [resolvedSectionTimings]);
  useEffect(() => { totalDurationRef.current = totalDuration; }, [totalDuration]);
  useEffect(() => { settingsRef.current = syncSettings; }, [syncSettings]);
  useEffect(() => { isPlayingRef.current = isGlobalPlaying; }, [isGlobalPlaying]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  useEffect(() => {
    isVocalMutedRef.current = isVocalMuted;
    if (isVocalMuted) {
      stopVocalBufferPlayback();
      globalVocalAudioRef.current?.pause();
    }
  }, [isVocalMuted]);

  // Seek guards: media elements report stale positions while a seek is in flight.
  const isSeekingRef = useRef<boolean>(false);
  const seekTargetTimeRef = useRef<number | null>(null);
  const seekCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Distinguishes internal loop wraps from user scrubs so 'seeking' never freezes the loop clock for 400ms. */
  const isInternalLoopSeekRef = useRef<boolean>(false);
  const loopWrapTargetRef = useRef<{ targetSec: number; prevEndSec: number; expiresAt: number } | null>(null);
  const syncVocalPlaybackRef = useRef<(timeSec: number, shouldPlay: boolean, strict?: boolean, fadeInMs?: number) => void>(() => {});

  /**
   * Holds the clock while a seek is in flight. The 'seeked' event normally
   * releases it; the timeout is the backstop for browsers (notably iOS Safari)
   * that deliver 'seeked' late or not at all, which otherwise froze the timer.
   */
  const armSeekGuard = useCallback((target: number | null) => {
    isSeekingRef.current = true;
    if (target !== null) seekTargetTimeRef.current = target;
    if (seekCooldownTimerRef.current) clearTimeout(seekCooldownTimerRef.current);
    seekCooldownTimerRef.current = setTimeout(() => {
      isSeekingRef.current = false;
      seekTargetTimeRef.current = null;
    }, SEEK_GUARD_MAX_MS);
  }, []);

  const releaseSeekGuard = useCallback(() => {
    isSeekingRef.current = false;
    seekTargetTimeRef.current = null;
    if (seekCooldownTimerRef.current) clearTimeout(seekCooldownTimerRef.current);
  }, []);

  /** Whether the section playing at the very end of the song is set to loop. */
  const isEndSectionLooping = useCallback((): boolean => {
    const timings = timingsRef.current;
    if (timings.length === 0) return false;
    const last = timings.reduce((a, b) => (b.end > a.end ? b : a));
    return Boolean(sectionsRef.current.find(s => s.id === last.id)?.isLooping);
  }, []);

  /** Plays an element; reverts UI state if the browser blocks autoplay. */
  const playElement = useCallback((el: HTMLAudioElement) => {
    el.play().catch(err => {
      if (err?.name === 'NotAllowedError') {
        setIsGlobalPlaying(false);
        showNotice('Your browser blocked audio. Tap play to start.', 'error');
      } else if (err?.name !== 'AbortError') {
        console.warn('Audio play() failed:', err);
      }
    });
  }, [showNotice]);

  // --- Beat element lifecycle ---
  useEffect(() => {
    const url = importedBeat?.audioUrl;
    if (!url) {
      const el = globalBeatAudioRef.current;
      if (el) {
        el.pause();
        detachFromMixer(el);
        el.removeAttribute('src');
        el.load();
        globalBeatAudioRef.current = null;
      }
      return;
    }

    let el = globalBeatAudioRef.current;
    if (!el) {
      el = new Audio();
      el.preload = 'auto';
      (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      globalBeatAudioRef.current = el;
      attachToMixer(el, settingsRef.current.beatVolume);
    }
    if (el.src !== url) el.src = url;
    const beatAudio = el;

    const onLoadedMetadata = () => {
      const realDur = beatAudio.duration;
      if (Number.isFinite(realDur) && realDur > 0) {
        setImportedBeat(prev => (prev && Math.abs((prev.duration || 0) - realDur) > 1 ? { ...prev, duration: realDur } : prev));
      }
      if (seekTargetTimeRef.current !== null) {
        try { beatAudio.currentTime = seekTargetTimeRef.current; } catch { /* not seekable yet */ }
      }
    };
    const onSeeked = () => {
      loopWrapTargetRef.current = null;
      isInternalLoopSeekRef.current = false;
      releaseSeekGuard();
    };
    const onSeeking = () => {
      if (isInternalLoopSeekRef.current) return;
      armSeekGuard(null);
    };
    const onTimeUpdate = () => {
      if (isSeekingRef.current) return;
      const t = beatAudio.currentTime;
      const wrap = loopWrapTargetRef.current;
      if (wrap && performance.now() < wrap.expiresAt && t >= wrap.prevEndSec - 0.12) return;
      if (Number.isFinite(t) && t >= 0 && !beatAudio.paused) {
        currentTimeRef.current = t;
        setCurrentTime(t);
      }
    };
    // Backup for the clock loop's own end-of-song stop or throttled end-section loop wrap.
    const onEnded = () => {
      // Mid-take the singer may hold a note past the beat: keep the clock going.
      if (isRecordingRef.current || isCountingDownRef.current) return;
      if (isEndSectionLooping()) {
        const timings = timingsRef.current;
        if (timings.length > 0) {
          const last = timings.reduce((a, b) => (b.end > a.end ? b : a));
          const wrapStart = Math.max(0, last.start);
          triggerLoopWrapFade(
            beatAudio,
            settingsRef.current.beatVolume,
            isVocalMutedRef.current ? 0 : settingsRef.current.vocalVolume,
            8
          );
          loopWrapTargetRef.current = {
            targetSec: wrapStart,
            prevEndSec: last.end,
            expiresAt: performance.now() + 350,
          };
          isInternalLoopSeekRef.current = true;
          try {
            beatAudio.currentTime = wrapStart;
          } finally {
            isInternalLoopSeekRef.current = false;
          }
          playElement(beatAudio);
          currentTimeRef.current = wrapStart;
          setCurrentTime(wrapStart);
          syncVocalPlaybackRef.current(wrapStart, true, true, 8);
        }
        return;
      }
      // Land on the final frame so the timer reads the full length, not a frame short.
      const end = totalDurationRef.current > 0 ? totalDurationRef.current : beatAudio.currentTime;
      currentTimeRef.current = end;
      setCurrentTime(end);
      setIsGlobalPlaying(false);
    };
    const onError = () => showNotice('This beat could not be played. Try re-importing it as WAV or MP3.', 'error');

    beatAudio.addEventListener('loadedmetadata', onLoadedMetadata);
    beatAudio.addEventListener('seeked', onSeeked);
    beatAudio.addEventListener('seeking', onSeeking);
    beatAudio.addEventListener('timeupdate', onTimeUpdate);
    beatAudio.addEventListener('ended', onEnded);
    beatAudio.addEventListener('error', onError);
    if (beatAudio.readyState >= 1) onLoadedMetadata();

    return () => {
      beatAudio.removeEventListener('loadedmetadata', onLoadedMetadata);
      beatAudio.removeEventListener('seeked', onSeeked);
      beatAudio.removeEventListener('seeking', onSeeking);
      beatAudio.removeEventListener('timeupdate', onTimeUpdate);
      beatAudio.removeEventListener('ended', onEnded);
      beatAudio.removeEventListener('error', onError);
    };
  }, [
    importedBeat?.audioUrl,
    setImportedBeat,
    showNotice,
    armSeekGuard,
    releaseSeekGuard,
    isEndSectionLooping,
    playElement,
    isRecordingRef,
    isCountingDownRef,
  ]);

  const ensureVocalElement = useCallback((): HTMLAudioElement => {
    let el = globalVocalAudioRef.current;
    if (!el) {
      el = new Audio();
      el.preload = 'auto';
      (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      const vocal = el;
      // A freshly assigned src can't be seeked until its metadata is in.
      vocal.addEventListener('loadedmetadata', () => {
        try { vocal.currentTime = desiredVocalOffsetRef.current; } catch { /* not seekable yet */ }
      });
      globalVocalAudioRef.current = vocal;
      attachToMixer(vocal, settingsRef.current.vocalVolume);
    }
    return el;
  }, []);

  // Beat and vocal levels. These go through the mixer's gain nodes, because
  // iOS Safari ignores HTMLMediaElement.volume.
  useEffect(() => {
    setMixerLevel(globalBeatAudioRef.current, syncSettings.beatVolume);
    setMixerLevel(globalVocalAudioRef.current, syncSettings.vocalVolume);
  }, [syncSettings.beatVolume, syncSettings.vocalVolume, importedBeat?.audioUrl]);

  /**
   * Keeps the vocal element locked to the song clock. The take that sounds is
   * chosen by where each take was recorded on the timeline, not by section.
   */
  const syncVocalPlayback = useCallback((timeSec: number, shouldPlay: boolean, strict = false, fadeInMs = 0) => {
    const existing = globalVocalAudioRef.current;
    const pauseElement = () => {
      if (existing && !existing.paused) {
        existing.pause();
        if (existing.playbackRate !== 1.0) existing.playbackRate = 1.0;
      }
    };
    const silence = () => {
      stopVocalBufferPlayback();
      pauseElement();
    };

    // Previous takes are muted while tracking a new one, or when the user muted vocals.
    if (takeInProgressRef.current || isRecordingRef.current || isCountingDownRef.current || isVocalMutedRef.current) return silence();

    const hit = findVocalAtTime(sectionsRef.current, timingsRef.current, takeIndicesRef.current, timeSec);
    if (!hit?.take.audioUrl) return silence();

    if (!shouldPlay) {
      silence();
      void preloadVocalBuffer(hit.take.id, hit.take.audioBlob, hit.take.audioUrl);
      return;
    }

    const status = syncVocalBufferPlayback(
      hit.take.id,
      hit.take.audioBlob,
      hit.take.audioUrl,
      hit.offsetSec,
      settingsRef.current.vocalVolume,
      strict,
      fadeInMs
    );
    if (status !== 'fallback') {
      pauseElement();
      return;
    }

    const vocal = ensureVocalElement();
    desiredVocalOffsetRef.current = hit.offsetSec;
    if (vocal.src !== hit.take.audioUrl) vocal.src = hit.take.audioUrl;

    if (vocal.readyState >= 1 && !vocal.seeking) {
      if (strict) {
        // Explicit transport seek or loop jump: snap immediately
        if (Math.abs(vocal.currentTime - hit.offsetSec) > 0.04) {
          try { vocal.currentTime = hit.offsetSec; } catch { /* not seekable yet */ }
        }
        if (vocal.playbackRate !== 1.0) vocal.playbackRate = 1.0;
      } else if (!vocal.paused) {
        // Continuous playback: NEVER perform hard seeks on micro-drift.
        // Calling audio.currentTime during playback flushes the audio decoding buffer and causes choppy audio.
        const drift = vocal.currentTime - hit.offsetSec;
        const absDrift = Math.abs(drift);
        if (absDrift > 0.6) {
          // Significant desync (e.g. background tab throttling): throttled corrective seek
          const now = performance.now();
          if (now - lastVocalSeekRef.current > 1500) {
            lastVocalSeekRef.current = now;
            try { vocal.currentTime = hit.offsetSec; } catch { /* not seekable yet */ }
          }
        } else if (absDrift > 0.06) {
          // Micro-drift: smooth speed nudge without any audible clicks, pops, or seeking
          const nudge = drift < 0 ? 1.025 : 0.975;
          if (vocal.playbackRate !== nudge) vocal.playbackRate = nudge;
        } else if (vocal.playbackRate !== 1.0) {
          vocal.playbackRate = 1.0;
        }
      }
    }

    if (vocal.paused) playElement(vocal);
  }, [ensureVocalElement, playElement, takeInProgressRef, isRecordingRef, isCountingDownRef]);
  syncVocalPlaybackRef.current = syncVocalPlayback;

  /** Moves both media elements to `timeSec`. */
  const seekAudioToTime = useCallback((timeSec: number, shouldPlay: boolean) => {
    const beatAudio = globalBeatAudioRef.current;
    if (beatAudio && importedBeatRef.current?.audioUrl) {
      try {
        if (beatAudio.readyState < 1) seekTargetTimeRef.current = timeSec;
        // Already there (e.g. pressing Play): seeking anyway only risks a stalled 'seeked'.
        else if (Math.abs(beatAudio.currentTime - timeSec) > 0.05) beatAudio.currentTime = timeSec;
        if (shouldPlay && beatAudio.paused) playElement(beatAudio);
        else if (!shouldPlay && !beatAudio.paused) beatAudio.pause();
      } catch (e) {
        console.warn('Beat seek failed:', e);
      }
    }
    syncVocalPlayback(timeSec, shouldPlay, true);
  }, [syncVocalPlayback, playElement]);

  // --- Playback clock loop (rAF + lookahead + micro-fade for tight bar loops) ---
  // The beat element is the master clock when present; when no beat is loaded,
  // the vocal take itself drives the clock so playhead and lyrics stay in pure lock.
  useEffect(() => {
    if (!isGlobalPlaying) {
      if (!isSeekingRef.current) {
        globalBeatAudioRef.current?.pause();
        stopVocalBufferPlayback();
        const vocal = globalVocalAudioRef.current;
        if (vocal && !vocal.paused) {
          vocal.pause();
          if (vocal.playbackRate !== 1.0) vocal.playbackRate = 1.0;
        }
      }
      return;
    }

    const LOOP_LOOKAHEAD_SEC = 0.014;
    let last = performance.now();
    let lastPublish = 0;
    let rafId: number | null = null;
    let hiddenTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const stepClock = () => {
      if (stopped) return;
      const now = performance.now();
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;

      const beat = globalBeatAudioRef.current;
      if (isSeekingRef.current) return;

      const prevTime = currentTimeRef.current;
      const hasBeat = Boolean(beat && importedBeatRef.current?.audioUrl);
      const beatRunning = hasBeat && !beat!.paused && !beat!.ended;

      let nextTime: number;
      const activeWrap = loopWrapTargetRef.current;
      if (beatRunning) {
        const beatPos = beat!.currentTime;
        // Mobile Safari & Chrome can report the stale pre-wrap beat position for 1-2 frames
        // right after setting beat.currentTime = timing.start; ignore it so we never double-wrap.
        if (activeWrap) {
          if (now >= activeWrap.expiresAt || (!beat!.seeking && Math.abs(beatPos - activeWrap.targetSec) < 0.35)) {
            loopWrapTargetRef.current = null;
          } else if (beat!.seeking || beatPos >= activeWrap.prevEndSec - 0.12) {
            return;
          }
        }
        // Some mobile browsers briefly report 0 while buffering after a seek.
        if (beatPos === 0 && prevTime > 1.5 && seekTargetTimeRef.current !== null) return;
        nextTime = beatPos;
      } else {
        const vocal = globalVocalAudioRef.current;
        const vocalRunning = Boolean(vocal && !vocal.paused && !vocal.ended && vocal.readyState >= 2);
        const hit = vocalRunning ? findVocalAtTime(sectionsRef.current, timingsRef.current, takeIndicesRef.current, prevTime) : null;
        if (vocalRunning && hit) {
          const timing = timingsRef.current.find(st => st.id === hit.sectionId);
          const anchor = takeAnchorSec(hit.take, timing?.start ?? 0);
          nextTime = vocal!.currentTime + anchor;
        } else {
          nextTime = prevTime + dt;
        }
      }

      const safeTotal = totalDurationRef.current;
      const timing = findTimingAt(timingsRef.current, prevTime);
      const section = sectionsRef.current.find(s => s.id === timing?.id);
      let jumped = false;
      // While a take is counting in or recording, time must run straight on:
      // a loop jump would desync the take from the beat, and stopping at the
      // song end would freeze the timer while the mic is still capturing.
      const tracking = isRecordingRef.current || isCountingDownRef.current;

      if (tracking) {
        // No loops, no end-of-song stop. After the beat ends, wall time carries on.
      } else if (section?.isLooping && timing && timing.end > timing.start) {
        if (nextTime >= timing.end - LOOP_LOOKAHEAD_SEC) {
          nextTime = timing.start;
          jumped = true;
        }
      } else if (safeTotal > 0 && nextTime >= safeTotal) {
        // End of song: stop on the last frame. The next Play starts from 0:00.
        stopped = true;
        currentTimeRef.current = safeTotal;
        setCurrentTime(safeTotal);
        setIsGlobalPlaying(false);
        stopVocalBufferPlayback();
        globalVocalAudioRef.current?.pause();
        return;
      }

      if (jumped) {
        triggerLoopWrapFade(
          beat,
          settingsRef.current.beatVolume,
          isVocalMutedRef.current ? 0 : settingsRef.current.vocalVolume,
          8
        );
        if (hasBeat && beat!.readyState >= 1) {
          loopWrapTargetRef.current = {
            targetSec: nextTime,
            prevEndSec: timing?.end ?? nextTime,
            expiresAt: now + 350,
          };
          isInternalLoopSeekRef.current = true;
          try {
            beat!.currentTime = nextTime;
          } finally {
            isInternalLoopSeekRef.current = false;
          }
          if (beat!.paused) playElement(beat!);
        }
      }

      currentTimeRef.current = nextTime;
      if (jumped || now - lastPublish >= CLOCK_PUBLISH_MS) {
        lastPublish = now;
        setCurrentTime(nextTime);
      }

      syncVocalPlayback(nextTime, true, jumped, jumped ? 8 : 0);
    };

    const scheduleFrame = () => {
      if (stopped) return;
      rafId = requestAnimationFrame(() => {
        stepClock();
        scheduleFrame();
      });
    };

    const recoverAfterForeground = () => {
      if (stopped || isRecordingRef.current || isCountingDownRef.current) return;
      last = performance.now();
      void resumeMixerIfNeeded().then(() => {
        if (stopped || !isPlayingRef.current || isRecordingRef.current || isCountingDownRef.current) return;
        const beat = globalBeatAudioRef.current;
        const hasBeat = Boolean(beat && importedBeatRef.current?.audioUrl);
        if (hasBeat && beat) {
          if (beat.paused && !beat.ended) {
            // Mobile OS (especially iOS Safari) often pauses HTMLAudioElement during app switch.
            // Try to resume; if blocked, sync UI to paused so playback never drifts silently.
            beat.play()
              .then(() => {
                if (!stopped && isPlayingRef.current) {
                  syncVocalPlayback(beat.currentTime, true, true, 8);
                }
              })
              .catch((err) => {
                if (!stopped && err?.name !== 'AbortError') {
                  stopVocalBufferPlayback();
                  globalVocalAudioRef.current?.pause();
                  setIsGlobalPlaying(false);
                }
              });
            return;
          }
          const cur = beat.currentTime;
          const t = findTimingAt(timingsRef.current, currentTimeRef.current);
          const s = sectionsRef.current.find(sec => sec.id === t?.id);
          if (s?.isLooping && t && t.end > t.start && cur >= t.end - LOOP_LOOKAHEAD_SEC) {
            triggerLoopWrapFade(
              beat,
              settingsRef.current.beatVolume,
              isVocalMutedRef.current ? 0 : settingsRef.current.vocalVolume,
              8
            );
            loopWrapTargetRef.current = { targetSec: t.start, prevEndSec: t.end, expiresAt: performance.now() + 350 };
            isInternalLoopSeekRef.current = true;
            try { beat.currentTime = t.start; } finally { isInternalLoopSeekRef.current = false; }
            currentTimeRef.current = t.start;
            setCurrentTime(t.start);
            syncVocalPlayback(t.start, true, true, 8);
          } else {
            currentTimeRef.current = cur;
            setCurrentTime(cur);
            syncVocalPlayback(cur, true, true, 8);
          }
        } else {
          syncVocalPlayback(currentTimeRef.current, true, true, 8);
        }
      });
    };

    let wasHidden = typeof document !== 'undefined' && document.hidden;

    const syncClockDriver = () => {
      if (stopped) return;
      if (typeof document !== 'undefined' && document.hidden) {
        wasHidden = true;
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        if (hiddenTimer === null) hiddenTimer = setInterval(stepClock, 25);
      } else {
        if (hiddenTimer !== null) { clearInterval(hiddenTimer); hiddenTimer = null; }
        if (wasHidden) {
          wasHidden = false;
          recoverAfterForeground();
        }
        if (rafId === null) scheduleFrame();
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted || wasHidden) {
        wasHidden = false;
        recoverAfterForeground();
      }
    };

    syncClockDriver();
    document.addEventListener('visibilitychange', syncClockDriver);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      stopped = true;
      loopWrapTargetRef.current = null;
      isInternalLoopSeekRef.current = false;
      document.removeEventListener('visibilitychange', syncClockDriver);
      window.removeEventListener('pageshow', onPageShow);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (hiddenTimer !== null) clearInterval(hiddenTimer);
    };
  }, [isGlobalPlaying, syncVocalPlayback, playElement, isRecordingRef, isCountingDownRef]);

  // Drop audio elements and seek timers on unmount.
  useEffect(() => {
    return () => {
      if (globalBeatAudioRef.current) {
        globalBeatAudioRef.current.pause();
        detachFromMixer(globalBeatAudioRef.current);
      }
      stopVocalBufferPlayback();
      if (globalVocalAudioRef.current) {
        globalVocalAudioRef.current.pause();
        detachFromMixer(globalVocalAudioRef.current);
      }
      if (seekCooldownTimerRef.current) clearTimeout(seekCooldownTimerRef.current);
    };
  }, []);

  const handleSeekToTime = useCallback((timeSec: number) => {
    unlockMixer();
    const safeTotal = totalDurationRef.current > 0 ? totalDurationRef.current : (importedBeatRef.current?.duration || NO_AUDIO_PLACEHOLDER_SEC);
    const clamped = Math.max(0, Math.min(safeTotal, timeSec));

    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    onResumeAutoScroll();

    armSeekGuard(clamped);

    const hit = findTimingAt(timingsRef.current, clamped);
    if (hit) setActiveSectionId(hit.id);

    seekAudioToTime(clamped, isPlayingRef.current);
  }, [seekAudioToTime, armSeekGuard, onResumeAutoScroll, setActiveSectionId]);

  /** Seeks from the timeline or lyrics view. Ignored mid-take: the beat would jump but the mic would not. */
  const handleUserSeek = useCallback((timeSec: number) => {
    if (takeInProgressRef.current) return;
    handleSeekToTime(timeSec);
  }, [handleSeekToTime, takeInProgressRef]);

  const handleJumpToSection = useCallback((sectionId: string, customTimeSec?: number) => {
    if (takeInProgressRef.current) return;
    const target = timingsRef.current.find(st => st.id === sectionId);
    if (!target) return;
    setActiveSectionId(sectionId);
    handleSeekToTime(customTimeSec !== undefined ? customTimeSec : target.start);
  }, [handleSeekToTime, setActiveSectionId, takeInProgressRef]);

  const handleTogglePlay = useCallback(() => {
    // Transport is owned by the record button from the Record tap until the take is saved.
    if (takeInProgressRef.current || isRecordingRef.current || isCountingDownRef.current) return;
    // Must run inside the tap itself: iOS only starts audio from a gesture.
    unlockMixer();

    if (isPlayingRef.current) {
      setIsGlobalPlaying(false);
      globalBeatAudioRef.current?.pause();
      stopVocalBufferPlayback();
      globalVocalAudioRef.current?.pause();
      if (isLiveLyricsOpenRef.current) {
        const hit = findTimingAt(timingsRef.current, currentTimeRef.current);
        if (hit) setActiveSectionId(hit.id);
      }
      return;
    }
    onResumeAutoScroll();
    let start = currentTimeRef.current;
    if (totalDurationRef.current > 0 && start >= totalDurationRef.current) {
      start = 0;
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }
    setIsGlobalPlaying(true);
    seekAudioToTime(start, true);
  }, [
    seekAudioToTime,
    onResumeAutoScroll,
    setActiveSectionId,
    takeInProgressRef,
    isRecordingRef,
    isCountingDownRef,
    isLiveLyricsOpenRef,
  ]);

  const pauseVocal = useCallback(() => {
    stopVocalBufferPlayback();
    globalVocalAudioRef.current?.pause();
  }, []);

  const stopPlayback = useCallback(() => {
    setIsGlobalPlaying(false);
    globalBeatAudioRef.current?.pause();
    stopVocalBufferPlayback();
    globalVocalAudioRef.current?.pause();
  }, []);

  const resetPlayback = useCallback(() => {
    setIsGlobalPlaying(false);
    currentTimeRef.current = 0;
    setCurrentTime(0);
    globalBeatAudioRef.current?.pause();
    stopVocalBufferPlayback();
    globalVocalAudioRef.current?.pause();
  }, []);

  const jumpWithLoopFade = useCallback((targetTimeSec: number) => {
    const beat = globalBeatAudioRef.current;
    triggerLoopWrapFade(
      beat,
      settingsRef.current.beatVolume,
      isVocalMutedRef.current ? 0 : settingsRef.current.vocalVolume,
      8
    );
    currentTimeRef.current = targetTimeSec;
    setCurrentTime(targetTimeSec);
    if (beat && importedBeatRef.current?.audioUrl && beat.readyState >= 1) {
      beat.currentTime = targetTimeSec;
      if (beat.paused) playElement(beat);
    }
    syncVocalPlayback(targetTimeSec, true, true, 8);
  }, [playElement, syncVocalPlayback]);

  return {
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
    syncVocalPlayback,
    handleSeekToTime,
    handleUserSeek,
    handleJumpToSection,
    handleTogglePlay,
    pauseVocal,
    stopPlayback,
    resetPlayback,
    jumpWithLoopFade,
  };
}
