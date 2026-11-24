// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  BlobUrlRegistry,
  beatBlobKey,
  takeBlobKey,
} from '../utils/storage';

function createMockRegistry() {
  let seq = 0;
  const created: Array<{ url: string; blob: Blob }> = [];
  const revoked: string[] = [];

  const registry = new BlobUrlRegistry({
    createObjectURL: (blob: Blob) => {
      seq += 1;
      const url = `blob:mock/${seq}`;
      created.push({ url, blob });
      return url;
    },
    revokeObjectURL: (url: string) => {
      revoked.push(url);
    },
  });

  return { registry, created, revoked };
}

test('beatBlobKey and takeBlobKey format consistent keys', () => {
  assert.equal(beatBlobKey('abc'), 'beat:abc');
  assert.equal(takeBlobKey('t-1'), 'take:t-1');
});

test('acquire creates only one URL per ID across repeated acquires and increments ref counts', () => {
  const { registry, created, revoked } = createMockRegistry();
  const blob = new Blob(['beat-audio'], { type: 'audio/mpeg' });
  const key = beatBlobKey('beat-1');

  const url1 = registry.acquire(key, blob);
  const url2 = registry.acquire(key, blob);
  const url3 = registry.acquire(key, blob);

  assert.equal(url1, 'blob:mock/1');
  assert.equal(url2, url1);
  assert.equal(url3, url1);
  assert.equal(created.length, 1);
  assert.equal(revoked.length, 0);
  assert.equal(registry.has(key), true);
  assert.equal(registry.get(key), url1);
  assert.equal(registry.size, 1);
});

test('release does not revoke until refCount reaches 0', () => {
  const { registry, revoked } = createMockRegistry();
  const blob = new Blob(['take-audio'], { type: 'audio/webm' });
  const key = takeBlobKey('take-1');

  const url = registry.acquire(key, blob);
  registry.acquire(key, blob);
  registry.acquire(key, blob);

  // Decrement from 3 -> 2 -> 1: must remain live.
  registry.release(key);
  assert.equal(revoked.length, 0);
  assert.equal(registry.has(key), true);
  assert.equal(registry.get(key), url);

  registry.release(key);
  assert.equal(revoked.length, 0);
  assert.equal(registry.has(key), true);

  // Final release: 1 -> 0 revokes and removes entry.
  registry.release(key);
  assert.deepEqual(revoked, [url]);
  assert.equal(registry.has(key), false);
  assert.equal(registry.get(key), undefined);
  assert.equal(registry.size, 0);

  // Extra release on an unknown/already-released key is a safe no-op.
  registry.release(key);
  registry.release('take:never-existed');
  assert.deepEqual(revoked, [url]);
});

test('syncActiveIds keeps IDs referenced in active state or undo stacks and revokes orphaned IDs', () => {
  const { registry, revoked } = createMockRegistry();
  const activeBeatKey = beatBlobKey('beat-active');
  const undoTakeKey = takeBlobKey('take-in-undo-stack');
  const orphanBeatKey = beatBlobKey('beat-deleted');
  const orphanTakeKey = takeBlobKey('take-deleted');

  const activeBeatUrl = registry.acquire(activeBeatKey, new Blob(['b1']));
  const undoTakeUrl = registry.acquire(undoTakeKey, new Blob(['t1']));
  const orphanBeatUrl = registry.acquire(orphanBeatKey, new Blob(['b2']));
  const orphanTakeUrl = registry.acquire(orphanTakeKey, new Blob(['t2']));

  // Simulate active sessions + beat library + undo/redo stack IDs.
  const reachableIds = new Set<string>([activeBeatKey, undoTakeKey]);
  const revokedCount = registry.syncActiveIds(reachableIds);

  assert.equal(revokedCount, 2);
  assert.equal(registry.size, 2);
  assert.equal(registry.get(activeBeatKey), activeBeatUrl);
  assert.equal(registry.get(undoTakeKey), undoTakeUrl);
  assert.equal(registry.has(orphanBeatKey), false);
  assert.equal(registry.has(orphanTakeKey), false);
  assert.deepEqual(new Set(revoked), new Set([orphanBeatUrl, orphanTakeUrl]));
});

test('replacing a blob for an existing ID revokes the old URL, returns a new one, and resets refCount to 1', () => {
  const { registry, created, revoked } = createMockRegistry();
  const key = beatBlobKey('beat-replace');
  const blobV1 = new Blob(['v1']);
  const blobV2 = new Blob(['v2']);

  const urlV1 = registry.acquire(key, blobV1);
  registry.acquire(key, blobV1); // refCount = 2

  const urlV2 = registry.acquire(key, blobV2);
  assert.notEqual(urlV2, urlV1);
  assert.equal(created.length, 2);
  assert.deepEqual(revoked, [urlV1]);
  assert.equal(registry.get(key), urlV2);
  assert.equal(registry.size, 1);

  // Because refCount reset to 1, a single release should revoke urlV2.
  registry.release(key);
  assert.deepEqual(revoked, [urlV1, urlV2]);
  assert.equal(registry.size, 0);
});

test('clear revokes all remaining URLs and empties the registry', () => {
  const { registry, revoked } = createMockRegistry();
  const u1 = registry.acquire(beatBlobKey('b1'), new Blob(['1']));
  const u2 = registry.acquire(takeBlobKey('t1'), new Blob(['2']));
  registry.acquire(takeBlobKey('t1'), new Blob(['2'])); // different blob -> revokes u2, creates u3
  const u3 = registry.get(takeBlobKey('t1'));
  assert.ok(u3);

  registry.clear();

  assert.equal(registry.size, 0);
  assert.equal(registry.has(beatBlobKey('b1')), false);
  assert.equal(registry.has(takeBlobKey('t1')), false);
  assert.deepEqual(new Set(revoked), new Set([u1, u2, u3]));
});
