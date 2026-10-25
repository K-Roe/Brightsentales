import { describe, expect, it } from 'vitest';
import type { Episode } from './episodes';
import { episodeHasUnsavedChanges, episodeSnapshot } from './episodeDraft';

const episode: Episode = { id: '11111111-1111-4111-8111-111111111111', name: 'Hello', sceneIds: ['22222222-2222-4222-8222-222222222222'], audio: [{ id: '33333333-3333-4333-8333-333333333333', assetId: '44444444-4444-4444-8444-444444444444', start: 2, trimStart: 0, trimEnd: 5, volume: .5, fadeIn: 1, fadeOut: 1 }] };

describe('episode draft comparison', () => {
  it('keeps an unchanged saved episode clean and treats omitted empty audio as unchanged', () => {
    const saved = episodeSnapshot(episode);
    expect(episodeHasUnsavedChanges(structuredClone(episode), saved)).toBe(false);
    expect(episodeHasUnsavedChanges(null, saved)).toBe(false);
    expect(episodeHasUnsavedChanges({ ...episode, name: 'Changed' }, saved)).toBe(true);
    expect(episodeHasUnsavedChanges({ ...episode, introId: '55555555-5555-4555-8555-555555555555' }, saved)).toBe(true);
    expect(episodeHasUnsavedChanges({ ...episode, creditsId: '66666666-6666-4666-8666-666666666666' }, saved)).toBe(true);
    expect(episodeHasUnsavedChanges(episode, null)).toBe(true); // New episode has no saved copy.
    expect(episodeSnapshot({ ...episode, audio: [] })).toBe(episodeSnapshot({ ...episode, audio: undefined }));
  });
  it('detects order, clip timing, trim, fades, volume and removal, then clears after save', () => {
    const saved = episodeSnapshot(episode);
    const second = '55555555-5555-4555-8555-555555555555';
    const expanded = { ...episode, sceneIds: [episode.sceneIds[0], second] };
    const expandedSaved = episodeSnapshot(expanded);
    expect(episodeHasUnsavedChanges(expanded, saved)).toBe(true);
    expect(episodeHasUnsavedChanges({ ...expanded, sceneIds: [second, episode.sceneIds[0]] }, expandedSaved)).toBe(true);
    expect(episodeHasUnsavedChanges({ ...expanded, sceneIds: [episode.sceneIds[0]] }, saved)).toBe(false);
    for (const patch of [{ start: 3 }, { trimStart: 1 }, { trimEnd: 4 }, { fadeIn: .5 }, { fadeOut: .5 }, { volume: .3 }]) {
      expect(episodeHasUnsavedChanges({ ...episode, audio: [{ ...episode.audio![0], ...patch }] }, saved)).toBe(true);
    }
    expect(episodeHasUnsavedChanges({ ...episode, audio: [] }, saved)).toBe(true);
    expect(episodeHasUnsavedChanges(expanded, episodeSnapshot(expanded))).toBe(false);
  });
});
