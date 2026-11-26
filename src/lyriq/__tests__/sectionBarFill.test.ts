import { describe, it, expect } from 'vitest';
import { sectionBarFill, getSectionColorPalette } from '../components/MasterPlaybackDock';

describe('sectionBarFill', () => {
  it('gives each section type its own colour', () => {
    expect(sectionBarFill('verse', false, true)).toBe(getSectionColorPalette('verse').translucent);
    expect(sectionBarFill('chorus', false, true)).toBe(getSectionColorPalette('chorus').translucent);
    expect(sectionBarFill('verse', false, true)).not.toBe(sectionBarFill('chorus', false, true));
  });
  it('makes the playing section brightest and upcoming bars dimmer', () => {
    const p = getSectionColorPalette('hook');
    expect(sectionBarFill('hook', true, true)).toBe(p.solid);
    expect(sectionBarFill('hook', true, false)).toBe(p.translucent);
    expect(sectionBarFill('hook', false, false)).toBe(p.dim);
  });
});
