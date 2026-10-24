import { describe, expect, it } from 'vitest';
import greeting from '../proofs/max-maxine-greeting-v1/greeting-scene.json';
import episode from '../proofs/max-maxine-greeting-v1/greeting-episode.json';
import { decodeTimedLibrary, stateAt, validateTimedLibrary } from './timedScenes';
import { productionDuration, validateEpisodeLibrary } from './episodes';

describe('Max and Maxine Greeting V1 deliverable', () => {
  it('is a saved Scene Maker scene and a complete one-scene episode', () => {
    const checked = validateTimedLibrary(greeting);
    const checkedEpisode = validateEpisodeLibrary(episode);
    expect(checked.ok).toBe(true);
    expect(checkedEpisode.ok).toBe(true);
    if (!checked.ok || !checkedEpisode.ok) return;
    expect(decodeTimedLibrary(JSON.stringify(greeting))).toEqual(checked);
    expect(checkedEpisode.library.episodes[0].sceneIds).toEqual([checked.library.scenes[0].id]);
    expect(productionDuration(checkedEpisode.library.episodes[0], checked.library)).toBe(8.2);
  });

  it('walks inward on one floor line, stops apart, and returns to idle after reciprocal waves', () => {
    const checked = validateTimedLibrary(greeting);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const scene = checked.library.scenes[0];
    expect(new Set(scene.actions.map(action => action.type))).toEqual(new Set(['appear', 'walk', 'turn', 'wave']));
    for (const time of [0, 0.5, 1, 2, 2.99, 3, 3.25, 3.6, 4.5, 5.5, 6.3, 7.1, 8.2]) {
      const max = stateAt(scene, 'max', time);
      const maxine = stateAt(scene, 'maxine', time);
      expect(max.visible && maxine.visible).toBe(true);
      expect(max.point.y).toBe(790);
      expect(maxine.point.y).toBe(790);
      expect(max.point.x + 213).toBeLessThan(maxine.point.x);
    }
    expect(stateAt(scene, 'max', 2).direction).toBe(1);
    expect(stateAt(scene, 'maxine', 2).direction).toBe(-1);
    expect(stateAt(scene, 'max', 3).point.x).toBe(690);
    expect(stateAt(scene, 'maxine', 3).point.x).toBe(980);
    expect(stateAt(scene, 'max', 4.5).pose).toBe('wave');
    expect(stateAt(scene, 'maxine', 6.3).pose).toBe('wave');
    expect(stateAt(scene, 'max', 8.2).pose).toBe('idle');
    expect(stateAt(scene, 'maxine', 8.2).pose).toBe('idle');
  });
});
