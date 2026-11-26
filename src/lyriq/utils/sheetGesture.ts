/**
 * Swipe-down-to-close for full-screen sheets (Apple Music style).
 * Pure so it can be unit-tested; the component feeds it Framer Motion's drag info.
 */

/** Pull distance (px) past which letting go closes the sheet. */
export const SHEET_DISMISS_DISTANCE_PX = 80;
/** Downward flick speed (px/s) that closes the sheet even on a short pull. */
export const SHEET_DISMISS_VELOCITY_PX_S = 500;

export function shouldDismissSheet(offsetY: number, velocityY: number): boolean {
  if (!Number.isFinite(offsetY) || !Number.isFinite(velocityY)) return false;
  // A fast flick only counts if it is heading down and the sheet actually moved down.
  if (velocityY >= SHEET_DISMISS_VELOCITY_PX_S && offsetY > 0) return true;
  // A long pull closes, unless the finger is clearly flicking back up.
  return offsetY >= SHEET_DISMISS_DISTANCE_PX && velocityY > -SHEET_DISMISS_VELOCITY_PX_S;
}

/** Only start a sheet drag from empty header space, never from a button or input inside it. */
export function isSheetDragStartTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return true;
  return (target as Element).closest('button, a, input, textarea, select, [role="slider"]') === null;
}
