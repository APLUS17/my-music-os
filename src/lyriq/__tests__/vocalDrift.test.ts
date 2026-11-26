// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { VocalDriftTracker } from '../utils/vocalDrift';

const FRAME = 1 / 60;

/** Runs the tracker over `seconds` of frames; returns the times a correction was asked for. */
function run(t: VocalDriftTracker, seconds: number, driftAt: (time: number, i: number) => number, from = 0) {
  const corrections: { at: number; offset: number }[] = [];
  const n = Math.round(seconds / FRAME);
  for (let i = 0; i < n; i++) {
    const now = from + i * FRAME;
    const c = t.check(now, driftAt(now, i));
    if (c !== null) corrections.push({ at: now, offset: c });
  }
  return corrections;
}

/** iOS-like song clock: the beat position is reported ~120 ms late and only updates every ~50 ms. */
function safariDrift(time: number): number {
  const reported = Math.floor((time - 0.12) / 0.05) * 0.05;
  return time - reported;
}

test('steady Safari offset and coarse steps never restart the vocal', () => {
  const t = new VocalDriftTracker();
  const corrections = run(t, 30, safariDrift);
  assert.equal(corrections.length, 0);
  const learned = t.learnedOffsetSec!;
  assert.ok(learned > 0.1 && learned < 0.2, `learned ${learned}`);
});

test('the old 80 ms rule would have fired on that same clock', () => {
  let fires = 0;
  const n = Math.round(30 / FRAME);
  for (let i = 0; i < n; i++) if (Math.abs(safariDrift(i * FRAME)) > 0.08) fires++;
  assert.ok(fires > 100, `fires ${fires}`);
});

test('sustained drift is corrected once, back to the learned offset', () => {
  const t = new VocalDriftTracker();
  run(t, 2, safariDrift);
  // The beat element stalls: from now on the vocal is 400 ms further ahead.
  const corrections = run(t, 1.2, (time) => safariDrift(time) + 0.4, 2);
  assert.equal(corrections.length, 1);
  assert.ok(Math.abs(corrections[0].offset - t.learnedOffsetSec!) < 1e-9);
  // Needed to stay out for the sustain time first.
  assert.ok(corrections[0].at - 2 >= 0.3 - 1e-9);
});

test('a short spike is ignored', () => {
  const t = new VocalDriftTracker();
  run(t, 2, safariDrift);
  const corrections = run(t, 3, (time) => safariDrift(time) + (time < 2.15 ? 0.5 : 0), 2);
  assert.equal(corrections.length, 0);
});

test('corrections are at least 1.5 s apart', () => {
  const t = new VocalDriftTracker();
  run(t, 2, () => 0);
  // Drift that never goes away (correction does not help in this fake): fires at most every 1.5 s.
  const corrections = run(t, 4.5, () => 0.5, 2);
  assert.ok(corrections.length >= 2 && corrections.length <= 3, `count ${corrections.length}`);
  for (let i = 1; i < corrections.length; i++) {
    assert.ok(corrections[i].at - corrections[i - 1].at >= 1.5 - 1e-9);
  }
});

test('a gross desync right after a start is corrected straight away', () => {
  const t = new VocalDriftTracker();
  const corrections = run(t, 0.2, () => 1.2);
  assert.equal(corrections.length, 1);
  assert.equal(corrections[0].offset, 0);
});

test('reset relearns the offset (after a seek or loop wrap)', () => {
  const t = new VocalDriftTracker();
  run(t, 2, () => 0.15);
  assert.ok(Math.abs(t.learnedOffsetSec! - 0.15) < 1e-9);
  t.reset();
  assert.equal(t.learnedOffsetSec, null);
  run(t, 2, () => 0.02, 10);
  assert.ok(Math.abs(t.learnedOffsetSec! - 0.02) < 1e-9);
});
