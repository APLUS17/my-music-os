# Beat sectioning (ours, not vendored)

Lays out an **instrumental** as the blocks a writer works in, so you can start writing
without sectioning anything yourself. Runs in the browser in a Web Worker
(`structure.worker.ts`, via `services/structureAnalysis.ts`), no server, no model
download; about 1-2 s for a 3-minute beat.

Output: bar-aligned blocks of 8 or 16 bars (4 only for a short intro, outro or break;
never more than 16), a repeat letter per block (A, B, C: same letter = same music), and
beat-style names: **Intro, Hook, Verse, Bridge, Outro**. Verses are numbered; a hook
stays "Hook" every time.

| Step | File | What it does |
|---|---|---|
| Features | `features.ts` | 2048-point STFT at 11025 Hz: MFCC (timbre), CLP chroma (harmony), band levels (808 30-120 Hz, mids 300 Hz-3 kHz, highs 3.5 kHz+). A separate 512-point STFT for onsets, so hits aren't heard early. |
| Beats | `beats.ts` | Tempo (onset autocorrelation, 120 BPM prior; under 80 BPM moves up an octave when the double tempo has its own peak, so a 140 trap beat isn't read as 70). DP beat tracker, beats extended to both ends, constant-tempo grid. A BPM in the file name is kept. |
| Beat 1 + blocks | `segment.ts`, `index.ts` | Each of the 4 beat phases is scored by its kick/808 attack (the anchor) plus how well 8/16-bar blocks fit the music on that phase and each 4-bar phrase offset; the best grid wins. Boundaries come from novelty (timbre, harmony, repetition, loudness) plus **transitions**: a dropout on the last beat(s) of a bar followed by the beat coming back, or a kick/crash impact on the 1. With a steady tempo, boundaries sit exactly on the bar grid the editor snaps to. |
| Repeats | `label.ts` | Blocks that sound alike beat by beat share a group (relative to the closest pair in the beat). A group splits when some of its blocks are clearly **fuller** (same loop, hook arrangement). Neighbours of the same group join up to 16 bars. A beat that is one loop throughout is cut into regular 16-bar blocks. |
| Names | `label.ts` `nameBeatSections` | **Fullness** = 808/low-end level + kick punch + highs + mid layers + harmonic spread (not loudness: masters are limited). Hook = the fullest repeated group, if it clearly stands out; no hook straight after a hook except a closing double hook. Intro/Outro only at the ends, 4-8 bars, and only when sparser than the body (a beat that drops full at 0:00 has no intro). Bridge = a one-off block in the second half. |
| Lyrics | `label.ts` `markRepeatedLyricsAsHook` | On re-analysis, sections whose lyrics repeat (written or transcribed) become Hook. |

Tests: `src/lyriq/__tests__/structure.test.ts` renders synthetic instrumentals (trap-style
where hook and verse share a loop, boom-bap with a lead-in, an unchanging loop) and checks
tempo, exact bar alignment, block lengths, groups and names.

Boundaries are also checked on real songs with vocals (no instrumental set with annotations
exists): `scripts/structure-bench/`. Names are not scored there: they are tuned for beats.

Changing the algorithm? Bump `STRUCTURE_VERSION` in `services/structureAnalysis.ts` so cached
beats are re-analysed, and re-run the tests and the benchmark.
