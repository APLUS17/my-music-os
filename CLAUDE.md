# Lyriq Lab — Claude Code Guide

## Project Overview

**Lyriq Lab** (formerly "My Music OS") is a music studio web app for songwriters. It combines lyric writing, voice recording, beat playback, and AI-powered creative tools in a single offline-first, mobile-friendly interface.

**Current Status**: Beta. Core writing, recording, auth, and AI transcription are shipped. Critical gaps: AI lyric suggestions UI, genre/mood selection, and export.

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
| Auth | Supabase Auth — email OTP (magic link), wired and active |
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
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
GOOGLE_API_KEY                  # Gemini API key (server-side; also checks NEXT_PUBLIC_GOOGLE_API_KEY or GEMINI_API_KEY)
GROQ_API_KEY                    # Groq Whisper key (server-side only, used by /api/transcribe)
```

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                      # Root layout with AuthProvider
│   ├── page.tsx                        # Homepage → mounts StudioWorkspace
│   ├── globals.css                     # Global styles + 5 CSS theme variables
│   ├── actions.ts                      # Server actions: Supabase CRUD, Gemini analysis, Facilitator AI
│   ├── auth/
│   │   └── page.tsx                    # Auth page (email OTP sign-in)
│   ├── mission-control/
│   │   └── page.tsx                    # Mission Control — business strategy dashboard
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
│   │   ├── NotesView.tsx               # Notes/takes list grouped by time, with search + attachments
│   │   ├── NoteAttachmentsView.tsx     # Attach recordings and beats to notes
│   │   ├── VaultView.tsx               # Library view (grid/list) for scraps, takes, beats
│   │   ├── PuzzleView.tsx              # Idea banking / scrap board  ← DELETED (use NotesView/VaultView)
│   │   ├── VoiceMemoView.tsx           # Takes list + transcription UI  ← DELETED (use NotesView)
│   │   ├── MuseDrawer.tsx              # AI assistant  ← DELETED
│   │   ├── GeminiPanel.tsx             # Empty placeholder (0 bytes)
│   │   ├── AuthGate.tsx                # Email OTP auth form
│   │   ├── Waveform.tsx                # Canvas-based waveform renderer
│   │   ├── SpectralEQ.tsx              # Visual EQ panel
│   │   ├── FXPanel.tsx                 # Effects controls UI (reverb, delay, EQ, compression)
│   │   ├── OnboardingTour.tsx          # 6-step interactive walkthrough
│   │   ├── FeedbackModal.tsx           # In-app feedback submission
│   │   └── useActiveBeatSection.ts     # Hook: tracks which beat section is playing
│   └── ui/                             # shadcn/ui primitives
├── contexts/
│   └── AuthContext.tsx                 # Auth provider: signInWithEmail (OTP), verifyOtp, signOut
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

Email OTP flow via Supabase Auth:
1. `AuthContext` (`contexts/AuthContext.tsx`) — provides `signInWithEmail`, `verifyOtp`, `signOut`
2. `AuthGate` component — email input → OTP code entry form
3. `/auth` page — standalone auth route
4. Supabase client/server split via `@supabase/ssr` in `lib/supabase/`

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
| Notes view (takes + ideas) | ✅ Shipped | `NotesView` — time-grouped, searchable, with attachments |
| Vault library view | ✅ Shipped | `VaultView` — grid/list layout for all content |
| Auth (email OTP) | ✅ Shipped | Supabase email magic link, `AuthContext` + `AuthGate` |
| Mission Control | ✅ Shipped | `/mission-control` — business strategy & growth dashboard |
| 5 themes | ✅ Shipped | Dark, Light, Midnight, Matrix, Sonar |
| Global search | ✅ Shipped | Projects, takes, beats, scraps |
| Onboarding tour | ✅ Shipped | 6-step, restartable from Settings |
| Rhyme finder | ⚠️ API ready | Datamuse integrated, no editor UI yet |
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
