import React from "react";
import { supabase } from "@/lib/db";
import { notFound } from "next/navigation";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";

type Params = Promise<{ id: string }>;

export default async function StudioPage({ params }: { params: Params }) {
    const { id } = await params;

    // Fetch project from Supabase
    const { data: project, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !project) {
        return notFound();
    }

    return <StudioWorkspace project={project} />;
}


