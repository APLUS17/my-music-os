import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { getProject } from "@/app/actions";
import { notFound } from "next/navigation";

export default async function ProjectPage({ params }: { params: { id: string } }) {
    const project = await getProject(params.id);

    if (!project) {
        notFound();
    }

    return <StudioWorkspace project={project} />;
}
