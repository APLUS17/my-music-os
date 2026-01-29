---
name: BLAST Framework
description: A deterministic, 5-phase framework for building production-ready full-stack applications (Blueprint, Links, Architecture, Stylize, Trigger).
---

# The BLAST Framework

**BLAST** is a deterministic execution model for full-stack agents. It replaces "guesswork" with a rigid, self-correcting 5-phase lifecycle.

When this skill is active, you must adhere to the following 5 phases in order. Do not skip phases unless explicitly directed.

---

## Phase 1: Blueprint (B)
**Goal**: Define the Logic and Desired Outcome.
**Output**: `architecture/blueprint.md` or section in Main Task.

1.  **Northstar Goal**: What is the single sentence purpose of this app?
2.  **Core Pillars**: Identify the 3-4 non-negotiable features.
3.  **Data Logic**: Define the shape of the data strictly (Schema/Types) before thinking about UI.
4.  **Verification**: Do not move to Phase 2 until the "Mental Model" is approved.

---

## Phase 2: Links (L)
**Goal**: Connectivity and Handshakes.
**Output**: Verified `.env` and `db.ts` connection.

1.  **The Handshake**: Connect to all external services (Supabase, OpenAI, Stripe) immediately.
2.  **Validation**: Run a script or small tool call to PROVE the connection works. Do not assume credentials work.
3.  **Secrets Hygiene**: Ensure no secrets are leaked to the client (`NEXT_PUBLIC_` audit).

---

## Phase 3: Architecture (A)
**Goal**: The Skeleton (Production-Ready Build).
**Output**: Functional, unstyled components and server actions.

1.  **3-Layer System**:
    *   **Layer 1 (SOPs)**: Write the plan/docs first.
    *   **Layer 2 (Actions)**: Write the Server Actions/API routes.
    *   **Layer 3 (Tools)**: Write the UI components (functional only).
2.  **Deterministic State**: Ensure the app handles "Loading", "Error", and "Empty" states explicitly.
3.  **No Placeholders**: Real data flows, even if the UI is ugly.

---

## Phase 4: Stylize (S)
**Goal**: The Soul (Premium Aesthetics).
**Output**: High-fidelity UI with motion and brand identity.

1.  **Guidelines First**: Extract or define a "Design Language" (e.g., Noir Tech, Glassmorphism).
2.  **Token System**: Define global radii, colors, and fonts variables.
3.  **Kinetic Motion**: Every interaction must have a reaction (hover, click, load). Use `framer-motion` for meaningful transitions.
4.  **Polish**: standard 1px borders, subtle gradients, and noise overlays to reduce "digital flatness".

---

## Phase 5: Trigger (T)
**Goal**: The Launch (Deployment & Handoff).
**Output**: Live URL and Deployment Docs.

1.  **Security Audit**: Scan for `sk-` keys, dependency vulns, and RLS flaws.
2.  **Build Verification**: Run `npm run build` locally. It MUST pass.
3.  **Deployment Config**: Document all ENV variables needed for Vercel/Netlify.
4.  **Trigger**: Push to main.

---

## Usage Instructions
To activate this framework, simply check the current status of the project against these 5 letters.
*   "Where are we in BLAST?"
*   "Initialize BLAST Phase 1."
