import axios from 'axios';

// types for Datamuse
interface DatamuseResult {
    word: string;
    score: number;
    tags?: string[];
}

// types for LRCLIB
interface LyricsResult {
    id: number;
    trackName: string;
    artistName: string;
    plainLyrics: string;
    syncedLyrics: string;
}

export class CreativeService {

    // --- Datamuse (Rhymes & Associations) ---

    async getRhymes(word: string): Promise<string[]> {
        try {
            const res = await axios.get<DatamuseResult[]>(`https://api.datamuse.com/words?rel_rhy=${word}&max=10`);
            return res.data.map(item => item.word);
        } catch (error) {
            console.error("Datamuse Error:", error);
            return [];
        }
    }

    async getSynonyms(word: string): Promise<string[]> {
        try {
            const res = await axios.get<DatamuseResult[]>(`https://api.datamuse.com/words?rel_syn=${word}&max=10`);
            return res.data.map(item => item.word);
        } catch (error) {
            console.error("Datamuse Error:", error);
            return [];
        }
    }

    async getRelatedConcepts(word: string): Promise<string[]> {
        try {
            const res = await axios.get<DatamuseResult[]>(`https://api.datamuse.com/words?ml=${word}&max=10`);
            return res.data.map(item => item.word);
        } catch (error) {
            console.error("Datamuse Error:", error);
            return [];
        }
    }

    // --- LRCLIB (Lyrics) ---

    async findLyrics(artist: string, track: string): Promise<LyricsResult | null> {
        try {
            const res = await axios.get<LyricsResult[]>(`https://lrclib.net/api/search?q=${artist} ${track}`);
            if (res.data && res.data.length > 0) {
                return res.data[0];
            }
            return null;
        } catch (error) {
            console.error("LRCLIB Error:", error);
            return null;
        }
    }

    // --- Inspiration Generator ---

    async generatePrompt(): Promise<string> {
        const templates = [
            "Write a song about [topic] in the style of [genre].",
            "Use the word '[word]' as a metaphor for time.",
            "Create a melody using only the pentatonic scale.",
            "Theme: Neo-Noir Cityscape."
        ];
        // In a real iteration, we could fetch random words from Datamuse to fill the templates
        return templates[Math.floor(Math.random() * templates.length)];
    }
}

export const creative = new CreativeService();
