# LYRIQ MVP GAP ANALYSIS
### Current State vs. Phase 1 Requirements vs. LyricStudio

> **Date**: February 10, 2026
> **Purpose**: Identify what we have, what we're missing, and what needs to happen to launch Phase 1

---

## CURRENT MVP AUDIT (What We Actually Have)

### ✅ WORKING FEATURES

| Feature | Status | Details |
|---------|--------|---------|
| **Flow Mode (Freeform Writing)** | ✅ Shipped | `SandboxView.tsx` - Clean writing surface, auto-resize textareas, section-aware editing |
| **Write Mode (Structured Cards)** | ✅ Shipped | `LyricCard.tsx` - Section cards with type labels (verse/chorus/bridge/intro/outro), repeats, reorder |
| **Flow ↔ Write Sync** | ✅ Shipped | Both modes share `sections[]` as single source of truth. No data loss on switch |
| **Beat Upload & Playback** | ✅ Shipped | `BeatUploader.tsx` - Upload audio files, play/pause, volume, scrubbing, loop points (start/end markers), looping toggle |
| **Beat Persistence** | ✅ Shipped | Beats stored in IndexedDB as base64. Persist across sessions |
| **Voice Recording** | ✅ Shipped | `RecorderDrawer.tsx` - Record vocals over beat, waveform visualization (canvas), scrubbing, playback with backing track |
| **Multiple Takes** | ✅ Shipped | Save multiple voice takes per project. Each has duration, timestamp, beat offset |
| **Pin Take to Section** | ✅ Shipped | `pinnedTakeId` on `LyricSection` type. Paperclip UI to attach recordings to specific sections |
| **Idea Banking (Puzzle Board)** | ✅ Shipped | `PuzzleView.tsx` - Capture ideas, tag with section type (verse/chorus/bridge/idea), add custom tags, send to studio, start project from idea |
| **Project Management** | ✅ Shipped | Create, save, load, delete projects. Swipeable project cards. Auto-save with debounce |
| **Beat Library** | ✅ Shipped | Library tab with uploaded beats. Play, write to, delete. Persistent storage |
| **Vocal FX Panel** | ✅ Shipped | `FXPanel.tsx` - Space (reverb), Echo (delay), Punch (compression) sliders. UI only (no audio processing) |
| **Voice Memo View** | ✅ Shipped | `VoiceMemoView.tsx` - List all takes, play/pause, download, AI transcription via Gemini |
| **AI Transcription** | ✅ Shipped | Google Gemini integration for transcribing voice recordings to text |
| **Onboarding Tour** | ✅ Shipped | `OnboardingTour.tsx` - 6-step interactive walkthrough. Restartable from Settings |
| **Theme System** | ✅ Shipped | 5 themes: Dark, Light, Midnight, Matrix, Sonar. CSS variables for live switching |
| **Search** | ✅ Shipped | Global search across projects, takes, beats, scraps with filter tabs |
| **Supabase Backend** | ✅ Connected | `db.ts` + `actions.ts` - CRUD for projects via Supabase. Server actions pattern |
| **Datamuse API (Rhymes)** | ✅ Connected | `creative.ts` - getRhymes, getSynonyms, getRelatedConcepts via Datamuse API |
| **Responsive/Mobile Design** | ✅ Shipped | Mobile-first layout, touch-friendly controls, swipe gestures |

### ⚠️ BUILT BUT DISABLED

| Feature | Status | Details |
|---------|--------|---------|
| **Muse AI Drawer** | ⚠️ Disabled | `MuseDrawer.tsx` - Rhyme, Synonym, Imagery, Next Line, Rewrite modes. Uses Gemini API internally. Currently disabled for beta (see `WIP_FEATURES.md`) |
| **GeminiPanel** | ⚠️ Empty file | `GeminiPanel.tsx` - 0 bytes. Placeholder only |
| **AI Service** | ⚠️ Mock only | `services/ai.ts` - `isMock: true`. Returns hardcoded responses. No real AI integration |
| **FX Audio Processing** | ⚠️ UI only | FX sliders exist but don't apply actual audio effects |

### ❌ NOT BUILT YET

| Feature | Status | Phase | Priority |
|---------|--------|-------|----------|
| **AI Lyric Suggestions** | ❌ Missing | Phase 1 | P0 - CRITICAL |
| **Genre/Mood Selection** | ❌ Missing | Phase 1 | P0 - CRITICAL |
| **Export (PDF/TXT/Copy)** | ❌ Missing | Phase 1 | P0 - CRITICAL |
| **Cloud Sync (Multi-device)** | ❌ Partial | Phase 1 | P1 |
| **Rhyme Tool in Editor** | ❌ Missing | Phase 1 | P1 |
| **AI Personality Modes** | ❌ Missing | Phase 2 | P0 |
| **Smart Section Guidance** | ❌ Missing | Phase 2 | P0 |
| **Reference Song Matching** | ❌ Missing | Phase 2 | P0 |
| **Advanced Rhyme Schemes** | ❌ Missing | Phase 2 | P1 |
| **Collaboration** | ❌ Missing | Phase 2 | P1 |
| **Expanded Beat Library** | ❌ Missing | Phase 2 | P1 |
| **Melody Sync** | ❌ Missing | Phase 3 | P0 |
| **Portfolio Learning AI** | ❌ Missing | Phase 3 | P0 |

---

## PHASE 1 GAP ANALYSIS

### 🔴 P0 - CRITICAL FOR LAUNCH

#### 1. AI LYRIC SUGGESTIONS
**Gap**: Without this, Lyriq is "just a fancy notes app" — can't compete with LyricStudio
**Current State**: MuseDrawer exists but is disabled. It uses Gemini for rhymes/synonyms/next line/rewrite, but it's a drawer overlay, not inline suggestions.
**What's Needed**:
- [ ] Re-enable MuseDrawer OR build inline AI suggestion UI
- [ ] Context-aware generation: AI reads entire song + section type + genre
- [ ] Generate 3-5 lyric line suggestions per request
- [ ] "Insert" button to add selected suggestion to current section
- [ ] Free tier: 25 suggestions/day (counter in UI)
- [ ] System prompt engineering for quality output
**Effort**: 5/10 (Gemini API already integrated, just needs proper UX)

#### 2. GENRE/MOOD SELECTION
**Gap**: LyricStudio has this. Without it, AI suggestions are generic
**Current State**: `projectBpm` and `projectKey` state exist but aren't connected to AI
**What's Needed**:
- [ ] Genre picker in project creation flow (Pop, Hip-Hop, R&B, Country, Rock, Indie, EDM, Latin)
- [ ] Optional mood/theme tags (Love, Heartbreak, Party, Motivation, Reflection)
- [ ] Genre + mood passed as context to AI system prompt
- [ ] Visual indicator of genre on project card
**Effort**: 3/10 (UI + prompt engineering)

#### 3. EXPORT FUNCTIONALITY
**Gap**: Users need to get lyrics OUT of the app. Table stakes
**Current State**: Nothing. No export, no copy, no share
**What's Needed**:
- [ ] "Copy All" button → copies formatted lyrics to clipboard
- [ ] Export as .txt (plain text with section headers)
- [ ] Export as .pdf (formatted with section labels, project title, date)
- [ ] Share via native share sheet (mobile)
**Effort**: 4/10

#### 4. IMPROVED ONBOARDING
**Gap**: LyricStudio users complain about weak onboarding — our opportunity
**Current State**: OnboardingTour exists (6 steps) but doesn't demo AI features
**What's Needed**:
- [ ] Update tour to include AI suggestion demo step
- [ ] Add step showing genre selection
- [ ] Add step showing idea banking
- [ ] Show example project with AI in action (not just UI walkthrough)
- [ ] Optional skip for returning users ✅ (already exists)
**Effort**: 3/10 (just updating existing component)

### 🟡 P1 - IMPORTANT FOR RETENTION

#### 5. RHYME TOOL IN EDITOR
**Gap**: LyricStudio's core feature. We have the API but no in-editor UX
**Current State**: `creative.ts` has Datamuse integration (getRhymes, getSynonyms, getRelatedConcepts). MuseDrawer has rhyme mode but is disabled.
**What's Needed**:
- [ ] Long-press/tap word in Flow or Write mode → "Find Rhyme" button
- [ ] Popup showing 10-15 rhyming words (Perfect, Near, Slant categories)
- [ ] Tap to replace word inline
- [ ] Also show synonyms and related concepts
**Effort**: 4/10 (API already works, need UI integration)

#### 6. CLOUD SYNC
**Gap**: Table stakes for modern apps. LyricStudio has this
**Current State**: Supabase is connected. `actions.ts` has CRUD operations. But app primarily uses localStorage + IndexedDB for data
**What's Needed**:
- [ ] Auth system (Supabase auth - email/OAuth)
- [ ] Sync localStorage → Supabase on save
- [ ] Auto-save to cloud every 5 seconds
- [ ] Offline mode with sync-on-reconnect
- [ ] Conflict resolution (most recent wins)
**Effort**: 6/10 (Supabase is set up, needs auth + sync logic)

---

## LYRICSTUDIO FEATURES WE MUST MATCH (Table Stakes)

| LyricStudio Feature | Lyriq Status | Gap Level |
|---------------------|-------------|-----------|
| AI lyric generation | ❌ Disabled/mock | 🔴 CRITICAL |
| Genre/mood context for AI | ❌ Not built | 🔴 CRITICAL |
| Rhyme finder (click word → rhymes) | ⚠️ API ready, no editor UI | 🟡 IMPORTANT |
| Beat library | ✅ Have it (user uploads) | ✅ Matched |
| Vocal recording + waveform | ✅ Have it (better than theirs — we have scrubbing + beat sync) | ✅ AHEAD |
| Multi-track recording | ✅ Have it | ✅ Matched |
| Project organization | ✅ Have it (swipeable cards, date sorting) | ✅ Matched |
| Export lyrics | ❌ Not built | 🔴 CRITICAL |
| Song text editing | ✅ Have it (Flow + Write modes — better than theirs) | ✅ AHEAD |

---

## FEATURES WHERE WE'RE ALREADY AHEAD OF LYRICSTUDIO

| Feature | Why We're Ahead |
|---------|-----------------|
| **Dual Writing Modes** | Flow (freeform) + Write (structured) with instant sync. LyricStudio has only one editor |
| **Idea Banking** | Puzzle board for capturing loose ideas with tags. LyricStudio has nothing like this |
| **Beat Loop Control** | Set custom loop start/end points. LyricStudio just plays beats |
| **Pin Takes to Sections** | Attach specific recordings to specific song sections. LyricStudio can't do this |
| **AI Transcription** | Gemini-powered voice-to-text for recordings. LyricStudio doesn't transcribe |
| **Onboarding Tour** | Interactive step-by-step tour. LyricStudio users complain about lack of guidance |
| **Theme System** | 5 visual themes. Personalization LyricStudio lacks |
| **Beat + Vocal Sync** | Record vocals with beat offset tracking. Recordings tied to beat timeline |

---

## LAUNCH READINESS SCORECARD

| Category | Score | Notes |
|----------|-------|-------|
| **Core Writing Experience** | 9/10 | Flow + Write modes are excellent. Missing: inline AI |
| **Beat Integration** | 8/10 | Upload, play, loop, scrub. Missing: beat library presets |
| **Recording** | 9/10 | Full recorder with waveform, scrubbing, multi-take, pin to section |
| **AI Features** | 2/10 | 🔴 Only transcription works. Core AI (suggestions) is disabled/mock |
| **Export** | 0/10 | 🔴 Nothing. Can't get lyrics out of the app |
| **Rhyme Tools** | 3/10 | API connected but no in-editor UI |
| **Project Management** | 7/10 | Create, save, load, delete. Missing: genre tags, cloud sync |
| **Onboarding** | 7/10 | Tour exists but doesn't cover AI features |
| **Overall Phase 1 Readiness** | **5/10** | Foundation is strong but missing the AI core + export |

---

## PRIORITY ACTION PLAN

### Sprint 1 (Week 1-2): "Make It Smart"
1. **Enable/rebuild AI Lyric Suggestions** - Re-enable MuseDrawer or build inline suggestion panel
2. **Add Genre/Mood Selection** - Project creation flow + AI context
3. **Export Functionality** - Copy, TXT, PDF export

### Sprint 2 (Week 3-4): "Make It Complete"
4. **In-editor Rhyme Tool** - Long-press word → rhyme popup
5. **Update Onboarding** - Demo AI features in tour
6. **Free tier limits** - 25 suggestions/day counter

### Sprint 3 (Week 5-6): "Make It Reliable"
7. **Auth + Cloud Sync** - Supabase auth, cloud save
8. **Bug fixes + polish** - Edge cases, error handling
9. **Performance optimization** - Large projects, many takes

---

## BOTTOM LINE

**The writing experience is already better than LyricStudio.** Flow mode, Write mode, idea banking, beat integration, and recording are all strong.

**The critical gap is AI.** Without working AI suggestions, we're a beautiful notes app. With AI, we're a serious competitor.

**3 things to ship before Phase 1 launch:**
1. 🔴 AI Lyric Suggestions (the killer feature)
2. 🔴 Genre/Mood Selection (makes AI good)
3. 🔴 Export (lets users get value out)

Everything else is already ahead of or on par with LyricStudio. Ship these 3 and you have a launchable Phase 1 MVP.
