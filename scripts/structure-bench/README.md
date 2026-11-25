# Structure analysis benchmark (boundaries only)

Checks where the editor's beat sectioning (`src/lyriq/utils/structure`) puts section
boundaries, against human annotations from
[SongFormBench](https://huggingface.co/datasets/ASLP-lab/SongFormBench) (CC-BY-4.0).
These are songs **with vocals**; the sectioning is built for instrumentals, so only
boundaries are scored here, not names. Names are tested on synthetic beats in
`src/lyriq/__tests__/structure.test.ts`.

```bash
./fetch.sh                # ~840 MB into ./data (git-ignored); needs ffmpeg
node run.mjs test         # held-out split
node run.mjs test --old   # the previous energy-only draft, for comparison
```

Splits: **dev** = first 40 HarmonixSet songs (tuning happened here), **test** = next 40,
**cn** = 20 Chinese pop songs.

**HR.5F / HR3F** = F-measure of section starts found within 0.5 s / 3 s ("trim" leaves
out the song's first and last boundary, which are free). Matching is greedy one-to-one by
distance (mir_eval uses maximum bipartite matching; results differ slightly).

Results (2026-11-24, STRUCTURE_VERSION 2):

| Split | Version | HR.5F | HR3F | HR.5F trim | HR3F trim |
|---|---|---|---|---|---|
| test (40) | old energy draft | 0.180 | 0.417 | 0.055 | 0.315 |
| test (40) | v1 (any beat, song names) | 0.466 | 0.640 | 0.406 | 0.581 |
| test (40) | **v2 (bar-aligned beat blocks)** | **0.512** | **0.670** | **0.452** | **0.613** |
| dev (40) | old / v1 / **v2** | 0.213 / 0.464 / **0.415** | 0.440 / 0.700 / **0.678** | 0.044 / 0.384 / **0.320** | 0.311 / 0.648 / **0.620** |
| cn (20) | old / v1 / **v2** | 0.222 / 0.377 / **0.269** | 0.466 / 0.685 / **0.675** | 0.077 / 0.293 / **0.162** | 0.347 / 0.631 / **0.614** |

v2 forces every boundary onto a bar line. Vocal songs often start a section on a pickup,
which costs some ±0.5 s hits on dev and cn; ±3 s is unchanged.
