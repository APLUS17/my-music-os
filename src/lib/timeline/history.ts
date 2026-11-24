/**
 * Undo/redo for editor state, kept deliberately simple and safe.
 *
 * Each entry remembers the state before and after one edit. An entry is only
 * ever applied if the current state is still exactly its `after`: if anything
 * else replaced the state in the meantime (loading another song, say), the
 * history is stale and is dropped rather than resurrecting old content.
 *
 * Bursts of the same kind of edit (typing in one section) coalesce into a
 * single entry, so one undo reverts the burst, not one keystroke.
 */

interface Entry<T> {
    before: T;
    after: T;
    key?: string;
    at: number;
}

export interface PushOptions {
    /** Edits with the same key close together merge into one undo step. */
    key?: string;
    now?: number;
    coalesceMs?: number;
}

const DEFAULT_COALESCE_MS = 1200;
const MAX_ENTRIES = 60;

export class EditHistory<T> {
    private undoStack: Entry<T>[] = [];
    private redoStack: Entry<T>[] = [];

    get canUndo(): boolean { return this.undoStack.length > 0; }
    get canRedo(): boolean { return this.redoStack.length > 0; }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }

    push(before: T, after: T, opts: PushOptions = {}): void {
        if (before === after) return;
        const now = opts.now ?? Date.now();
        const top = this.undoStack[this.undoStack.length - 1];

        // Something else changed the state since our last edit: the old history no longer applies.
        if (top && top.after !== before) this.clear();

        const last = this.undoStack[this.undoStack.length - 1];
        if (
            opts.key !== undefined && last && last.key === opts.key &&
            now - last.at <= (opts.coalesceMs ?? DEFAULT_COALESCE_MS)
        ) {
            last.after = after;
            last.at = now;
        } else {
            this.undoStack.push({ before, after, key: opts.key, at: now });
            if (this.undoStack.length > MAX_ENTRIES) this.undoStack.shift();
        }
        this.redoStack = [];
    }

    /** The state to restore, or null if there is nothing (valid) to undo. */
    undo(current: T): T | null {
        const entry = this.undoStack[this.undoStack.length - 1];
        if (!entry) return null;
        if (entry.after !== current) {
            this.clear();
            return null;
        }
        this.undoStack.pop();
        this.redoStack.push(entry);
        return entry.before;
    }

    redo(current: T): T | null {
        const entry = this.redoStack[this.redoStack.length - 1];
        if (!entry) return null;
        if (entry.before !== current) {
            this.clear();
            return null;
        }
        this.redoStack.pop();
        this.undoStack.push(entry);
        return entry.after;
    }
}
