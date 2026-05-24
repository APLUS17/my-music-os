/**
 * Counts the syllables in a single English word using a heuristic-based algorithm.
 */
export function countSyllablesInWord(word: string): number {
  word = word.toLowerCase().trim();
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;

  // Remove non-alphabetic characters
  word = word.replace(/[^a-z]/g, '');
  if (word.length === 0) return 0;

  // Match vowel sequences (a, e, i, o, u, y)
  const vowelSequences = word.match(/[aeiouy]+/g);
  let count = vowelSequences ? vowelSequences.length : 0;

  // Subtract for silent 'e' at the end
  if (word.endsWith('e')) {
    // If it ends in '-le' with a consonant before it, it sounds as a syllable (e.g. table, apple, simple)
    const isLeEnding = word.endsWith('le') && word.length > 2 && !'aeiouy'.includes(word[word.length - 3]);
    if (!isLeEnding) {
      count--;
    }
  }

  return Math.max(1, count);
}

/**
 * Counts the total syllables in a sentence or block of text.
 */
export function countSyllables(text: string): number {
  if (!text) return 0;
  
  // Split into words by whitespace and filter out any empty strings
  const words = text.split(/\s+/).filter(word => word.length > 0);
  let total = 0;
  for (const word of words) {
    total += countSyllablesInWord(word);
  }
  return total;
}
