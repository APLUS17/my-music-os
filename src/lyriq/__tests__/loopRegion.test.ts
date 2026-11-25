// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderLoopRegion } from '../utils/mixer';

const SR = 8000;

/** A slow sawtooth: the value tells where in the file a sample came from, and a naive loop seam is a big jump. */
function saw(seconds: number, periodSec = 1.7): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = (((i / SR) % periodSec) / periodSec - 0.5) * 0.9;
  return out;
}
const maxStep = (x: Float32Array) => {
  let m = 0;
  for (let i = 1; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - x[i - 1]));
  return m;
};

describe('renderLoopRegion', () => {
  it('cuts exactly the requested section', () => {
    const src = saw(10);
    const [out] = renderLoopRegion([src], SR, 2, 6)!;
    expect(out.length).toBe(4 * SR);
    // Outside the cross-faded tail the samples are the original ones.
    expect(out[0]).toBe(src[2 * SR]);
    expect(out[SR]).toBe(src[3 * SR]);
  });

  it('makes the wrap as smooth as the song itself when there is audio before the start', () => {
    const src = saw(10);
    const [out] = renderLoopRegion([src], SR, 2, 6)!;
    // The raw seam (end of section into its start) is a full-scale jump on this signal.
    const rawJump = Math.abs(src[6 * SR - 1] - src[2 * SR]);
    expect(rawJump).toBeGreaterThan(0.3);
    // After the cross-fade, the step from the last sample to the first is a normal per-sample step.
    const wrapStep = Math.abs(out[out.length - 1] - out[0]);
    const normal = maxStep(src.subarray(0, 4 * SR));
    expect(wrapStep).toBeLessThanOrEqual(normal * 1.05);
    // And nothing inside the tail jumps either.
    expect(maxStep(out)).toBeLessThanOrEqual(normal * 1.5);
  });

  it('keeps the section start intact (the downbeat is not softened)', () => {
    const src = saw(10);
    const [out] = renderLoopRegion([src], SR, 2, 6)!;
    for (let i = 0; i < 200; i++) expect(out[i]).toBe(src[2 * SR + i]);
  });

  it('fades both sides of the seam at the very start of a file, where there is no lead-in', () => {
    const src = new Float32Array(SR * 4).fill(0.5);
    const [out] = renderLoopRegion([src], SR, 0, 2)!;
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBeLessThan(0.05);
    expect(out[Math.floor(out.length / 2)]).toBe(0.5);
    expect(maxStep(out)).toBeLessThan(0.1);
  });

  it('handles every channel and never modifies the input', () => {
    const l = saw(6), r = saw(6, 1.3);
    const copyL = l.slice(), copyR = r.slice();
    const out = renderLoopRegion([l, r], SR, 1, 4)!;
    expect(out).toHaveLength(2);
    expect(out[0]).not.toBe(l);
    expect(Array.from(l)).toEqual(Array.from(copyL));
    expect(Array.from(r)).toEqual(Array.from(copyR));
  });

  it('clamps a section that runs past the end of the file', () => {
    const src = saw(5);
    const [out] = renderLoopRegion([src], SR, 3, 9)!;
    expect(out.length).toBe(2 * SR);
  });

  it('refuses sections too short to loop, and empty input', () => {
    expect(renderLoopRegion([saw(5)], SR, 1, 1.01)).toBeNull();
    expect(renderLoopRegion([], SR, 0, 1)).toBeNull();
  });
});
