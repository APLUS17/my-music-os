import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
    initDB,
    saveAudioData,
    getAudioData,
    deleteAudioData,
    putMuseChunk,
    getMuseChunks,
    deleteMuseChunks,
    saveMuseAudio,
    getMuseAudio,
    deleteMuseAudio,
    putMuseManifest,
    getMuseManifests,
    deleteMuseManifest,
} from '../studioDB';
import { MuseManifest } from '@/types';

describe('studioDB SSR Guard Tests', () => {
    beforeEach(() => {
        // Stub the global 'window' as undefined to simulate SSR/Node.js environment
        vi.stubGlobal('window', undefined);
    });

    afterEach(() => {
        // Restore globals to default jsdom/browser environment after each test
        vi.unstubAllGlobals();
    });

    it('should have window defined as undefined in typeof check', () => {
        expect(typeof window).toBe('undefined');
    });

    it('initDB should return undefined during SSR', async () => {
        const db = await initDB();
        expect(db).toBeUndefined();
    });

    it('saveAudioData should return undefined (void) during SSR', async () => {
        const result = await saveAudioData('id', 'data');
        expect(result).toBeUndefined();
    });

    it('getAudioData should return undefined during SSR', async () => {
        const result = await getAudioData('id');
        expect(result).toBeUndefined();
    });

    it('deleteAudioData should return undefined (void) during SSR', async () => {
        const result = await deleteAudioData('id');
        expect(result).toBeUndefined();
    });

    it('putMuseChunk should return undefined (void) during SSR', async () => {
        const dummyBlob = {} as Blob;
        const result = await putMuseChunk('recId', 1, dummyBlob);
        expect(result).toBeUndefined();
    });

    it('getMuseChunks should return an empty array [] during SSR', async () => {
        const result = await getMuseChunks('recId');
        expect(result).toEqual([]);
    });

    it('deleteMuseChunks should return undefined (void) during SSR', async () => {
        const result = await deleteMuseChunks('recId');
        expect(result).toBeUndefined();
    });

    it('saveMuseAudio should return undefined (void) during SSR', async () => {
        const dummyBlob = {} as Blob;
        const result = await saveMuseAudio('id', dummyBlob);
        expect(result).toBeUndefined();
    });

    it('getMuseAudio should return undefined during SSR', async () => {
        const result = await getMuseAudio('id');
        expect(result).toBeUndefined();
    });

    it('deleteMuseAudio should return undefined (void) during SSR', async () => {
        const result = await deleteMuseAudio('id');
        expect(result).toBeUndefined();
    });

    it('putMuseManifest should return undefined (void) during SSR', async () => {
        const dummyManifest = {} as MuseManifest;
        const result = await putMuseManifest(dummyManifest);
        expect(result).toBeUndefined();
    });

    it('getMuseManifests should return an empty array [] during SSR', async () => {
        const result = await getMuseManifests();
        expect(result).toEqual([]);
    });

    it('deleteMuseManifest should return undefined (void) during SSR', async () => {
        const result = await deleteMuseManifest('id');
        expect(result).toBeUndefined();
    });
});
