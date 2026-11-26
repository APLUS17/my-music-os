import { describe, it, expect } from 'vitest';
import { getDockHint } from '../components/MasterPlaybackDock';

describe('getDockHint', () => {
  it('points to the lyrics swipe when a take has lyrics to open', () => {
    expect(getDockHint({ isRecording: false, canOpenLyrics: true })).toBe('Swipe up for lyrics');
  });
  it('stays quiet while recording', () => {
    expect(getDockHint({ isRecording: true, canOpenLyrics: true })).toBeNull();
  });
  it('stays quiet with nothing to open', () => {
    expect(getDockHint({ isRecording: false, canOpenLyrics: false })).toBeNull();
  });
});
