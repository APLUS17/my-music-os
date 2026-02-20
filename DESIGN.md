# Design System: Lyriq Landing Page
**Project ID:** 6282600208225527539

## 1. Visual Theme & Atmosphere
- **Mood:** Cinematic, Focused, Premium.
- **Aesthetic Philosophy:** "Prosumer Studio." The design avoids the "toy-like" feel of casual apps, instead opting for a dark, high-contrast workspace that feels like a professional DAW (Digital Audio Workstation). 
- **Density:** Spacious with extreme focus on the "Flow" of information.

## 2. Color Palette & Roles
- **Primary Background:** `Deep Charcoal (#121212)` — The foundation for focus.
- **Creative Accent (Cyan):** `Aqua-Glow (#00FFFF)` — Represents "Flow" and digital clarity.
- **Creative Accent (Indigo):** `Vivid Indigo (#590DF2)` — Represents "Structure" and depth.
- **Surface Layer:** `Translucent Glass (#FFFFFF10)` — Used for feature cards and the comparison table.
- **Text (Primary):** `Off-White (#F2F2F2)` — High readability against dark backgrounds.

## 3. Typography Rules
- **Family:** Inter (Sans-Serif)
- **Headers:** Semi-bold, tight letter-spacing for a modern, punchy feel.
- **Body:** Regular, generous line-height to ensure readability of long-form songwriting copy.

## 4. Component Stylings
* **Buttons:** 
    - **Primary:** Pill-shaped, gradient-fill (Indigo to Cyan), vibrant hover states.
    - **Subtext:** Small, muted gray captions below buttons to manage expectations (e.g., "Limited to first 50").
* **Cards/Containers:** 
    - **Material:** Glassmorphism with `16px` backdrop blur.
    - **Geometry:** Subtly rounded corners (`8px` to `12px`).
    - **Borders:** Ultra-thin `1px` translucent borders to define edges without adding visual weight.
* **Forms:** 
    - **Inputs:** Minimalist bottom-border only or subtle glass fields. Focus on the "one question at a time" qualified flow.

## 5. Layout Principles
- **Grid:** Center-aligned hero, shifting to a multi-column feature grid.
- **Atmosphere Layers:** Strategic use of blurred radial gradients in background corners to create depth without distracting from text.
- **Whitespace Strategy:** Generous top/bottom margins to let each feature "breathe."

---

## 6. FLOW Mobile Songwriting Experience
**Core Philosophy:** "One editor, infinite help." The songwriter stays in the flow, never leaving the editor. Tools surface contextually.

### 6.1. Mobile Interface Architecture
*   **Primary Screen:** The Blank Page (Editor takes 70% screen real estate).
*   **Header:** Simple implementation (Back, Title, More).
*   **Editor:** Large, centered, distraction-free.
*   **Bottom Toolbar:** 4 Contextual Tools (Suggestions, Rhymes, Words, Flow).
    *   **Behavior:** Non-blocking bottom sheets.
    *   **Interaction:** Swipe left/right to switch tools. Tap line to open specific context.

### 6.2. The 4 Contextual Tools
1.  **✨ SUGGESTIONS:**
    *   **Function:** Smart line-by-line lyric suggestions.
    *   **Context:** Analyzes selected text + Genre/Vibe tags.
    *   **Controls:** Creativity slider (Temperature).
    *   **TextFX Modes:** Unexpect, Fuse, Unfold.
2.  **🔤 RHYMES:**
    *   **Function:** Inline rhyme helper + phonetic playground.
    *   **Features:** Auto-detect end word. Perfect/Near/Slant filters. Rhyme scheme visualization (AABB, etc.).
3.  **📚 WORDS:**
    *   **Function:** Vocabulary expansion + TextFX.
    *   **Sub-tools:** Synonyms, Sounds (Alliteration), Scene (Imagery expansion).
4.  **🎵 FLOW:**
    *   **Function:** Song structure & rhythm guidance.
    *   **Features:** Syllable counter, Section checklist (Verse/Chorus), Chord key selector.

### 6.3. User Interaction Patterns
*   **Tap Line:** Opens ✨ Suggestions (or context-aware tool).
*   **Swipe Toolbar:** Switches between the 4 tools.
*   **Drag Panel:** Pull down to collapse (non-blocking).
*   **Long-press Word:** Opens 📚 Words panel.

### 6.4. Design Aesthetics (UI/UX Pro Max)
*   **Glassmorphism:** Panels use `16px` backdrop blur (per Design System).
*   **Motion:** Smooth spring animations for panel slide-up/down.
*   **Typography:** Inter for clean readability.
*   **Color Roles:**
    *   **Active Tool:** Indigo/Cyan gradient border/glow.
    *   **Suggestions:** Off-white text with high contrast.

