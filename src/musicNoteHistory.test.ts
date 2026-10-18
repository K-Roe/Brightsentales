import { describe, expect, it } from 'vitest';
import { emptyNoteHistory, recordNoteEdit, stepNoteHistory } from './musicNoteHistory';
import { newMusicProject, newTrack } from './musicProject';

describe('note-only history', () => {
  it('restores notes without reverting intervening mixer and tempo changes', () => {
    const track = newTrack('piano', 'Piano');
    const note = { id: 'n', pitch: 60, start: 0, duration: 1, velocity: .8 };
    const project = { ...newMusicProject(), tempo: 140, tracks: [{ ...track, volume: .3, notes: [note] }] };
    const history = recordNoteEdit(emptyNoteHistory(), { trackId: track.id, before: [], after: [note], label: 'Add note' });
    const undone = stepNoteHistory(project, history, 'undo');
    expect(undone?.project.tracks[0].notes).toEqual([]);
    expect(undone?.project.tracks[0].volume).toBe(.3);
    expect(undone?.project.tempo).toBe(140);
    expect(undone && stepNoteHistory(undone.project, undone.history, 'redo')?.project.tracks[0].notes).toEqual([note]);
  });
  it('clears redo after another edit and ignores removed tracks', () => {
    const track = newTrack('piano', 'Piano');
    const note = { id: 'n', pitch: 60, start: 0, duration: 1, velocity: .8 };
    const first = recordNoteEdit(emptyNoteHistory(), { trackId: track.id, before: [], after: [note], label: 'Add' });
    const undone = stepNoteHistory({ ...newMusicProject(), tracks: [track] }, first, 'undo')!;
    expect(recordNoteEdit(undone.history, { trackId: track.id, before: [], after: [note], label: 'Add' }).future).toEqual([]);
    expect(stepNoteHistory(newMusicProject(), first, 'undo')).toBeNull();
  });
});
