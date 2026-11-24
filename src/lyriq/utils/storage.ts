import type { ImportedBeat, SongSession, Take } from '../types';

/**
 * Local persistence for songs and their audio.
 *
 * Song structure is stored as one JSON-like record; audio (beats and takes)
 * goes in a separate object store as Blobs, keyed by id, so saving a lyric
 * edit never rewrites megabytes of audio.
 */

const DB_NAME = 'lyriq';
const DB_VERSION = 1;
const META_STORE = 'meta';
const BLOB_STORE = 'blobs';
const WORKSPACE_KEY = 'workspace';
const SCHEMA_VERSION = 1;

type StoredTake = Omit<Take, 'audioUrl' | 'audioBlob'> & { blobKey?: string };
type StoredBeat = Omit<ImportedBeat, 'audioUrl' | 'audioBlob'> & { blobKey?: string };
type StoredSession = Omit<SongSession, 'sections' | 'importedBeat'> & {
  sections: Array<Omit<SongSession['sections'][number], 'voiceNotes'> & { voiceNotes: StoredTake[] }>;
  importedBeat: StoredBeat | null;
};

interface StoredWorkspace {
  version: number;
  activeSessionId: string;
  sessions: StoredSession[];
  beats?: StoredBeat[];
  savedAt: number;
}

const WIPE_AUDIO_MARKER_KEY = 'lyriq_wiped_audio_beat_user_req_v1';

interface LoadedWorkspace {
  workspace: StoredWorkspace;
  blobs: Map<string, Blob>;
}

/** Blob keys already written, so unchanged audio isn't rewritten on every save. */
const persistedBlobKeys = new Set<string>();

export function beatBlobKey(beatId: string): string {
  return `beat:${beatId}`;
}

export function takeBlobKey(takeId: string): string {
  return `take:${takeId}`;
}

export interface BlobUrlRegistryOptions {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

interface BlobUrlEntry {
  url: string;
  blob: Blob;
  refCount: number;
}

/**
 * Reference-counted registry for `blob:` object URLs so duplicate URLs are not
 * allocated for the same audio asset and URLs are only revoked once no longer
 * referenced by active state or undo/redo history.
 */
export class BlobUrlRegistry {
  private readonly entries = new Map<string, BlobUrlEntry>();
  private readonly createObjectURL: (blob: Blob) => string;
  private readonly revokeObjectURL: (url: string) => void;

  constructor(options: BlobUrlRegistryOptions = {}) {
    this.createObjectURL = options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
    this.revokeObjectURL = options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url));
  }

  acquire(id: string, blob: Blob): string {
    const existing = this.entries.get(id);
    if (existing) {
      if (existing.blob === blob) {
        existing.refCount += 1;
        return existing.url;
      }
      this.revokeObjectURL(existing.url);
    }

    const url = this.createObjectURL(blob);
    this.entries.set(id, { url, blob, refCount: 1 });
    return url;
  }

  get(id: string): string | undefined {
    return this.entries.get(id)?.url;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  get size(): number {
    return this.entries.size;
  }

  release(id: string): void {
    const existing = this.entries.get(id);
    if (!existing) return;
    existing.refCount -= 1;
    if (existing.refCount <= 0) {
      this.entries.delete(id);
      this.revokeObjectURL(existing.url);
    }
  }

  syncActiveIds(activeIds: ReadonlySet<string>): number {
    let revoked = 0;
    for (const [id, entry] of this.entries) {
      if (!activeIds.has(id)) {
        this.entries.delete(id);
        this.revokeObjectURL(entry.url);
        revoked += 1;
      }
    }
    return revoked;
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      this.revokeObjectURL(entry.url);
    }
    this.entries.clear();
  }
}

export const blobUrlRegistry = new BlobUrlRegistry();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open storage'));
    req.onblocked = () => reject(new Error('Storage is blocked by another tab'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Storage write failed'));
    tx.onabort = () => reject(tx.error ?? new Error('Storage write was aborted'));
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Returns the saved workspace and its audio, or null if nothing is stored (or storage is unavailable). */
export async function loadWorkspace(): Promise<LoadedWorkspace | null> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }
  try {
    const tx = db.transaction([META_STORE, BLOB_STORE], 'readonly');
    const workspace = (await request(tx.objectStore(META_STORE).get(WORKSPACE_KEY))) as StoredWorkspace | undefined;
    if (!workspace || workspace.version !== SCHEMA_VERSION || !Array.isArray(workspace.sessions) || workspace.sessions.length === 0) {
      return null;
    }
    const blobStore = tx.objectStore(BLOB_STORE);
    const keys = (await request(blobStore.getAllKeys())) as string[];
    const blobs = new Map<string, Blob>();
    for (const key of keys) {
      const blob = (await request(blobStore.get(key))) as Blob | undefined;
      if (blob) {
        blobs.set(key, blob);
        persistedBlobKeys.add(key);
      }
    }
    return { workspace, blobs };
  } catch (err) {
    console.warn('Could not read saved songs:', err);
    return null;
  } finally {
    db.close();
  }
}

/** Rebuilds live sessions and beat catalog (with fresh object URLs) from stored data. */
export function rehydrateSessions({ workspace, blobs }: LoadedWorkspace): {
  sessions: SongSession[];
  activeSessionId: string;
  beats: ImportedBeat[];
} {
  const beatUrlCache = new Map<string, ImportedBeat>();

  const rehydrateBeat = (storedBeat: StoredBeat | null | undefined): ImportedBeat | null => {
    if (!storedBeat) return null;
    const cached = beatUrlCache.get(storedBeat.id);
    if (cached) {
      // Preserve cached arrangement / grid metadata if either copy has it.
      if (!cached.arrangement && storedBeat.arrangement) {
        cached.arrangement = storedBeat.arrangement;
      }
      if (cached.gridOriginSec === undefined && storedBeat.gridOriginSec !== undefined) {
        cached.gridOriginSec = storedBeat.gridOriginSec;
      }
      if (cached.bpmConfidence === undefined && storedBeat.bpmConfidence !== undefined) {
        cached.bpmConfidence = storedBeat.bpmConfidence;
      }
      return cached;
    }
    const beatBlob = storedBeat.blobKey ? blobs.get(storedBeat.blobKey) : undefined;
    if (!beatBlob) return null;
    const { blobKey: _k, ...rest } = storedBeat;
    const beat: ImportedBeat = {
      ...rest,
      audioBlob: beatBlob,
      audioUrl: blobUrlRegistry.acquire(beatBlobKey(storedBeat.id), beatBlob),
    };
    beatUrlCache.set(beat.id, beat);
    return beat;
  };

  // Rehydrate catalog beats first so cached Vault arrangements and grid metadata win.
  const beatsMap = new Map<string, ImportedBeat>();
  for (const storedBeat of workspace.beats ?? []) {
    const hydrated = rehydrateBeat(storedBeat);
    if (hydrated) beatsMap.set(hydrated.id, hydrated);
  }

  const sessions = workspace.sessions.map((s): SongSession => {
    const beat = rehydrateBeat(s.importedBeat);
    if (beat && !beatsMap.has(beat.id)) {
      beatsMap.set(beat.id, beat);
    }
    return {
      ...s,
      importedBeat: beat,
      sections: s.sections.map(sec => ({
        ...sec,
        voiceNotes: sec.voiceNotes.map((t): Take => {
          const { blobKey, ...rest } = t;
          const blob = blobKey ? blobs.get(blobKey) : undefined;
          return blob ? { ...rest, audioBlob: blob, audioUrl: blobUrlRegistry.acquire(takeBlobKey(t.id), blob) } : rest;
        }),
      })),
    };
  });

  const active = sessions.some(s => s.id === workspace.activeSessionId) ? workspace.activeSessionId : sessions[0].id;
  return { sessions, activeSessionId: active, beats: Array.from(beatsMap.values()) };
}

/** Writes all songs and standalone beats. Audio blobs are only written when new; orphaned blobs are removed. */
export async function saveWorkspace(
  sessions: SongSession[],
  activeSessionId: string,
  beats: ImportedBeat[] = []
): Promise<void> {
  const referenced = new Map<string, Blob>();

  const toStoredBeat = (beat: ImportedBeat): StoredBeat => {
    const { audioUrl: _u, audioBlob, ...rest } = beat;
    const blobKey = audioBlob ? beatBlobKey(beat.id) : undefined;
    if (audioBlob && blobKey) referenced.set(blobKey, audioBlob);
    return { ...rest, blobKey };
  };

  const stored: StoredSession[] = sessions.map(s => {
    const importedBeat = s.importedBeat ? toStoredBeat(s.importedBeat) : null;
    return {
      ...s,
      importedBeat,
      sections: s.sections.map(sec => ({
        ...sec,
        voiceNotes: (sec.voiceNotes || []).map((t): StoredTake => {
          const { audioUrl: _u, audioBlob, ...rest } = t;
          const blobKey = audioBlob ? takeBlobKey(t.id) : undefined;
          if (audioBlob && blobKey) referenced.set(blobKey, audioBlob);
          return { ...rest, blobKey };
        }),
      })),
    };
  });

  const storedBeats: StoredBeat[] = beats.map(toStoredBeat);

  const db = await openDb();
  try {
    const existingKeys = (await request(db.transaction(BLOB_STORE, 'readonly').objectStore(BLOB_STORE).getAllKeys())) as string[];

    const tx = db.transaction([META_STORE, BLOB_STORE], 'readwrite');
    const blobStore = tx.objectStore(BLOB_STORE);
    const written: string[] = [];
    for (const [key, blob] of referenced) {
      if (!persistedBlobKeys.has(key) || !existingKeys.includes(key)) {
        blobStore.put(blob, key);
        written.push(key);
      }
    }
    for (const key of existingKeys) {
      if (!referenced.has(key)) {
        blobStore.delete(key);
        persistedBlobKeys.delete(key);
      }
    }
    const workspace: StoredWorkspace = {
      version: SCHEMA_VERSION,
      activeSessionId,
      sessions: stored,
      beats: storedBeats,
      savedAt: Date.now(),
    };
    tx.objectStore(META_STORE).put(workspace, WORKSPACE_KEY);
    await done(tx);
    written.forEach(k => persistedBlobKeys.add(k));
  } finally {
    db.close();
  }

  // Ask the browser not to evict this origin's storage under pressure.
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
}

export function hasAudioWipeMarker(): boolean {
  try {
    return Boolean(window.localStorage.getItem(WIPE_AUDIO_MARKER_KEY));
  } catch {
    return true; // If localStorage is blocked, avoid wiping user state repeatedly.
  }
}

export function markAudioWiped(): void {
  try {
    window.localStorage.setItem(WIPE_AUDIO_MARKER_KEY, 'true');
  } catch {
    // Storage blocked: non-fatal.
  }
}
