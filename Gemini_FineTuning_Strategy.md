# Gemini Fine-Tuning & Prompting Strategy for Lyriq

This document outlines the three-tiered approach to optimizing the Gemini model for advanced songwriting intelligence within the Lyriq (my-music-os) platform. This strategy ascends from basic prompt engineering to full model tuning, aligning with our PRD roadmap.

---

## Level 1: System Instructions & Context Steering (Zero-Shot)

**Concept:** Heavily condition the model via the `systemInstruction` parameter before the user even types anything. This sets strict rules for syllabic rhythm, internal rhymes, and tone profiles.

### Key Requirements & Implementation
- **Dynamic Prompt Templates:** Create JSON/TypeScript mappings of genres (e.g., "Afrobeats", "Dark Vaporwave") to specific musical instruction sets.
- **Stateful Injectors:** Logic in `geminiService.ts` to dynamically append rules (e.g., "Always match the syllable count of the previous line") based on the current UI state.
- **Persona Definitions:** Pre-written system prompts for different "Facilitator" personalities.

### Efficiency Gains
- **For the Model:** Highly cacheable prompts. Extremely low latency since it relies on zero-shot inference without needing massive context windows.
- **For the User:** Immediate, high-quality, genre-accurate results without the user needing to manually type "write this in a sad country style."

### Roadmap Tie-in
- **Phase 1.3 (Genre/Mood Context):** Directly enables the ability to steer AI vocabulary based on project settings.
- **Phase 2.3 (AI Personality Modes):** Forms the foundation for switching between "Technical Critic" and "Hype Partner" personas.

---

## Level 2: RAG & Few-Shot Prompting (Dynamic Context)

**Concept:** Instead of just giving the model rules, give it *examples* on the fly. We pull the user's previously written (and liked) lyrics from the Vault and feed them as context to mimic the user's unique cadence and vocabulary.

### Key Requirements & Implementation
- **Searchable Vault Architecture:** The Vault must be queryable (via full-text search or vector embeddings).
- **Context Assembler Pipeline:** When a user asks for a suggestion, the backend must fetch 3-5 relevant fragments from their recent Rituals/Vault.
- **Few-Shot Formatting:** Format the prompt as: *"Here are 4 bars the user just wrote: [Data]. Suggest the next 2 bars keeping the exact same cadence."*

### Efficiency Gains
- **For the Model:** Grounded generation. The model hallucinate less and follows rhythmic structures much better when given concrete examples in the prompt window.
- **For the User:** The AI sounds exactly like *them*. It dramatically reduces the time spent editing and rewriting AI suggestions because the output already matches their personal style.

### Roadmap Tie-in
- **Phase 2.1 (Smart Idea Recall):** This is the core engine for surfacing relevant Ideas from the bank while writing.
- **Phase 3.1 (Collaboration):** Can be used to blend the styles of multiple writers in a shared session by pulling from both of their Vaults.

---

## Level 3: Actual Model Tuning (Parameter-Efficient Fine-Tuning)

**Concept:** Physically altering the model's weights by training it on a specific dataset. This is used to natively emulate a highly specific genre, artist flow, or even a specific user's entire discography without needing long prompts.

### Key Requirements & Implementation
- **Dataset Pipeline:** Infrastructure to export high-quality, formatted JSONL documents mapping prompts to lyrical outputs (`{"text_input": "...", "output": "..."}`). Needs hundreds/thousands of examples.
- **Vertex AI / Google AI Studio Integration:** A pipeline to upload the dataset, train the model, and retrieve the new `tunedModel` ID.
- **Dynamic Model Routing:** Updating `geminiService.ts` to use custom model IDs (e.g., `model: "tunedModels/user-custom-lyricist-id"`) instead of the base Flash model.

### Efficiency Gains
- **For the Model:** Can achieve incredibly nuanced results on smaller (cheaper/faster) models because the knowledge is baked into the weights, significantly reducing the required input token count.
- **For the User:** The ultimate "Pro" tool. It acts as a true digital clone of their songwriting brain or provides absolute mastery of a specific niche genre out-of-the-box.

### Roadmap Tie-in
- **Phase 3 (Market Leadership):** This is a massive differentiator for a premium/pro tier. 
- **Phase 3.2 (Template Marketplace):** Opens the door to creating and selling "Tuned Genre Models" (e.g., "The 90s Boom Bap Model") on a marketplace.
