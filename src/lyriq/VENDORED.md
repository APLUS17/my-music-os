# `src/lyriq/` is a vendored copy of the minimal LYRIQ editor

Source: `APLUS17/LYRIQ-Minimal-Public`, `main` @ **b23e047**. It is the app served at `/`.
Treat it as upstream code: fix things there first, then re-sync, rather than diverging.

## Differences from upstream (keep this list short)

1. `motion/react` -> `framer-motion` (same API; `motion` isn't a dependency here).
2. `services/ai.ts`: `getAiFeatures()` reads `/api/health` once. `analyzeBeatArrangement` and
   `fetchSongSuggestions` throw `ai_unavailable` immediately when the server says the feature is
   off, so a whole beat is never uploaded just to be refused.
3. `App.tsx` + `components/LyricToolbar.tsx`: the **Suggest** button/menu item only appears when
   the server offers suggestions.
4. `__tests__/`: `node:test` -> `vitest`, each file pinned to the `node` environment. Their
   Express `server.test.ts` was dropped (there is no Express server here).
5. Not copied: `main.tsx`, `server.ts`, `vite.config.ts` (replaced by `src/app/(lyriq)/` and `src/app/api/`).
6. **Beat sectioning is ours.** `utils/structure/` + `services/structureAnalysis.ts` (new files) do the
   sectioning in a Web Worker. In `App.tsx`, `runBackgroundBeatAnalysis` calls `analyzeBeatStructure`
   instead of `analyzeBeatArrangement` (server), `isFinalArrangement` replaces the `source === 'ai'`
   checks, and `handleConfirmReanalysis` runs `markRepeatedLyricsAsHook`. Sections get beat-style names
   (Intro, Hook, Verse, Bridge, Outro). `types.ts`: `BeatAnalysis`
   gains `source: 'local-structure'`, `version`, `groups`; `ArrangementSource` gains `'structure'`.
   `utils/audio.ts` gains `decodeToMono`. `components/Header.tsx`: the import message no longer
   quotes the instant draft's BPM and section count ("loaded • finding sections…"); `App.tsx`
   announces the real ones when the analysis lands ("Sections ready: 8 sections • 140 BPM").

7. **Loop playback is click-free (ours).** `utils/mixer.ts` + `hooks/useAudioEngine.ts`. A section loop used
   to wrap by seeking the beat's media element and dipping the gain at that instant. Measured with a
   continuous tone: every wrap was a hard cut (one sample jumping ~98% of full scale), because the playback
   context's clock only advances in ~23 ms steps, so a 3-8 ms fade scheduled "now" ran in the past. Now:
   - while a section loops, the beat plays from a decoded copy of just that section
     (`AudioBufferSourceNode`, `loop = true`) with its end cross-faded into the audio before its start
     (`renderLoopRegion`), so the seam is continuous and the loop length is exact; the media element keeps
     running muted underneath and is the fallback while the copy decodes;
   - the playhead follows that loop's audio clock, and the vocal restart is booked on the same clock ahead of
     each wrap, so beat and vocal land on the same sample;
   - every fade is scheduled `scheduleMargin()` (>= 25 ms, from `baseLatency`) ahead of `ctx.currentTime`;
     vocal sources have their own fader and crossfade instead of stopping dead.
   Verified by recording the context's output (an AudioWorklet tap) while looping a continuous-phase tone:
   old engine 4 clicks in 4 wraps, new engine 0 in 4 (mid-file section) and none in steady-state wraps.
   `__tests__/loopRegion.test.ts` covers the seam maths.

8. **Vocal drift check tolerates iPhone's clock (ours).** `utils/vocalDrift.ts` (new) + `utils/mixer.ts`.
   `syncVocalBufferPlayback` used to restart the vocal whenever it was more than 80 ms from the song clock,
   checked every frame. iOS Safari reports the beat element's position late and in coarse steps, so that
   fired constantly and the vocal sounded choppy. Now it learns the normal offset after each start and only
   corrects drift that leaves it by more than 200 ms for 300 ms, at most once every 1.5 s. Seeks and loop
   wraps still restart the vocal at once. Tests: `__tests__/vocalDrift.test.ts`.

9. **Mobile fixes (ours).** The new flat dock (`MasterPlaybackDock.tsx`) plus: safe-area padding on every
   top bar (`Header`, `LibraryView`, `KaraokeLyricsModal`, notices), `h-dvh` root, 44 px touch targets
   (`hit-44` utility in `index.css` for icon buttons, `min-h-[44px]` for menu rows), song delete with
   Undo (`handleDeleteSession` / `restoreDeletedSession` in `App.tsx`), keyboard bar lifted clear of
   the dock bubble, dock menu opens Sync settings directly when it would hold one item.
10. **Auto latency reads the beat's context (ours).** `utils/mixer.ts` (`getPlaybackOutputLatencySec`),
   `utils/audio.ts` (`resolveAutoLatencySec`, `RecordingResult.inputLatencySec`), `hooks/useVoiceRecorder.ts`.
   Take placement used to subtract the *capture* context's `baseLatency + outputLatency`, but the beat plays
   through the mixer's `'playback'` context, which buffers more. Now, when the beat is playing and routed
   through the mixer, auto latency = mixer `baseLatency + outputLatency` (read with the first chunk) + the mic
   track's `latency`; otherwise it falls back to the old reading. Safari reports no `outputLatency`, so
   iPhone still undercounts until loopback calibration lands.

## Server side (ours, not vendored)

- `src/app/api/transcribe-audio` -> Groq Whisper with word timestamps, your written lyrics as the
  `prompt` hint, mapped to lyric lines by `src/lib/server/whisperLines.ts`.
- `src/app/api/health` -> `{ ai, features: { transcription, arrangement, suggestions } }`.
- `src/app/api/analyze-beat`, `song-assistant` -> always `503 ai_unavailable` (beat sectioning is
  local; no AI service is wired for suggestions).

## Re-syncing

Copy upstream `src/{components,hooks,services,utils,lib}`, `App.tsx`, `types.ts`, `index.css` over
this folder, re-apply the nine differences above, run `npx tsc --noEmit` and `npx vitest run src/lyriq`.
