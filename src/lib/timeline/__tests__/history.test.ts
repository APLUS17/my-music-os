import { describe, it, expect } from 'vitest';
import { EditHistory } from '../history';

// Distinct object identities, as in the app (every edit makes a new array).
const v = (n: number) => ({ n });

describe('EditHistory', () => {
    it('undoes and redoes in order', () => {
        const h = new EditHistory<{ n: number }>();
        const a = v(1), b = v(2), c = v(3);
        h.push(a, b);
        h.push(b, c);
        expect(h.undo(c)).toBe(b);
        expect(h.undo(b)).toBe(a);
        expect(h.undo(a)).toBeNull();
        expect(h.redo(a)).toBe(b);
        expect(h.redo(b)).toBe(c);
        expect(h.redo(c)).toBeNull();
    });

    it('a new edit clears redo', () => {
        const h = new EditHistory<{ n: number }>();
        const a = v(1), b = v(2), c = v(3);
        h.push(a, b);
        h.undo(b);
        expect(h.canRedo).toBe(true);
        h.push(a, c);
        expect(h.canRedo).toBe(false);
    });

    it('coalesces a burst of the same kind of edit into one step', () => {
        const h = new EditHistory<{ n: number }>();
        const s = [v(0), v(1), v(2), v(3)];
        h.push(s[0], s[1], { key: 'text:a', now: 1000 });
        h.push(s[1], s[2], { key: 'text:a', now: 1400 });
        h.push(s[2], s[3], { key: 'text:a', now: 1800 });
        expect(h.undo(s[3])).toBe(s[0]);   // one undo reverts all three keystrokes
        expect(h.canUndo).toBe(false);
    });

    it('does not coalesce across keys or after a pause', () => {
        const h = new EditHistory<{ n: number }>();
        const s = [v(0), v(1), v(2), v(3)];
        h.push(s[0], s[1], { key: 'text:a', now: 1000 });
        h.push(s[1], s[2], { key: 'text:b', now: 1100 });
        h.push(s[2], s[3], { key: 'text:b', now: 1100 + 5000 });
        expect(h.undo(s[3])).toBe(s[2]);
        expect(h.undo(s[2])).toBe(s[1]);
        expect(h.undo(s[1])).toBe(s[0]);
    });

    it('never coalesces edits without a key (structure changes stay separate)', () => {
        const h = new EditHistory<{ n: number }>();
        const s = [v(0), v(1), v(2)];
        h.push(s[0], s[1], { now: 1000 });
        h.push(s[1], s[2], { now: 1001 });
        expect(h.undo(s[2])).toBe(s[1]);
    });

    it('drops a stale history instead of resurrecting old content', () => {
        const h = new EditHistory<{ n: number }>();
        const a = v(1), b = v(2);
        h.push(a, b);
        const someOtherSong = v(99);           // state replaced by something that did not go through the history
        expect(h.undo(someOtherSong)).toBeNull();
        expect(h.canUndo).toBe(false);
    });

    it('a foreign change before the next edit starts a fresh history', () => {
        const h = new EditHistory<{ n: number }>();
        const a = v(1), b = v(2), other = v(50), next = v(51);
        h.push(a, b);
        h.push(other, next);                    // `other` is not what the last entry ended on
        expect(h.undo(next)).toBe(other);
        expect(h.canUndo).toBe(false);          // the old entry (a -> b) is gone
    });

    it('ignores no-op pushes', () => {
        const h = new EditHistory<{ n: number }>();
        const a = v(1);
        h.push(a, a);
        expect(h.canUndo).toBe(false);
    });

    it('caps its size', () => {
        const h = new EditHistory<{ n: number }>();
        let cur = v(0);
        for (let i = 1; i <= 100; i++) { const nxt = v(i); h.push(cur, nxt, { now: i }); cur = nxt; }
        let steps = 0;
        let state: { n: number } | null = cur;
        while (state && (state = h.undo(state))) steps++;
        expect(steps).toBeLessThanOrEqual(60);
        expect(steps).toBeGreaterThan(30);
    });
});
