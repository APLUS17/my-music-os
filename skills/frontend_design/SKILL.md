---
name: Visual Core Framework (Frontend Design)
description: A flexible framework for creating *unique*, high-fidelity design systems for any project. Use this to define a bespoke aesthetic (Palette, Typography, tokens) before writing CSS.
---

# The Visual Core Framework

This skill is a **Design Engine**. It does not enforce a specific look. Instead, it provides a structured process to invent a *new, unique aesthetic* for every project.

**Trigger**: Use this when initializing a new UI or when the user asks for a "Redesign."

---

## 1. The "Aesthetic DNA" Phase
Before coding, you must answer these 4 questions to generate the project's unique "DNA":

### A. The Vibe (Adjectives)
Pick 3 adjectives that define the feeling.
*   *Examples*: "Brutalist / Playful / Raw", "Corporate / Clean / Trustworthy", "Cyberpunk / Neon / Glitch".
*   **Result**: This guides every decision below.

### B. The Palette (Color Logic)
Do not just pick colors. Pick a *logic*.
*   **Monochrome**: 5 shades of grey + 1 sharp accent.
*   **Pastel**: Low saturation, high brightness.
*   **High Contrast**: Pure Black (#000000) vs Pure White (#ffffff).
*   *Requirement*: Define variables for `--bg`, `--fg`, `--primary`, `--surface`.

### C. The Typography (Type Pairing)
Pairing fonts creates character.
*   **The "Workhorse"**: Legible sans-serif (Inter, Geist, Helvetica) for UI.
*   **The "Character"**: Display font (Serif, Mono, Handwriting) for Headers/Data.
*   *Requirement*: Define `--font-ui` and `--font-display`.

### D. The Physics (Tokens)
How does the world feel?
*   **Soft**: Large radius (16px+), blur shadows, springy animations.
*   **Hard**: 0px radius, thick borders, instant hover states.
*   **Glass**: High blur (20px), low opacity, noise overlays.

---

## 2. Implementation Rules (The "Anti-Generic" Law)
To prevent "Default AI Aesthetics," you must strictly follow these rules:

1.  **No "Default Blue"**: Never use the default Tailwind blue (`blue-500`). Pick a specific hue (Indigo, Violet, Cyan) or a custom hex.
2.  **No "Plain White"**: Use `zinc-50` or `slate-50` for light mode. Pure white is for paper only.
3.  **Ambience**: Always add *texture* to the background. (e.g., specific gradients, mesh, noise, or subtle patterns).
4.  **Motion is Mandatory**: "Kineticism" is what makes a site feel premium.
    *   *Hover*: Buttons must scale or shift.
    *   *Entrance*: Content must stagger-fade in.

---

## 3. Execution Template (Copy to `globals.css`)
When starting, generate a root configuration like this, tailored to the DNA:

```css
:root {
  /* The DNA */
  --font-ui: 'Your Chosen Sans', sans-serif;
  --font-display: 'Your Chosen Display', serif;
  
  /* The Palette */
  --bg-main: /* Hex based on Vibe */;
  --fg-main: /* Hex based on Vibe */;
  --accent:  /* Hex based on Vibe */;
  
  /* The Physics */
  --radius-panel: /* 0px, 8px, or 24px */;
  --radius-btn:   /* Match or Contrast */;
  --backdrop-blur: /* 0px or 20px */;
}
```

---

## 4. Examples of "DNA"
*   **My Music OS**: "Noir Tech" (Dark, Grainy, Mono fonts, 1px borders).
*   **E-Commerce Brand**: "Soft Pop" (Pastel pinks, heavy rounded corners, bouncy motion).
*   **Dev Tool**: "Terminal Brutalism" (Green on Black, monospace only, 0px radius).
