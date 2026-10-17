import { describe, expect, it } from 'vitest';
import type { AudioAsset } from './audio';
import { EPISODES_KEY } from './episodes';
import { LIBRARY_KEY } from './maker';
import { STORAGE_KEY, DEFAULT_SCENE } from './scene';
import { TIMED_SCENES_KEY } from './timedScenes';
import { createStudioBackup, restoreStudioBackup } from './studioBackup';
import { AUDIO_RESTORE_KEY, recoverCoordinatedRestore, restoreStudioWithAudio, type AudioRestoreOperations } from './restoreCoordinator';

const oldAsset: AudioAsset = { id: '11111111-1111-4111-8111-111111111111', name: 'Old sound', kind: 'effect', mime: 'audio/wav', duration: 1, size: 2, blob: new Blob([new Uint8Array([1, 2])]) };
const newAsset: AudioAsset = { ...oldAsset, id: '22222222-2222-4222-8222-222222222222', name: 'New sound' };
const sceneId = '33333333-3333-4333-8333-333333333333';
const episodeId = '44444444-4444-4444-8444-444444444444';
const backup = createStudioBackup([], DEFAULT_SCENE, new Date('2026-10-17T12:00:00.000Z'), undefined, {
  version: 1, scenes: [{ id: sceneId, name: 'New scene', placeId: 'living-room', duration: 10, characters: {}, actions: [], audio: [{ id: '55555555-5555-4555-8555-555555555555', assetId: newAsset.id, start: 1, trimStart: 0, trimEnd: 1, volume: .5, fadeIn: 0, fadeOut: 0 }] }],
}, { version: 1, episodes: [{ id: episodeId, name: 'New episode', sceneIds: [sceneId] }] }, [
  { id: newAsset.id, name: newAsset.name, kind: newAsset.kind, mime: newAsset.mime, duration: 1, size: 2, data: 'AQI=', sha256: 'a'.repeat(64) },
]);

class MemoryStorage {
  data = new Map<string, string>([
    [LIBRARY_KEY, '[]'], [STORAGE_KEY, JSON.stringify(DEFAULT_SCENE)],
    [TIMED_SCENES_KEY, JSON.stringify({ version: 1, scenes: [] })],
    [EPISODES_KEY, JSON.stringify({ version: 1, episodes: [] })],
  ]);
  writes = 0;
  failAt = 0;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (++this.writes === this.failAt) throw Error('Interrupted write'); this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

function audioFixture() {
  let current = [oldAsset];
  let snapshot: AudioAsset[] | null = null;
  const operations: AudioRestoreOperations = {
    async replaceWithSnapshot(assets) { snapshot = current; current = assets; },
    async rollback() { if (snapshot) current = snapshot; snapshot = null; },
    async finish() { snapshot = null; },
  };
  return { operations, current: () => current, snapshot: () => snapshot };
}

describe('cross-store restore recovery', () => {
  it('keeps new audio, scene clip and episode references after a complete restore', async () => {
    const storage = new MemoryStorage(), audio = audioFixture();
    expect(await restoreStudioWithAudio(storage, backup, [newAsset], audio.operations)).toEqual({ ok: true });
    expect(audio.current()).toEqual([newAsset]);
    expect(audio.snapshot()).toBeNull();
    expect(storage.getItem(AUDIO_RESTORE_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(TIMED_SCENES_KEY)!).scenes[0].audio[0].assetId).toBe(newAsset.id);
    expect(JSON.parse(storage.getItem(EPISODES_KEY)!).episodes[0].sceneIds).toEqual([sceneId]);
  });

  it('rolls back after interruption before audio, after audio, or during localStorage writes', async () => {
    for (const stage of ['before-audio', 'after-audio', 'during-local'] as const) {
      const storage = new MemoryStorage(), audio = audioFixture();
      const before = new Map(storage.data);
      storage.setItem(AUDIO_RESTORE_KEY, 'pending');
      if (stage !== 'before-audio') await audio.operations.replaceWithSnapshot([newAsset]);
      if (stage === 'during-local') expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, backup, undefined, undefined, undefined, true).ok).toBe(true);
      expect(await recoverCoordinatedRestore(storage, audio.operations)).toEqual({ ok: true });
      expect(storage.data).toEqual(before);
      expect(audio.current()).toEqual([oldAsset]);
      expect(audio.snapshot()).toBeNull();
    }
  });

  it('finishes a committed restore after interruption before cleanup', async () => {
    const storage = new MemoryStorage(), audio = audioFixture();
    storage.setItem(AUDIO_RESTORE_KEY, 'pending');
    await audio.operations.replaceWithSnapshot([newAsset]);
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, backup, undefined, undefined, undefined, true).ok).toBe(true);
    storage.setItem(AUDIO_RESTORE_KEY, 'committed');
    expect(await recoverCoordinatedRestore(storage, audio.operations)).toEqual({ ok: true });
    expect(storage.getItem(AUDIO_RESTORE_KEY)).toBeNull();
    expect(audio.current()).toEqual([newAsset]);
    expect(audio.snapshot()).toBeNull();
    expect(JSON.parse(storage.getItem(EPISODES_KEY)!).episodes[0].sceneIds).toEqual([sceneId]);
  });

  it('keeps previous data on a localStorage write failure', async () => {
    const storage = new MemoryStorage(), audio = audioFixture();
    const before = new Map(storage.data);
    storage.failAt = 5;
    expect((await restoreStudioWithAudio(storage, backup, [newAsset], audio.operations)).ok).toBe(false);
    expect(storage.data).toEqual(before);
    expect(audio.current()).toEqual([oldAsset]);
    expect(audio.snapshot()).toBeNull();
  });

  it('keeps previous data when the atomic IndexedDB replacement fails', async () => {
    const storage = new MemoryStorage(), audio = audioFixture();
    const before = new Map(storage.data);
    const broken = { ...audio.operations, async replaceWithSnapshot() { throw Error('IDB quota exceeded'); } };
    expect((await restoreStudioWithAudio(storage, backup, [newAsset], broken)).ok).toBe(false);
    expect(storage.data).toEqual(before);
    expect(audio.current()).toEqual([oldAsset]);
  });

  it('blocks editing if pending recovery cannot restore the audio snapshot', async () => {
    const storage = new MemoryStorage(), audio = audioFixture();
    storage.setItem(AUDIO_RESTORE_KEY, 'pending');
    await audio.operations.replaceWithSnapshot([newAsset]);
    const broken = { ...audio.operations, async rollback() { throw Error('IDB unavailable'); } };
    expect((await recoverCoordinatedRestore(storage, broken)).ok).toBe(false);
    expect(storage.getItem(AUDIO_RESTORE_KEY)).toBe('pending');
    expect(audio.current()).toEqual([newAsset]);
    expect(await recoverCoordinatedRestore(storage, audio.operations)).toEqual({ ok: true });
    expect(audio.current()).toEqual([oldAsset]);
    expect(await recoverCoordinatedRestore(storage, audio.operations)).toEqual({ ok: true });
  });
});
