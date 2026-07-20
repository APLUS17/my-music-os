// src/utils/audio/recorder-worklet.ts
// This TypeScript file is a type-safe reference for the AudioWorklet compiled script.
// The actual runtime worklet is loaded from /public/audio/recorder-worklet.js

export interface RecorderWorkletMessage {
  command: 'audioData';
  buffer: Float32Array;
}

// Dummy export to keep TypeScript happy and modular
export const RECORDER_WORKLET_NAME = 'recorder-worklet';
