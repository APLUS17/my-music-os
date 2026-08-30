// The standalone Vocal FX mixer panel (reverb/delay/EQ/compression sliders
// over a played-back take) and its Spectral EQ visualizer were cut in the
// essence redesign — a memo app doesn't need a mixing console. See
// ESSENCE_REDESIGN.md.
//
// This file survives as the shared settings shape for RecorderDrawer's
// live-monitoring effects (hearing a touch of reverb in your headphones
// while you sing a take) — that one stayed, because it's about capturing
// a better performance, not post-processing one.

export interface FXSettings {
  space: number;
  echo: number;
  punch: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
}

export const defaultFXSettings: FXSettings = {
  space: 0,
  echo: 0,
  punch: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
};
