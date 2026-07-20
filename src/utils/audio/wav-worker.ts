// Background worker file: wav-worker.ts
// Handles buffer accumulation, pre-roll sample discarding, and mono Float-to-16-Bit PCM WAV encoding.

let recBuffers: Float32Array[] = [];
let recLength = 0;
let sampleRate = 44100;

self.onmessage = (e: MessageEvent) => {
  const { command, buffer, rate, samplesToDiscard } = e.data;

  if (command === 'init') {
    sampleRate = rate || 44100;
    recBuffers = [];
    recLength = 0;
  }

  if (command === 'record') {
    // buffer is expected to be a single Float32Array (mono)
    if (buffer instanceof Float32Array) {
      recBuffers.push(buffer);
      recLength += buffer.length;
    }
  }

  if (command === 'exportWAV') {
    let merged = mergeBuffers(recBuffers, recLength);

    // Dynamic pre-roll sample discarding for sample-accurate timeline alignment
    if (samplesToDiscard && samplesToDiscard > 0) {
      const discardCount = Math.min(samplesToDiscard, merged.length);
      merged = merged.subarray(discardCount);
    }

    const dataview = encodeWAV(merged, sampleRate);
    const audioBlob = new Blob([dataview.buffer as ArrayBuffer], { type: 'audio/wav' });

    self.postMessage({ command: 'wavReady', blob: audioBlob });
  }
};

function mergeBuffers(buffers: Float32Array[], length: number): Float32Array {
  const result = new Float32Array(length);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

function encodeWAV(samples: Float32Array, rate: number): DataView {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, rate, true);
  /* byte rate (rate * 1 channel * 2 bytes per sample) */
  view.setUint32(28, rate * 2, true);
  /* block align (1 channel * 2 bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Float to 16-Bit signed PCM conversion
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return view;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
