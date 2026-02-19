import { Genre } from '@/types';

/**
 * Build genre-specific AI prompts for lyric suggestions
 */
export const buildSuggestionPrompt = (
  query: string,
  genre: Genre,
  creativity: number = 50
): string => {
  const genrePrompts: Record<Genre, string> = {
    'hip-hop': `Given the lyric line "${query}", suggest 5 creative next lines with:
- Internal rhymes and multisyllabic rhymes
- Wordplay and clever wordplay
- ${creativity > 70 ? 'Experimental and surprising' : 'Natural and flow-focused'} style
Return only a JSON array of strings.`,

    'k-pop': `Given the lyric line "${query}", suggest 5 next lines with:
- Mix of Korean loanwords and English hooks
- Catchy, repetitive phrases
- ${creativity > 70 ? 'Fun and playful' : 'Confident and smooth'} tone
Return only a JSON array of strings.`,

    'worship': `Given the worship lyric "${query}", suggest 5 next lines with:
- Biblical imagery and grace themes
- Declarative statements of faith
- ${creativity > 70 ? 'Poetic and metaphorical' : 'Singable and congregational'} language
Return only a JSON array of strings.`,

    'pop': `Given the lyric line "${query}", suggest 5 next lines with:
- Catchy, memorable phrasing
- Universal emotional themes
- ${creativity > 70 ? 'Unexpected and clever' : 'Radio-friendly and smooth'} style
Return only a JSON array of strings.`,

    'r&b': `Given the R&B lyric "${query}", suggest 5 next lines with:
- Smooth, sensual phrasing
- ${creativity > 70 ? 'Vocal run opportunities' : 'Groove-focused'} structure
- Intimate and evocative language
Return only a JSON array of strings.`,

    'country': `Given the country lyric "${query}", suggest 5 next lines with:
- Storytelling and rural imagery
- Twang-friendly language and rhymes
- ${creativity > 70 ? 'Unexpected narrative turns' : 'Authentic and heartfelt'} tone
Return only a JSON array of strings.`,

    'rock': `Given the rock lyric "${query}", suggest 5 next lines with:
- Powerful and anthemic phrasing
- ${creativity > 70 ? 'Experimental and bold' : 'Classic and driving'} energy
- Raw emotion and attitude
Return only a JSON array of strings.`,

    'indie': `Given the indie lyric "${query}", suggest 5 next lines with:
- Introspective and poetic language
- ${creativity > 70 ? 'Experimental and oblique' : 'Intimate and subtle'} imagery
- Authentic emotional voice
Return only a JSON array of strings.`,
  };

  return genrePrompts[genre] || genrePrompts['pop'];
};

/**
 * Parse JSON array response from Gemini API
 * Handles markdown code blocks and trailing text
 */
export const parseJsonResponse = (text: string): string[] => {
  try {
    let raw = text.trim();

    // Strip markdown code blocks
    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) raw = codeBlock[1].trim();

    // Find the first JSON array
    const firstBracket = raw.indexOf('[');
    if (firstBracket === -1) return [];

    // Find matching closing bracket
    let depth = 0;
    let end = -1;
    for (let i = firstBracket; i < raw.length; i++) {
      if (raw[i] === '[') depth++;
      else if (raw[i] === ']') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    const jsonStr = end >= 0 ? raw.slice(firstBracket, end + 1) : raw;
    const parsed = JSON.parse(jsonStr);

    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch (e) {
    console.error('Failed to parse JSON response:', e);
    return [];
  }
};

/**
 * Rhyme detection - build prompt for finding rhymes
 */
export const buildRhymePrompt = (word: string): string => {
  return `List 15 creative rhymes (perfect and near) for the word "${word}". Include multisyllabic rhymes. Return only a JSON array of strings, no explanations.`;
};

/**
 * Synonym detection - build prompt
 */
export const buildSynonymPrompt = (word: string, genre: Genre): string => {
  return `List 10 poetic synonyms for the word "${word}" suitable for ${genre} songwriting. Focus on emotional resonance. Return only a JSON array of strings.`;
};

/**
 * Scene/vivid description generation
 */
export const buildScenePrompt = (concept: string): string => {
  return `Generate 6 vivid, sensory-rich descriptions for the concept "${concept}". Include visual, auditory, and tactile details. Return only a JSON array of strings (1-2 sentences each).`;
};

/**
 * TextFX Explode - break word into similar sounds
 */
export const buildExplodePrompt = (word: string): string => {
  return `Break the word "${word}" into 8 similar-sounding phrases and words for songwriting. Return only a JSON array of strings.`;
};

/**
 * TextFX Simile - creative comparisons
 */
export const buildSimilePrompt = (concept: string): string => {
  return `Generate 8 creative similes and metaphors for "${concept}" suitable for song lyrics. Suggest unexpected comparisons. Return only a JSON array of strings.`;
};
