
export type SectionType = 'verse' | 'chorus' | 'bridge' | 'tag' | 'intro' | 'outro' | 'idea';

export interface LyricSection {
    id: string;
    type: SectionType;
    repeats: number;
    text: string;
    pinnedSessionId?: string;
}

export interface LyricScrap {
    id: string;
    text: string;
    type: SectionType;
    color?: string;
    tags?: string[];
}

export interface SandboxLine {
    id: string;
    text: string;
    sectionId?: string; // previously takeId
}

export interface TranscriptionLine {
    text: string;
    startTime: number;   // seconds from vocal recording start
    endTime: number;
}

export interface AutoSection {
    id: string;
    startTime: number;
    endTime: number;
    loopPass?: number;           // 1, 2, 3 for loop takes
    type: 'vocal' | 'instrumental' | 'speech' | 'silence';
    label?: string;
    transcription?: string;
    summary?: string;
    emojiTag?: string;
    isBest: boolean;
    isFavorited: boolean;
    sentToLyricsId?: string;     // links to a LyricSection if committed
}

// Vocal layer for multi-track recording (Ableton-style take lanes)
export interface RecordingLayer {
    id: string;
    name?: string;
    audioUrl?: string;
    base64?: string;
    duration?: number;
    isMuted: boolean;
    gain?: number;               // 0-1 volume level
    transcription?: string;
    lines?: TranscriptionLine[];
}

export interface RecordingSession {
    id: string;
    name?: string;
    timestamp: string;
    beatId?: string;
    loopStart?: number;
    loopEnd?: number;
    isLoopSession: boolean;
    base64?: string; // Persisted data
    audioUrl?: string; // URL to the blob for playback (ephemeral)
    transcription?: string;
    lines?: TranscriptionLine[];   // per-line timestamps from Gemini vocal analysis
    bpm?: number;
    sections: AutoSection[];
    duration?: number;
    beatOffset?: number; // The currentTime of the beat when recording started
    layers?: RecordingLayer[]; // Additional vocal layers (harmonies, ad-libs, etc.)
    projectId?: string; // Links session to specific project; undefined for floating/legacy sessions
}

export interface Beat {
    id: string;
    name: string;
    audioUrl: string;
    base64?: string;
    duration: string;
    date: string;
    sections?: AutoSection[];
}

export interface SavedProject {
    id: string;
    name: string;
    lastModified: string;
    sections: LyricSection[];
    scraps: LyricScrap[];
    sessions: RecordingSession[];
    beats: Beat[];
}

// Removed 'tag' and 'idea' from this list so they don't appear in the LyricCard dropdown
export const SECTION_TYPES: SectionType[] = ['intro', 'verse', 'chorus', 'bridge', 'outro'];

export const COLORS = {
    bgPrimary: '#0F0F0F',
    bgSecondary: '#1A1A1A',
    accent: '#A58BFF', // Electric Violet
    textPrimary: '#FFFFFF',
    textSecondary: '#888888',
    border: 'rgba(255, 255, 255, 0.08)',
    cardBg: 'rgba(255, 255, 255, 0.03)',
    modalBg: '#121212',
    wavePlayed: '#A58BFF',
    waveFuture: '#2D2D2D'
};

export type EnergyLevel = 'Low' | 'Medium' | 'High';

export interface Ritual {
    id: string;
    title: string;
    category: string;
    durationMinutes: number;
    timeOfDay: string;
    description: string;
    energyLevel: EnergyLevel;
    prepSteps: string[];
}

export interface RitualStat {
    ritualId: string;
    completedAt: string; // ISO date string
    durationMinutes: number;
}
