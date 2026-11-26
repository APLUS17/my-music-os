import { describe, it, expect } from 'vitest';
import { shouldDismissSheet, isSheetDragStartTarget, SHEET_DISMISS_DISTANCE_PX } from '../utils/sheetGesture';

describe('shouldDismissSheet', () => {
  it('closes on a long pull', () => {
    expect(shouldDismissSheet(SHEET_DISMISS_DISTANCE_PX, 0)).toBe(true);
    expect(shouldDismissSheet(300, 100)).toBe(true);
  });
  it('springs back on a short slow pull', () => {
    expect(shouldDismissSheet(40, 100)).toBe(false);
    expect(shouldDismissSheet(0, 0)).toBe(false);
  });
  it('closes on a fast downward flick even if short', () => {
    expect(shouldDismissSheet(20, 900)).toBe(true);
  });
  it('does not close when flicking back up', () => {
    expect(shouldDismissSheet(120, -900)).toBe(false);
    expect(shouldDismissSheet(-10, 900)).toBe(false);
  });
  it('ignores bad numbers', () => {
    expect(shouldDismissSheet(NaN, 0)).toBe(false);
    expect(shouldDismissSheet(100, Infinity)).toBe(false);
  });
});

describe('isSheetDragStartTarget', () => {
  it('allows empty header space and rejects controls', () => {
    const header = document.createElement('header');
    const label = document.createElement('span');
    const button = document.createElement('button');
    const icon = document.createElement('svg');
    button.appendChild(icon);
    header.append(label, button);
    expect(isSheetDragStartTarget(label)).toBe(true);
    expect(isSheetDragStartTarget(header)).toBe(true);
    expect(isSheetDragStartTarget(button)).toBe(false);
    expect(isSheetDragStartTarget(icon)).toBe(false);
    expect(isSheetDragStartTarget(null)).toBe(true);
  });
});
