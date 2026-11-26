# Lyriq Lab — Claude Code Guide

## Project Overview

**Lyriq Lab** (formerly "My Music OS") is a music studio web app for songwriters. It combines lyric writing, voice recording, beat playback, and AI-powered creative tools in a single offline-first, mobile-friendly interface.

**Current Status**: Beta. **`/` is now the minimal LYRIQ editor** (simple view, bottom dock, timed-lyrics popup, one-tap recording), with take transcription via Groq Whisper. Our previous studio is kept at `/classic`. **Auth is disabled for now** (see Auth).

## Routes

| Route | What it is |
|---|---|
| `/` | The minimal editor. Code in `src/lyriq/` (a vendored copy, see `src/lyriq/VENDORED.md`). Library + editor, bottom dock, timed-lyrics popup (tap the take chip, e.g. `C1`), keyboard bar, undo, rhymes, reorder. Own theme: black, amber, Cormorant/Inter. |
| `/classic` | Our previous studio (`StudioWorkspace`, Vault, Muse, FX, 5 themes). Unchanged; everything below under "Song timeline" and "Project Structure" describes this one. |
| `/mission-control` | Business dashboard (unchanged). |
| `/launch` | Apple-style launch page (`src/app/(launch)/`, own root layout + `launch.css`). Tokens from `/mnt/project-files/design-system/lyriq-apple-style.md`. Film, poster, phone stills and OG image in `public/launch/`; swap the film by replacing `public/launch/lyriq-film.mp4`. Every CTA goes to `/`. |

The two UIs are separate **route groups** with their own root layouts (`src/app/(lyriq)/`, `src/app/(classic)/`) so their CSS cannot collide. Navigating between them is a full page load.

**New-app API** (`src/app/api/`): `transcribe-audio` (raw WAV in, `{lines:[{text,startSec,endSec}]}` out, via Groq Whisper with word timestamps and your written lyrics as a spelling hint; mapping in `src/lib/server/whisperLines.ts`), `health` (`{ai, features:{transcription,arrangement,suggestions}}`), and `analyze-beat` / `song-assistant` which always answer `503 ai_unavailable` (suggestions are not wired). **Beat sectioning runs in the browser** for instrumentals: `src/lyriq/utils/structure/` (beat 1 from the kick/808, bar-aligned 8/16-bar blocks, repeat groups, beat-style names Intro/Hook/Verse/Bridge/Outro from arrangement fullness) in a Web Worker, see its README; boundary benchmark on human-annotated songs in `scripts/structure-bench/`. A per-IP rate limiter guards them because auth is off. The classic app still uses `/api/transcribe` and `/api/muse/*`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.4 (App Router) |
| UI | React 19, shadcn/ui, Radix UI, Tailwind CSS 4 |
| Animation | Framer Motion 12 |
| Audio | Web Audio API, MediaRecorder API |
| AI (transcription) | Groq Whisper (`whisper-large-v3-turbo`) — voice recording → text, via `/api/transcribe` server proxy |
| AI (analysis + chat) | Google Gemini 2.0 Flash (`@google/genai`) — audio structure analysis + Studio Facilitator |
| Creative APIs | Datamuse (rhymes/synonyms), LRCLIB (lyrics search) |
| Database | Supabase (PostgreSQL) via `@supabase/ssr` + Next.js Server Actions |
| Auth | **Removed for now** — no sign-in; the app is local-first |
| Testing | Vitest, @testing-library/react, jsdom |
| Language | TypeScript 5.9 |

---

## Dev Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run test     # Run Vitest test suite
npm run lint     # ESLint
```

---

## Environment Variables

Required in `.env.local` (not committed):

```
NEXT_PUBLIC_SUPABASE_URL          # only the waitlist/email-capture actions use Supabase now
NEXT_PUBLIC_SUPABASE_ANON_KEY
GOOGLE_API_KEY                  # Gemini key. Only the classic Muse recap uses it; the new app does not need it
GROQ_API_KEY                    # Groq Whisper key (server-side). Powers take transcription in BOTH apps (/api/transcribe-audio and /api/transcribe)
```

---

## Project Structure

```
src/
├── lyriq/                              # THE NEW EDITOR at `/` (vendored from the minimal app, see VENDORED.md)
├── lib/server/                         # apiGuard (rate limit, error envelope), whisperLines (Groq -> lyric lines)
├── app/
│   ├── (lyriq)/                        # Root layout + page for `/`
│   ├── (classic)/                      # Old root layout/globals + `/classic` + `/mission-control`
│   │   ├── layout.tsx                  # Classic root layout (no auth provider)
│   │   ├── globals.css                 # Classic global styles + 5 CSS theme variables
│   │   └── classic/page.tsx            # Mounts StudioWorkspace at `/classic`
│   ├── actions.ts                      # Server actions: Supabase CRUD, Gemini analysis, Facilitator AI
│   │   └── mission-control/page.tsx    # Mission Control — business strategy dashboard (`/mission-control`)
│   └── api/
│       ├── transcribe/route.ts         # Proxies audio to Groq Whisper (keeps key server-side)
│       └── mission-control-sync/route.ts  # Mission control data sync endpoint
├── components/
│   ├── ErrorBoundary.tsx               # Top-level error boundary
│   ├── studio/
│   │   ├── StudioWorkspace.tsx         # State hub — sections, sessions, beats, scraps
│   │   ├── SandboxView.tsx             # Flow mode (freeform textarea writing)
│   │   ├── LyricCard.tsx               # Write mode (structured section cards)
│   │   ├── SplitEditor.tsx             # Flow/Write mode switcher
│   │   ├── RecorderDrawer.tsx          # Voice recording + waveform + Groq transcription
│   │   ├── BeatUploader.tsx            # Beat upload, playback, loop markers, beat analysis
│   │   ├── MusicPlayer.tsx             # Audio playback controls
│   │   ├── MiniPlayer.tsx              # Compact beat player
│   │   ├── PlayerTab.tsx               # Beat library UI
│   │   ├── RecordingThread.tsx         # Multi-take lane management
│   │   ├── VaultView.tsx               # Library view (grid/list) for scraps, takes, beats
│   │   ├── PuzzleView.tsx              # Idea banking / scrap board  ← DELETED (use VaultView)
│   │   ├── VoiceMemoView.tsx           # Takes list + transcription UI  ← DELETED
│   │   ├── NotesView.tsx               # Notebook (notes/takes list)  ← DELETED
│   │   ├── NoteAttachmentsView.tsx     # Attach recordings/beats to notes  ← DELETED
│   │   ├── MuseDrawer.tsx              # AI assistant  ← DELETED
│   │   ├── GeminiPanel.tsx             # Empty placeholder (0 bytes)
│   │   ├── SectionTimeline.tsx         # Beat sectioning strip: waveform, draggable bar-snapped boundaries, auto-section, split/merge
│   │   ├── KaraokeView.tsx             # Full-screen karaoke: active line centered + filled, click-to-seek
│   │   ├── SyncSettingsPanel.tsx       # Lyric timing offset, recording latency, follow playback
│   │   ├── KeyboardAccessoryBar.tsx    # Undo / Redo / Rhymes / Stanza / Done, shown while typing (above the mobile keyboard)
│   │   ├── ReorderList.tsx             # Drag-to-reorder sections (keeps each section's length)
│   │   ├── Waveform.tsx                # Canvas-based waveform renderer
│   │   ├── SpectralEQ.tsx              # Visual EQ panel
│   │   ├── FXPanel.tsx                 # Effects controls UI (reverb, delay, EQ, compression)
│   │   ├── OnboardingTour.tsx          # 6-step interactive walkthrough
│   │   ├── FeedbackModal.tsx           # In-app feedback submission
│   │   └── useActiveBeatSection.ts     # Hook: tracks which beat section is playing
│   └── ui/                             # shadcn/ui primitives
├── contexts/
├── hooks/
│   ├── useVocalFX.ts                   # Web Audio API: real reverb (convolution), delay, EQ, compression
│   └── useVisualViewport.ts            # Mobile viewport resize handler
├── lib/
│   ├── db.ts                           # Legacy Supabase client (keep for server actions compat)
│   ├── types.ts                        # Project, Idea, ProjectStatus interfaces
│   ├── mockData.ts                     # MOCK_PROJECTS, MOCK_IDEAS (dev data)
│   ├── utils.ts                        # cn() and shared utilities
│   ├── audio/
│   │   ├── audioIntelligence.ts        # Groq Whisper — transcribeAudio() with per-segment timestamps
│   │   └── smartSplit.ts               # Energy-based silence detection (RMS threshold 0.05)
│   ├── creative/
│   │   └── SongwritingKnowledge.ts     # Songwriting exercises, engines, stages, prompts knowledge base
│   ├── services/
│   │   ├── ai.ts                       # AIService — isMock: true (lyric suggestions not real yet)
│   │   ├── creative.ts                 # CreativeService (Datamuse + LRCLIB)
│   │   └── storage.ts                  # StorageService (localStorage/IndexedDB)
│   ├── supabase/
│   │   ├── client.ts                   # Browser Supabase client (@supabase/ssr)
│   │   └── server.ts                   # Server Supabase client (@supabase/ssr)
│   └── utils/
│       ├── id.ts                       # ID generation
│       ├── syllable.ts                 # Syllable counting utility
│       └── time.ts                     # Time formatting helpers
└── types/
    └── index.ts                        # LyricSection, RecordingSession, Beat, RecordingLayer, SavedProject
```

---

## Core Architecture

### State Management

`StudioWorkspace` is the single state hub. It owns:
- `sections[]` — lyric sections (source of truth for both Flow and Write modes)
- `sessions[]` — voice recording takes
- `beats[]` — uploaded beats (stored as base64 in IndexedDB)
- `scraps[]` — idea bank items

Persistence layers (in priority order):
1. **localStorage** — primary, fast, offline-first
2. **IndexedDB** — audio blobs (beats + recordings as base64)
3. **Supabase** — projects table via server actions

### Flow ↔ Write Sync

Both modes edit the same `sections[]` array — no duplication.
- **Flow (SandboxView)**: Flattens sections into editable lines, re-groups on save
- **Write (LyricCard)**: Directly edits `section.text`
- Switching modes is instant with no data loss. Default mode is Flow.

### Audio Pipeline

```
MediaRecorder → Blob → base64 → IndexedDB
                                      ↓
                        Groq Whisper transcription (speech → text, via /api/transcribe)
                        Gemini 2.0 Flash structure analysis (via actions.ts analyzeAudioStructure)
                        SmartSplit energy analysis → AutoSection[]
```

- **Recording**: `MediaRecorder` API captures mic input mixed with beat
- **Playback**: `<audio>` tag or Web Audio Context with mixing
- **SmartSplit** (`lib/audio/smartSplit.ts`): Energy-based silence detection (RMS threshold 0.05), classifies vocal/instrument/speech via Zero Crossing Rate + energy variance
- **Groq Whisper** (`lib/audio/audioIntelligence.ts`): `transcribeAudio()` → converts voice recording to text with per-segment timestamps. Proxied server-side via `/api/transcribe` to keep the API key off the client.
- **Gemini 2.0 Flash** (`src/app/actions.ts`): `analyzeAudioStructure()` → beat/vocal structure detection with section labels and emoji tags. Also powers the Studio Facilitator conversational AI coach.
- **Vocal FX** (`hooks/useVocalFX.ts`): Real Web Audio API processing chain — convolution reverb (with cached impulse response), delay, 3-band EQ (low/mid/high BiquadFilter), and dynamics compression. Wired to `FXPanel` settings.

### Auth

**Disabled for now.** `AuthContext`, `AuthGate`, `/auth` and `proxy.ts` were removed, and the API routes (`/api/transcribe`, `/api/muse/*`) no longer check for a user. Everything works without signing in.

- **Before deploying publicly:** those routes now spend your Groq/Gemini keys for anyone who can reach them. Add auth or rate limiting first.
- The Supabase project CRUD in `app/actions.ts` (`createProject`, `getProjects`, ...) still calls `getAuthenticatedClient()` and throws `Unauthorized`. Nothing in the UI calls it. It is parked for when auth returns.

### Song timeline (beat sections, auto-scroll, karaoke)

All pure logic is in `lib/timeline/` and unit-tested; the UI is thin.

- `timeline.ts` — section timings (`resolveSectionTimings`), the single source of truth for per-line times (`buildTimedLines`), `pickActiveLine`. Sections without explicit times split the song evenly.
- `beatSections.ts` — non-AI beat analysis: tempo (refined to 0.05 BPM against the whole track), bar grid, per-bar energy, boundaries by DP, labels by energy. **The frame hop is 220 samples = 9.977 ms at 22.05 kHz, not 10 ms — always use `hopFor()`**; the nominal value drifts the grid ~0.4 s over a song.
- `sectionEdit.ts` — move boundary / split / merge / apply analysed structure to lyric sections. Never drops lyrics. **Add / delete / reorder go through `insertSectionAfter`, `deleteSectionAt`, `reorderSections`**: they keep the timeline covering exactly `[0, duration]` (no gap, overlap or zero-width section). Never `setSections` with a bare append/filter/swap on a timed song. Hand edits set `isUserModified`, so Re-detect asks before overwriting them. `snapToBar` is magnetic (pulls within 35% of a bar, else leaves the time alone).
- `history.ts` + `hooks/useSectionHistory.ts` — undo/redo for the sections. **Edit through `commitSections`**; typing in one stanza and a boundary drag each coalesce into one undo step. Anything that still calls `setSections` directly (loading a song) just invalidates the history, which is safe. Cmd/Ctrl+Z, Cmd+Shift+Z/Ctrl+Y work in the lyrics area; Space plays/pauses when nothing has focus.
- `lib/creative/rhyme.ts` — offline rhyme groups (ported from the minimal app). `LyricCard` underlines them via a transparent mirror layer over each row's textarea. Note: every `-ing` word groups together, so gerunds underline even mid-line.
- `songClock.ts` + `hooks/useSongClock.ts` — one clock read from the real audio elements (beat is the timeline when playing; a take is `take time + beatOffset`). Components subscribe to a derived value via `useClockValue` so only what changes re-renders.
- `LyricSection` has optional `startTimeSec` / `endTimeSec` / `energy`; `SectionType` gained `'pre-chorus'`.
- With a take loaded, the take drives the beat, so seeks outside the take's span clamp to its nearest edge (with a toast). Use `session.duration`, not the element's: `MediaRecorder` takes report `Infinity`.

Known gaps: the "open" editor layout has no active-line highlight or rhyme underlines (use the card layout / karaoke); a take does not yet enter at its position while the beat plays on from elsewhere. The bar grid is not stored: after a reload it is recomputed from the audio once per beat.

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Flow mode (freeform writing) | ✅ Shipped | |
| Write mode (section cards) | ✅ Shipped | |
| Flow ↔ Write sync | ✅ Shipped | |
| Beat upload + playback | ✅ Shipped | Loop markers, volume, scrubbing |
| Beat persistence (IndexedDB) | ✅ Shipped | |
| Voice recording | ✅ Shipped | Waveform canvas, scrubbing |
| Multiple takes | ✅ Shipped | `RecordingThread` |
| Pin take to section | ✅ Shipped | `pinnedTakeId` on `LyricSection` |
| AI transcription | ✅ Shipped | Groq Whisper (`whisper-large-v3-turbo`), per-segment timestamps |
| AI Audio Analysis | ✅ Shipped | Gemini 2.0 Flash structure analysis via `analyzeAudioStructure()` |
| Studio Facilitator AI | ✅ Shipped | Conversational AI coach via Gemini in `actions.ts` |
| Vocal FX (reverb/delay/EQ) | ✅ Shipped | Real Web Audio API via `useVocalFX` hook |
| Vault library view | ✅ Shipped | `VaultView` — grid/list layout for all content |
| Auth | ⏸ Disabled | Removed for now, see Auth |
| Beat sectioning | ✅ Shipped | Auto-detect from audio + drag/split/merge, `SectionTimeline` |
| Editor follows playback | ✅ Shipped | Active section/line highlight + auto-scroll (pauses on manual scroll) |
| Karaoke view | ✅ Shipped | `KaraokeView`, centered + filled active line, tap to seek |
| Mission Control | ✅ Shipped | `/mission-control` — business strategy & growth dashboard |
| 5 themes | ✅ Shipped | Dark, Light, Midnight, Matrix, Sonar |
| Global search | ✅ Shipped | Projects, takes, beats, scraps |
| Onboarding tour | ✅ Shipped | 6-step, restartable from Settings |
| Rhyme highlighting | ✅ Shipped | Offline, toggle in the keyboard bar; Datamuse client still unused |
| Undo / redo | ✅ Shipped | Sections text + structure + timing, `useSectionHistory` |
| Reorder sections | ✅ Shipped | `ReorderList`, keeps section lengths |
| **AI lyric suggestions (UX)** | ⚠️ Partial | `services/ai.ts` is `isMock: true` — no real suggestions UI |
| **Genre/mood selection** | ❌ Missing | P0 — feeds AI context on project creation |
| **Export (TXT/PDF/copy)** | ❌ Missing | P0 — critical for Phase 1 |
| Cloud sync (multi-device) | ⚠️ Partial | Supabase CRUD works, full sync pending |
| Recording layers (Ableton-style) | 🚧 Designed | See `ABLETON_TAKE_LANES_DESIGN.md` |

---

## Design System

- **Theme**: Premium dark mode, "vibe-first", glassmorphism
- **Primary colors**: Black `#000000`, Acid Green `#7fff00`, Muted Onyx `#121212`, Vapor White
- **Typography**: Geist (sans), Poppins (display), JetBrains Mono (technical)
- **Layout**: Mobile-first, floating bottom navbar, Framer Motion transitions
- **Components**: Pill buttons, glassmorphic cards, minimalist inputs, no borders

Theming is done via CSS variables in `globals.css`. All 5 themes switch at the `:root` level.

---

## Key Design Docs

| File | Contents |
|---|---|
| `DESIGN.md` | Design system, colors, typography, component patterns |
| `MVP_GAP_ANALYSIS.md` | Phase 1 readiness assessment, P0/P1 gap list |
| `FLOW_WRITE_SYNC.md` | Dual-mode architecture and sync mechanics |
| `WIP_FEATURES.md` | Features disabled for beta |
| `ABLETON_TAKE_LANES_DESIGN.md` | Multi-track layer architecture design |
| `Lyriq PRD Roadmap_.md` | Full PRD from MVP to market leader |
| `architecture/BLAST.md` | BLAST framework (Blueprint→Links→Architecture→Stylize→Trigger) |

---

## Tests

```bash
npm run test
```

Test files:
- `src/components/studio/__tests__/RecordingThread.stress.test.tsx`
- `src/components/studio/__tests__/SpectralEQ.test.tsx`
- `src/components/studio/__tests__/takes-transcription-persistence.test.tsx`
- `src/components/studio/__tests__/useActiveBeatSection.test.tsx`
- `src/lib/audio/__tests__/smartSplit.test.ts`
- `src/lib/utils/__tests__/id.test.ts`
- `src/lib/utils/__tests__/syllable.test.ts`
- `src/lib/utils/__tests__/time.test.ts`
- `src/__tests__/setup.ts` — global setup (@testing-library/jest-dom)

---

## Backend

Supabase (PostgreSQL) via Next.js Server Actions in `app/actions.ts`:
- `createProject`, `getProjects`, `getProject`, `deleteProject`, `updateProjectStudio`
- `analyzeAudioStructure` — Gemini 2.0 Flash audio analysis
- Facilitator AI chat — Gemini 2.0 Flash conversational coach
- Supabase split into `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` using `@supabase/ssr`

External APIs:
- **Groq Whisper** — server-side only via `/api/transcribe`, requires `GROQ_API_KEY`
- **Google Gemini 2.0 Flash** — server-side only via `actions.ts`, requires `GOOGLE_API_KEY`
- **Datamuse** — client-side, no auth required
- **LRCLIB** — client-side, no auth required
