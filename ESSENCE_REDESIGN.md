# Lyriq — The Essence Redesign

*What it would look like if Steve Jobs and Jony Ive got their hands on it.*

This document covers two passes. The first (below) redid the visual
material — tokens, chrome, decoration. The second, **What Lyriq Is**,
answers a harder question first: what is this product *for*, and what
falls out once you answer that honestly. Read that section first if
you're asking "why is X gone" about a whole feature rather than a color.

---

## What Lyriq Is

**A better Notes and Voice Memos for songwriters.**

Notes and Voice Memos each win by doing one thing invisibly well and
never asking you to configure anything before you can think out loud.
Their one weakness, for a songwriter, is that they don't talk to each
other: the hum you recorded and the line you scribbled live in two
apps with no memory of each other. That gap is Lyriq's entire reason
to exist. Everything else is not.

So the test for every feature became concrete: **does this help
someone capture a lyric or a take, or connect the two, faster than
Notes + Voice Memos would?** Run down the feature list against that
question and it sorts itself:

**Fits — this is the product:**
- Flow (freeform capture) — the "better Notes" half
- Recording + auto-transcription — the "better Voice Memos" half
- Pinning a take to a line, multiple takes per line — the actual
  differentiator; Notes and Voice Memos can't do this at all
- Beat playback under a recording — songwriters write to a loop; this
  is domain-specific capture, not production
- Library/search, quiet auth + sync — the note list / recordings
  list, unified, and nothing's ever lost, invisibly, like Notes

**Doesn't fit — GarageBand's job, not Notes':**
- The standalone Vocal FX mixer (reverb/delay/EQ/compression on a
  *played-back* take) and its Spectral EQ visualizer. **Cut.**
  RecorderDrawer's live-monitoring reverb — a touch of space in your
  headphones *while you sing*, meant to help the performance rather
  than polish it after — stayed. Same category of effect, opposite
  purpose: one is capture, one is production.

**Doesn't fit — a different product wearing Lyriq's clothes:**
- Muse, the standalone AI conversational-coach tab: its own view, its
  own long-form "hit record and just talk" capture pipeline, its own
  IndexedDB manifest/chunk schema for crash recovery. A copilot, not a
  notes app. **Cut the tab.** The two things inside it that were
  actually useful — an AI recap of a take, and never losing a take to
  a crash — got folded into the product that stayed:
  - **Recap** is now one button on any take in `PlayerTab`, using the
    same Gemini pipeline (`processMuseSession`), instead of a mode you
    had to go find.
  - **Crash recovery** runs silently on next launch instead of surfacing
    a manual "orphaned recordings" list to sift through — see the new
    effect in `StudioWorkspace.tsx` right after `handleSaveRecordingSession`.
    A voice-memo app that can lose your take to a crash without ever
    telling you isn't "notes and voice memos," it's a bug wearing a
    feature's name.

**Out of scope, not "in the way":** Mission Control (`/mission-control`)
is a business dashboard at its own URL that no songwriter ever sees.
Left alone — the essence question doesn't apply to a tool aimed at the
person running Lyriq, not the people using it.

**Duplication, not a feature question:** Home's Library had a
Songs/Beats tab switcher; Vault separately browsed sessions, scraps,
*and* beats. Same content, two homes. **Cut** the Beats tab from Home —
Vault is now the one place standalone audio lives, and got a delete
affordance for beats it was missing (Home's tab used to be the only
place you could delete one).

**Also cut:** the 6-step onboarding tour. A "Start writing" empty
state that only appeared *during* the tour was arguably the tour's
biggest tell — the product needed a guide to get you to the thing
that should have explained itself. Deleted the tour; the empty state
now shows whenever there's nothing to write, tour or not, and does
the teaching Notes-style: quietly, in place, no overlay.

### What this cost, concretely

| Removed | Lines | Where it went |
|---|---|---|
| `FXPanel.tsx` (mixer UI) | ~170 | File now holds only the `FXSettings` type RecorderDrawer's live-monitor still shares |
| `SpectralEQ.tsx` + its test | ~640 | Deleted outright |
| `useVocalFX` hook (playback FX chain) | ~310 | Deleted; `createReverbImpulse` stayed for RecorderDrawer |
| `MuseView.tsx` | ~1,030 | Deleted; recap + crash-recovery folded into `StudioWorkspace`/`PlayerTab` |
| `useMuseRecorder.ts` | — | Deleted (long-form capture pipeline had no other caller) |
| `OnboardingTour.tsx` | ~260 | Deleted |
| Home's Beats tab | ~70 | Deleted; equivalent (plus a missing delete button) added to Vault |

Nothing here touched Flow/Write sync, the recorder's core save path,
take persistence, or the transcription/analysis pipeline. Verified with
`tsc --noEmit`, `npm run lint` (no new errors), and the full test suite
(115/115 passing after removing SpectralEQ's own 31 tests along with it).

---

## The brief they'd have given

Jobs didn't ask "how do we make this look nicer." He asked "what is this
actually for, and what is everything else in the way of that." Ive's
answer was always the same: remove until it breaks, then put back the one
thing it needed. Applied to a songwriting app, that means one question —

> **Does this help someone write, record, or hear the song faster?**

Everything that isn't a "yes" is a tax on the writer's attention. This
redesign is the product of asking that question of every screen, every
choice, and a fair number of pixels — and cutting what didn't answer it.

## What got cut

- **Five of six themes.** Dark, Light, Midnight, Matrix, Sonar, Moises —
  a settings screen that made the *user* design the app. A theme picker
  is a decision the product declined to make. We made it: **Lyriq
  Black** — true `#000`, one accent, done. If you want proof this was
  a real edit and not a coat of paint, `theme` no longer exists as
  state in `StudioWorkspace.tsx` — there's nothing left to switch.
- **The spinning vinyl record.** A conic-gradient metallic disc with
  fake grooves, a fake label, and a fake spindle hole, rotating at 4s/rev
  — on every beat tile, in a grid, at thumbnail size. It's the exact
  species of decoration Ive spent iOS 7 removing: skeuomorphism standing
  in for information. A beat tile now just tells you what it is (`Disc`
  glyph) and lets you play it.
- **Orbiting particles, blur blobs, gradient-clipped headlines.** The
  Flow-mode empty state had two animated blur blobs, a dashed ring
  orbiting a pen icon, and a headline rendered as a background-clip
  gradient. None of it was information — it was motion for its own
  sake, competing with the cursor for the writer's eye in the one place
  that's supposed to be *quiet*. Replaced with an icon, one sentence,
  one button.
- **The theme-cycle sun/moon button and the six-swatch Settings grid.**
  Gone with the themes. Settings now tells you the truth: there's one
  look, and it's tuned for the words on the page.
- **A mint-green FAB menu that didn't match anything else in the app.**
  Recolored into the actual system — accent green for "create," red for
  "record" (never both meaning the same thing at once).

## What stayed, on purpose

The redesign is not a rewrite of the engine. Flow/Write sync, the
recorder, take lanes, vocal FX, Supabase persistence, the Groq/Gemini
pipeline — untouched. Jobs never rewrote the database to change how an
app felt; he changed the material and the amount of it you saw. Every
edit here is presentation: `globals.css` tokens and the JSX/className
layer in `StudioWorkspace.tsx`, `AuthGate.tsx`, and `MiniPlayer.tsx`. No
handler, no state shape, no persistence path was touched. That's
deliberate — an "essence" redesign that breaks recording on day one
isn't restraint, it's recklessness wearing restraint's clothes.

## The new material

| Token | Before | Now | Why |
|---|---|---|---|
| `--bg-main` | `hsl(240,6%,10%)` — a gray pretending to be black | `#000000` | An OLED-honest black is a material choice, not a mood. It also makes the accent color the only thing with anywhere to hide. |
| `--accent` | `#3b82f6` (blue) | `#B4FF39` (Lyriq acid green) | The brand's own color, finally used as *the* accent instead of a generic blue borrowed from a hundred other SaaS products. |
| `--studio-red` | `#FF003C` | `#FF3B30` | A calmer, more legible red reserved strictly for record/destructive — never doubles as the brand accent, so "red" only ever means one thing. |
| `--radius-lg` | `0.5rem` | `1.125rem` | Generous, calm geometry over sharp corporate corners. |
| `.glass-*` | blur + saturate + a fake gloss-reflection gradient | blur where structural (sheets, sticky bars), reflection gradient removed | Materials should look like what they are. A translucent plate doesn't need a painted-on shine to read as glass. |

Six theme variants (`[data-theme="light|midnight|matrix|sonar|moises"]`)
were deleted outright rather than left dormant — dead CSS is still a
decision someone has to explain later.

## How to see it

```bash
npm run dev
```

Everything downstream of `globals.css` picks up the new material for
free — `MusicPlayer`, `VaultView`, `BeatUploader`, `FXPanel`,
`RecorderDrawer`, `PlayerTab`, `OnboardingTour` all read the same CSS
variables and needed no direct edits to look like part of one product
again. That's the actual test of whether a design system was real in
the first place: change the tokens, and everything downstream should
just be *right*.
