import { describe, expect, it } from 'vitest';
import { duplicateSceneOccurrence, moveSceneOccurrence, removeSceneOccurrence } from './episodeSequence';

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
});
