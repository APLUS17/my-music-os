import { renderHook } from '@testing-library/react';
import { useActiveBeatSection } from '../useActiveBeatSection';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useActiveBeatSection', () => {
    let sections: Array<{ startTime: number; endTime: number }>;

    beforeEach(() => {
        sections = [
            { startTime: 0, endTime: 10 },
            { startTime: 10, endTime: 20 },
            { startTime: 20, endTime: 30 },
        ];
    });

    it('returns -1 when no sections are provided', () => {
        const { result } = renderHook(() => useActiveBeatSection([], 5));
        expect(result.current).toBe(-1);
    });

    it('returns -1 when time is null', () => {
        const { result } = renderHook(() => useActiveBeatSection(sections, null));
        expect(result.current).toBe(-1);
    });

    it('finds the correct section with linear search on first run (if not first section)', () => {
        const spy = vi.spyOn(sections, 'findIndex');
        const { result } = renderHook(() => useActiveBeatSection(sections, 15));

        expect(result.current).toBe(1);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('uses Fast Path 2 for the first section on first run', () => {
        const spy = vi.spyOn(sections, 'findIndex');
        const { result } = renderHook(() => useActiveBeatSection(sections, 5));

        expect(result.current).toBe(0);
        expect(spy).not.toHaveBeenCalled(); // Fast path 2 (lastIdx + 1) handles index 0
    });

    it('uses Fast Path 1 when staying in the same section', () => {
        const { result, rerender } = renderHook(
            ({ time }) => useActiveBeatSection(sections, time),
            { initialProps: { time: 15 } }
        );

        expect(result.current).toBe(1);

        const spy = vi.spyOn(sections, 'findIndex');
        rerender({ time: 17 });
        expect(result.current).toBe(1);
        expect(spy).not.toHaveBeenCalled(); // Fast path 1
    });

    it('uses Fast Path 2 when moving to the next section', () => {
        const { result, rerender } = renderHook(
            ({ time }) => useActiveBeatSection(sections, time),
            { initialProps: { time: 5 } }
        );

        expect(result.current).toBe(0);

        const spy = vi.spyOn(sections, 'findIndex');
        rerender({ time: 15 });
        expect(result.current).toBe(1);
        expect(spy).not.toHaveBeenCalled(); // Fast path 2
    });

    it('falls back to linear search when jumping multiple sections forward', () => {
        const { result, rerender } = renderHook(
            ({ time }) => useActiveBeatSection(sections, time),
            { initialProps: { time: 5 } }
        );

        expect(result.current).toBe(0);

        const spy = vi.spyOn(sections, 'findIndex');
        rerender({ time: 25 });
        expect(result.current).toBe(2);
        expect(spy).toHaveBeenCalledTimes(1); // Jumped over section 1, so fast paths fail
    });

    it('uses Fast Path 3 when moving backwards', () => {
        const { result, rerender } = renderHook(
            ({ time }) => useActiveBeatSection(sections, time),
            { initialProps: { time: 15 } }
        );

        expect(result.current).toBe(1);

        const spy = vi.spyOn(sections, 'findIndex');
        rerender({ time: 5 });
        expect(result.current).toBe(0);
        expect(spy).not.toHaveBeenCalled(); // Fast path 3
    });

    it('handles floating point boundaries correctly', () => {
        const { result } = renderHook(() => useActiveBeatSection(sections, 10));
        expect(result.current).toBe(1); // [10, 20)
    });

    it('handles exact end boundary correctly', () => {
        const { result } = renderHook(() => useActiveBeatSection(sections, 9.9999));
        expect(result.current).toBe(0);
    });

    it('handles overlapping sections by returning the first match', () => {
        const overlappingSections = [
            { startTime: 0, endTime: 10 },
            { startTime: 5, endTime: 15 },
        ];
        const { result } = renderHook(() => useActiveBeatSection(overlappingSections, 7));
        expect(result.current).toBe(0);
    });
});
