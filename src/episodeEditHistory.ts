import { episodeSnapshot } from './episodeDraft';
import type { Episode } from './episodes';

export type EpisodeEditHistory = { past: Episode[]; present: Episode; future: Episode[] };
const LIMIT = 50;

export function beginEpisodeEdit(episode: Episode): EpisodeEditHistory {
  return { past: [], present: structuredClone(episode), future: [] };
}

export function recordEpisodeEdit(history: EpisodeEditHistory, next: Episode): EpisodeEditHistory {
  if (episodeSnapshot(history.present) === episodeSnapshot(next)) return history;
  return { past: [...history.past, history.present].slice(-LIMIT), present: structuredClone(next), future: [] };
}

export function undoEpisodeEdit(history: EpisodeEditHistory): EpisodeEditHistory {
  if (!history.past.length) return history;
  return { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] };
}

export function redoEpisodeEdit(history: EpisodeEditHistory): EpisodeEditHistory {
  if (!history.future.length) return history;
  return { past: [...history.past, history.present].slice(-LIMIT), present: history.future[0], future: history.future.slice(1) };
}
