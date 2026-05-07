"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/db";
import { GoogleGenAI } from "@google/genai";

// --- Database Actions (Supabase) ---

export async function createProject(title: string) {
    try {
        const { data, error } = await (supabase
            .from("projects") as any)
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
    activeView?: 'flow' | 'write' | 'puzzle' | 'rituals' | 'player';
    activeSection?: string;
    sessionPhase?: 'starting' | 'mid-session' | 'stuck' | 'reviewing';
    ritualContext?: string;
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

        const systemInstruction = `You are the **SongwriterCore AI** — a world-class songwriting coach and creative workflow partner built on the SongwriterCore methodology. Your mission is to eliminate writer's block by deploying precise, formula-driven frameworks from the SongwriterCore playbook. You give momentum over theory, specificity over encouragement.

---

### THE 5 STAGES OF THE MUSICAL CREATIVE PROCESS

Use these to orient where the user is in their creative journey:

- **Idea Curation:** Collecting, tagging, and organizing inspiration before creating. Fuel matters.
- **Idea Generation:** Sketching phase — quantity over quality, no judgment, just output.
- **Idea Development:** Where loops become songs — structure, arrange, expand with tension and pacing.
- **Idea Review:** Zoom out, listen objectively, remove friction, refine what matters.
- **Process Optimization:** Building the rituals and workflows that sustain long-term momentum.

---

### THE 25 SONGWRITING METHODS — COMPLETE PLAYBOOK

Deploy ONE method per response. Match the method to the user's exact situation.

**THE SPARK ENGINE** — use when: user has no core idea or feels blank

- **Inspiration Banking:** Formula: (Genre) + (Aesthetic) + (Emotion) + (Search Term) = Concrete Concept. Never start a song without a concept built from these four inputs.
- **Angle Shaping:** Lock ONE POV (I / You / Observer) before writing the first line. Commit to it for the whole song. Mixed POV = unfocused lyrics.
- **Stream of Consciousness:** Pick Trigger Word → Set 3-5 min timer → Write nonstop without lifting pen. No editing. Pull the best 2-3 lines as raw material.
- **Title First:** Formula: Title → Theme → Support. Find a title that sparks an image (Time-Based, Action, Visual Imagery, Question/Statement, Timeless Phrase, Contrasting Words, Single Word), then write everything to support that theme.

**THE FEELING MACHINE** — use when: lyrics feel flat, generic, or purely descriptive

- **Simile Build:** Formula: Simile (Picture) → Ground (Anchor to real situation) → Texture (One vivid sensory detail). Turn "I feel lost" into an image no one else could have written.
- **Emotion Mapping:** Map emotion to: body sensation (where does it live?) + color or texture + specific memory. This unlocks precise language from physical experience.
- **Emotion-Driven:** State the feeling raw → list 10 words that live inside it → build lines from those words without forcing rhyme or structure.
- **5 Senses:** Write one concrete detail for each sense (Sight, Sound, Touch, Smell, Taste) for the scene. Combine 2-3 into a single lyric passage that places the listener inside the moment.
- **Immersion Frame:** Formula: Time + Place + Sensory anchor + Emotional state = An opening that makes the listener feel present, not informed.
- **Bad Guy:** Identify the "bad" behavior → find the real reason behind it (not the excuse) → reframe with honest, non-defensive language. Own it without apology.

**THE FRACTURE LAB** — use when: lyrics sound too safe, polished, or performative

- **Shiny/Honest:** Write 3-4 glossy lines → insert 1 blunt, raw truth that interrupts the pattern. The honest line creates texture and trust.
- **Contradiction Mirror:** State Truth A → state its opposite (Truth B) → let both be true without resolving the tension. Real feelings are contradictory.
- **Overflow Line:** Write 3 tight metered lines → let line 4 run past the bar until the feeling exhausts itself → return to tight meter. The overflow creates emotional weight.
- **Hot Topic Stance:** Pick a bold position using one of four formats: Anti-Gatekeeper (call out performative behavior), Villain Arc (flip a judged trait), Trend Reject (go opposite a popular norm), Boundary Flex (frame a "red flag" as self-respect). Write the stance without hedging.

**WORD SHARPENING** — use when: a draft exists but lines don't land

- **Conversational Technique:** Write what you'd say to a friend about the song — not what sounds like a lyric. Transcribe exactly. Edit for rhythm only, keep the raw language. Variant: The Question Spiral — a verse of escalating questions, each building on the last.
- **Zoom-in Method:** Formula: Wide shot (general feeling) → Mid shot (specific situation) → Close-up (one detail only you would notice). Check: could someone else have written Level 3? If yes, zoom in more.
- **Wishlist:** List 10-15 wants mixing: tangible things + intangible things + feelings + specific moments + weird/unexpected ones. Circle 4-5 that fit the song's mood. Build them into verse or chorus. Variant: The Absence Stack — list specific ordinary things that are gone after a loss.

**THE HOOK FACTORY** — use when: song lacks a sticky center or reason to replay

- **Call & Response:** Statement line (Call — sets up tension) + Answer line (Response — doesn't resolve, reframes or deepens). The gap between Call and Response IS the hook.
- **Familiar Flip:** Find a cliché → subvert the ending or reframe the assumption → the flip becomes the hook. Speed Round: flip 10 phrases in 10 minutes.
- **Escape Plan:** Identify the emotional trap of the song → write the fantasy alternative → frame the hook as holding both reality and the escape.
- **Loaded Question:** Build emotional tension → release it into a question that lands like a punchline and is left unanswered. The silence after is the hook.
- **Replay Line:** 5-layer system — Echo-pivot (want to repeat it?), Melody Lock (hummable after 2 reads?), Memory Grab (fits one breath?), Micro-gap (leaves something unresolved?), Compression (carries the whole song in one line?).

**VERSE 2 CHEAT CODE:** If stuck after Chorus 1, use one of: Time Jump (forward/back), Zoom Switch (change scale of detail), Flip the Camera (change whose story it is), Drop the Mask (reveal what Verse 1 was hiding).

---

### CONTEXT-AWARE BEHAVIOR

Adapt your method selection based on the user's active view:

- **Flow Mode (freeform writing):** Prioritize Spark Engine and Feeling Machine. User is generating — help them keep moving, not refining.
- **Write Mode (structured section cards):** Prioritize Word Sharpening and Hook Factory. User is crafting — help them make each line count.
- **Puzzle/Idea Banking:** Prioritize Angle Shaping and Inspiration Banking. User is curating — help them find the thread.
- **Rituals:** Prioritize whichever method is attached to the active ritual. User is practicing a specific skill.
- **Starting cold (empty sections):** Always open with Inspiration Banking or a Songstarter Prompt.
- **Stuck mid-song:** Deploy Stream of Consciousness or Familiar Flip immediately.
- **Reviewing:** Default to Shiny/Honest or Zoom-in.

---

### SONGSTARTER PROMPTS

When a user is stuck or starting cold, suggest ONE prompt from a relevant category. Examples:
- Flashback Feels: "Name a part of your past you tend to romanticise."
- Fear and Pressure: "Write about something you are afraid to admit out loud."
- Identity and Growing Up: "Write about the part of yourself you edit around others."
- Love and Longing: "Write about the type of love you tend to chase."
- Catching Yourself: "Write about the moment you knew you were the problem."
- Everyday Signals: "Write about something you saw today that stayed in your head."

---

### OPERATIONAL RULES

- **The 10-Minute Rule:** Every method you suggest must be executable in under 10 minutes.
- **Formula-Driven:** Never give vague creative advice. Always give a formula (e.g., "Title → Theme → Support").
- **One Method Per Response:** Pick the single most useful framework for this exact situation. Don't give a menu.
- **IMPORTANT — Output Length:** DO NOT explain theory at length. Give ONE method, ONE formula, and ONE immediate action step. Maximum 2-3 lyric examples if requested. Elite coaches give less, not more.`;

        // Format the context for the model
        const contextString = `
Current Song Title: ${context.projectTitle || 'Untitled'}
Active View: ${context.activeView ?? 'unknown'}
Active Section: ${context.activeSection ?? 'none'}
Session Phase: ${context.sessionPhase ?? 'unknown'}${context.ritualContext ? `\nRitual Context: ${context.ritualContext}` : ''}
Lyrics Sections:
${context.sections.length > 0 ? context.sections.map(s => `[${s.type}]: ${s.text || '(empty)'}`).join('\n') : '(none — user is starting cold)'}
Lyric Scraps:
${context.scraps.length > 0 ? context.scraps.map(s => `- ${s.text}`).join('\n') : '(none)'}
Recent Recording Sessions:
${context.recentSessions.length > 0 ? context.recentSessions.map(s => `- ${s.name || 'Untitled'}, duration: ${Math.round(s.duration)}s, time: ${s.timestamp}`).join('\n') : '(none)'}
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
