---
name: stitch-design
description: Skill for extracting design tokens and creating a DESIGN.md file using Google Stitch.
---

# Stitch DESIGN.md Skill

## Overview
This skill guides the agent in using the Google Stitch MCP Server to analyze a project's design and generate a comprehensive `DESIGN.md` file. It focuses on capturing the "Project Identity," "Atmosphere," "Color Palette," and "Geometry."

## The Goal
To create a `DESIGN.md` file that serves as a source of truth for the project's visual language, enabling consistent UI development.

## Usage
When asked to "analyze the design" or "create a design doc" for a Stitch project:

1.  **Retrieve Project Info:** Use `stitch_client.get_project` (or equivalent MCP tool) to get project details.
2.  **Get Screen Details:** Retrieve the code, image, and object info for a representative screen (e.g., Home).
3.  **Analyze:** Extract design tokens, translation technical values to descriptive language.
4.  **Generate:** Create `DESIGN.md` following the structure below.

## Analysis & Synthesis Instructions

### 1. Extract Project Identity (JSON)
- Locate the Project Title
- Locate the specific Project ID

### 2. Define the Atmosphere (Image/HTML)
Evaluate the screenshot and HTML structure to capture the overall "vibe." Use evocative adjectives (e.g., "Airy," "Dense," "Minimalist," "Utilitarian").

### 3. Map the Color Palette (Tailwind Config/JSON)
Identify key colors. For each, provide:
- **Descriptive Name:** (e.g., "Deep Muted Teal-Navy")
- **Hex Code:** (e.g., `#294056`)
- **Role:** (e.g., "Primary actions")

### 4. Translate Geometry & Shape (CSS/Tailwind)
Convert technical values to physical descriptions:
- `rounded-full` -> "Pill-shaped"
- `rounded-lg` -> "Subtly rounded corners"
- `rounded-none` -> "Sharp, squared-off edges"

### 5. Describe Depth & Elevation
Describe usage of shadows and layers (e.g., "Flat," "Whisper-soft diffused shadows").

## Output Format (DESIGN.md Structure)

```markdown
# Design System: [Project Title]
**Project ID:** [Insert Project ID Here]

## 1. Visual Theme & Atmosphere
(Description of the mood, density, and aesthetic philosophy.)

## 2. Color Palette & Roles
(List colors by Descriptive Name + Hex Code + Functional Role.)

## 3. Typography Rules
(Description of font family, weight usage for headers vs. body, and letter-spacing character.)

## 4. Component Stylings
* **Buttons:** (Shape description, color assignment, behavior).
* **Cards/Containers:** (Corner roundness description, background color, shadow depth).
* **Inputs/Forms:** (Stroke style, background).

## 5. Layout Principles
(Description of whitespace strategy, margins, and grid alignment.)
```

## Best Practices
- **Be Descriptive:** Use "Ocean-deep Cerulean (#0077B6)" instead of just "blue".
- **Be Functional:** Explain the purpose of design choices.
- **Be Precise:** Always include exact values (hex codes, pixels).
