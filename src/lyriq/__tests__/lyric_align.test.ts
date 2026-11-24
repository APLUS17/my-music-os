// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import type { SttPhrase } from '../types';
import { vocalEnvelope, mapVocal, alignLinesToVocal, applyWrittenLyrics, timeTakeLyrics, writtenLyricLines } from '../utils/lyricAlign';

const RATE = 16000;

/** A fake vocal take: quiet room noise, with "sung" stretches where given. */
function fakeTake(durationSec: number, sung: Array<[number, number]>, opts: { dipsAt?: number[] } = {}): Float32Array {
  const out = new Float32Array(Math.round(durationSec * RATE));
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < out.length; i++) out[i] = rnd() * 0.002; // ~ -54 dBFS room tone
  for (const [a, b] of sung) {
    for (let i = Math.round(a * RATE); i < Math.round(b * RATE) && i < out.length; i++) {
      const t = i / RATE;
      // Word-like wobble in level, never fully silent inside the phrase.
      const wobble = 0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 3));
      let level = 0.3 * wobble;
      for (const d of opts.dipsAt ?? []) if (Math.abs(t - d) < 0.06) level = 0.006; // a quick breath
      out[i] += level * Math.sin(2 * Math.PI * 220 * t);
    }
  }
  return out;
}

const TRUE_STARTS = [0.5, 3.2, 6.0, 8.7];
const SUNG: Array<[number, number]> = [[0.5, 2.6], [3.2, 5.4], [6.0, 8.1], [8.7, 10.6]];
const TEXT = ['the night is bright and the light is right', 'we run the city till the morning comes', 'hands up high we never coming down', 'say it loud and let the people know'];

const vocalOf = (samples: Float32Array) => mapVocal(vocalEnvelope(samples, RATE));
const linesAt = (starts: number[], len = 1.8): SttPhrase[] => starts.map((s, i) => ({ text: TEXT[i], startSec: s, endSec: s + len }));
const near = (actual: number[], expected: number[], tol: number) =>
  actual.forEach((a, i) => assert.ok(Math.abs(a - expected[i]) <= tol, `line ${i}: ${a} vs ${expected[i]} (±${tol})`));

test('finds where singing starts', () => {
  const v = vocalOf(fakeTake(12, SUNG));
  assert.equal(v.regions.length, 4);
  near(v.regions.map(r => r.start), TRUE_STARTS, 0.03);
  near(v.regions.map(r => r.end), SUNG.map(s => s[1]), 0.05);
});

test('late live-style timing (+0.9s, uneven) snaps back onto the vocal', () => {
  const v = vocalOf(fakeTake(12, SUNG));
  const late = linesAt([1.35, 4.2, 6.85, 9.65]);
  const out = alignLinesToVocal(late, v, 12);
  near(out.map(l => l.startSec), TRUE_STARTS, 0.04);
});

test('model timestamps that drift and run late are corrected', () => {
  const v = vocalOf(fakeTake(12, SUNG));
  const drift = linesAt(TRUE_STARTS.map(t => t * 1.04 + 0.5));
  const out = alignLinesToVocal(drift, v, 12);
  near(out.map(l => l.startSec), TRUE_STARTS, 0.04);
});

test('lines end when the voice stops, not when the next line starts', () => {
  const v = vocalOf(fakeTake(12, SUNG));
  const out = alignLinesToVocal(linesAt(TRUE_STARTS), v, 12);
  near(out.map(l => l.endSec), SUNG.map(s => s[1]), 0.06);
});

test('a breath inside continuous singing still marks a new line', () => {
  // One unbroken phrase from 0.5 to 6.0, with a quick breath at 3.2.
  const samples = fakeTake(7, [[0.5, 6.0]], { dipsAt: [3.14] });
  const v = vocalOf(samples);
  assert.equal(v.regions.length, 1);
  const out = alignLinesToVocal(linesAt([0.7, 3.6]), v, 7);
  near(out.map(l => l.startSec), [0.5, 3.2], 0.06);
});

test('without a clear vocal, timing is only cleaned up', () => {
  const flat = new Float32Array(RATE * 5).fill(0.1);
  const v = vocalOf(flat);
  assert.equal(v.entries.length, 0);
  const out = alignLinesToVocal([{ text: 'b', startSec: 2, endSec: 3 }, { text: 'a', startSec: 1, endSec: 9 }], v, 5);
  assert.deepEqual(out.map(l => l.text), ['a', 'b']);
  assert.equal(out[0].startSec, 1);
  assert.ok(out[0].endSec <= 2, 'lines never overlap');
});

test('times past the end of the take are pulled inside it', () => {
  const out = alignLinesToVocal([{ text: 'x', startSec: 30, endSec: 32 }], null, 10);
  assert.ok(out[0].startSec <= 10 && out[0].endSec <= 10);
});

test('lines keep their order and never overlap', () => {
  const v = vocalOf(fakeTake(12, SUNG));
  const messy = linesAt([0.6, 0.65, 6.1, 6.05]);
  const out = alignLinesToVocal(messy, v, 12);
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i].startSec >= out[i - 1].startSec + 0.29, 'ordered with a minimum gap');
    assert.ok(out[i - 1].endSec <= out[i].startSec + 1e-9, 'no overlap');
  }
});

test('written lyrics replace misheard words and keep their line breaks', () => {
  const heard: SttPhrase[] = [
    { text: 'the nite is bright and the lite is right', startSec: 0.5, endSec: 2.6 },
    { text: 'we run the city til the mornin comes', startSec: 3.2, endSec: 5.4 },
  ];
  const written = '[Verse]\nThe night is bright and the light is right\nWe run the city till the morning comes\nThis line was never sung';
  const out = applyWrittenLyrics(heard, written)!;
  assert.ok(out);
  assert.deepEqual(out.map(l => l.text), ['The night is bright and the light is right', 'We run the city till the morning comes']);
  near(out.map(l => l.startSec), [0.5, 3.2], 0.001);
});

test('written lyrics that do not match the take are ignored', () => {
  const heard: SttPhrase[] = [{ text: 'we run the city till the morning comes', startSec: 0, endSec: 2 }];
  assert.equal(applyWrittenLyrics(heard, 'completely different words about the ocean\nand some boats'), null);
});

test('headings are not treated as lyrics', () => {
  assert.deepEqual(writtenLyricLines('[Chorus]\nVerse 2:\nreal line\n\nChorus\nanother'), ['real line', 'another']);
});

test('full pipeline: late transcription + written lyrics -> written lines on the real vocal', () => {
  const v = vocalOf(fakeTake(12, SUNG));
  const late = linesAt([1.3, 4.1, 6.9, 9.5]).map(l => ({ ...l, text: l.text.replace('night', 'nite') }));
  const out = timeTakeLyrics(late, v, 12, TEXT.map(t => t[0].toUpperCase() + t.slice(1)).join('\n'));
  assert.equal(out[0].text, 'The night is bright and the light is right');
  near(out.map(l => l.startSec), TRUE_STARTS, 0.04);
});

test('word gaps inside lines do not steal the line start (16 lines, noisy timing)', () => {
  // Each line: 5 words of 0.3s with 0.18s silences between them; 0.8s rest between lines.
  const sung: Array<[number, number]> = [];
  const starts: number[] = [];
  let t = 0.4;
  for (let line = 0; line < 16; line++) {
    starts.push(t);
    for (let w = 0; w < 5; w++) { sung.push([t, t + 0.3]); t += 0.48; }
    t += 0.8 - 0.18;
  }
  const v = vocalOf(fakeTake(t + 1, sung));
  let seed = 3;
  const jitter = () => ((seed = (seed * 48271) % 2147483647) / 2147483647 - 0.5) * 0.7; // ±0.35s
  const guessed = starts.map((s, i) => ({ text: `line ${i}`, startSec: s + 0.6 + jitter(), endSec: s + 2.5 }));
  const out = alignLinesToVocal(guessed, v, t + 1);
  near(out.map(l => l.startSec), starts, 0.04);
});
