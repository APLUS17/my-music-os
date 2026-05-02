"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/db";
import { GoogleGenAI } from "@google/genai";

// --- Database Actions (Supabase) ---

export async function createProject(title: string) {
    try {
        const { data, error } = await supabase
            .from("projects")
            .insert([{ title, status: "draft" }])
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
        const { data, error } = await supabase
            .from("projects")
            .select("*")
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
        const { data, error } = await supabase
            .from("projects")
            .select("*")
            .eq("id", id)
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
        const { error } = await supabase
            .from("projects")
            .delete()
            .eq("id", id);

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
        const { error } = await supabase
            .from("projects")
            .update({ description: content, updated_at: new Date().toISOString() })
            .eq("id", id);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error("Supabase Error:", error);
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


// --- Facilitator AI (Gemini) ---

export type FacilitatorContext = {
    projectTitle: string;
    sections: { type: string; text: string }[];
    scraps: { text: string }[];
    recentSessions: { name: string; duration: number; timestamp: string }[];
};

export async function chatWithFacilitator(userPrompt: string, context: FacilitatorContext) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("GEMINI_API_KEY is not set. Using fallback response.");
            return {
                reply: "I am ready to help, but the Gemini API key is missing from the server environment.",
                success: false
            };
        }

        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction = `You are the Facilitator, an elite, minimalist music production assistant.
Your Constraints:
1. Never use filler words (e.g., 'Sure, I can help', 'Here are some ideas'). Jump straight to the point.
2. Keep responses to a maximum of 2 short sentences unless the user explicitly asks for lyrics.
3. If suggesting lyrics or rhymes, provide a maximum of 2 short options.
4. Always provide actionable, specific advice based on the user's provided lyrics and session data.
5. Never overwhelm the user with information. Be a sharp, focused sounding board.`;

        // Format the context for the model
        const contextString = `
Current Song Title: ${context.projectTitle || 'Untitled'}
Lyrics Sections:
${context.sections.map(s => `[${s.type}]: ${s.text || '(empty)'}`).join('\n')}
Lyric Scraps:
${context.scraps.map(s => `- ${s.text}`).join('\n')}
Recent Recording Sessions:
${context.recentSessions.map(s => `- ${s.name || 'Untitled'}, duration: ${Math.round(s.duration)}s, time: ${s.timestamp}`).join('\n')}
`;

        const prompt = `Context:\n${contextString}\n\nUser: ${userPrompt}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        const reply = response.text || "I don't have a specific response for that right now.";

        return { reply, success: true };
    } catch (error) {
        console.error("Gemini Error in Facilitator:", error);
        return {
            reply: "I'm having trouble connecting to my brain right now. Try again in a moment.",
            success: false
        };
    }
}
