import { describe, expect, it } from 'vitest';
import greeting from '../proofs/max-maxine-greeting-v2/greeting-scene.json';
import episode from '../proofs/max-maxine-greeting-v2/greeting-episode.json';
import backup from '../proofs/max-maxine-greeting-v2/greeting-studio-backup.json';
import { decodeTimedLibrary, needsGreetingSideWave, stateAt, validateTimedLibrary } from './timedScenes';
import { EPISODES_KEY, productionDuration, validateEpisodeLibrary } from './episodes';
import { TIMED_SCENES_KEY } from './timedScenes';
import { LIBRARY_KEY } from './maker';
import { STORAGE_KEY } from './scene';
import { restoreStudioBackup, validateStudioBackup } from './studioBackup';

describe('Max and Maxine Greeting V2 review candidate', () => {
  it('round trips as a version 1 Studio scene and episode without changing V1', () => {
    const sceneResult = validateTimedLibrary(greeting);
    const episodeResult = validateEpisodeLibrary(episode);
    expect(sceneResult.ok).toBe(true);
    expect(episodeResult.ok).toBe(true);
    if (!sceneResult.ok || !episodeResult.ok) return;
    expect(decodeTimedLibrary(JSON.stringify(greeting))).toEqual(sceneResult);
    expect(episodeResult.library.episodes[0].sceneIds).toEqual([sceneResult.library.scenes[0].id]);
    expect(productionDuration(episodeResult.library.episodes[0], sceneResult.library)).toBe(8.2);
  });

  it('stops at separated floor positions and keeps both profiles facing inward through idle and waves', () => {
    const checked = validateTimedLibrary(greeting);
    if (!checked.ok) throw Error(checked.error);
    const scene = checked.library.scenes[0];
    expect(new Set(scene.actions.map(action => action.type))).toEqual(new Set(['appear', 'walk', 'wave']));
    for (const id of ['max', 'maxine']) expect(needsGreetingSideWave(scene, id)).toBe(true);
    for (const time of [0.5, 1, 2, 2.9, 3, 3.3, 3.6, 4.5, 5.5, 6.3, 7.1, 8.2]) {
      const max = stateAt(scene, 'max', time);
      const maxine = stateAt(scene, 'maxine', time);
      expect(max.point.y).toBe(790);
      expect(maxine.point.y).toBe(790);
      expect(max.point.x + 213).toBeLessThan(maxine.point.x);
      expect(max.direction).toBe(1);
      expect(maxine.direction).toBe(-1);
      if (time >= 3) { expect(max.pose).toBe('side'); expect(maxine.pose).toBe('side'); }
    }
    expect(stateAt(scene, 'max', 3).point.x).toBe(690);
    expect(stateAt(scene, 'maxine', 3).point.x).toBe(980);
    expect(stateAt(scene, 'max', 4.5).sideWaveFrame).toBeGreaterThan(0);
    expect(stateAt(scene, 'maxine', 6.3).sideWaveFrame).toBeGreaterThan(0);
    expect(stateAt(scene, 'max', 8.2).sideWaveFrame).toBeUndefined();
    expect(stateAt(scene, 'maxine', 8.2).sideWaveFrame).toBeUndefined();
  });

  it('rejects side-wave artwork on unrelated action types and characters', () => {
    const scene = greeting.scenes[0];
    const altered = { ...scene, actions: scene.actions.map(action => action.id.endsWith('0006') ? { ...action, type: 'turn' } : action) };
    expect(validateTimedLibrary({ version: 1, scenes: [altered] }).ok).toBe(false);
    const custom = { ...scene, actions: scene.actions.map(action => action.id.endsWith('0006') ? { ...action, characterId: 'brightling-00000000-0000-4000-8000-000000000001' } : action) };
    expect(validateTimedLibrary({ version: 1, scenes: [custom] }).ok).toBe(false);
  });

  it('restores the exported V2 Studio Backup with the candidate marker intact', () => {
    const checked = validateStudioBackup(backup);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    };
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, checked.backup).ok).toBe(true);
    const restored = decodeTimedLibrary(storage.getItem(TIMED_SCENES_KEY));
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.library.scenes[0].actions.filter(action => action.artwork === 'greeting-side-v2')).toHaveLength(4);
    expect(JSON.parse(storage.getItem(EPISODES_KEY)!).episodes[0].sceneIds).toEqual([restored.library.scenes[0].id]);
  });
});
