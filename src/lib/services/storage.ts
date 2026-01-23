import { Project, Idea } from '../types';
import { MOCK_PROJECTS, MOCK_IDEAS } from '../mockData';

const STORAGE_KEY_PROJECTS = 'vibecode_projects';
const STORAGE_KEY_IDEAS = 'vibecode_ideas';

class StorageService {
    private isMock: boolean;

    constructor() {
        // In a real app, check env vars. For now, defaulting to true or checking window availability.
        this.isMock = true;
    }

    // --- Projects ---
    async getProjects(): Promise<Project[]> {
        if (this.isMock) {
            if (typeof window === 'undefined') return MOCK_PROJECTS;

            const stored = localStorage.getItem(STORAGE_KEY_PROJECTS);
            if (!stored) {
                localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(MOCK_PROJECTS));
                return MOCK_PROJECTS;
            }
            return JSON.parse(stored);
        }
        // Real Supabase implementation would go here
        return [];
    }

    async createProject(project: Project): Promise<Project> {
        if (this.isMock) {
            const projects = await this.getProjects();
            const newProjects = [project, ...projects];
            localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(newProjects));
            return project;
        }
        return project;
    }

    // --- Ideas ---
    async getIdeas(projectId: string): Promise<Idea[]> {
        if (this.isMock) {
            if (typeof window === 'undefined') return MOCK_IDEAS.filter(i => i.projectId === projectId);

            const stored = localStorage.getItem(STORAGE_KEY_IDEAS);
            let allIdeas = MOCK_IDEAS;

            if (stored) {
                allIdeas = JSON.parse(stored);
            } else {
                localStorage.setItem(STORAGE_KEY_IDEAS, JSON.stringify(MOCK_IDEAS));
            }

            return allIdeas.filter(i => i.projectId === projectId);
        }
        return [];
    }
}

export const storage = new StorageService();
