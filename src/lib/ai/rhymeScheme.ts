/**
 * Rhyme scheme detection and visualization
 * Detects patterns like AABB, ABAB, ABCB, etc.
 */

// Simple phonetic ending patterns for rhyme detection
// Maps word endings to their phonetic class
const getPhoneticEnding = (word: string): string => {
  if (!word) return '';
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length < 2) return clean;

  // Simple vowel-consonant pattern matching
  // Get last 2-3 characters
  const len = clean.length;
  const endings = [
    clean.slice(-3), // last 3 chars
    clean.slice(-2), // last 2 chars
  ];

  // Return the ending that gives best rhyme matches
  return endings[0] || endings[1];
};

export interface RhymeMatch {
  index: number;
  endWord: string;
  family: string;
}

export interface DetectedScheme {
  pattern: string; // e.g., "AABB", "ABAB"
  lines: RhymeMatch[];
  family: Map<string, number[]>; // family -> line indices
}

/**
 * Detect rhyme scheme from array of lyrics
 * Uses simple phonetic matching - not perfect but fast and mobile-friendly
 */
export const detectRhymeScheme = (lyrics: string[]): DetectedScheme => {
  const family = new Map<string, number[]>();
  const scheme: string[] = [];
  const lines: RhymeMatch[] = [];
  let schemeIndex = 0;
  const schemeMap = new Map<string, string>();

  lyrics.forEach((lyric, idx) => {
    const words = lyric.trim().split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    const ending = getPhoneticEnding(lastWord);

    if (!ending) {
      scheme.push('?');
      lines.push({ index: idx, endWord: lastWord, family: '?' });
      return;
    }

    // Check if we've seen this ending before
    let familyKey = '';
    for (const [key, value] of schemeMap.entries()) {
      if (key === ending || isSimilarEnding(ending, key)) {
        familyKey = value;
        break;
      }
    }

    // If no match, create new family
    if (!familyKey) {
      familyKey = String.fromCharCode(65 + schemeIndex); // A, B, C, etc.
      schemeMap.set(ending, familyKey);
      schemeIndex++;
    }

    scheme.push(familyKey);
    lines.push({ index: idx, endWord: lastWord, family: familyKey });

    // Track which lines belong to this family
    if (!family.has(familyKey)) {
      family.set(familyKey, []);
    }
    family.get(familyKey)!.push(idx);
  });

  return {
    pattern: scheme.join(''),
    lines,
    family,
  };
};

/**
 * Check if two word endings are similar enough to rhyme
 * Very simple heuristic - checks last 2-3 characters
 */
const isSimilarEnding = (ending1: string, ending2: string): boolean => {
  if (ending1 === ending2) return true;

  // Check if they share the same last 2 characters (consonant-vowel patterns)
  if (ending1.length >= 2 && ending2.length >= 2) {
    const e1 = ending1.slice(-2);
    const e2 = ending2.slice(-2);
    if (e1 === e2) return true;
  }

  // Check if they both end with the same vowel + consonant
  if (ending1.length >= 1 && ending2.length >= 1) {
    const vowels = 'aeiou';
    for (let i = ending1.length - 1; i >= 0; i--) {
      if (vowels.includes(ending1[i])) {
        for (let j = ending2.length - 1; j >= 0; j--) {
          if (vowels.includes(ending2[j])) {
            // Match if both have same trailing vowel-consonant
            if (
              i + 1 < ending1.length &&
              j + 1 < ending2.length &&
              ending1[i + 1] === ending2[j + 1]
            ) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
};

/**
 * Get color for rhyme family
 * Returns Tailwind class names for consistency
 */
export const getFamilyColor = (family: string): string => {
  const colors = [
    'bg-blue-500/20 border-blue-500/40 text-blue-400', // A - blue
    'bg-green-500/20 border-green-500/40 text-green-400', // B - green
    'bg-purple-500/20 border-purple-500/40 text-purple-400', // C - purple
    'bg-pink-500/20 border-pink-500/40 text-pink-400', // D - pink
    'bg-yellow-500/20 border-yellow-500/40 text-yellow-400', // E - yellow
    'bg-indigo-500/20 border-indigo-500/40 text-indigo-400', // F - indigo
  ];

  const charCode = family.charCodeAt(0) - 65; // A=0, B=1, etc.
  return colors[charCode % colors.length];
};

/**
 * Get rhyme words from Datamuse API (fallback)
 */
export const getRhymesFromDatamuse = async (word: string): Promise<string[]> => {
  try {
    const response = await fetch(`https://api.datamuse.com/words?rel_rhy=${word}`);
    if (!response.ok) throw new Error('Datamuse API failed');

    const data = await response.json();
    return data.slice(0, 10).map((item: any) => item.word);
  } catch (e) {
    console.error('Datamuse API error:', e);
    return [];
  }
};

/**
 * Get near rhymes (slant rhymes)
 */
export const getNearRhymesFromDatamuse = async (word: string): Promise<string[]> => {
  try {
    const response = await fetch(`https://api.datamuse.com/words?rel_nry=${word}`);
    if (!response.ok) throw new Error('Datamuse API failed');

    const data = await response.json();
    return data.slice(0, 10).map((item: any) => item.word);
  } catch (e) {
    console.error('Datamuse API error:', e);
    return [];
  }
};
