# SOP 002: Dashboard (OS Home)

## 1. Objective
Display a high-level overview of the user's creative universe. Allow finding recent work and starting new projects quickly.

## 2. Inputs & Triggers
- **Load:** Page load (`/`) triggers project fetch.
- **Action:** User clicks "New Project" -> Input Modal -> Create.
- **Action:** User clicks a Project Card -> Navigate to `/project/[id]`.

## 3. Tools & Logic
1.  **Fetch Projects**
    - **Source:** SQLite (`prisma.project.findMany`)
    - **Filter:** Order by `updatedAt` desc.
    - **Limit:** Recent 6-10 items? Or lazy load.
2.  **Create Project**
    - **Action:** `createProject(title)`
    - **Result:** URL redirect to new project.
3.  **Recent Ideas**
    - **Source:** SQLite (`prisma.idea.findMany`)
    - **Logic:** Show the last 3 generated prompts/lyrics for inspiration.

## 4. Edge Cases
- **No Projects:** Show "Welcome" empty state with a clear CTA.
- **Loading:** Skeleton cards (shimmer effect).
- **Error:** Toast notification "Failed to load projects".

## 5. Output
- A responsive grid of `ProjectCard` components.
- A "Quick Actions" sidebar or top bar.
