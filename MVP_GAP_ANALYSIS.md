# LYRIQ LAB — LAUNCH STRATEGY & GAP ANALYSIS
### Updated: August 2026

> **Strategic pivot:** This document has been updated to reflect the distribution-first launch strategy defined in the August 2026 business coaching session. The previous version tracked feature completeness. This version tracks launch readiness — a different problem.

---

## WHO WE'RE BUILDING FOR (ICP)

**One sentence:**
> The independent hip-hop or R&B artist (18–28) who leases or makes beats, writes lyrics in Apple Notes or voice memos, and can't turn raw ideas into finished songs because they're always switching between apps.

**Why this person:**
- Already pays for beats online (BeatStars, Airbit) — tech-comfortable, spending money in the category
- Records voice memos daily — the behavior Lyriq formalizes already exists
- Bounces between 3+ apps — fragmentation pain is real and daily
- Wants to finish songs, not just write lines — clear job to be done
- Mobile-native, design-conscious — will pay for tools that make them look/sound pro

---

## THE VALUE PROP

> **"The only songwriting app with an AI that listens to your beat and helps you finish the song."**

**Competitive positioning:** LyricStudio writes lyrics. Lyriq Lab finishes songs.

---

## CURRENT BUILD STATUS (August 2026)

### ✅ SHIPPED & WORKING

| Feature | Status | Strategic value |
|---------|--------|----------------|
| Flow Mode (freeform writing) | ✅ Shipped | Core writing surface |
| Write Mode (structured cards) | ✅ Shipped | Structured editing |
| Flow ↔ Write Sync | ✅ Shipped | No data loss on mode switch |
| Beat Upload + Playback | ✅ Shipped | Core differentiator setup |
| Voice Recording + Waveform | ✅ Shipped | Key feature vs LyricStudio |
| Multiple Takes | ✅ Shipped | Pro workflow |
| AI Transcription (Groq Whisper) | ✅ Shipped | Ahead of competitors |
| AI Audio Analysis (Gemini) | ✅ Shipped | **#1 differentiator** — no competitor has this |
| Studio Facilitator AI | ✅ Shipped | Conversational coach — ahead of LyricStudio |
| Supabase Auth (email OTP) | ✅ Shipped | Production-ready |
| 5 Themes | ✅ Shipped | Polish (not launch critical) |
| Notes View | ✅ Shipped | Useful but not differentiating |
| Vault View | ✅ Shipped | Nice to have |
| Onboarding Tour | ✅ Shipped | Can defer update |

### 🔴 P0 — MUST SHIP BEFORE FIRST 100 USERS

| Feature | Gap | Effort | Why it's blocking |
|---------|-----|--------|------------------|
| **Export (TXT + PDF)** | ❌ Missing | 4/10 | Users can't get their work out. Instant churn. |
| **Real AI Lyric Suggestions** | ⚠️ `isMock: true` | 5/10 | The core promise is fake. Trust killer. |
| **Wire MuseDrawer/AI to real Gemini** | ❌ Component deleted, no replacement UI | 5/10 | The AI panel is a void. |
| ~~Fix FX Panel~~ | ✅ Already wired — `useVocalFX` hook + RecorderDrawer both live | N/A |
| **Genre/Mood on project creation** | ❌ Missing | 3/10 | Required to make AI suggestions contextual |

### 🟡 P1 — NEEDED FOR FIRST PAYING USERS

| Feature | Gap | Effort |
|---------|-----|--------|
| Multi-device sync (Supabase) | ⚠️ Partial | 5/10 |
| In-editor Rhyme Tool (Datamuse API ready) | ❌ No UI | 4/10 |
| Beat storage → Supabase cloud | ❌ IndexedDB only (data loss risk on mobile) | 6/10 |
| Email capture + welcome sequence | ❌ Not built | 3/10 |

### ⛔ DEPRIORITIZED (Not blocking launch, defer to Phase 2)

| Feature | Why deprioritized |
|---------|------------------|
| Mission Control dashboard | Builds for founder, not user |
| AI Personality Modes | Phase 2 differentiator |
| Collaboration / real-time co-writing | Phase 3 |
| Ableton-style Take Lanes | Phase 3 |
| Rhyme scheme visualization | Phase 2 |
| Reference Song Matching | Phase 2 |
| Syllable/beat grid overlay | Phase 2 |
| Version history timeline | Phase 2 |

---

## DISTRIBUTION (THE ACTUAL P0)

The product is built. The problem is no one knows it exists. Distribution is P0, not a feature.

**Week 1 action:**
Post in r/makinghiphop: "Drop a beat link — I'll run it through my app and tell you where the hook should land."
Do this for 20 people manually. This is your first 20 real users.

**Channel strategy:**
1. **Reddit community embedding** — r/makinghiphop (600K), r/WeAreTheMusicMakers
2. **Producer partnership** — One BeatStars producer (10K+ followers) links Lyriq in beat delivery emails
3. **SEO** — "songwriting app for iPhone," "how to write lyrics to a beat," "finish songs faster"

---

## REVENUE — FOUNDING 50 PLAY

Sell 50 lifetime Pro memberships at $49 before anything else.
- Revenue: $2,450 upfront
- Funds 30 months of infrastructure
- Gets 50 invested real users with zero churn risk
- Sell via Reddit/Discord personally in the next 2 weeks

**Pricing:**
- Free: 3 projects, 20 AI messages/day, beat upload, write + record
- Pro: $9/mo or $79/yr — unlimited AI, export, multi-device sync
- Studio: $19/mo or $149/yr — everything + audio intelligence, vocal FX, multi-take

---

## LAUNCH READINESS SCORECARD (August 2026)

| Category | Score | Blocker? |
|----------|-------|----------|
| Core Writing Experience | 9/10 | No |
| Beat Integration | 8/10 | No |
| Recording + AI Transcription | 10/10 | No |
| AI Audio Intelligence | 10/10 | No — this is the moat |
| AI Suggestions UX | 2/10 | 🔴 YES — isMock: true |
| Export | 0/10 | 🔴 YES — missing entirely |
| Vocal FX + Live Monitoring | 10/10 | No — fully wired, real Web Audio |
| Distribution / Acquisition | 0/10 | 🔴 YES — no users |
| Revenue / Monetization | 0/10 | 🔴 YES — no pricing in production |
| **Overall Launch Readiness** | **5/10** | Foundation is elite. Distribution + 3 features blocking. |

---

## THE ORDER OF OPERATIONS

1. Ship export (TXT + PDF) — 1 afternoon
2. Wire real AI suggestions (remove `isMock: true`) — 1-2 days
3. Add genre/mood to project creation — half day
5. Post Beat Drop thread in r/makinghiphop — 30 minutes
6. Sell Founding 50 via Reddit/Discord — 2 weeks running in background
7. Set up email capture + 5-email welcome sequence — 1 day
8. Then, and only then, think about new features
