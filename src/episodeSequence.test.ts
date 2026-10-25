import { describe, expect, it } from 'vitest';
import { appendEpisodeScene, duplicateEpisodeOccurrence, duplicateSceneOccurrence, moveEpisodeOccurrence, moveSceneOccurrence, removeEpisodeOccurrence, removeSceneOccurrence, updateEpisodeOccurrence } from './episodeSequence';
import type { Episode } from './episodes';

describe('episode scene occurrences', () => {
  it('reorders one occurrence while retaining repeated scene references', () => {
    const ids = ['max', 'maxine', 'max'];
    expect(moveSceneOccurrence(ids, 0, 2)).toEqual(['maxine', 'max', 'max']);
    expect(ids).toEqual(['max', 'maxine', 'max']);
    expect(moveSceneOccurrence(ids, 0, -1)).toBe(ids);
  });

  it('duplicates and removes only the selected occurrence', () => {
    const ids = ['max', 'maxine'];
    expect(duplicateSceneOccurrence(ids, 0)).toEqual(['max', 'max', 'maxine']);
    expect(removeSceneOccurrence(['max', 'max', 'maxine'], 1)).toEqual(ids);
    expect(removeSceneOccurrence(ids, 3)).toBe(ids);
  });
  it('moves timing with its occurrence and keeps new boundaries as hard cuts', () => {
    const episode: Episode = { id: 'episode', name: 'Timing', sceneIds: ['a', 'b', 'a'], sceneSettings: [{ duration: 3 }, { duration: 5, transition: { type: 'fade-black', duration: .6 } }, { duration: 7 }] };
    const moved = moveEpisodeOccurrence(episode, 1, 0);
    expect(moved.sceneIds).toEqual(['b', 'a', 'a']);
    expect(moved.sceneSettings?.map(item => item.duration)).toEqual([5, 3, 7]);
    expect(moved.sceneSettings?.[0].transition).toBeUndefined();
    expect(episode.sceneSettings?.[1].transition?.duration).toBe(.6);
    const duplicated = duplicateEpisodeOccurrence(episode, 1);
    expect(duplicated.sceneSettings?.[2]).toEqual({ duration: 5 });
    expect(removeEpisodeOccurrence(duplicated, 1).sceneSettings?.map(item => item.duration)).toEqual([3, 5, 7]);
    expect(appendEpisodeScene(episode, 'c').sceneSettings?.[3]).toEqual({});
    expect(updateEpisodeOccurrence(episode, 2, { duration: 8 }).sceneSettings?.[2].duration).toBe(8);
  });
});
