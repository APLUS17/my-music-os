#!/usr/bin/env bash
# Downloads the benchmark subset used for tuning and testing (about 840 MB) into ./data
# and builds the analysis bundle. SongFormBench is CC-BY-4.0 (ASLP-lab).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data/audio data/pcm data/build
BASE=https://huggingface.co/datasets/ASLP-lab/SongFormBench/resolve/main
curl -sfL -o data/SongFormBench.jsonl "$BASE/data/SongFormBench.jsonl"
list() { curl -sf "https://huggingface.co/api/datasets/ASLP-lab/SongFormBench/tree/main/data/audios/$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s).forEach(f=>console.log(f.path)))'; }
# Every song except each 5th HarmonixSet one (80 songs: dev = first 40, test = next 40), plus 20 Chinese songs.
{ list HarmonixSet | awk 'NR%5!=0' | head -80; list CN | head -20; } > data/pick.txt
xargs -P 6 -I{} sh -c 'f=$(basename {}); [ -s data/audio/$f ] || curl -sfL --retry 3 -o data/audio/$f "'"$BASE"'/{}"' < data/pick.txt
for f in data/audio/*; do n=$(basename "$f"); [ -s "data/pcm/$n.f32" ] || ffmpeg -v error -i "$f" -ac 1 -ar 44100 -f f32le "data/pcm/$n.f32"; done
../../node_modules/.bin/esbuild entry.ts --bundle --format=esm --platform=node --outfile=data/build/lib.mjs --log-level=warning
echo "Ready: node run.mjs test   (or dev | cn; add --old for the previous algorithm)"
