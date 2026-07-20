// public/audio/recorder-worklet.js
class RecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const left = input[0];
    const right = input[1];

    if (left) {
      let monoBuffer;

      // If a stereo or dual-mono input exists, mix channels to avoid channel dropouts
      if (right && right.length === left.length) {
        monoBuffer = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) {
          monoBuffer[i] = (left[i] + right[i]) / 2;
        }
      } else {
        // Fallback for native mono hardware
        monoBuffer = new Float32Array(left);
      }

      // Ship out the isolated mono buffer safely to the background worker
      this.port.postMessage({
        command: 'audioData',
        buffer: monoBuffer
      });
    }

    return true;
  }
}

registerProcessor('recorder-worklet', RecorderWorklet);
