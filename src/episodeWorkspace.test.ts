import { describe, expect, it } from 'vitest';
import { EMPTY_EPISODE_WORKSPACE, addEpisodeTestPreview, decodeEpisodeWorkspace, deleteEpisodeFolder, makeEpisodeFolder, moveEpisodeToFolder, recordEpisodeSaved, renameEpisodeFolder, validateEpisodeWorkspace } from './episodeWorkspace';

const scene = { id: 'b1234567-1234-4234-8234-123456789abc', name: 'A scene', duration: 4, placeId: 'living-room', characters: {}, actions: [] };
const episode = { id: 'a1234567-1234-4234-8234-123456789abc', name: 'Hello, Max!', sceneIds: [scene.id] };
const date = new Date('2026-10-26T10:00:00.000Z');

describe('episode folder and visual test library', () => {
  it('validates, creates, renames, moves and removes folders without deleting episodes', () => {
    const made = makeEpisodeFolder(EMPTY_EPISODE_WORKSPACE, ' Season One ', date)!;
    expect(validateEpisodeWorkspace(made).ok).toBe(true);
    const renamed = renameEpisodeFolder(made, made.folders[0].id, 'BrightTales Season 1')!;
    const moved = moveEpisodeToFolder(renamed, episode.id, renamed.folders[0].id)!;
    const removed = deleteEpisodeFolder(moved, renamed.folders[0].id)!;
    expect(removed.folders).toEqual([]);
    expect(removed.assignments).toEqual({});
    expect(episode.sceneIds).toHaveLength(1);
  });

  it('rejects duplicate or malformed folders and preserves valid data on decode', () => {
    const folder = makeEpisodeFolder(EMPTY_EPISODE_WORKSPACE, 'Drafts', date)!;
    expect(makeEpisodeFolder(folder, ' drafts ', date)).toBeNull();
    const decoded = decodeEpisodeWorkspace(JSON.stringify(folder));
    expect(decoded.ok && decoded.workspace).toEqual(folder);
    expect(validateEpisodeWorkspace({ ...folder, assignments: { [episode.id]: 'missing-folder' } }).ok).toBe(false);
  });

  it('records saved dates and makes playable-preview references without altering episode content', () => {
    const saved = recordEpisodeSaved(EMPTY_EPISODE_WORKSPACE, episode, date);
    const previewed = addEpisodeTestPreview(saved, episode, [scene], 'Walking test', 'Compare the gentle walk at the scene end.', date)!;
    expect(previewed.testPreviews[0]).toMatchObject({ title: 'Walking test', purpose: 'Compare the gentle walk at the scene end.', episodeId: episode.id, createdAt: date.toISOString() });
    const firstFolder = makeEpisodeFolder(previewed, 'Drafts', date)!;
    const assigned = moveEpisodeToFolder(firstFolder, episode.id, firstFolder.folders[0].id)!;
    expect(assigned.testPreviews[0].folderId).toBe(firstFolder.folders[0].id);
    expect(episode.name).toBe('Hello, Max!');
    expect(episode.sceneIds).toHaveLength(1);
    expect(validateEpisodeWorkspace(previewed).ok).toBe(true);
  });
});
