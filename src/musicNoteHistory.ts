import type { Note, MusicProject } from './musicProject';

export type NoteEdit = { trackId: string; before: Note[]; after: Note[]; label: string };
export type NoteHistory = { past: NoteEdit[]; future: NoteEdit[] };
export const emptyNoteHistory = (): NoteHistory => ({ past: [], future: [] });

export function recordNoteEdit(history: NoteHistory, edit: NoteEdit): NoteHistory {
  if (JSON.stringify(edit.before) === JSON.stringify(edit.after)) return history;
  return { past: [...history.past.slice(-49), structuredClone(edit)], future: [] };
}

export function stepNoteHistory(project: MusicProject, history: NoteHistory, direction: 'undo' | 'redo') {
  const source = direction === 'undo' ? history.past : history.future;
  const edit = source.at(-1);
  if (!edit || !project.tracks.some(track => track.id === edit.trackId)) return null;
  const notes = structuredClone(direction === 'undo' ? edit.before : edit.after);
  const next = { ...project, tracks: project.tracks.map(track => track.id === edit.trackId ? { ...track, notes } : track) };
  const updated = direction === 'undo'
    ? { past: history.past.slice(0, -1), future: [...history.future, edit] }
    : { past: [...history.past, edit], future: history.future.slice(0, -1) };
  return { project: next, history: updated, label: edit.label };
}
