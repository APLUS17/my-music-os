// The playback Vocal FX processing hook — applied to a played-back take
// from the standalone FXPanel mixer — was cut in the essence redesign
// along with FXPanel itself. See ESSENCE_REDESIGN.md.
//
// `createReverbImpulse` survives as a shared utility: RecorderDrawer's
// live-monitoring reverb (a touch of space in your headphones while you
// sing a take, meant to help the performance, not polish it afterward)
// still uses it.

// Cached impulse response to avoid recreation
const impulseCache = new Map<string, AudioBuffer>();

export function createReverbImpulse(context: AudioContext, duration: number, decay: number) {
  const key = `${context.sampleRate}-${duration}-${decay}`;
  if (impulseCache.has(key)) {
    return impulseCache.get(key)!;
  }

  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);

  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const val = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    left[i] = val;
    right[i] = val;
  }

  impulseCache.set(key, impulse);
  return impulse;
}
