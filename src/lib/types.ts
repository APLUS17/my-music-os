export type ProjectStatus = 'draft' | 'in-progress' | 'completed' | 'archived';

export interface Project {
    id: string;
    title: string;
    artist: string;
    status: ProjectStatus;
    bpm?: number;
    key?: string;
    description?: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    coverImage?: string;
}

export interface Idea {
    id: string;
    projectId: string;
    content: string;
    type: 'lyric' | 'melody' | 'theme' | 'prompt';
    createdAt: string;
}
