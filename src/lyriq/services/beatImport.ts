import type { BeatAnalysis, ImportedBeat } from '../types';
import { extractAudioWaveform, encodeWAV, calcWaveformSync } from '../utils/audio';
import { buildLocalEnergyArrangement } from '../utils/arrangement';
import { beatBlobKey, blobUrlRegistry } from '../utils/storage';

const MAX_BEAT_BYTES = 200 * 1024 * 1024;
const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|flac|ogg|aif|aiff)$/i;

/**
 * Reads "120bpm" / "bpm 120" / "132.00bpm" / "128.5 bpm" from a file name (sample packs write
 * decimals). Bare numbers are ignored: too many false positives.
 */
export function parseBpmFromFilename(name: string): number | undefined {
  const m = name.match(/(\d{2,3}(?:[.,]\d{1,2})?)\s*bpm/i) || name.match(/bpm[\s_\-:]*(\d{2,3}(?:[.,]\d{1,2})?)/i);
  const n = m ? Math.round(parseFloat(m[1].replace(',', '.')) * 100) / 100 : NaN;
  return n >= 40 && n <= 240 ? n : undefined;
}

/** Reads keys like "F#m", "Bb min" or "C maj". The quality is required so words like "A" don't match. */
function parseKeyFromFilename(name: string): string | undefined {
  const m = name.match(/(?:^|[\s_\-(\[])([A-G][#b]?)[\s_]?(maj(?:or)?|min(?:or)?|m)(?=$|[\s_\-)\].])/);
  return m ? `${m[1]}${m[2]}` : undefined;
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXT_RE.test(file.name);
}

export function validateBeatFile(file: File): string | null {
  if (!isAudioFile(file)) return 'That file does not look like audio. Try MP3, WAV or M4A.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_BEAT_BYTES) return 'That file is over 200 MB. Export a shorter or compressed version.';
  return null;
}

/**
 * Returns the beat's cached arrangement when present, or deterministically
 * computes a bar-snapped local RMS energy arrangement from its waveform/grid.
 */
export function resolveLocalBeatArrangement(beat: ImportedBeat, fallbackBpm = 120): BeatAnalysis | null {
  if (beat.arrangement?.sections?.length) return beat.arrangement;
  if (!(beat.duration > 0)) return null;
  const resolvedBpm =
    beat.bpm && beat.bpm >= 40 && beat.bpm <= 240
      ? beat.bpm
      : fallbackBpm >= 40 && fallbackBpm <= 240
        ? fallbackBpm
        : 120;
  const local = buildLocalEnergyArrangement(beat.waveform, beat.duration, {
    bpm: resolvedBpm,
    gridOriginSec: beat.gridOriginSec ?? 0,
    confidence: beat.bpmConfidence ?? 1,
  });
  return local.sections.length > 0 ? local : null;
}

export function createImmediateBeat(file: File, fallbackBpm: number): {
  beat: ImportedBeat;
  nameBpm?: number;
} {
  const id = `beat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const objectUrl = blobUrlRegistry.acquire(beatBlobKey(id), file);
  const name = file.name.replace(/\.[^/.]+$/, '');
  const nameBpm = parseBpmFromFilename(file.name);
  const nameKey = parseKeyFromFilename(file.name);

  return {
    nameBpm,
    beat: {
      id,
      name,
      audioUrl: objectUrl,
      audioBlob: file,
      duration: 0,
      waveform: [],
      bpm: nameBpm ?? fallbackBpm,
      bpmConfidence: nameBpm ? 1 : undefined,
      bpmSource: nameBpm ? 'filename' : undefined,
      gridOriginSec: 0,
      key: nameKey,
      mimeType: file.type || 'audio/mpeg',
      createdAt: Date.now(),
    },
  };
}

export interface DecodedBeatResult {
  beat: ImportedBeat;
  bpmSource: 'from filename' | 'detected' | 'unchanged';
  bpmPreference?: number;
  analysisWav?: Blob;
  fallbackArrangement?: BeatAnalysis;
}

export async function decodeBeatFile(
  file: File,
  immediate: ImportedBeat,
  nameBpm: number | undefined,
  fallbackBpm: number
): Promise<DecodedBeatResult | null> {
  const analysis = await extractAudioWaveform(file, 90, nameBpm);
  if (!analysis.decoded && analysis.duration === 0) {
    return null;
  }

  const detectedBpm = analysis.detectedBpm?.bpm;
  const beatBpm = nameBpm ?? detectedBpm ?? fallbackBpm;
  const bpmSource: DecodedBeatResult['bpmSource'] = nameBpm ? 'from filename' : detectedBpm ? 'detected' : 'unchanged';
  const storedBpmSource: ImportedBeat['bpmSource'] = nameBpm ? 'filename' : detectedBpm ? 'detected' : undefined;
  const bpmConfidence = nameBpm ? 1 : analysis.detectedBpm?.confidence;
  const gridOriginSec = analysis.gridOriginSec ?? 0;

  const localArrangement: BeatAnalysis | undefined =
    analysis.fallbackArrangement?.sections?.length
      ? analysis.fallbackArrangement
      : analysis.duration > 0
        ? buildLocalEnergyArrangement(analysis.waveform, analysis.duration, {
            bpm: beatBpm,
            gridOriginSec,
            confidence: bpmConfidence ?? 1,
          })
        : undefined;
  const usableArrangement = localArrangement?.sections?.length ? localArrangement : undefined;

  return {
    beat: {
      ...immediate,
      duration: analysis.duration,
      waveform: analysis.waveform,
      bpm: beatBpm,
      bpmConfidence,
      bpmSource: storedBpmSource,
      gridOriginSec,
      arrangement: usableArrangement,
    },
    bpmSource,
    bpmPreference: nameBpm ?? detectedBpm,
    analysisWav: analysis.analysisWav,
    fallbackArrangement: usableArrangement,
  };
}

/**
 * Synthesizes 4 lightweight offline studio beats (real WAV Blobs + waveforms)
 * so the Vault can be spun and auditioned immediately offline.
 */
export function createStarterBeats(): ImportedBeat[] {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return [];

  const specs = [
    { id: 'starter-beat-1', name: 'Night Drive', bpm: 92, key: 'Fm', rootHz: 87.31, duration: 8 },
    { id: 'starter-beat-2', name: 'Obsidian Tape', bpm: 124, key: 'Cm', rootHz: 65.41, duration: 8 },
    { id: 'starter-beat-3', name: 'Velvet Horizon', bpm: 84, key: 'Am', rootHz: 110.0, duration: 8 },
    { id: 'starter-beat-4', name: 'Solar Flare', bpm: 140, key: 'Gm', rootHz: 98.0, duration: 8 },
  ];

  const sampleRate = 16000;
  const now = Date.now();

  return specs.map((spec, idx) => {
    const totalSamples = spec.duration * sampleRate;
    const pcm = new Float32Array(totalSamples);
    const beatSec = 60 / spec.bpm;
    const stepSec = beatSec / 2;

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const beatIndex = Math.floor(t / beatSec);
      const beatPos = t - beatIndex * beatSec;
      const stepPos = t - Math.floor(t / stepSec) * stepSec;

      const isKick = beatIndex % 2 === 0;
      const kickEnv = isKick ? Math.exp(-beatPos * 14) : 0;
      const kickFreq = 52 + 95 * Math.exp(-beatPos * 32);
      const kick = Math.sin(2 * Math.PI * kickFreq * beatPos) * kickEnv * 0.55;

      const isSnare = beatIndex % 2 === 1;
      const snareEnv = isSnare ? Math.exp(-beatPos * 26) : 0;
      const snareNoise = Math.sin(i * 1.73) * Math.cos(i * 3.17) * snareEnv * 0.28;

      const hatEnv = Math.exp(-stepPos * 55);
      const hat = Math.sin(i * 5.13) * hatEnv * 0.08;

      const pad =
        (Math.sin(2 * Math.PI * spec.rootHz * t) +
          0.6 * Math.sin(2 * Math.PI * spec.rootHz * 1.1892 * t) +
          0.5 * Math.sin(2 * Math.PI * spec.rootHz * 1.4983 * t)) *
        0.12;

      pcm[i] = Math.max(-0.95, Math.min(0.95, kick + snareNoise + hat + pad));
    }

    const blob = encodeWAV(pcm, sampleRate);
    const waveform = calcWaveformSync(pcm, 64);

    return {
      id: spec.id,
      name: spec.name,
      audioUrl: blobUrlRegistry.acquire(beatBlobKey(spec.id), blob),
      audioBlob: blob,
      duration: spec.duration,
      waveform,
      bpm: spec.bpm,
      bpmConfidence: 1,
      bpmSource: 'manual',
      gridOriginSec: 0,
      isStarter: true,
      arrangement: {
        estimatedBpm: spec.bpm,
        gridOriginSec: 0,
        sections: [
          {
            type: 'verse',
            title: 'Loop',
            startTimeSec: 0,
            endTimeSec: spec.duration,
            energy: 'medium',
          },
        ],
      },
      key: spec.key,
      mimeType: 'audio/wav',
      createdAt: now - idx * 60000,
    };
  });
}
