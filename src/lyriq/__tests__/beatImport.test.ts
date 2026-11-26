import { describe, expect, it } from 'vitest';
import { parseBpmFromFilename } from '../services/beatImport';

describe('parseBpmFromFilename', () => {
  it('reads whole BPM values, with or without a space or a leading label', () => {
    expect(parseBpmFromFilename('boom 140bpm.wav')).toBe(140);
    expect(parseBpmFromFilename('Beat_93 BPM_Cm.mp3')).toBe(93);
    expect(parseBpmFromFilename('bpm 120 loop.wav')).toBe(120);
    expect(parseBpmFromFilename('bpm_87.wav')).toBe(87);
  });
  it('reads decimal BPM values written by sample packs (not just the "00" after the dot)', () => {
    expect(parseBpmFromFilename('hadesfromheaven-Roots-Master--132.00bpm-Em-[Clearance Required].wav')).toBe(132);
    expect(parseBpmFromFilename('Loop 128.5 bpm.wav')).toBe(128.5);
    expect(parseBpmFromFilename('loop 98,25bpm.wav')).toBe(98.25);
  });
  it('ignores bare numbers and out-of-range values', () => {
    expect(parseBpmFromFilename('LS.s203 - 158 C Major (@loopscope).wav')).toBeUndefined();
    expect(parseBpmFromFilename('beat 20bpm.wav')).toBeUndefined();
    expect(parseBpmFromFilename('beat 300bpm.wav')).toBeUndefined();
  });
});
