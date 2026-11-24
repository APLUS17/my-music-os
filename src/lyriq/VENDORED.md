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
   `utils/audio.ts` gains `decodeToMono`.

## Server side (ours, not vendored)

- `src/app/api/transcribe-audio` -> Groq Whisper with word timestamps, your written lyrics as the
  `prompt` hint, mapped to lyric lines by `src/lib/server/whisperLines.ts`.
- `src/app/api/health` -> `{ ai, features: { transcription, arrangement, suggestions } }`.
- `src/app/api/analyze-beat`, `song-assistant` -> always `503 ai_unavailable` (beat sectioning is
  local; no AI service is wired for suggestions).

## Re-syncing

Copy upstream `src/{components,hooks,services,utils,lib}`, `App.tsx`, `types.ts`, `index.css` over
this folder, re-apply the six differences above, run `npx tsc --noEmit` and `npx vitest run src/lyriq`.
