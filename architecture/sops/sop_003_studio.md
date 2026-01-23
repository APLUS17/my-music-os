# SOP 003: The Studio (Creative Lab)

## 1. Objective
The central workspace where the artist creates. It combines a text editor (Lyrics) with an audio player (Beats/Demos) and creative tools (Rhymes).

## 2. Inputs & Triggers
- **Load:** `/project/[id]` triggers loading Project data.
- **Action:** User types in Text Area -> Updates `Idea` content.
- **Action:** User clicks "Rhyme" -> Fetches Datamuse data.
- **Action:** User uploads/plays audio -> Triggers Audio Player.

## 3. Mock Logical Architecture
Since we are in **Mock Mode**, the Studio will simulate:

### A. The Lyric Editor (Writing)
- **Component:** `TextEditor.tsx`
- **Logic:** Uses `useState` to track text.
- **"Save":** Updates the in-memory `projectStore` (defined in `actions.ts`).

### B. The Audio Player (Listening)
- **Component:** `AudioPlayer.tsx`
- **Logic:** Standard HTML5 `<audio>` tag.
- **Mock Data:** We will provide a sample "beat.mp3" in the `public` folder so the user can test playback immediately without uploading files.

### C. The Creative Assistant (Thinking)
- **Component:** `CreativeSidebar.tsx`
- **Logic:** Calls `getCreativeSuggestion` (Datamuse API) matching the user's selected text.

## 4. UI Layout (Vibecode Aesthetic)
- **Left:** Audio Controls & Waveform (Visual).
- **Center:** The "Page" (Text Editor).
- **Right:** Tools (Rhymes, Synonyms).
- **Vibe:** Dark mode, focus-driven, glassmorphism panels.

## 5. Mock Output
- A fully interactive "Studio" page where you can write lyrics, play a demo beat, and see rhyme suggestions.
