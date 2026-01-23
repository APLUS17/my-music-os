import { ProjectList } from "@/components/dashboard/ProjectList";
import { Button } from "@/components/ui/Button";
import { getProjects, createProject } from "./actions";
import { Sparkles, Plus } from "lucide-react";
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

  return (
    <div className="min-h-screen p-8 sm:p-12 font-sans bg-vibecode-dark text-foreground relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-vibecode-primary/5 via-transparent to-transparent pointer-events-none" />

      <header className="flex justify-between items-end mb-16 relative z-10 w-full animate-slide-up">
        <div>
          <div className="flex items-center gap-2 text-vibecode-secondary font-mono text-[10px] tracking-[0.3em] uppercase mb-4 opacity-60">
            <div className="w-1.5 h-1.5 rounded-full bg-vibecode-secondary shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
            Vibecode // OS_TERMINAL
          </div>
          <h1 className="text-5xl font-bold tracking-tighter text-white uppercase italic">
            Lyriq <span className="text-vibecode-primary">Lab</span>
          </h1>
        </div>

        <form action={handleCreate} className="flex gap-2">
          <input
            name="title"
            placeholder="New Project Title..."
            className="bg-vibecode-card border border-vibecode-border rounded-md px-4 py-2 text-sm focus:outline-none focus:border-vibecode-primary text-white"
            required
          />
          <Button type="submit" size="sm" variant="primary" className="gap-2">
            <Plus size={16} /> Create
          </Button>
        </form>
      </header>

      <main className="relative z-10 animate-fade-in">
        <ProjectList initialProjects={projects} />
      </main>

      {/* Quick Actions (Floating) */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button variant="secondary" size="lg" className="rounded-full shadow-2xl gap-2">
          <Sparkles size={18} /> Quick Idea
        </Button>
      </div>
    </div>
  );
}
