import { Project, Idea } from './types';

export const MOCK_PROJECTS: Project[] = [
    {
        id: 'proj_001',
        title: 'Neon Nights',
        artist: 'User',
        status: 'in-progress',
        bpm: 128,
        key: 'Cm',
        description: 'Synthwave track with dark undertones.',
        tags: ['synthwave', 'demo', 'v1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'proj_002',
        title: 'Sunday Morning',
        artist: 'User',
        status: 'draft',
        bpm: 85,
        key: 'G',
        description: 'Acoustic chill vibes.',
        tags: ['acoustic', 'guitar'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
];

export const MOCK_IDEAS: Idea[] = [
    {
        id: 'idea_001',
        projectId: 'proj_001',
        type: 'lyric',
        content: "Driving through the city lights / nothing feels the same tonight",
        createdAt: new Date().toISOString(),
    },
    {
        id: 'idea_002',
        projectId: 'proj_001',
        type: 'theme',
        content: "Referencing 'Blade Runner' aesthetic - rain and neon.",
        createdAt: new Date().toISOString(),
    }
];
