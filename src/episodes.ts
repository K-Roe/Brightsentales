import type { TimedLibrary, TimedScene } from './timedScenes';
import { clipLength, type AudioClip, validAudioClips } from './audio';
import type { Intro, IntroLibrary } from './introductions';
import { creditsAsScene, type Credits, type CreditsLibrary } from './credits';

export const EPISODES_KEY = 'brightsenappstales.episodes.v1';
export type Episode = { id: string; name: string; sceneIds: string[]; introId?: string; creditsId?: string; audio?: AudioClip[] };
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
    if (!episode || !uuid.test(episode.id) || ids.has(episode.id) || typeof episode.name !== 'string' || episode.name !== episode.name.trim() || !episode.name || episode.name.length > 80 || !Array.isArray(episode.sceneIds) || episode.sceneIds.length > 100 || episode.sceneIds.some(id => typeof id !== 'string' || !uuid.test(id)) || episode.introId !== undefined && !uuid.test(episode.introId) || episode.creditsId !== undefined && !uuid.test(episode.creditsId) || episode.audio !== undefined && !validAudioClips(episode.audio, 360000)) return { ok: false, error: 'An episode has invalid details.' };
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
export type ProductionBlock = { kind: 'intro' | 'scene' | 'credits'; scene: TimedScene; start: number; index: number; intro?: Intro; credits?: Credits };
export function productionBlocks(episode: Episode, scenes: TimedLibrary, intros?: IntroLibrary, credits?: CreditsLibrary): ProductionBlock[] {
  const blocks: ProductionBlock[] = [];
  let start = 0;
  const add = (kind: ProductionBlock['kind'], scene: TimedScene, intro?: Intro, endCredits?: Credits) => { blocks.push({ kind, scene, start, index: blocks.length, ...(intro ? { intro } : {}), ...(endCredits ? { credits: endCredits } : {}) }); start += scene.duration; };
  const intro = intros?.intros.find(item => item.id === episode.introId);
  if (intro) add('intro', intro, intro);
  for (const id of episode.sceneIds) { const scene = scenes.scenes.find(item => item.id === id); if (scene) add('scene', scene); }
  const endCredits = credits?.credits.find(item => item.id === episode.creditsId);
  if (endCredits) add('credits', creditsAsScene(endCredits), undefined, endCredits);
  return blocks;
}
export function productionDuration(episode: Episode, scenes: TimedLibrary, intros?: IntroLibrary, credits?: CreditsLibrary): number {
  return productionBlocks(episode, scenes, intros, credits).reduce((sum, block) => sum + block.scene.duration, 0);
}
export function productionPosition(episode: Episode, scenes: TimedLibrary, intros: IntroLibrary, credits: CreditsLibrary, time: number): (ProductionBlock & { localTime: number; total: number }) | null {
  if (missingSceneIds(episode, scenes).length || episode.introId && !intros.intros.some(item => item.id === episode.introId) || episode.creditsId && !credits.credits.some(item => item.id === episode.creditsId)) return null;
  const blocks = productionBlocks(episode, scenes, intros, credits);
  const total = productionDuration(episode, scenes, intros, credits);
  const current = Math.max(0, Math.min(total, time));
  const block = blocks.find((item, index) => current < item.start + item.scene.duration || index === blocks.length - 1);
  return block ? { ...block, localTime: current - block.start, total } : null;
}
export function episodeDuration(episode: Episode, scenes: TimedLibrary): number {
  return episode.sceneIds.reduce((sum, id) => sum + (scenes.scenes.find(scene => scene.id === id)?.duration ?? 0), 0);
}
export function speechFitsEpisode(episode: Episode, scenes: TimedLibrary, intros?: IntroLibrary, credits?: CreditsLibrary): boolean {
  const total = productionDuration(episode, scenes, intros, credits);
  return (episode.audio ?? []).every(clip => clip.speakerId === undefined || clip.start + clipLength(clip) <= total + 1e-7);
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
