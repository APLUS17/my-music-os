// Usage: node run.mjs <split: dev|test|cn|all> [--old] [--json params] [--limit n]
// Boundaries only: these are songs with vocals, and the names are tuned for instrumentals.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as lib from './data/build/lib.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(HERE, 'data');
const args = process.argv.slice(2);
const split = args[0] || 'dev';
const runOld = args.includes('--old');
const pIdx = args.indexOf('--json');
const params = pIdx >= 0 ? JSON.parse(args[pIdx + 1]) : {};
const lIdx = args.indexOf('--limit');
const limit = lIdx >= 0 ? Number(args[lIdx + 1]) : Infinity;
const verbose = args.includes('-v');

const meta = Object.fromEntries(
  fs.readFileSync(path.join(DIR, 'SongFormBench.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).map(r => [r.id, r])
);
const files = fs.readdirSync(path.join(DIR, 'audio')).sort();
const hx = files.filter(f => f.startsWith('BHX'));
const cn = files.filter(f => f.startsWith('BC'));
const pick = { dev: hx.slice(0, 40), test: hx.slice(40, 80), cn, all: [...hx, ...cn] }[split].slice(0, limit);

const CACHE = path.join(DIR, 'pcm');
fs.mkdirSync(CACHE, { recursive: true });
function decode(file) {
  const c = path.join(CACHE, file + '.f32');
  if (!fs.existsSync(c)) {
    const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(DIR, 'audio', file), '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
    fs.writeFileSync(c, buf);
  }
  const b = fs.readFileSync(c);
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
}

function gtSegments(rec) {
  const L = rec.labels;
  const segs = [];
  for (let i = 0; i < L.length - 1; i++) segs.push({ start: L[i].start, end: L[i + 1].start, label: L[i].label });
  return segs;
}

// One-to-one matching within a window (greedy by distance; mir_eval uses max bipartite matching).
function hits(ref, est, win) {
  const pairs = [];
  ref.forEach((r, i) => est.forEach((e, j) => { const d = Math.abs(r - e); if (d <= win) pairs.push([d, i, j]); }));
  pairs.sort((a, b) => a[0] - b[0]);
  const ur = new Set(), ue = new Set();
  let h = 0;
  for (const [, i, j] of pairs) if (!ur.has(i) && !ue.has(j)) { ur.add(i); ue.add(j); h++; }
  return h;
}
function fmeasure(ref, est, win) {
  if (!ref.length || !est.length) return 0;
  const h = hits(ref, est, win);
  const p = h / est.length, r = h / ref.length;
  return p + r ? (2 * p * r) / (p + r) : 0;
}
function bounds(segs) { return [segs[0].start, ...segs.map(s => s.end)]; }

const rows = [];
let tAnalysis = 0;
for (const f of pick) {
  const id = f.replace(/\.(wav|mp3)$/, '');
  const rec = meta[id];
  if (!rec) continue;
  const pcm = decode(f);
  const dur = pcm.length / 44100;
  const gt = gtSegments(rec).filter(s => s.end > s.start);
  let est;
  const t0 = performance.now();
  if (runOld) {
    const bpmEst = lib.detectBpmFromChannelData(pcm, 44100);
    const bpm = bpmEst?.bpm;
    const origin = bpm ? lib.detectGridOriginSec(pcm, 44100, bpm) : 0;
    const a = lib.buildLocalEnergyArrangement(lib.calcRmsEnvelope(pcm, 180), dur, bpm ? { bpm, gridOriginSec: origin, confidence: bpmEst.confidence } : null);
    est = a.sections.map(s => ({ start: s.startTimeSec, end: s.endTimeSec, label: s.type }));
  } else {
    const r = lib.analyzeStructure(pcm, 44100, params);
    est = r.sections.map((s, i) => ({ start: s.startTimeSec, end: s.endTimeSec, label: s.type, g: r.groups[i] }));
    if (verbose) console.log(id, 'bpm', r.bpm, 'conf', r.gridConfidence.toFixed(2), est.map(s => `${s.start.toFixed(1)}${s.label[0]}${s.g}`).join(' '));
  }
  tAnalysis += performance.now() - t0;
  const rb = bounds(gt), eb = bounds(est);
  const inner = a => a.slice(1, -1);
  rows.push({
    id,
    hr05: fmeasure(rb, eb, 0.5),
    hr3: fmeasure(rb, eb, 3),
    hr05t: fmeasure(inner(rb), inner(eb), 0.5),
    hr3t: fmeasure(inner(rb), inner(eb), 3),
    nRef: gt.length, nEst: est.length,
  });
  if (verbose) console.log('   GT', gt.map(s => `${s.start.toFixed(1)}${s.label.slice(0, 3)}`).join(' '));
}
const mean = k => rows.reduce((s, r) => s + r[k], 0) / Math.max(1, rows.length);
const out = {
  split, old: runOld, n: rows.length,
  'HR.5F': mean('hr05').toFixed(3), 'HR3F': mean('hr3').toFixed(3),
  'HR.5F(trim)': mean('hr05t').toFixed(3), 'HR3F(trim)': mean('hr3t').toFixed(3),
  sectionsRef: mean('nRef').toFixed(1), sectionsEst: mean('nEst').toFixed(1),
  msPerSong: Math.round(tAnalysis / Math.max(1, rows.length)),
};
console.log(JSON.stringify(out));
