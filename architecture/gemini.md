# My Music OS - System Context

## Overview
"My Music OS" (Antigravity Vibecode 01) is a deterministic, full-stack Next.js application designed as a "second brain" for music artists. It manages the creative lifecycle from ideation to file management.

## Tech Stack
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Framer Motion
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **AI:** OpenAI API (GPT-4o/Claude 3.5 Sonnet)

## Core Principles
1. **Determinism:** Data flow and state management must be predictable.
2. **Aesthetic:** "Premium," "Dark," "Glassmorphism."
3. **Modularity:** Components are atomic; Logic is separated into SOP-driven hooks/utils.

## Directory Structure
- `architecture/sops`: Standard Operating Procedures for features.
- `backend/scripts`: Python utility scripts.
- `src/components`: React components (atomic design).
- `src/lib`: Core logic and utilities.
- `src/app`: Next.js pages/routes.

## Environment Variables
Required keys in `.env.local`:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `OPENAI_API_KEY`
