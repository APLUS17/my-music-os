# Work In Progress & Feature Status
### Updated: August 2026

> **Note:** This document has been updated to reflect the current state of the codebase after the August 2026 strategy session. Dead features are marked clearly. The build priority has shifted from features to distribution.

---

## 🔴 DEAD / REMOVED FEATURES (Do Not Resurrect Without User Evidence)

### MuseDrawer — DELETED
The `MuseDrawer` component has been deleted from the codebase. `GeminiPanel.tsx` is a 0-byte placeholder.
**Status:** Gone. The Studio Facilitator AI in `actions.ts` is the replacement backend.
**What's needed:** A new lightweight AI suggestion UI — not a full drawer. An inline suggestion panel or ghost-text style suggestions wired to `chatWithFacilitator`.

### FX Panel — ✅ FULLY WIRED (Not a bug)
`FXPanel.tsx` sliders → `setFxSettings` state → `useVocalFX` hook → real Web Audio processing chain.
- **StudioWorkspace**: `useVocalFX(vocalAudioRef, fxSettings, showFXPanel, isPlaying, currentTime)` — active on vocal playback
- **RecorderDrawer**: has its own parallel Web Audio graph built directly into the recorder, with live monitoring toggle (use headphones warning included)
- Both EQ (lowshelf/peaking/highshelf), reverb (convolution), delay, compression, and limiter are all live.

### Mission Control — DEPRIORITIZED
`/mission-control` — the business strategy dashboard. Functional but irrelevant to users.
**Status:** Keep in codebase, remove from any navigation or onboarding that surfaces it to users.
**Why deprioritized:** This was a feature for the founder, not the ICP. Songwriters don't need a growth dashboard.

---

## 🟡 IN PROGRESS / PARTIAL

### Studio Facilitator AI — SHIPPED (Backend), MISSING (Frontend UI)
**Backend:** `chatWithFacilitator` in `src/app/actions.ts` — fully functional Gemini 2.0 Flash conversational coach.
**Frontend:** No dedicated UI to expose this. `GeminiPanel.tsx` is 0 bytes. `MuseDrawer.tsx` was deleted.
**What's needed:** A minimal AI panel — text input + response display — wired to `chatWithFacilitator`. This is P0 because it's the core product differentiator.

### AI Lyric Suggestions — MOCKED
`src/lib/services/ai.ts` has `isMock: true`. Returns hardcoded responses.
**What's needed:** Wire to Gemini via `chatWithFacilitator` or a dedicated `suggestLyrics` server action. Include current section text + beat context + genre/mood as prompt context.
**Priority: P0.** This is the promise the product makes. It's currently a lie.

### Cloud Sync (Supabase) — PARTIAL
Project CRUD works via `actions.ts`. Beat audio and recordings are IndexedDB-only (base64).
**Risk:** iOS/Android aggressively purge IndexedDB under storage pressure. Users will lose beats silently.
**What's needed:** Migrate beat audio to Supabase Storage. This is P1 (not blocking launch, but a retention risk).

### Rhyme Tool — API READY, NO UI
Datamuse API is integrated in `src/lib/services/creative.ts`. Returns rhymes/synonyms/near-rhymes.
**What's needed:** Editor UI — tap a word → popover with rhyme suggestions → tap to replace. This is P1.

---

## ✅ SHIPPED & STABLE

| Feature | File | Notes |
|---------|------|-------|
| Flow Mode | `SandboxView.tsx` | Solid |
| Write Mode | `LyricCard.tsx` | Solid |
| Flow ↔ Write Sync | `StudioWorkspace.tsx` | Single `sections[]` source of truth |
| Beat Upload + Playback | `BeatUploader.tsx` | Loop points, scrubbing, volume |
| Beat Persistence | `services/storage.ts` | IndexedDB — cloud migration needed |
| Voice Recording | `RecorderDrawer.tsx` | Waveform, scrub playback |
| Multiple Takes | `RecordingThread.tsx` | Multi-take lane management |
| Pin Take to Section | `LyricCard.tsx` | `pinnedTakeId` on `LyricSection` |
| AI Transcription | `audioIntelligence.ts` | Groq Whisper via `/api/transcribe` |
| AI Audio Analysis | `actions.ts` | Gemini 2.0 Flash `analyzeAudioStructure()` |
| Auth (email OTP) | `AuthContext.tsx` | Supabase email magic link — fully deployed |
| Notes View | `NotesView.tsx` | Time-grouped, searchable |
| Vault View | `VaultView.tsx` | Grid/list layout |
| 5 Themes | `globals.css` | CSS variables — working |
| Onboarding Tour | `OnboardingTour.tsx` | 6-step, restartable |

---

## ❌ NOT BUILT YET (Priority Order)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Export (TXT + PDF) | 🔴 P0 | 4/10 | Biggest churn blocker |
| AI Suggestion UI | 🔴 P0 | 5/10 | Wire `chatWithFacilitator` to inline panel |
| Genre/Mood on project creation | 🔴 P0 | 3/10 | Required for contextual AI |
| Email capture + welcome sequence | 🟡 P1 | 3/10 | Use Resend or Loops.so |
| In-editor Rhyme Tool | 🟡 P1 | 4/10 | Datamuse API already integrated |
| Beat cloud storage | 🟡 P1 | 6/10 | Supabase Storage migration |
| Multi-device sync (full) | 🟡 P1 | 5/10 | Supabase CRUD partial, needs beats/recordings |

---

## 🗄️ ARCHIVED UI ELEMENTS (Intentionally Removed)

These were removed to simplify layout. Do not re-add without a clear user request:

- Repeats Indicator (`x2 | + -`) — removed from `LyricCard.tsx` header
- Category Selector Dropdown — removed from `StudioWorkspace.tsx`
- Line/Syllable Summary Bar — removed from above lyric card list
- Empty State Centered Button — replaced by standard `+ Add Section`
- Player Tab action icons (chat, translate, list) — overlapped with nav pill
- Global Search Icon — replaced by theme toggle in header
- "Capture the Flow" greeting — only shown inside onboarding tour
