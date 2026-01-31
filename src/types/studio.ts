// Lyric section types for song structure
export type SectionType = 'verse' | 'chorus' | 'bridge' | 'hook' | 'outro' | 'ad-lib' | 'intro' | 'pre-chorus';

export const SECTION_TYPES: SectionType[] = [
    'intro',
    'verse',
    'pre-chorus',
    'chorus',
    'bridge',
    'hook',
    'outro',
    'ad-lib'
];

export interface LyricSection {
    id: string;
    type: SectionType;
    repeats: number;
    text: string;
    pinnedTakeId?: string;
}

export interface LyricScrap {
    id: string;
    text: string;
    type: 'lyric' | 'idea' | 'rhyme';
}

export interface VoiceTake {
    id: string;
    timestamp: string;
    duration: string;
    transcription: string;
    associatedLyrics: string;
    isPlaying: boolean;
    audioUrl: string;
}
