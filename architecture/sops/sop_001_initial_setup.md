# SOP 001: Project Initialization

## 1. Objective
Establish the core Next.js application structure, styling foundation, and verification protocols.

## 2. Tools & Logic
1. **Framework Setup**
   - **Tool:** `create-next-app`
   - **Flags:** `--ts --tailwind --eslint --app --src-dir`
2. **Styling Foundation**
   - **Tool:** Tailwind CSS v4
   - **Logic:** Use `globals.css` with `@theme inline` for Vibecode variables (`--color-vibecode-*`).
3. **Connectivity**
   - **Script:** `backend/scripts/verify_connections.py`
   - **Logic:** Validates `SUPABASE_URL`, `SUPABASE_KEY`, `OPENAI_API_KEY`.

## 3. Output
- Initialized Next.js project.
- `my-music-os` directory with `architecture` and `backend` folders.
- Running App (Dev Mode).
