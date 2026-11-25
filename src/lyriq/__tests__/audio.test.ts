// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  detectBpmFromChannelData,
  encodeWAV,
  downsampleMono,
  calcWaveformSync,
  pcmToTranscriptionWav,
  computeRecordingAnchorSec,
  pickAnalysisSampleRate,
  buildAnalysisWav,
  calcRmsEnvelope,
} from '../utils/audio';

/** Synthetic click track: short decaying bursts on every beat. */
function clickTrack(bpm: number, seconds: number, sampleRate = 22050): Float32Array {
  const out = new Float32Array(Math.floor(seconds * sampleRate));
  const beatSamples = Math.round((60 / bpm) * sampleRate);
  for (let start = 0; start < out.length; start += beatSamples) {
    for (let i = 0; i < 600 && start + i < out.length; i++) {
      out[start + i] = Math.sin(i * 0.4) * Math.exp(-i / 120);
    }
  }
  return out;
}

for (const bpm of [90, 100, 120, 128, 140]) {
  test(`detects ${bpm} BPM from a click track within 2 BPM`, () => {
    const est = detectBpmFromChannelData(clickTrack(bpm, 45), 22050);
    assert.ok(est, 'expected an estimate');
    assert.ok(Math.abs(est!.bpm - bpm) <= 2, `got ${est!.bpm} for ${bpm}`);
  });
}

/** Like clickTrack, but every other beat is quieter (kick/snare), which pulls naive detection to half tempo. */
function accentedTrack(bpm: number, seconds: number, weakLevel: number, sampleRate = 22050): Float32Array {
  const out = new Float32Array(Math.floor(seconds * sampleRate));
  const beatSamples = Math.round((60 / bpm) * sampleRate);
  let beat = 0;
  for (let start = 0; start < out.length; start += beatSamples, beat++) {
    const level = beat % 2 === 0 ? 1 : weakLevel;
    for (let i = 0; i < 600 && start + i < out.length; i++) {
      out[start + i] = level * Math.sin(i * 0.4) * Math.exp(-i / 120);
    }
  }
  return out;
}

for (const bpm of [60, 174]) {
  test(`still detects a genuinely ${bpm < 100 ? 'slow' : 'fast'} ${bpm} BPM click track`, () => {
    const est = detectBpmFromChannelData(clickTrack(bpm, 45), 22050);
    assert.ok(est, 'expected an estimate');
    assert.ok(Math.abs(est!.bpm - bpm) <= 2, `got ${est!.bpm} for ${bpm}`);
  });
}

for (const bpm of [140, 150]) {
  test(`reads ${bpm} BPM with alternating accents as ${bpm}, not half tempo`, () => {
    const est = detectBpmFromChannelData(accentedTrack(bpm, 45, 0.5), 22050);
    assert.ok(est, 'expected an estimate');
    assert.ok(Math.abs(est!.bpm - bpm) <= 2, `got ${est!.bpm} for ${bpm}`);
  });
}

test('returns null (not 120) for silence', () => {
  assert.equal(detectBpmFromChannelData(new Float32Array(22050 * 20), 22050), null);
});

test('returns null for audio that is too short', () => {
  assert.equal(detectBpmFromChannelData(clickTrack(120, 2), 22050), null);
});

test('encodeWAV writes a valid 16-bit mono header and clamps samples', async () => {
  const wav = encodeWAV(new Float32Array([0, 0.5, -0.5, 2, -2]), 16000);
  const view = new DataView(await wav.arrayBuffer());
  const tag = (o: number) => String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));
  assert.equal(tag(0), 'RIFF');
  assert.equal(tag(8), 'WAVE');
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(40, true), 10);
  assert.equal(view.getInt16(44 + 6, true), 32767); // clamped from 2
  assert.equal(view.getInt16(44 + 8, true), -32768); // clamped from -2
  assert.equal(wav.size, 44 + 10);
});

test('downsampleMono averages blocks and keeps length proportional', () => {
  const input = new Float32Array(48000).fill(0.5);
  const out = downsampleMono(input, 48000, 16000);
  assert.equal(out.length, 16000);
  assert.ok(out.every(v => Math.abs(v - 0.5) < 1e-6));
});

test('downsampleMono suppresses content above the new Nyquist (no aliasing)', () => {
  // A 7 kHz tone sampled at 48 kHz would alias to 1 kHz if samples were just dropped.
  const n = 48000;
  const tone = new Float32Array(n);
  for (let i = 0; i < n; i++) tone[i] = Math.sin((2 * Math.PI * 7000 * i) / 48000);
  const out = downsampleMono(tone, 48000, 16000);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak < 0.9, `expected attenuation, peak ${peak}`);
});

test('calcWaveformSync returns the requested number of bars within 8..100', () => {
  const data = new Float32Array(10000).map((_, i) => Math.sin(i / 50));
  const bars = calcWaveformSync(data, 48);
  assert.equal(bars.length, 48);
  assert.ok(bars.every(b => b >= 8 && b <= 100));
});

test('pcmToTranscriptionWav produces a 16 kHz mono WAV directly from PCM', async () => {
  const samples = new Float32Array(48000).fill(0.25);
  const wav = pcmToTranscriptionWav(samples, 48000);
  const view = new DataView(await wav.arrayBuffer());
  const tag = (o: number) => String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));
  assert.equal(tag(0), 'RIFF');
  assert.equal(tag(8), 'WAVE');
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(40, true), 16000 * 2);
});

test('computeRecordingAnchorSec subtracts reportedLatencySec plus initial capture buffer when auto latency is enabled', () => {
  const workletChunkSec = 2048 / 48000;
  const anchorWorklet = computeRecordingAnchorSec({
    firstChunkTimelineSec: 10.1,
    targetStartSec: 10.0,
    manualLatencyMs: null,
    reportedLatencySec: 0.025,
    firstChunkBufferSec: workletChunkSec,
  });
  assert.ok(Math.abs(anchorWorklet - (10.1 - 0.025 - workletChunkSec)) < 1e-9);

  const spChunkSec = 4096 / 48000;
  const anchorSp = computeRecordingAnchorSec({
    firstChunkTimelineSec: 10.15,
    targetStartSec: 10.0,
    manualLatencyMs: null,
    reportedLatencySec: 0.02,
    firstChunkBufferSec: spChunkSec,
  });
  assert.ok(Math.abs(anchorSp - (10.15 - 0.02 - spChunkSec)) < 1e-9);

  // Manual latency overrides automatic calculation.
  const anchorManual = computeRecordingAnchorSec({
    firstChunkTimelineSec: 10.1,
    targetStartSec: 10.0,
    manualLatencyMs: 80,
    reportedLatencySec: 0.025,
    firstChunkBufferSec: workletChunkSec,
  });
  assert.ok(Math.abs(anchorManual - (10.1 - 0.08)) < 1e-9);

  // Never goes negative near 0:00.
  const clampedZero = computeRecordingAnchorSec({
    firstChunkTimelineSec: 0.02,
    targetStartSec: 0,
    manualLatencyMs: null,
    reportedLatencySec: 0.03,
    firstChunkBufferSec: workletChunkSec,
  });
  assert.equal(clampedZero, 0);
});

test('pickAnalysisSampleRate snaps to standard 16000 Hz or 8000 Hz instead of odd numbers', () => {
  assert.equal(pickAnalysisSampleRate(120, 44100), 16000);
  assert.equal(pickAnalysisSampleRate(187, 48000), 16000);
  // Tracks longer than ~3m07s must snap cleanly to 8000 Hz (never 11428 Hz or 6500 Hz).
  assert.equal(pickAnalysisSampleRate(220, 44100), 8000);
  assert.equal(pickAnalysisSampleRate(360, 48000), 8000);
  // Never upsamples low-rate source audio.
  assert.equal(pickAnalysisSampleRate(120, 11025), 11025);
});

test('buildAnalysisWav writes a standard-rate WAV header for long tracks', async () => {
  // 210s track at 16000 Hz source -> snaps to 8000 Hz standard WAV
  const samples = new Float32Array(210 * 16000);
  const { blob, sampleRate } = buildAnalysisWav(samples, 16000);
  assert.equal(sampleRate, 8000);
  const view = new DataView(await blob.arrayBuffer());
  assert.equal(view.getUint32(24, true), 8000);
});

test('calcRmsEnvelope reflects amplitude contrasts accurately', () => {
  const quiet = new Float32Array(1000).fill(0.1);
  const loud = new Float32Array(1000).fill(0.8);
  const combined = new Float32Array(2000);
  combined.set(quiet, 0);
  combined.set(loud, 1000);
  const env = calcRmsEnvelope(combined, 4);
  assert.equal(env.length, 4);
  assert.ok(env[0] < 0.15 && env[1] < 0.15);
  assert.ok(env[2] > 0.75 && env[3] > 0.75);
});
