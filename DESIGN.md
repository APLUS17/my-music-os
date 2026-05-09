# Design System: Lyriq Lab (Music OS)

**Project ID:** 6282600208225527539 / 4592349754183388496

## 1. Visual Theme & Atmosphere
The design follows a **Sophisticated Dark Mode** aesthetic with a "Vibe-first" philosophy. It feels **Premium**, **Immersive**, and **High-craft**. The interface uses **Glassmorphism** and **Obsidian-like density** to create a focused work environment for music artists. It’s "Deterministic" but "Soulful," with a heavy emphasis on depth, vibrant accents, and smooth cinematic transitions.

## 2. Color Palette & Roles
*   **Deep Space Black (#000000):** Used for primary backgrounds and high-contrast surfaces.
*   **Acid Green / Sonic Lime (#7fff00 - Variable):** The primary **Accent** color. Used for progress indicators, active recording states, and call-to-action highlights.
*   **Muted Onyx (#121212):** Used for card backgrounds and secondary surfaces.
*   **Stardust Gray (#ffffff / 0.1 opacity):** Used for glass borders and translucent overlaps.
*   **Vapor White (#ffffff):** Primary text color for maximum readability on dark surfaces.
*   **Dim Ghost (#ffffff / 0.4 opacity):** Used for tertiary labels and helper text.

## 3. Typography Rules
*   **Sans-Serif (Geist / Inter):** Used for the primary UI, providing a modern and accessible feel.
*   **Display (Poppins / Righteous):** Used for large headers to inject personality and creative energy.
*   **Mono (JetBrains Mono):** Used for technical data, time-codes, and metadata to reinforce the "OS" and "Lab" character.
*   **Weight Usage:** 
    *   Headers: Bold or Extra-Bold (700+)
    *   Body: Regular (400) or Medium (500)
    *   Metadata: Light (300) or Regular (400)

## 4. Component Stylings
*   **Buttons:** 
    *   **Actionable:** Pill-shaped (`rounded-full`) or generously rounded (`rounded-xl`).
    *   **Feedback:** Active scale changes (`active:scale-95`) and hover brightness increases.
    *   **Variants:** Ghost for navigation, Outline for secondary, Solid Accent for primary actions.
*   **Cards/Containers:** 
    *   **Aesthetic:** "Glass" containers with `backdrop-blur-3xl` and subtle stardust borders.
    *   **Shape:** Softened edges (`rounded-2xl` or `rounded-3xl`) for an organic yet modern feel.
    *   **Elevation:** Whisper-soft diffused shadows for layered depth.
*   **Inputs/Forms:** 
    *   **Styling:** Minimalist ghost inputs or translucent black backgrounds.
    *   **Interaction:** Focus states use accent color glows or border color transitions.

## 5. Layout Principles
*   **Dynamic Density:** Mobile-first, single-column focus that expands intelligently for desktop viewports.
*   **Floating Navigation:** A fixed bottom navbar that uses high-blur glassmorphism to "float" above content.
*   **Breathability:** High-margin layouts with intentional whitespace to prevent fatigue during long creative sessions.
*   **Transitions:** Framer Motion powered animations for all state changes (drawer openings, tab switching).
*   **External UI Registry:** **shadcn-glass-ui** (v2.11+) - Primary source for glassmorphic and AI-friendly component templates.
    *   Repo: [https://github.com/Yhooi2/shadcn-glass-ui-library](https://github.com/Yhooi2/shadcn-glass-ui-library)
    *   Docs: [https://yhooi2.github.io/shadcn-glass-ui-library/](https://yhooi2.github.io/shadcn-glass-ui-library/)
