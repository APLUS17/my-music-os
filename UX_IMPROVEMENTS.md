# UX Improvements Brainstorm

A rapid audit of the Lyriq Lab codebase (StudioWorkspace, SandboxView, LyricCard, RecorderDrawer, and supporting components). Grouped by severity.

---

## Critical (data loss / trust)

1. **No undo anywhere.** Deleting a section, line, take, beat, or project is irreversible. Highest-leverage fix: replace destructive `confirm()` dialogs with a toast + "Undo" action (sonner is already installed).
2. **Native `confirm()`/`window.confirm()` dialogs** are used in 9 places (RecorderDrawer, StudioWorkspace) for deletes and project switches. They break the premium glassmorphic aesthetic, can't be styled, and on mobile look like browser chrome. Replace with a styled confirmation sheet or undo-toast pattern.
3. **Mic permission denial is silent.** `initializeMic()` catches the error and only `console.error`s it. A user who denied mic access (or is on an insecure origin) gets a record button that does nothing. Show an explanatory state with a "how to re-enable" hint.
4. **`startRecording` failure is silent** — same pattern: `catch (err) { console.error(...) }`. The user taps record and nothing happens.
5. **localStorage quota errors are swallowed.** The autosave `catch (e) { console.error("Storage full...") }` means a user with a full quota keeps writing lyrics that silently stop persisting — while the "saved" indicator still shows saved (the indicator flips to `saved` on a timer regardless of write success). Surface a persistent warning and offer cleanup (old beats/takes).
6. **No `beforeunload` guard while recording.** Closing the tab mid-take loses the recording with no warning.
7. **Save indicator lies on failure** (see #5) — `setSaveIndicator('saved')` runs in a `setTimeout` even when `setItem` threw. Tie the indicator to actual write success.

## High (core flows)

8. **Export is missing entirely** (already flagged P0 in the gap analysis). Songwriters can't get lyrics *out* — no copy-all, no TXT/PDF. Even a "Copy lyrics" button on the studio header would relieve most of the pain.
9. **No genre/mood selection** (P0 in gap analysis) — blocks the AI features' relevance.
10. **Rhyme finder has no UI.** Datamuse is integrated but unreachable. A long-press / selection popover on a lyric line ("Rhymes · Synonyms") would activate an already-built capability.
11. **Flow mode hover-only controls are invisible on touch.** The record-mic button, drag handle, line-delete `X`, and section divider all appear on `group-hover` — mobile users (the primary target per the design docs) can never discover them. Show them on line focus, or add a tap-to-reveal affordance.
12. **Same problem in Write mode:** LyricCard's move-up/down and delete buttons are `opacity-0 group-hover:opacity-100`.
13. **Flow-mode line delete has no confirmation and no undo** — a stray tap on the `X` deletes a lyric line permanently.
14. **Recording controls give no feedback while transcription/analysis runs.** After saving a take, Gemini transcription + smartSplit run in the background; the user should see per-take progress ("Transcribing…") rather than a global counter, and a clear failure state with retry when the API errors.
15. **No offline indicator.** The app is offline-first, but Gemini/Datamuse calls will just fail silently offline. Detect `navigator.onLine` and disable/badge AI features accordingly.
16. **Project switch archives current work via `window.confirm` with vague copy** ("Workspace will sync"). Users can't tell if they'll lose anything. Make save-then-switch automatic and say so: "Your current song is saved to Library."

## Medium (polish / efficiency)

17. **No keyboard shortcuts.** For a writing tool: Cmd+Z (undo), Cmd+S (manual save reassurance), Cmd+F (search), R (record), Space (play/pause when not in a text field), Cmd+E (export).
18. **Flow mode caret handling is lossy.** Enter always appends `\n` at the *end* of the section text rather than splitting at the caret (Write mode does this correctly). Pressing Enter mid-line in Flow mode moves your caret to a new empty line and leaves the text behind.
19. **Backspace at line start in Flow mode only works on empty lines** — it can't merge with the previous line like Write mode does. Inconsistent editing physics between the two modes is disorienting since they're pitched as the same document.
20. **Drag-and-drop take pinning is desktop-only.** HTML5 `draggable` doesn't work on touch. Provide a tap alternative ("Pin to section" in a take's menu).
21. **Autosave debounce is 1s with no flush on unload.** Fast edits followed by a tab close inside the debounce window are lost. Flush pending save on `visibilitychange`/`pagehide`.
22. **Swipe-to-delete project cards have no discoverability cue** — nothing indicates the card can swipe. Add a subtle affordance or an explicit "…" menu as an alternative.
23. **Move-section is chevron-only, one step at a time.** Drag to reorder (framer-motion `Reorder` is right there) would match the app's feel.
24. **Section-type dropdown is a custom positioned div** — likely clipped/off-screen near viewport edges and not keyboard-navigable. Use the existing Radix primitives.
25. **Recording timer resolution is 100ms but no visual level meter during record** in the drawer's core loop — a subtle input-level indicator prevents "recorded 3 minutes of silence" disasters (mic muted at OS level).
26. **No "recently deleted" / trash** for takes and beats given they represent unrecoverable audio.
27. **Empty states exist for lyrics but not for beats/takes/library** views — first-run users see blank panels.
28. **Search has no keyboard entry point or recent-searches**, and filters (`all/songs/sections/...`) are a state machine users must discover.

## Accessibility

29. **Icon-only buttons largely lack `aria-label`s** — only 36 aria/title occurrences across 7 files for hundreds of controls. Screen readers get unlabeled buttons for record, play, delete, pin.
30. **8px nav labels** (`text-[8px]`) in the bottom navbar are below any legible minimum; fine as decoration only if icons carry `aria-label`s.
31. **`spellCheck={false}` on all lyric textareas** — reasonable for stylized lyrics, but should be a user toggle; many writers want spellcheck.
32. **Hover-revealed controls (11, 12) are also keyboard-inaccessible** — `opacity-0` elements are still tabbable but invisible when focused. Add `focus-within` visibility.
33. **Custom dropdown (24) traps no focus and has no Escape handling.**
34. **Color-only playing state** on audio pills (accent background) — add an icon/label change for color-blind users (partially done via Play/Pause icon; verify contrast in Light theme).

## Quick wins (ship in an afternoon)

- Copy-all-lyrics button (partial fix for #8).
- Toast + Undo for line/section delete (#1, #13).
- `aria-label` pass on icon buttons (#29).
- Error toasts for mic-denied and record-failed (#3, #4).
- `focus-within:opacity-100` alongside `group-hover:opacity-100` (#11, #12, #32).
- Flush autosave on `pagehide` (#21).
