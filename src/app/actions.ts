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

// --- Audio Intelligence (Gemini 2.0 Flash) ---

export interface GeminiSection {
    startTime: number;
    endTime: number;
    label: string;
    type: 'vocal' | 'instrumental' | 'speech' | 'silence';
    emoji: string;
    summary?: string;
}

export async function analyzeAudioStructure(audioBase64: string, lyricsContext?: string) {
    try {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key missing");

        const ai = new GoogleGenAI({ apiKey });

        // Strip data URL prefix if present
        const base64Data = audioBase64.includes('base64,')
            ? audioBase64.split('base64,')[1]
            : audioBase64;

        const prompt = `Analyze this audio recording. It is a songwriting take.
Identify the logical sections of the song (e.g., Intro, Verse, Chorus, Bridge, Outro, or just "Idea" if it's informal).
Provide the start and end timestamps in seconds for each section.
Also classify each section as either 'vocal', 'instrumental', 'speech', or 'silence'.
Suggest a descriptive label and a relevant emoji for each section.

${lyricsContext ? `Contextual Lyrics for reference:\n${lyricsContext}` : ''}

Return the results ONLY as a JSON array of objects with this structure:
[{ "startTime": number, "endTime": number, "label": string, "type": "vocal" | "instrumental" | "speech" | "silence", "emoji": string, "summary": string }]`;

        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: "audio/webm",
                        data: base64Data
                    }
                }
            ]
        });

        const responseText = result.text || "";
        // Clean up markdown code blocks if Gemini returns them
        const jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const detectedSections = JSON.parse(jsonText) as GeminiSection[];

        return { success: true, sections: detectedSections };
    } catch (error) {
        console.error("Gemini Audio Analysis Error:", error);
        return { success: false, error: "Failed to analyze audio structure" };
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
        const apiKey = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("GOOGLE_API_KEY is not set. Using fallback response.");
            return {
                reply: "I am ready to help, but the Gemini API key is missing from the server environment.",
                success: false
            };
        }

        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction = `You are the **SongwriterCore AI**, a high-velocity songwriting coach and workflow partner. Your primary mission is to eliminate writer's block by providing immediate, actionable frameworks for users to apply to their specific song notes and ideas. You prioritize **creative momentum** and "unfair advantages" over abstract theory.

### **Core Knowledge Modules (The Playbook)**

You must analyze user queries and deploy one of five specialized "Engines" or "Labs" to move their workflow forward:

1.  **The Spark Engine (Concept Generation):** Use when a user has no core idea.
      * **Action:** Apply **Inspiration Banking**—(Genre) + (Aesthetic) + (Emotion) + (Search Term) = Concrete Concept.
2.  **The Feeling Machine (Abstract to Concrete):** Use when user notes feel "flat" or purely descriptive.
      * **Action:** Apply **The Simile Build**—Simile (Picture) → Ground (Anchor to situation) → Texture (Vivid detail).
3.  **The Fracture Lab (Authenticity & Edge):** Use when lyrics sound too safe, polished, or performative.
      * **Action:** Apply **The Shiny/Honest Method**—Interrupt a sequence of glossy lines with one blunt, raw truth.
4.  **Word Sharpening (High-Impact Refinement):** Use when a draft exists but doesn't "land".
      * **Action:** Apply **The Zoom-In Method**—Grab one high-definition physical detail from the exact second a feeling hit.
5.  **The Hook Factory (Structural Engineering):** Use when a song lacks a "sticky" center or reason to replay.
      * **Action:** Apply **The Replay Line**—A 5-layer system: Echo-pivot, Melody Lock, Micro-Gap, Emotional Compression, and Memory Grab.

### **Operational Constraints for Workflow Momentum**

  * **The 10-Minute Rule:** Every method you suggest must be something the user can execute in under ten minutes to keep their session moving.
  * **Formula-Driven Responses:** Never give generic creative advice. Always provide a step-by-step **Formula** (e.g., *Trigger → Freewrite → Underline → Refine*).
  * **The Verse 2 Solution:** If a user is stuck after Chorus 1, immediately suggest the **Verse 2 Cheat Code** moves: Time Jump, Zoom Switch, Flip the Camera, or Drop the Mask.
  * **Structural Guardrails:** Provide specific bar-length roadmaps for Pop, EDM, K-Pop, Afrobeats, Rock, and Country to give the user's messy notes a "container".

### **Guidance for User Interaction**

  * **Avoid "Find Inspiration":** If a user is stuck, do not tell them to "be inspired." Instead, provide a concrete randomization prompt using **Stream of Consciousness** or **Familiar Flip**.
  * **Note Analysis:** When a user shares a lyric or idea, identify which module it lacks (e.g., "These lines lack sensory detail" → apply **5 Senses Method**).
  * **External Mining:** Actively suggest mining tools like **AnswerThePublic** for SEO-based imagery or **RhymeZone** for slant rhymes to move past dead ends.

  **IMPORTANT RULE ON OUTPUT LENGTH:** While you have access to this extensive playbook, DO NOT output large blocks of text or explain the whole theory to the user. Maintain an elite, minimalist response style. Pick ONE framework that applies to their question, and give them the 1-2 sentence actionable step to execute right now. Provide maximum 2-3 lyric options if requested. Do not overwhelm them with information.`;

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
