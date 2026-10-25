import { describe, expect, it } from 'vitest';
import { beginEpisodeEdit, recordEpisodeEdit, redoEpisodeEdit, undoEpisodeEdit } from './episodeEditHistory';
import { episodeHasUnsavedChanges, episodeSnapshot } from './episodeDraft';
import type { Episode } from './episodes';

const source: Episode = { id: '11111111-1111-4111-8111-111111111111', name: 'Opening', sceneIds: ['22222222-2222-4222-8222-222222222222'] };

describe('episode editing history', () => {
  it('undoes and redoes occurrence and transition edits without changing the saved snapshot', () => {
    const saved = episodeSnapshot(source);
    const start = beginEpisodeEdit(source);
    const timed = recordEpisodeEdit(start, { ...start.present, sceneSettings: [{ duration: 2 }] });
    const faded = recordEpisodeEdit(timed, { ...timed.present, sceneIds: [...timed.present.sceneIds, '33333333-3333-4333-8333-333333333333'], sceneSettings: [{ duration: 2 }, { transition: { type: 'fade-black', duration: .6 } }] });
    expect(episodeHasUnsavedChanges(faded.present, saved)).toBe(true);
    const back = undoEpisodeEdit(faded);
    expect(back.present.sceneIds).toHaveLength(1);
    expect(back.present.sceneSettings?.[0].duration).toBe(2);
    expect(undoEpisodeEdit(back).present).toEqual(source);
    expect(episodeHasUnsavedChanges(undoEpisodeEdit(back).present, saved)).toBe(false);
    expect(redoEpisodeEdit(back).present).toEqual(faded.present);
    expect(source.sceneSettings).toBeUndefined();
  });

  it('clears redo after a new edit and ignores no-op changes', () => {
    const start = beginEpisodeEdit(source);
    expect(recordEpisodeEdit(start, { ...source })).toBe(start);
    const edited = recordEpisodeEdit(start, { ...source, name: 'Ending' });
    const back = undoEpisodeEdit(edited);
    expect(back.future).toHaveLength(1);
    const alternate = recordEpisodeEdit(back, { ...source, name: 'Middle' });
    expect(alternate.future).toHaveLength(0);
    expect(redoEpisodeEdit(alternate)).toBe(alternate);
  });
});
