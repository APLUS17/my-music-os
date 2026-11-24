export type SectionType = 'none' | 'verse' | 'chorus' | 'bridge' | 'hook' | 'pre-chorus' | 'intro' | 'outro';

/** A transcribed phrase. Times are seconds on the song timeline unless noted otherwise. */
export interface SttPhrase {
  text: string;
  startSec: number;
  endSec: number;
}

export interface LyricLine {
  id: string;
  text: string;
  startSec: number;
  endSec: number;
}

export interface Take {
  id: string;
  name?: string;
  duration: number; // seconds, derived from the captured sample count
  audioUrl?: string; // object URL for playback
  audioBlob?: Blob;
  waveform: number[]; // relative heights of waveform bars
  hasRecorded?: boolean;
  transcript?: string;
  sttData?: SttPhrase[]; // phrase times on the song timeline
  sttSource?: 'live' | 'batch';
  transcriptionStatus?: 'idle' | 'pending' | 'done' | 'failed';
  timestamp?: string;
  createdAt?: number;
  /** Song-timeline position of this take's first sample (latency-compensated). */
  startBeatOffsetSec?: number;
  beatId?: string;
  /** Capture warnings, e.g. 'silent', 'clipped', 'interrupted'. */
  warnings?: string[];
}

export type ArrangementSource = 'ai' | 'manual' | 'even' | 'energy';

export interface ImportedBeat {
  id: string;
  name: string;
  audioUrl: string;
  /** The original file, kept so the beat can be restored after a reload. */
  audioBlob?: Blob;
  duration: number; // in seconds
  waveform: number[];
  bpm?: number;
  /** Confidence (0..1) of the beat's BPM; 1 for explicit filename/manual values. */
  bpmConfidence?: number;
  bpmSource?: 'filename' | 'detected' | 'ai' | 'manual';
  /** First downbeat / grid phase origin in seconds (>= 0). */
  gridOriginSec?: number;
  /** Cached server-side arrangement analysis persisted in IndexedDB. */
  arrangement?: BeatAnalysis;
  /** True for built-in synthetic starter loops so background AI analysis skips them. */
  isStarter?: boolean;
  key?: string;
  mimeType?: string;
  createdAt?: number;
  isFavorite?: boolean;
}

/** Result of server-side arrangement analysis or local energy fallback; absent fields mean unavailable. */
export interface BeatAnalysis {
  source?: 'ai' | 'local-energy';
  estimatedBpm?: number;
  gridOriginSec?: number;
  sections: Array<{
    type: SectionType;
    title: string;
    startTimeSec: number;
    endTimeSec: number;
    energy?: 'low' | 'medium' | 'high';
    suggestedLyricsPrompt?: string;
  }>;
}

export interface SongSection {
  id: string;
  type: SectionType;
  repetitions: number;
  isLooping: boolean;
  text: string;
  placeholder: string;
  voiceNotes: Take[];
  syncedLyrics?: LyricLine[];
  startTimeSec?: number;
  endTimeSec?: number;
  /** Set when the user manually drags boundaries or structurally edits this section. */
  isUserModified?: boolean;
  energy?: 'low' | 'medium' | 'high';
  suggestedLyricsPrompt?: string;
}

export interface SongSession {
  id: string;
  title: string;
  isCustomTitle?: boolean;
  updatedAt: string;
  updatedAtTimestamp?: number;
  createdAt?: number;
  isFavorite?: boolean;
  coverAccent?: string;
  bpm: number;
  arrangementSource?: ArrangementSource;
  sections: SongSection[];
  importedBeat: ImportedBeat | null;
}

export function getSectionTakeCode(type: SectionType | string, takeIndex: number): string {
  const num = takeIndex + 1;
  const clean = (type || 'verse').toLowerCase().trim();
  let prefix = 'V';
  if (clean.startsWith('intro')) prefix = 'I';
  else if (clean.startsWith('verse')) prefix = 'V';
  else if (clean.startsWith('chorus')) prefix = 'C';
  else if (clean.startsWith('hook')) prefix = 'H';
  else if (clean.startsWith('bridge')) prefix = 'B';
  else if (clean.startsWith('outro')) prefix = 'O';
  else if (clean.startsWith('pre')) prefix = 'P';
  else if (clean.length > 0) prefix = clean.charAt(0).toUpperCase();

  return `${prefix}${num}`;
}
