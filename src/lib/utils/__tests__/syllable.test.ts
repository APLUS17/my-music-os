import { describe, it, expect } from 'vitest';
import { countSyllables, countSyllablesInWord } from '../syllable';

describe('syllable utils', () => {
  describe('countSyllablesInWord', () => {
    it('should count syllables for basic words', () => {
      expect(countSyllablesInWord('check')).toBe(1);
      expect(countSyllablesInWord('ya')).toBe(1);
      expect(countSyllablesInWord('think')).toBe(1);
      expect(countSyllablesInWord('ballin')).toBe(2);
      expect(countSyllablesInWord('espy')).toBe(2);
    });

    it('should handle silent e at the end', () => {
      // e.g. like, please, game
      expect(countSyllablesInWord('like')).toBe(1);
      expect(countSyllablesInWord('please')).toBe(1);
      expect(countSyllablesInWord('game')).toBe(1);
    });

    it('should handle -le ending with consonant before it', () => {
      // e.g. apple, table, simple
      expect(countSyllablesInWord('apple')).toBe(2);
      expect(countSyllablesInWord('table')).toBe(2);
      expect(countSyllablesInWord('simple')).toBe(2);
    });

    it('should handle short words (length <= 3)', () => {
      expect(countSyllablesInWord('the')).toBe(1);
      expect(countSyllablesInWord('a')).toBe(1);
      expect(countSyllablesInWord('my')).toBe(1);
      expect(countSyllablesInWord('me')).toBe(1);
    });

    it('should handle non-alphabetic characters', () => {
      expect(countSyllablesInWord('check!')).toBe(1);
      expect(countSyllablesInWord('ballin...')).toBe(2);
    });

    it('should handle empty or whitespace word', () => {
      expect(countSyllablesInWord('')).toBe(0);
      expect(countSyllablesInWord('   ')).toBe(0);
    });
  });

  describe('countSyllables', () => {
    it('should count syllables for full sentences (from screenshot)', () => {
      expect(countSyllables('Check check please')).toBe(3);
      expect(countSyllables('Ya I think ya ballin')).toBe(6);
      expect(countSyllables('Like ya won an espy')).toBe(6);
      expect(countSyllables('hbrndnenwwn')).toBe(1);
    });

    it('should handle extra whitespace and newlines', () => {
      expect(countSyllables('  Check   check   please  ')).toBe(3);
      expect(countSyllables('Check\ncheck\nplease')).toBe(3);
    });

    it('should handle empty input', () => {
      expect(countSyllables('')).toBe(0);
      expect(countSyllables(null as any)).toBe(0);
      expect(countSyllables(undefined as any)).toBe(0);
    });
  });
});
