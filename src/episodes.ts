import type { TimedLibrary, TimedScene } from './timedScenes';

export const EPISODES_KEY = 'brightsenappstales.episodes.v1';
export type Episode = { id: string; name: string; sceneIds: string[] };
export type EpisodeLibrary = { version: 1; episodes: Episode[] };
export const EMPTY_EPISODE_LIBRARY: EpisodeLibrary = { version: 1, episodes: [] };
export type EpisodeResult = { ok: true; library: EpisodeLibrary } | { ok: false; error: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export function validateEpisodeLibrary(value: unknown): EpisodeResult {
  if (!value || typeof value !== 'object' || (value as EpisodeLibrary).version !== 1 || !Array.isArray((value as EpisodeLibrary).episodes)) return { ok: false, error: 'Saved episodes are invalid.' };
  const episodes = (value as EpisodeLibrary).episodes;
  if (episodes.length > 100) return { ok: false, error: 'Too many episodes.' };
  const ids = new Set<string>();
  for (const episode of episodes) {
    if (!episode || !uuid.test(episode.id) || ids.has(episode.id) || typeof episode.name !== 'string' || episode.name !== episode.name.trim() || !episode.name || episode.name.length > 80 || !Array.isArray(episode.sceneIds) || episode.sceneIds.length > 100 || episode.sceneIds.some(id => typeof id !== 'string' || !uuid.test(id))) return { ok: false, error: 'An episode has invalid details.' };
    ids.add(episode.id);
  }
  return { ok: true, library: value as EpisodeLibrary };
}

export function decodeEpisodeLibrary(raw: string | null): EpisodeResult {
  if (raw === null) return { ok: true, library: structuredClone(EMPTY_EPISODE_LIBRARY) };
  try { return validateEpisodeLibrary(JSON.parse(raw)); }
  catch { return { ok: false, error: 'Saved episodes are not valid JSON.' }; }
}

export type EpisodePosition = { scene: TimedScene; index: number; localTime: number; start: number; total: number };
export function episodeDuration(episode: Episode, scenes: TimedLibrary): number {
  return episode.sceneIds.reduce((sum, id) => sum + (scenes.scenes.find(scene => scene.id === id)?.duration ?? 0), 0);
}

export function missingSceneIds(episode: Episode, scenes: TimedLibrary): string[] {
  const available = new Set(scenes.scenes.map(scene => scene.id));
  return [...new Set(episode.sceneIds.filter(id => !available.has(id)))];
}

export function episodePosition(episode: Episode, scenes: TimedLibrary, time: number): EpisodePosition | null {
  if (missingSceneIds(episode, scenes).length || episode.sceneIds.length === 0) return null;
  const total = episodeDuration(episode, scenes);
  const current = Math.max(0, Math.min(total, time));
  let start = 0;
  for (let index = 0; index < episode.sceneIds.length; index++) {
    const scene = scenes.scenes.find(item => item.id === episode.sceneIds[index])!;
    const end = start + scene.duration;
    if (current < end || index === episode.sceneIds.length - 1) return { scene, index, localTime: current - start, start, total };
    start = end;
  }
  return null;
}
