# Structure analysis benchmark

Scores the editor's beat sectioning (`src/lyriq/utils/structure`) against human
annotations from [SongFormBench](https://huggingface.co/datasets/ASLP-lab/SongFormBench)
(CC-BY-4.0): real songs with expert-labelled sections.

```bash
./fetch.sh                # ~840 MB into ./data (git-ignored); needs ffmpeg
node run.mjs test         # new algorithm, held-out split
node run.mjs test --old   # the previous energy-only draft, for comparison
node train.mjs            # refit the section-name weights (labelModel.ts) on dev
```

Splits: **dev** = first 40 HarmonixSet songs (all tuning and fitting happened here),
**test** = next 40 HarmonixSet songs, **cn** = 20 Chinese pop songs. Test and cn were
never used for tuning.

Metrics: **HR.5F / HR3F** = F-measure of section starts found within 0.5 s / 3 s
(the "trim" variants leave out the song's first and last boundary, which are free).
**ACC** = share of time with the right name, using 7 classes (pre-chorus counts as verse).
The editor has no "instrumental" or "silence" name, and those are about a fifth of the
annotated time, so ACC can't reach 1.

Results (2026-11-24):

| Split | Version | HR.5F | HR3F | HR.5F trim | HR3F trim | ACC |
|---|---|---|---|---|---|---|
| test (40) | old energy draft | 0.180 | 0.417 | 0.055 | 0.315 | 0.462 |
| test (40) | **new** | **0.466** | **0.640** | **0.406** | **0.581** | **0.621** |
| cn (20) | old energy draft | 0.222 | 0.466 | 0.077 | 0.347 | 0.619 |
| cn (20) | **new** | **0.377** | **0.685** | **0.293** | **0.631** | **0.746** |

For reference, published scores on the full 200-song HarmonixSet half (SongFormer
paper, arXiv 2510.02797; their metric code, so only roughly comparable):
All-In-One 0.596 / 0.730 / ACC 0.740, SongFormer 0.703 / 0.784 / ACC 0.795,
Gemini 2.5 Pro 0.423 / 0.813 / ACC 0.748.

Matching here is greedy one-to-one by distance (mir_eval uses maximum bipartite
matching; results differ slightly).
