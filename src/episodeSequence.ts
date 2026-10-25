/** Sequence operations address occurrences by position, so repeated scene IDs stay independent. */
import type { Episode, EpisodeSceneSettings } from './episodes';

const settings = (episode: Episode) => episode.sceneIds.map((_, index) => ({ ...episode.sceneSettings?.[index] }));

export function updateEpisodeOccurrence(episode: Episode, index: number, patch: EpisodeSceneSettings): Episode {
  if (index < 0 || index >= episode.sceneIds.length) return episode;
  const next = settings(episode);
  next[index] = { ...next[index], ...patch };
  return { ...episode, sceneSettings: next };
}

export function appendEpisodeScene(episode: Episode, id: string): Episode {
  return { ...episode, sceneIds: [...episode.sceneIds, id], ...(episode.sceneSettings ? { sceneSettings: [...settings(episode), {}] } : {}) };
}

export function moveEpisodeOccurrence(episode: Episode, from: number, to: number): Episode {
  if (from < 0 || from >= episode.sceneIds.length || to < 0 || to >= episode.sceneIds.length || from === to) return episode;
  const sceneIds = moveSceneOccurrence(episode.sceneIds, from, to);
  if (!episode.sceneSettings) return { ...episode, sceneIds };
  const next = settings(episode);
  next.splice(to, 0, ...next.splice(from, 1));
  next[0] = { ...next[0], transition: undefined };
  return { ...episode, sceneIds, sceneSettings: next };
}

export function duplicateEpisodeOccurrence(episode: Episode, index: number): Episode {
  if (index < 0 || index >= episode.sceneIds.length) return episode;
  const sceneIds = duplicateSceneOccurrence(episode.sceneIds, index);
  if (!episode.sceneSettings) return { ...episode, sceneIds };
  const next = settings(episode);
  next.splice(index + 1, 0, { duration: next[index].duration });
  return { ...episode, sceneIds, sceneSettings: next };
}

export function removeEpisodeOccurrence(episode: Episode, index: number): Episode {
  if (index < 0 || index >= episode.sceneIds.length) return episode;
  const sceneIds = removeSceneOccurrence(episode.sceneIds, index);
  if (!episode.sceneSettings) return { ...episode, sceneIds };
  const next = settings(episode);
  next.splice(index, 1);
  if (next.length) next[0] = { ...next[0], transition: undefined };
  return { ...episode, sceneIds, sceneSettings: next };
}

export function moveSceneOccurrence(ids: string[], from: number, to: number): string[] {
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to) return ids;
  const next = [...ids];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

export function duplicateSceneOccurrence(ids: string[], index: number): string[] {
  if (index < 0 || index >= ids.length) return ids;
  const next = [...ids];
  next.splice(index + 1, 0, ids[index]);
  return next;
}

export function removeSceneOccurrence(ids: string[], index: number): string[] {
  if (index < 0 || index >= ids.length) return ids;
  return ids.filter((_, position) => position !== index);
}
