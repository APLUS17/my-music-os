"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

// --- Auth helper ---

async function getAuthenticatedClient() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Unauthorized");
    return { supabase, userId: user.id };
}

// --- Database Actions (Supabase) ---

export async function createProject(title: string, opts?: { genre?: string; mood?: string; artist?: string }) {
    try {
        const { supabase, userId } = await getAuthenticatedClient();
        const { data, error } = await supabase
            .from("projects")
            .insert([{
                title,
                status: "draft",
                user_id: userId,
                genre: opts?.genre,
                mood: opts?.mood,
                artist: opts?.artist,
            }])
            .select()
            .single();

        if (error) throw error;

        revalidatePath("/");
        return { success: true, project: data };
    } catch (error) {
        console.error("Supabase Error:", error);
        return { success: false, error: "Failed to create project" };
    }
}

export async function getProjects() {
    try {
        const { supabase, userId } = await getAuthenticatedClient();
        const { data, error } = await supabase
            .from("projects")
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Supabase Error:", error);
        return [];
    }
}

export async function getProject(id: string) {
    try {
        const { supabase, userId } = await getAuthenticatedClient();
        const { data, error } = await supabase
            .from("projects")
            .select("*")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Supabase Error:", error);
        return null;
    }
}

export async function deleteProject(id: string) {
    try {
        const { supabase, userId } = await getAuthenticatedClient();
        const { error } = await supabase
            .from("projects")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);

        if (error) throw error;

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Supabase Error:", error);
        return { success: false, error: "Failed to delete" };
    }
}

export async function updateProjectStudio(id: string, content: string) {
    try {
        const { supabase, userId } = await getAuthenticatedClient();
        const { error } = await supabase
            .from("projects")
            .update({ description: content, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("user_id", userId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Supabase Error:", error);
        return { success: false };
    }
}

export async function updateProject(id: string, updates: {
    title?: string;
    artist?: string;
    genre?: string;
    mood?: string;
    bpm?: number;
    key?: string;
    status?: string;
    local_data?: Record<string, unknown>;
}) {
    try {
        const { supabase, userId } = await getAuthenticatedClient();
        const { error } = await supabase
            .from("projects")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("user_id", userId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Supabase Error:", error);
        return { success: false };
    }
}

export async function upsertProjectLocalData(id: string, localData: Record<string, unknown>) {
    try {
        const { supabase, userId } = await getAuthenticatedClient();
        const { error } = await supabase
            .from("projects")
            .update({ local_data: localData, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("user_id", userId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Supabase Error:", error);
        return { success: false };
    }
}

export async function joinBetaWaitlist(email: string, name?: string, howHeard?: string) {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from("beta_waitlist")
            .insert([{ email, name, how_heard: howHeard }]);

        if (error && error.code === '23505') return { success: true, alreadyJoined: true };
        if (error) throw error;
        return { success: true, alreadyJoined: false };
    } catch (error) {
        console.error("Waitlist Error:", error);
        return { success: false };
    }
}

// --- Creative Logic (Datamuse API - Still Real!) ---

export async function getCreativeSuggestion(prompt: string) {
    try {
        // Datamuse is free and requires no API key
        const [rhymesRes, relatedRes] = await Promise.all([
            fetch(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(prompt)}&max=5`),
            fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(prompt)}&max=5`),
        ]);

        const rhymes = await rhymesRes.json();
        const related = await relatedRes.json();

        const prompts = [
            "Write about the feeling of midnight highways",
            "Capture the energy of city lights at 3am",
            "Express the weight of unspoken words",
            "Describe the color of a forgotten memory",
            "Paint the sound of rain on windows",
        ];

        return {
            rhymes: rhymes.map((r: { word: string }) => r.word),
            related: related.map((r: { word: string }) => r.word),
            inspiration: prompts[Math.floor(Math.random() * prompts.length)],
        };
    } catch (error) {
        console.error("Datamuse Error:", error);
        return {
            rhymes: ["dream", "stream", "theme"],
            related: ["vision", "imagination", "create"],
            inspiration: "Write from the heart",
        };
    }
}

// --- Vocal Section Timestamping (Gemini 2.5 Flash) ---
// Runs automatically after each take is saved. Replaces SmartSplit's
// energy-based sections with AI-labeled timestamps the user can actually read.

export interface VocalSection {
    id: string;
    startTime: number;
    endTime: number;
    label: string;
    type: 'vocal' | 'instrumental' | 'speech' | 'silence';
    emojiTag: string;
    summary: string;
    isBest: boolean;
    isFavorited: boolean;
}

export async function analyzeVocalSections(
    audioBase64: string
): Promise<{ success: true; sections: VocalSection[] } | { success: false; error: string }> {
    try {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) return { success: false, error: 'API key missing' };

        const ai = new GoogleGenAI({ apiKey });

        const base64Data = audioBase64.includes('base64,')
            ? audioBase64.split('base64,')[1]
            : audioBase64;

        const mimeMatch = audioBase64.match(/^data:([^;]+);/);
        const mimeType = mimeMatch?.[1] || 'audio/webm';

        const prompt = `Freestyle vocal studio recording. Timestamp every distinct moment.
Types: "vocal" (rapping/singing), "speech" (talking/narrating), "silence" (pause/dead air).
Label: max 3 words (e.g. "Verse Flow", "Hook Idea", "Spoken Concept").
Cover the full timeline with no gaps.`;

        const responseSchema = {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    startTime: { type: 'NUMBER' },
                    endTime: { type: 'NUMBER' },
                    label: { type: 'STRING' },
                    type: { type: 'STRING', enum: ['vocal', 'speech', 'silence'] },
                    emoji: { type: 'STRING' },
                    summary: { type: 'STRING' }
                },
                required: ['startTime', 'endTime', 'label', 'type', 'emoji', 'summary']
            }
        };

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { text: prompt },
                { inlineData: { mimeType, data: base64Data } }
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        const raw = JSON.parse(result.text || '[]') as { startTime: number; endTime: number; label: string; type: string; emoji: string; summary: string }[];

        const validTypes = new Set(['vocal', 'speech', 'silence', 'instrumental']);
        const sections: VocalSection[] = raw
            .filter(s => typeof s.startTime === 'number' && typeof s.endTime === 'number' && s.startTime < s.endTime)
            .map((s, i) => ({
                id: `vs-${i}-${Math.random().toString(36).slice(2, 7)}`,
                startTime: s.startTime,
                endTime: s.endTime,
                label: (s.label || 'Section').slice(0, 40),
                type: (validTypes.has(s.type) ? s.type : 'vocal') as VocalSection['type'],
                emojiTag: s.emoji || '🎤',
                summary: s.summary || '',
                isBest: false,
                isFavorited: false,
            }));

        return { success: true, sections };
    } catch (error: any) {
        console.error('analyzeVocalSections error:', error);
        return { success: false, error: 'Failed to analyze vocal sections' };
    }
}


// --- Email capture (lead magnet / Beat Drop) ---

export async function saveEmailCapture(email: string, source?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('email_captures')
            .insert([{ email: email.toLowerCase().trim(), source: source ?? 'landing_page', created_at: new Date().toISOString() }]);

        if (error && error.code !== '23505') {
            console.error('Email capture error:', error);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message ?? 'Unknown error' };
    }
}
