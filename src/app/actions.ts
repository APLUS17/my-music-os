"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/db";

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
