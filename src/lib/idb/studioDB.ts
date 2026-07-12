import { MuseManifest } from '@/types';

const DB_NAME = 'StudioProDB';
const DB_VERSION = 2;
const STORE_NAME = 'audio_assets';
const CHUNKS_STORE = 'muse_chunks';
const AUDIO_STORE = 'muse_audio';
const MANIFESTS_STORE = 'muse_manifests';

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return;
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            // Version 1 upgrade
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            // Version 2 upgrades
            if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
                db.createObjectStore(CHUNKS_STORE);
            }
            if (!db.objectStoreNames.contains(AUDIO_STORE)) {
                db.createObjectStore(AUDIO_STORE);
            }
            if (!db.objectStoreNames.contains(MANIFESTS_STORE)) {
                db.createObjectStore(MANIFESTS_STORE, { keyPath: 'id' });
            }
        };
    });
};

// Legacy Base64 helpers (compatibility)
export const saveAudioData = async (id: string, data: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(data, id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getAudioData = async (id: string): Promise<string | undefined> => {
    if (typeof window === 'undefined') return undefined;
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const deleteAudioData = async (id: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Muse Chunks helpers
export const putMuseChunk = async (recId: string, seq: number, blob: Blob): Promise<void> => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    const key = `${recId}:${String(seq).padStart(6, '0')}`;
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CHUNKS_STORE, 'readwrite');
        const store = tx.objectStore(CHUNKS_STORE);
        const request = store.put(blob, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getMuseChunks = async (recId: string): Promise<Blob[]> => {
    if (typeof window === 'undefined') return [];
    const db = await initDB();
    return new Promise<Blob[]>((resolve, reject) => {
        const tx = db.transaction(CHUNKS_STORE, 'readonly');
        const store = tx.objectStore(CHUNKS_STORE);
        const range = IDBKeyRange.bound(`${recId}:`, `${recId}:\uffff`);
        const request = store.getAll(range);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const deleteMuseChunks = async (recId: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    const range = IDBKeyRange.bound(`${recId}:`, `${recId}:\uffff`);
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CHUNKS_STORE, 'readwrite');
        const store = tx.objectStore(CHUNKS_STORE);
        const keysRequest = store.getAllKeys(range);
        keysRequest.onsuccess = () => {
            const keys = keysRequest.result;
            if (keys.length === 0) {
                resolve();
                return;
            }
            let completed = 0;
            keys.forEach((key) => {
                const delReq = store.delete(key);
                delReq.onsuccess = () => {
                    completed++;
                    if (completed === keys.length) {
                        resolve();
                    }
                };
                delReq.onerror = () => reject(delReq.error);
            });
        };
        keysRequest.onerror = () => reject(keysRequest.error);
    });
};

// Muse Audio helpers
export const saveMuseAudio = async (id: string, blob: Blob): Promise<void> => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(AUDIO_STORE, 'readwrite');
        const store = tx.objectStore(AUDIO_STORE);
        const request = store.put(blob, id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getMuseAudio = async (id: string): Promise<Blob | undefined> => {
    if (typeof window === 'undefined') return undefined;
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(AUDIO_STORE, 'readonly');
        const store = tx.objectStore(AUDIO_STORE);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const deleteMuseAudio = async (id: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(AUDIO_STORE, 'readwrite');
        const store = tx.objectStore(AUDIO_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Muse Manifest helpers
export const putMuseManifest = async (manifest: MuseManifest): Promise<void> => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(MANIFESTS_STORE, 'readwrite');
        const store = tx.objectStore(MANIFESTS_STORE);
        const request = store.put(manifest);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getMuseManifests = async (): Promise<MuseManifest[]> => {
    if (typeof window === 'undefined') return [];
    const db = await initDB();
    return new Promise<MuseManifest[]>((resolve, reject) => {
        const tx = db.transaction(MANIFESTS_STORE, 'readonly');
        const store = tx.objectStore(MANIFESTS_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const deleteMuseManifest = async (id: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(MANIFESTS_STORE, 'readwrite');
        const store = tx.objectStore(MANIFESTS_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
