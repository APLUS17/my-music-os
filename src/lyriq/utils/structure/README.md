# Beat sectioning (ours, not vendored)

Splits a beat or song into sections and names them, in the browser, with no server and
no model download. Runs in a Web Worker (`structure.worker.ts`) via
`services/structureAnalysis.ts`; about 1 s per 3-minute song on a laptop.

| Step | File | What it does |
|---|---|---|
| Features | `features.ts` | One 2048-point STFT at 11025 Hz: log-mel, MFCC (timbre), CLP chroma (harmony), loudness, spectral-flux onsets |
| Beats | `beats.ts` | Tempo (onset autocorrelation, 120 BPM prior), dynamic-programming beat tracker (Ellis 2007), beats extended to both song edges at the fitted tempo, constant-tempo grid fit for the editor's bar snapping. A tempo from the file name is kept. |
| Boundaries | `segment.ts` | Beat-synchronous features; novelty from timbre and harmony (Foote checkerboard), repetition (Serrà structure features) and loudness; downbeat phase = where novelty peaks; a dynamic programme over downbeats with a 4/8/16-bar phrase prior; each boundary may then slide 1 beat to the sharpest change. No section under 1.5 bars. |
| Groups | `label.ts` | Sections that sound alike, beat by beat, share a letter (A, B, C...). |
| Names | `labelModel.ts` | A linear scorer over ~20 numbers per section (position, loudness, how often its music repeats, whether it is the loudest repeated part...), fitted on 40 annotated songs; sections that share music vote together. `label.ts` keeps the older hand-written rules (`labelWith: 'rules'`). |
| Lyrics | `label.ts` `markRepeatedLyricsAsChorus` | On re-analysis, sections whose lyrics repeat (written or transcribed) become the chorus. |

Measured on real songs with human annotations: see `scripts/structure-bench/README.md`.
Held out: section starts within 3 s 0.64 (old draft 0.42), within 0.5 s 0.47 (0.18),
name accuracy 0.62 (0.46). Names are still the weak part; boundaries and groups are the
strong part.

Changing the algorithm? Bump `STRUCTURE_VERSION` in `services/structureAnalysis.ts` so cached
beats are re-analysed, and re-run the benchmark.
