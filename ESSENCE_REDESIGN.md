# Lyriq — The Essence Redesign

*What it would look like if Steve Jobs and Jony Ive got their hands on it.*

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
