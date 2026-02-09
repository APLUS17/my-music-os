
export type SectionType = 'verse' | 'chorus' | 'bridge' | 'tag' | 'intro' | 'outro' | 'idea';

export interface LyricSection {
    id: string;
    type: SectionType;
    repeats: number;
    text: string;
    pinnedTakeId?: string; // ID of the associated voice take
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
    takeId?: string;
}

export interface VoiceTake {
    id: string;
    timestamp: string;
    duration: string;
    transcription: string;
    associatedLyrics: string;
    isPlaying: boolean;
    audioUrl?: string; // URL to the blob for playback (ephemeral)
    base64?: string; // Persisted data
    beatOffset?: number; // The currentTime of the beat when recording started
}

export interface Beat {
    id: string;
    name: string;
    audioUrl: string;
    base64?: string;
    duration: string;
    date: string;
}

export interface SavedProject {
    id: string;
    name: string;
    lastModified: string;
    sections: LyricSection[];
    scraps: LyricScrap[];
    takes: VoiceTake[];
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
