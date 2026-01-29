import { LibraryScreen } from "@/components/dashboard/LibraryScreen";
import { getProjects, createProject } from "./actions";
import { redirect } from "next/navigation";

export default async function Home() {
  const projects = await getProjects();

  async function handleCreate(formData: FormData) {
    "use server";
    const title = formData.get("title") as string;
    if (title) {
      await createProject(title);
      redirect("/");
    }
  }

  return <LibraryScreen projects={projects} createAction={handleCreate} />;
}
