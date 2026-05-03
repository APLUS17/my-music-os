import { describe, it, expect, vi } from 'vitest';
import { generateId, randomId } from '../id';

describe('id utils', () => {
  describe('generateId', () => {
    it('should start with the provided prefix', () => {
      const prefix = 'test-';
      const id = generateId(prefix);
      expect(id.startsWith(prefix)).toBe(true);
    });

    it('should work without a prefix', () => {
      const id = generateId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should contain a timestamp, random part, and counter', () => {
      const id = generateId();
      // Format: {timestamp}-{randomPart}-{counter}
      const parts = id.split('-');
      expect(parts.length).toBeGreaterThanOrEqual(3);

      const counterPart = parts[parts.length - 1];
      const randomPart = parts[parts.length - 2];

      expect(parseInt(counterPart)).not.toBeNaN();
      expect(randomPart.length).toBeLessThanOrEqual(6);
    });

    it('should increment the counter', () => {
      const id1 = generateId('');
      const id2 = generateId('');

      const parts1 = id1.split('-');
      const parts2 = id2.split('-');

      const counter1 = parseInt(parts1[parts1.length - 1]);
      const counter2 = parseInt(parts2[parts2.length - 1]);

      expect(counter2).toBe(counter1 + 1);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      const count = 100;
      for (let i = 0; i < count; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(count);
    });

    it('should use a timestamp-like value', () => {
        const id = generateId();
        const parts = id.split('-');
        // Timestamp is the first part (or second if prefix contains -)
        // If no prefix, it's the first part.
        const idNoPrefix = generateId('');
        const timestampPart = idNoPrefix.split('-')[0];

        // Should be base36
        expect(parseInt(timestampPart, 36)).toBeGreaterThan(0);
    });
  });

  describe('randomId', () => {
    it('should return a string', () => {
      const id = randomId();
      expect(typeof id).toBe('string');
    });

    it('should be alphanumeric', () => {
      const id = randomId();
      // Alphanumeric check
      if (id.length > 0) {
        expect(id).toMatch(/^[a-z0-9]+$/);
      }
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      const count = 100;
      for (let i = 0; i < count; i++) {
        ids.add(randomId());
      }
      expect(ids.size).toBe(count);
    });
  });
});
