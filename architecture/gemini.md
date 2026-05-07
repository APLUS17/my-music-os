# Lyriq Lab — System Context (Gemini)

**Last updated:** 2026-04-25
**Phase:** 5 (Trigger) — AI activation + deployment sprint

---

## Overview

"My Music OS" (Antigravity Vibecode 01) is a mobile-first, full-stack Next.js application serving as a "second brain" for music artists. It manages the full creative lifecycle: freeform lyric writing → structured sections → beat upload → vocal recording → AI assistance → idea banking. Competitive target: LyricStudio. Northstar: own the full songwriter journey that no current tool owns end-to-end.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5.9
- **UI:** React 19, Tailwind CSS 4, Framer Motion 12
- **Components:** shadcn/ui, Radix UI, Lucide React
- **Database:** Supabase (PostgreSQL) — Project ID: `ebomfglluqwogdvlwice`
- **Storage:** IndexedDB (beats/audio — local), Supabase `assets` bucket (cloud)
- **AI:** Google Gemini via `@google/genai` (transcription working; lyric suggestions disabled)
- **Rhyme API:** Datamuse (no key required) — `src/lib/services/creative.ts`
- **Testing:** Vitest + Testing Library
- **Deploy:** Vercel (frontend) + Supabase (backend)

> Note: The `gemini.md` file previously listed OpenAI — the actual AI dependency is `@google/genai` (Gemini). `OPENAI_API_KEY` is referenced in legacy config but Gemini is the active integration.

---

## Core Principles

1. **Determinism:** Single source of truth (`sections[]`) shared across all editor modes.
2. **Aesthetic:** "Noir Tech & Quiet Luxury" — Premium Dark, Glassmorphism, Framer Motion animations.
3. **Modularity:** Atomic components, logic in SOP-driven hooks/utils/services.
4. **Mobile-first:** Floating bottom nav, touch-friendly, swipe gestures throughout.

---

## Architecture: "One Song, Two Lenses"

Both Flow and Write modes share `sections[]` as the single data source:

- **Flow Mode** (`SandboxView.tsx`): Flattens sections into a clean freeform writing surface. Each line remembers its parent section ID. On edit, groups lines back into sections.
- **Write Mode** (`LyricCard.tsx`): Directly edits `section.text` in structured cards with controls.

Switching between modes causes no data loss. See `FLOW_WRITE_SYNC.md`.

---

## Directory Structure

```
src/
├── app/
│   ├── page.tsx                  # App entry point
│   ├── layout.tsx
│   ├── actions.ts                # Server actions (Supabase CRUD)
│   └── api/transcribe/route.ts   # Gemini voice transcription API
├── components/studio/
│   ├── StudioWorkspace.tsx       # Root studio orchestrator
│   ├── SandboxView.tsx           # Flow mode
│   ├── LyricCard.tsx             # Write mode cards
│   ├── BeatUploader.tsx          # Beat upload, play, loop, scrub
│   ├── RecorderDrawer.tsx        # Voice recorder + waveform
│   ├── RecordingThread.tsx       # Session/take management
│   ├── PuzzleView.tsx            # Idea banking board
│   ├── MuseDrawer.tsx            # AI drawer — DISABLED for beta
│   ├── GeminiPanel.tsx           # Placeholder (0 bytes)
│   ├── FXPanel.tsx               # FX sliders (UI only — no audio)
│   ├── VoiceMemoView.tsx         # All takes + transcription
│   ├── OnboardingTour.tsx        # 6-step interactive tour
│   ├── SpectralEQ.tsx
│   ├── SplitEditor.tsx
│   ├── PlayerTab.tsx
│   ├── Waveform.tsx
│   └── MusicPlayer.tsx
├── components/ui/                # shadcn/ui primitives
└── lib/
    ├── types.ts                  # Core types (LyricSection, RecordingSession, etc.)
    ├── db.ts                     # Supabase client
    ├── services/
    │   ├── ai.ts                 # AI service — isMock: true (NOT real yet)
    │   ├── creative.ts           # Datamuse rhymes/synonyms/concepts
    │   └── storage.ts            # IndexedDB beats/audio
    └── audio/
        ├── audioIntelligence.ts
        └── smartSplit.ts
```

---

## Feature Status

### Shipped and Working

| Feature | Component |
|---------|-----------|
| Flow Mode (freeform writing) | `SandboxView.tsx` |
| Write Mode (structured cards) | `LyricCard.tsx` |
| Flow ↔ Write sync (no data loss) | Shared `sections[]` |
| Beat upload, play, loop, scrub | `BeatUploader.tsx` |
| Beat persistence | IndexedDB base64 |
| Voice recording + waveform canvas | `RecorderDrawer.tsx` |
| Multiple takes per project | `RecordingThread.tsx` |
| Pin take to lyric section | `pinnedTakeId` on `LyricSection` |
| Idea banking (puzzle board) | `PuzzleView.tsx` |
| AI transcription (Gemini) | `api/transcribe/route.ts` |
| Project CRUD + auto-save | `actions.ts` + localStorage |
| Beat library | Tabbed UI, IndexedDB |
| Vocal FX panel (UI only) | `FXPanel.tsx` |
| Voice Memo view + download | `VoiceMemoView.tsx` |
| Onboarding tour (6 steps) | `OnboardingTour.tsx` |
| Theme system (5 themes) | CSS variables |
| Global search | Filter tabs across all content |
| Supabase backend connected | `db.ts` + `actions.ts` |
| Datamuse API (rhymes) | `creative.ts` |
| Mobile-first responsive | Touch + swipe gestures |

### Built But Disabled

| Feature | Reason | How to Re-enable |
|---------|--------|-----------------|
| Muse AI Drawer | Disabled for beta | See `WIP_FEATURES.md` |
| Gemini Panel | Empty placeholder | Needs implementation |
| Real AI service | `isMock: true` | Update `services/ai.ts` |
| FX audio processing | UI only | Wire Web Audio API |

### Not Built Yet (Priority Order)

**P0 — Critical for Phase 1 launch:**
- AI Lyric Suggestions (re-enable MuseDrawer + real Gemini)
- Genre/Mood selection on project creation (feeds AI context)
- Export — Copy All, TXT, PDF

**P1 — Important for retention:**
- In-editor rhyme tool (Datamuse API ready, no editor UI)
- Cloud Sync + Supabase Auth
- Updated onboarding to demo AI

**Future — LYRIQ 2.0:**
- Ableton-style take lanes (layered vocal recording) — spec in `ABLETON_TAKE_LANES_DESIGN.md`
- Rhyme scheme display per line (A/B/C labels + syllable count)
- Voice → structured lyric sheet (AI-classified sections from recording)
- AI Personality Modes, Reference Song Matching
- Real-time collaboration

---

## Design System

**Aesthetic:** Sophisticated Dark Mode / "Noir Tech & Quiet Luxury"

**Colors:**
- `#000000` — Deep Space Black (primary BG)
- `#7fff00` — Acid Green/Sonic Lime (accent: progress, active, CTAs)
- `#121212` — Muted Onyx (card BG)
- `rgba(255,255,255,0.1)` — Stardust Gray (glass borders)
- `#ffffff` — Vapor White (primary text)
- `rgba(255,255,255,0.4)` — Dim Ghost (tertiary/helper text)

**Fonts:**
- Geist / Inter — primary UI
- Poppins / Righteous — display headers (personality)
- JetBrains Mono — metadata, timecodes, technical data

**Components:**
- Cards: `rounded-2xl`/`rounded-3xl`, `backdrop-blur-3xl`, diffused shadows
- Buttons: `rounded-full` or `rounded-xl`, `active:scale-95`
- Layout: floating bottom navbar (glassmorphism), mobile-first, breathable whitespace
- Animations: Framer Motion for all state transitions

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
GEMINI_API_KEY=          # Active AI integration
OPENAI_API_KEY=          # Legacy reference — not actively used
```

---

## BLAST Framework Status

| Phase | Status |
|-------|--------|
| B — Blueprint | ✅ Complete |
| L — Links | ✅ Complete (Supabase, Gemini, Datamuse) |
| A — Architecture | ✅ Complete |
| S — Stylize | ✅ Complete |
| T — Trigger | 🚧 In Progress (deploy + AI activation) |

---

## Competitive Position (vs LyricStudio)

**We're ahead:**
- Dual writing modes (Flow + Write with instant sync)
- Idea banking (Puzzle board — LyricStudio has nothing like it)
- Beat loop control (custom start/end markers)
- Pin recordings to specific sections
- AI transcription of voice memos
- Onboarding tour
- 5 visual themes

**We're behind:**
- AI lyric suggestions (disabled/mock) — CRITICAL gap
- Genre/mood selection for AI context
- Export functionality (zero — can't get lyrics out)
- In-editor rhyme tool (API ready, no UI)
- Cloud sync + auth

---

## UI/UX Rules (Gemini-specific)

Always load and apply both skills for any UI/UX work:
1. `ui-ux-pro-max` — design intelligence, anti-patterns, accessibility
2. `frontend-design` — distinctive, production-grade frontend patterns

These are in `~/.gemini/antigravity/skills/` and `~/.gemini/antigravity/global_skills/`.
