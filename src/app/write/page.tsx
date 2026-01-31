import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { getProjects, createProject } from "@/app/actions";
import { redirect } from "next/navigation";

export default async function WritePage() {
    // Quick Start Logic:
    // 1. Try to find the most recent project
    // 2. If no projects, create a "Scratchpad"
    // 3. Render the Studio

    const projects = await getProjects();
    let activeProject = projects[0]; // Logic: Most recent due to descending sort in actions.ts

    if (!activeProject) {
        // Create a default scratchpad if nothing exists
        const { project } = await createProject("Untitled Session " + new Date().toLocaleDateString());
        if (project) {
            activeProject = project;
        } else {
            // Fallback if creating fails (shouldn't happen)
            return <div className="p-10 text-white">Error initializing session.</div>;
        }
    }

    // Directly render the workspace for instant access
    return <StudioWorkspace project={activeProject} />;
}
