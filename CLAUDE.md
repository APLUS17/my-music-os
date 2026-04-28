# Lyriq Lab — Claude Code Guide

## Project Overview

**Lyriq Lab** (formerly "My Music OS") is a music studio web app for songwriters. It combines lyric writing, voice recording, beat playback, and AI-powered creative tools in a single offline-first, mobile-friendly interface.

**Current Status**: Beta. Phase 1 readiness ~5/10. Core writing and recording features are shipped. Critical gaps: AI lyric suggestions, genre/mood selection, and export.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| UI | React 19, shadcn/ui, Radix UI, Tailwind CSS 4 |
| Animation | Framer Motion |
| Audio | Web Audio API, MediaRecorder API |
| AI | Google Gemini (`@google/genai`) — transcription + beat analysis |
| Creative APIs | Datamuse (rhymes/synonyms), LRCLIB (lyrics search) |
| Database | Supabase (PostgreSQL) via Next.js Server Actions |
| Auth | Supabase Auth (foundation laid, not fully integrated) |
| Testing | Vitest, @testing-library/react, jsdom |
| Language | TypeScript 5 |

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
NEXT_PUBLIC_GOOGLE_API_KEY      # Google Gemini API key
```

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Homepage → mounts StudioWorkspace
│   ├── actions.ts              # Server actions (Supabase CRUD)
│   └── globals.css             # Global styles + 5 CSS theme variables
├── components/
│   ├── studio/                 # All core app components
│   │   ├── StudioWorkspace.tsx     # State hub — manages sections, sessions, beats, scraps
│   │   ├── SandboxView.tsx         # Flow mode (freeform textarea writing)
│   │   ├── LyricCard.tsx           # Write mode (structured section cards)
│   │   ├── SplitEditor.tsx         # Flow/Write mode switcher
│   │   ├── RecorderDrawer.tsx      # Voice recording + waveform + Gemini transcription
│   │   ├── BeatUploader.tsx        # Beat upload, playback, loop markers, beat analysis
│   │   ├── MusicPlayer.tsx         # Audio playback controls
│   │   ├── PlayerTab.tsx           # Beat library UI
│   │   ├── RecordingThread.tsx     # Multi-take lane management
│   │   ├── VoiceMemoView.tsx       # Takes list + AI transcription UI
│   │   ├── PuzzleView.tsx          # Idea banking / scrap board
│   │   ├── Waveform.tsx            # Canvas-based waveform renderer
│   │   ├── SpectralEQ.tsx          # Visual EQ panel (UI only)
│   │   ├── FXPanel.tsx             # Effects controls (reverb, delay, compression)
│   │   ├── MuseDrawer.tsx          # AI assistant — DISABLED for beta
│   │   ├── OnboardingTour.tsx      # 6-step interactive walkthrough
│   │   └── FeedbackModal.tsx       # In-app feedback submission
│   └── ui/                     # shadcn/ui primitives (button, sheet, slider, etc.)
├── lib/
│   ├── db.ts                   # Supabase client
│   ├── types.ts                # Project, Idea, ProjectStatus interfaces
│   ├── mockData.ts             # MOCK_PROJECTS, MOCK_IDEAS (dev data)
│   ├── audio/
│   │   ├── audioIntelligence.ts    # Gemini API — transcription + beat analysis
│   │   └── smartSplit.ts           # Audio buffer analysis (energy thresholding)
│   └── services/
│       ├── ai.ts               # AIService (mock responses, isMock: true)
│       ├── creative.ts         # CreativeService (Datamuse + LRCLIB)
│       └── storage.ts          # StorageService (localStorage/Supabase-ready)
└── types/
    └── index.ts                # LyricSection, RecordingSession, Beat, RecordingLayer, SavedProject
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
3. **Supabase** — projects table via server actions, not fully synced yet

### Flow ↔ Write Sync

Both modes edit the same `sections[]` array — no duplication.
- **Flow (SandboxView)**: Flattens sections into editable lines, re-groups on save
- **Write (LyricCard)**: Directly edits `section.text`
- Switching modes is instant with no data loss. Default mode is Flow.

### Audio Pipeline

```
MediaRecorder → Blob → base64 → IndexedDB
                                      ↓
                             Gemini transcription
                             SmartSplit analysis → AutoSection[]
```

- **Recording**: `MediaRecorder` API captures mic input mixed with beat
- **Playback**: `<audio>` tag or Web Audio Context with mixing
- **SmartSplit** (`lib/audio/smartSplit.ts`): Energy-based silence detection (RMS threshold 0.05), classifies vocal/instrument/speech via Zero Crossing Rate + energy variance
- **Gemini AI** (`lib/audio/audioIntelligence.ts`): `analyzeAudioWithGemini()` → vocal transcription with timestamps; `analyzeInstrumentalWithGemini()` → beat structure detection with emoji tags. Lazy-initialized to avoid module-level crashes.

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
| AI transcription | ✅ Shipped | Gemini, per-line timestamps |
| Beat AI analysis | ✅ Shipped | Gemini, emoji section tags |
| Idea banking | ✅ Shipped | `PuzzleView` |
| 5 themes | ✅ Shipped | Dark, Light, Midnight, Matrix, Sonar |
| Global search | ✅ Shipped | Projects, takes, beats, scraps |
| Onboarding tour | ✅ Shipped | 6-step, restartable from Settings |
| Rhyme finder | ⚠️ API ready | Datamuse integrated, no editor UI yet |
| Muse AI drawer | ⚠️ Disabled | Built, disabled for beta |
| **AI lyric suggestions** | ❌ Missing | **P0 — critical for Phase 1** |
| **Genre/mood selection** | ❌ Missing | **P0 — critical for Phase 1** |
| **Export (TXT/PDF/copy)** | ❌ Missing | **P0 — critical for Phase 1** |
| Cloud sync | ⚠️ Partial | Supabase connected, auth not integrated |
| Auth | ⚠️ Partial | Foundation laid, not enforced |
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
| `WIP_FEATURES.md` | Features disabled for beta (MuseDrawer, BPM/Key, Share) |
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
- `src/__tests__/setup.ts` — global setup (@testing-library/jest-dom)

---

## Backend

The real backend is Supabase (PostgreSQL) accessed via Next.js Server Actions in `app/actions.ts`:
- `createProject`, `getProjects`, `getProject`, `deleteProject`, `updateProjectStudio`

The `backend/` folder contains Python scripts (`verify_connections.py`) for local API validation only — not deployed.

External APIs called client-side (no backend proxy):
- Google Gemini — requires `NEXT_PUBLIC_GOOGLE_API_KEY`
- Datamuse — no auth required
- LRCLIB — no auth required
