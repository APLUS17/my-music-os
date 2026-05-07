# LYRIQ MVP GAP ANALYSIS
### Current State vs. Phase 1 Requirements vs. LyricStudio

> **Date**: May 7, 2026 (Updated)
> **Purpose**: Identify what we have, what we're missing, and what needs to happen to launch Phase 1

---

## CURRENT MVP AUDIT (What We Actually Have)

### ✅ WORKING FEATURES

| Feature | Status | Details |
|---------|--------|---------|
| **Flow Mode (Freeform Writing)** | ✅ Shipped | `SandboxView.tsx` - Clean writing surface, auto-resize textareas, section-aware editing |
| **Write Mode (Structured Cards)** | ✅ Shipped | `LyricCard.tsx` - Section cards with type labels, repeats, reorder |
| **Flow ↔ Write Sync** | ✅ Shipped | Both modes share `sections[]` as single source of truth |
| **Beat Upload & Playback** | ✅ Shipped | `BeatUploader.tsx` - Upload, play/pause, volume, scrubbing, loop points |
| **Beat Persistence** | ✅ Shipped | Beats stored in IndexedDB as base64 |
| **Voice Recording** | ✅ Shipped | `RecorderDrawer.tsx` - Record vocals over beat with waveform visualization |
| **Multiple Takes** | ✅ Shipped | Save multiple voice takes per project |
| **Pin Take to Section** | ✅ Shipped | `pinnedTakeId` on `LyricSection`. Paperclip UI to attach recordings |
| **AI Audio Analysis** | ✅ Shipped | **NEW**: Gemini 2.0 Flash automatically identifies song structure (Verse/Chorus) from audio |
| **Studio Facilitator AI** | ✅ Shipped | **NEW**: Conversational AI coach for creative momentum, formulas, and "Verse 2" solutions |
| **AI Transcription** | ✅ Shipped | Google Gemini integration for transcribing voice recordings to text |
| **Supabase Backend** | ✅ Connected | `db.ts` + `actions.ts` - CRUD for projects via Supabase. Fixed deployment type issues |
| **Theme System** | ✅ Shipped | 5 themes: Dark, Light, Midnight, Matrix, Sonar |
| **Responsive/Mobile Design** | ✅ Shipped | Mobile-first layout, touch-friendly controls |

### ⚠️ BUILT BUT DISABLED

| Feature | Status | Details |
|---------|--------|---------|
| **Muse AI Drawer** | ⚠️ Disabled | `MuseDrawer.tsx` - Rhyme, Synonym, Imagery modes. Needs re-enabling in Studio |
| **AI Lyric Suggestions** | ⚠️ Partial | `chatWithFacilitator` can suggest lyrics, but dedicated inline suggestions are not yet built |
| **FX Audio Processing** | ⚠️ UI only | FX sliders exist but don't apply actual audio effects |

### ❌ NOT BUILT YET

| Feature | Status | Phase | Priority |
|---------|--------|-------|----------|
| **Genre/Mood Selection** | ❌ Missing | Phase 1 | P0 - CRITICAL |
| **Export (PDF/TXT/Copy)** | ❌ Missing | Phase 1 | P0 - CRITICAL |
| **Rhyme Tool in Editor** | ❌ Missing | Phase 1 | P1 |
| **Cloud Sync (Multi-device)** | ❌ Partial | Phase 1 | P1 |
| **AI Personality Modes** | ❌ Missing | Phase 2 | P0 |

---

## PHASE 1 GAP ANALYSIS (REVISED)

### 🔴 P0 - CRITICAL FOR LAUNCH

#### 1. AI LYRIC SUGGESTIONS (UX)
**Gap**: We have the backend logic (`chatWithFacilitator`), but need a streamlined UI for inserting suggestions directly into lyrics.
**What's Needed**:
- [ ] Connect `MuseDrawer` to the real Gemini actions
- [ ] "Insert" button to add selected suggestion to current section

#### 2. GENRE/MOOD SELECTION
**Gap**: AI is currently "generalist". Genre context is needed for better suggestions.
**Effort**: 3/10

#### 3. EXPORT FUNCTIONALITY
**Gap**: Still the biggest friction point. Users cannot get lyrics out of the app.
**Effort**: 4/10

---

## LAUNCH READINESS SCORECARD

| Category | Score | Notes |
|----------|-------|-------|
| **Core Writing Experience** | 9/10 | Excellent foundation |
| **Beat Integration** | 8/10 | Strong |
| **Recording & Audio AI** | **10/10** | **AHEAD**: Multi-take + AI structure analysis is best-in-class |
| **Creative AI (Facilitator)** | **8/10** | **AHEAD**: Chat-based coaching is a major differentiator |
| **AI Suggestions (UX)** | 3/10 | 🔴 Missing inline integration |
| **Export** | 0/10 | 🔴 Critical blocker |
| **Overall Phase 1 Readiness** | **7/10** | Foundations are elite. Just need UX polish on AI and Export |
