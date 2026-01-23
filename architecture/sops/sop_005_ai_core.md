# SOP 005: Songwriter's Engine (Datamuse Intelligence)

## 1. Objective
Enable high-speed lyrical assistance directly within the Studio using the free Datamuse API. This tool acts as an instantaneous rhyming dictionary and thematic word-bank.

## 2. Core Features
- **Perfect Rhymes (`rel_rhy`)**: Words that rhyme exactly.
- **Slant Rhymes (`rel_nry`)**: Approximate rhymes for modern, natural flows.
- **Vibe Explorer (`ml`)**: Find words with similar meanings/thematics to a core concept.
- **Descriptive Associations (`rel_jjb`)**: Find adjectives often used to describe your word (e.g., "Neon" -> "bright", "flickering", "colorful").

## 3. Technical Implementation
- **API**: `https://api.datamuse.com/words`
- **Frontend Logic**: The `CreativeSidebar` will feature a toggle to switch between different search modes.
- **Highlight-to-Search**: Selecting a word in the `TextEditor` sends that word to the `Songwriter's Engine` automatically.

## 4. UI Layout
- **Sidebar Tabs**: Standard Rhymes | Slant Rhymes | Thematic Vibes.
- **Results List**: Sorted by "Score" (Datamuse's confidence level).

