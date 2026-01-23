# SOP 004: The Vault (Storage & Archiving)

## 1. Objective
Establish a secure, deterministic storage system for all creative assets (beats, stems, vocal memos). "The Vault" ensures that no idea is ever lost and everything is tied to a `Project`.

## 2. Technical Stack
- **Provider:** Supabase Storage.
- **Buckets:** 
    - `assets`: General creative files (beats, loops).
    - `exports`: Finished versions/demos.

## 3. Organizational Structure
Files follow a strict hierarchy in storage:
`projects/{project_id}/{asset_type}/{filename}`
Asset types: `stems`, `memos`, `references`.

## 4. Logical Components

### A. Vault Manager (Hook)
- **File:** `src/hooks/useVault.ts`
- **Logic:** Handles direct uploads to Supabase, generates signed URLs for playback, and updates the `tracks` table in the database.

### B. Vault UI (Component)
- **Component:** `VaultBrowser.tsx`
- **Vibe:** A clean, file-explorer style interface within the project page. Supports drag-and-drop.

## 5. Security (RLS)
- Uploads restricted to authenticated users.
- Storage policies mirrored with DB `project` permissions.

## 6. Project Archiving
- Transitioning `project.status` to 'archived' moves it to a "Cold Storage" view in the Dashboard to reduce clutter while preserving all Vault links.
