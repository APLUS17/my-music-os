/// <reference lib="webworker" />
// Runs song structure analysis off the main thread (about 1 s per song on a laptop,
// a few seconds on a phone).

import { analyzeStructure } from './index';

interface Request {
  id: number;
  pcm: Float32Array;
  sampleRate: number;
  hintBpm?: number;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, pcm, sampleRate, hintBpm } = e.data;
  try {
    const result = analyzeStructure(pcm, sampleRate, { hintBpm });
    (self as unknown as Worker).postMessage({ id, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
