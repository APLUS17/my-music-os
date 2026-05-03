import { describe, it, expect } from 'vitest';
import { formatTime } from '../time';

describe('time utils', () => {
  describe('formatTime', () => {
    it('should format seconds to mm:ss', () => {
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(5)).toBe('00:05');
      expect(formatTime(60)).toBe('01:00');
      expect(formatTime(65)).toBe('01:05');
      expect(formatTime(3599)).toBe('59:59');
    });

    it('should handle minutes greater than 59', () => {
      expect(formatTime(3600)).toBe('60:00');
      expect(formatTime(3665)).toBe('61:05');
    });

    it('should handle null, undefined, and NaN', () => {
      expect(formatTime(null)).toBe('00:00');
      expect(formatTime(undefined)).toBe('00:00');
      expect(formatTime(NaN)).toBe('00:00');
    });

    it('should handle negative numbers', () => {
      expect(formatTime(-10)).toBe('00:00');
    });

    it('should handle non-finite numbers', () => {
      expect(formatTime(Infinity)).toBe('00:00');
      expect(formatTime(-Infinity)).toBe('00:00');
    });

    it('should floor decimal seconds', () => {
      expect(formatTime(65.7)).toBe('01:05');
      expect(formatTime(0.9)).toBe('00:00');
    });
  });
});
