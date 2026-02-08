import { Project, Idea } from './types';

export const MOCK_PROJECTS: Project[] = [
    {
        id: 'mission_001',
        title: 'Mission: Flow to Write',
        artist: 'You',
        status: 'in-progress',
        bpm: 120, // A comfortable tempo for writing
        key: 'C',
        description: 'Mission Brief: 1. Hit Play 2. Type lyrics in Flow 3. Switch to Studio to organize.',
        tags: ['mission', 'onboarding'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
];

export const MOCK_IDEAS: Idea[] = [
    {
        id: 'idea_mission_01',
        projectId: 'mission_001',
        type: 'lyric',
        content: "Don't overthink it, just let the lines flow...",
        createdAt: new Date().toISOString(),
    },
    {
        id: 'idea_mission_02',
        projectId: 'mission_001',
        type: 'theme',
        content: "Focus on the rhythm. The structure comes later.",
        createdAt: new Date().toISOString(),
    }
];
