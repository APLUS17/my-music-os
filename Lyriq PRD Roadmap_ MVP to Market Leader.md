# Lyriq PRD Roadmap: MVP to Market Leader
### Updated: August 2026

> **Strategic update (August 2026):** This roadmap has been revised after a full business strategy session. The primary change: **Distribution is now Phase 1 P0**, not a Phase 3 afterthought. The product is built. The problem is no one knows it exists.

---

## Competitive Moat (What We Have That Others Don't)

- **AI Audio Intelligence** — Gemini 2.0 Flash reads beat structure and labels sections. No competitor has this.
- **Studio Facilitator** — Conversational AI coach that knows your beat, genre, and lyric context. LyricStudio has no audio layer at all.
- **Write + Record in one place** — Upload beat → write lyrics → record takes → get transcription. The full loop, mobile-first.

**One sentence:** LyricStudio writes lyrics. Lyriq Lab finishes songs.

---

## Phase 1: Launch to First 100 Users (Now — Month 2)

### P0 — Complete Before Any Distribution

| Task | Why | Effort |
|------|-----|--------|
| **Export (TXT + PDF)** | Users can't take their work out. Instant churn. | 4/10 |
| **Wire AI Suggestions** (remove `isMock: true`) | The core promise is currently fake. Trust killer. | 5/10 |
| **Build AI Suggestion UI** | `MuseDrawer.tsx` deleted, `GeminiPanel.tsx` is 0 bytes — no frontend exists | 5/10 |
| ~~Fix FX Panel~~ | ✅ Fully wired — `useVocalFX` + live monitoring in RecorderDrawer are both real | — |
| **Genre/Mood on project creation** | Required context for AI to be useful | 3/10 |

### P0 — Distribution (This Is The Actual Gap)

The product is good. The acquisition is zero. These run in parallel with the build fixes above.

1. **Beat Drop Thread** — Post in r/makinghiphop (600K): "Drop a beat link — I'll tell you where the hook should land." Do this manually for 20 people. These are your first 20 real users.
2. **Founding 50 Memberships** — Sell 50 lifetime Pro memberships at $49 via Reddit/Discord. $2,450 upfront, zero churn risk, 50 invested early adopters. Run this for 2 weeks in background.
3. **Producer Partnership** — One BeatStars producer with 10K+ followers links Lyriq in their beat delivery emails.
4. **Email capture + welcome sequence** — 5-email onboarding series. Use Resend or Loops.so.

### P1 — Needed for First Paying Users

| Feature | Notes |
|---------|-------|
| Multi-device sync (full) | Supabase project CRUD works; beats/recordings still IndexedDB-only |
| In-editor Rhyme Tool | Datamuse API integrated in `creative.ts` — just needs editor UI |
| Beat cloud storage | IndexedDB purged under iOS/Android storage pressure — silent data loss risk |

---

## Phase 2: Differentiation (Months 3–5)

> Leverage the AI audio moat to build features competitors can't replicate.

- **Smart Idea Recall** — AI surfaces relevant saved scraps and fragments while you write, based on context
- **Advanced Audio Analysis** — Melody detection, syllable-to-beat alignment, tempo-aware line suggestions
- **AI Personality Modes** — Switch Facilitator style (e.g., "The Technical Critic" vs. "The Hype Partner")
- **Rhyme scheme visualization** — A/B/C labels per lyric line
- **Reference Song Matching** — "Write me a hook with the same cadence as X"
- **In-editor Rhyme Tool** (if not shipped in P1)
- **Syllable/beat grid overlay** — See how many syllables land on each beat in real time

---

## Phase 3: Ecosystem (Months 6+)

> Build the network moat — community and pro integrations.

- **Real-time collaboration** — Shared writing sessions, Facilitator as "meeting minutes" AI
- **Template Marketplace** — Share and sell song structures, prompt templates, section presets
- **Ableton-style Take Lanes** — Layered vocal recording (spec in `ABLETON_TAKE_LANES_DESIGN.md`)
- **Version history timeline** — Restore any previous state of a song
- **DAW export** — MIDI or stems export for Logic/Ableton integration

---

## Pricing (Go-To-Market)

| Tier | Price | What's Included |
|------|-------|----------------|
| Free | $0 | 3 projects, 20 AI messages/day, beat upload, write + record |
| Pro | $9/mo or $79/yr | Unlimited AI, export, multi-device sync |
| Studio | $19/mo or $149/yr | Everything + audio intelligence, vocal FX, multi-take lanes |
| **Founding 50** | **$49 lifetime** | Lifetime Pro — sell these in first 2 weeks |

---

## Success Metrics

| Milestone | Target |
|-----------|--------|
| Phase 1 complete | 100 real users who have exported a song |
| Phase 1 revenue | Founding 50 sold ($2,450) |
| Phase 2 entry | 500 MAU, 50 paying subscribers |
| Phase 3 entry | $5K MRR |
