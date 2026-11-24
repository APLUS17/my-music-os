// Beat sectioning in the browser: decode -> worker -> sections.
// Replaces the server call to /api/analyze-beat. See utils/structure/README.md.

import type { BeatAnalysis } from '../types';
import { decodeToMono } from '../utils/audio';
import { analyzeStructure, type StructureResult } from '../utils/structure';
import { ANALYSIS_SR, resampleTo } from '../utils/structure/features';

/** Bump when the algorithm changes, so beats analysed by an older version are redone. */
export const STRUCTURE_VERSION = 2;

const WORKER_TIMEOUT_MS = 45_000;

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, { resolve: (r: StructureResult) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../utils/structure/structure.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: StructureResult; error?: string }>) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      clearTimeout(job.timer);
      if (e.data.result) job.resolve(e.data.result);
      else job.reject(new Error(e.data.error || 'Structure analysis failed'));
    };
    worker.onerror = ev => {
      console.warn('Structure worker failed; analysing on the main thread instead.', ev.message);
      workerBroken = true;
      worker?.terminate();
      worker = null;
      for (const [id, job] of pending) {
        clearTimeout(job.timer);
        job.reject(new Error('worker-failed'));
        pending.delete(id);
      }
    };
    return worker;
  } catch (err) {
    console.warn('Could not start the structure worker:', err);
    workerBroken = true;
    return null;
  }
}

function runInWorker(w: Worker, pcm: Float32Array, hintBpm?: number): Promise<StructureResult> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Structure analysis timed out'));
    }, WORKER_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, pcm, sampleRate: ANALYSIS_SR, hintBpm }, [pcm.buffer]);
  });
}

/** Sections, tempo and downbeat grid for a beat file. Null when the file can't be decoded. */
export async function analyzeBeatStructure(file: Blob, hintBpm?: number): Promise<StructureResult | null> {
  const decoded = await decodeToMono(file);
  if (!decoded) return null;
  // Resample here: a quarter of the data to hand to the worker.
  const pcm = resampleTo(decoded.mono, decoded.sampleRate, ANALYSIS_SR);
  const copy = pcm === decoded.mono ? pcm.slice() : pcm;
  const w = getWorker();
  if (w) {
    try {
      return await runInWorker(w, copy, hintBpm);
    } catch (err) {
      if (!(err instanceof Error) || err.message !== 'worker-failed') throw err;
      // Fall through: the worker could not start (e.g. a strict CSP); run inline once.
      return analyzeStructure(resampleTo(decoded.mono, decoded.sampleRate, ANALYSIS_SR), ANALYSIS_SR, { hintBpm });
    }
  }
  return analyzeStructure(copy, ANALYSIS_SR, { hintBpm });
}

/** The app's cached-arrangement shape for a structure result. */
export function toBeatAnalysis(r: StructureResult): BeatAnalysis {
  return {
    source: 'local-structure',
    version: STRUCTURE_VERSION,
    estimatedBpm: r.bpm,
    gridOriginSec: r.gridOriginSec,
    sections: r.sections,
    groups: r.groups,
  };
}

/** True when a cached arrangement is final: no need to analyse the beat again. */
export function isFinalArrangement(a: BeatAnalysis | undefined | null): boolean {
  if (!a?.sections?.length) return false;
  return a.source === 'ai' || (a.source === 'local-structure' && a.version === STRUCTURE_VERSION);
}
