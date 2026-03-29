---
name: debug
description: Systematic debugging workflow for this Next.js/React music studio app. Use when diagnosing runtime errors, unexpected UI behavior, audio pipeline issues, AI analysis failures, or data persistence bugs.
---

# Debug Skill

When this skill is active, follow this structured debugging process before writing any fixes.

---

## Step 1: Reproduce & Scope

1. Identify **exactly** what is broken — UI render, audio playback, recording, AI analysis, persistence, or navigation.
2. Note the **trigger**: user action, lifecycle event, async callback, or state change.
3. Check the browser console and network tab for errors or failed requests.

---

## Step 2: Locate the Fault

Use the component/module map below to narrow the search:

| Area | Key Files |
|------|-----------|
| Studio layout & state | `src/components/studio/StudioWorkspace.tsx` |
| Recording & layers | `src/components/studio/RecordingThread.tsx` |
| Beat-driven player | `src/components/studio/PlayerTab.tsx` |
| Audio split & energy | `src/lib/audio/smartSplit.ts` |
| Gemini AI analysis | `src/lib/audio/audioIntelligence.ts` |
| Beat upload flow | `src/components/studio/BeatUploader.tsx` |
| Shared types | `src/types/index.ts` |
| IndexedDB audio store | inline in `StudioWorkspace.tsx` (`initDB`, `saveAudioData`, `getAudioData`) |

Read the relevant file(s) before suggesting any fix.

---

## Step 3: Common Failure Patterns

**Audio / Web Audio API**
- `AudioContext` suspended on page load — requires user gesture to resume.
- `decodeAudioData` fails on unsupported codec — check MIME type and browser support.
- Beat base64 missing data URL prefix — `analyzeInstrumentalWithGemini` uses `stripDataUrlPrefix`; confirm it's a full data URL.

**Gemini AI Analysis**
- `NEXT_PUBLIC_GOOGLE_API_KEY` not set — functions return `null` silently; check env vars.
- Model name typo — current model: `gemini-3.1-flash-lite-preview` for instrumentals, `gemini-1.5-flash` for vocals.
- JSON parse error — Gemini sometimes returns markdown-fenced JSON; strip ` ```json ``` ` if present.

**State / Persistence**
- `uploadedBeatId` is `null` after reload — beats are stored in `beats[]` state (localStorage), but `uploadedBeatId` is session-only; re-derive it from `beats` on mount if needed.
- `sections` empty — `beat.sections` is populated asynchronously after upload; the player may render before analysis completes.
- Layer audio out of sync — `layerAudioRefs` must be wired into the same play/pause path as `beatAudioRef`.

**React / Next.js**
- Hydration mismatch — `typeof window === 'undefined'` guards are required for IndexedDB and Web Audio.
- `useEffect` stale closure — verify dependency arrays include all referenced state.

---

## Step 4: Fix Protocol

1. **Read first** — always read the file at the relevant lines before editing.
2. **Minimal change** — fix only what is broken; do not refactor surrounding code.
3. **Verify the fix** — after editing, trace the execution path mentally (or via a quick `console.log` if needed) to confirm the fix addresses the root cause.
4. **Clean up** — remove any temporary `console.log` statements before committing.

---

## Step 5: Report

After the fix, briefly state:
- What was wrong (root cause)
- What was changed (file:line)
- How to verify it works
