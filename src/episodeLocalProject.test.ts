import { describe, expect, it } from 'vitest';
import { createStudioBackup } from './studioBackup';
import { DEFAULT_PLACE_ORGANISATION } from './placeFolders';
import { makeLocalEpisodeBackup } from './episodeLocalProject';
import type { TimedScene } from './timedScenes';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const scene = (n: number): TimedScene => ({ id: id(n), name: `Scene ${n}`, duration: 8, placeId: 'living-room', characters: { max: { x: 420, y: 790 } }, actions: [] });

describe('private episode project backup', () => {
  it('keeps the native Backup v8 shape and only copies the selected episode scenes', () => {
    const selected = { id: id(10), name: 'Selected episode', sceneIds: [id(1)] };
    const unrelated = { id: id(11), name: 'Another episode', sceneIds: [id(2)] };
    const source = createStudioBackup([], null, new Date('2026-10-26T10:00:00Z'), structuredClone(DEFAULT_PLACE_ORGANISATION), { version: 1, scenes: [scene(1), scene(2)] }, { version: 1, episodes: [selected, unrelated] }, [], { version: 1, intros: [] }, { version: 1, credits: [] });
    const result = makeLocalEpisodeBackup(source, selected);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.version).toBe(8);
    expect(result.backup.episodes?.episodes).toEqual([selected]);
    expect(result.backup.timedScenes?.scenes.map(item => item.id)).toEqual([id(1)]);
    expect(result.backup.scene).toBeNull();
  });

  it('refuses missing scenes and never returns an incomplete project', () => {
    const selected = { id: id(10), name: 'Missing scene episode', sceneIds: [id(3)] };
    const source = createStudioBackup([], null, new Date('2026-10-26T10:00:00Z'), structuredClone(DEFAULT_PLACE_ORGANISATION), { version: 1, scenes: [scene(1)] }, { version: 1, episodes: [selected] }, [], { version: 1, intros: [] }, { version: 1, credits: [] });
    expect(makeLocalEpisodeBackup(source, selected)).toMatchObject({ ok: false, error: 'A scene used by this episode is missing.' });
  });
});
