import type { TimedLibrary, TimedScene } from './timedScenes';
import { clipLength, type AudioClip, validAudioClips } from './audio';
import type { Intro, IntroLibrary } from './introductions';
import { creditsAsScene, type Credits, type CreditsLibrary } from './credits';

export const EPISODES_KEY = 'brightsenappstales.episodes.v1';
export type EpisodeSceneSettings = { duration?: number; transition?: { type: 'fade-black'; duration: number } };
/** Optional episode-level directing track. Absent means the saved scene camera keeps its existing behaviour. */
export type EpisodeCameraShot = {
  id: string;
  start: number;
  duration: number;
  shot: 'wide' | 'medium' | 'close-up' | 'custom';
  target: string;
  movement: 'static' | 'pan' | 'follow';
  x?: number;
  y?: number;
  zoom?: number;
};
export type Episode = { id: string; name: string; sceneIds: string[]; sceneSettings?: EpisodeSceneSettings[]; camera?: EpisodeCameraShot[]; introId?: string; creditsId?: string; audio?: AudioClip[] };
export type EpisodeLibrary = { version: 1; episodes: Episode[] };
export const EMPTY_EPISODE_LIBRARY: EpisodeLibrary = { version: 1, episodes: [] };
export type EpisodeResult = { ok: true; library: EpisodeLibrary } | { ok: false; error: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const finiteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function validEpisodeCamera(camera: unknown): boolean {
  if (camera === undefined) return true;
  if (!Array.isArray(camera) || camera.length > 100) return false;
  const ids = new Set<string>();
  let end = 0;
  for (const shot of camera) {
    if (!shot || typeof shot !== 'object' || Array.isArray(shot)) return false;
    const item = shot as EpisodeCameraShot;
    if (typeof item.id !== 'string' || !uuid.test(item.id) || ids.has(item.id)) return false;
    if (item.shot !== 'wide' && item.shot !== 'medium' && item.shot !== 'close-up' && item.shot !== 'custom') return false;
    if (item.movement !== 'static' && item.movement !== 'pan' && item.movement !== 'follow') return false;
    if (typeof item.target !== 'string' || !item.target) return false;
    if (!finiteNumber(item.start) || item.start < 0 || !finiteNumber(item.duration) || item.duration < .5 || item.start + item.duration > 3600) return false;
    if (item.start < end - 1e-7) return false;
    if (item.shot === 'custom' && (!finiteNumber(item.zoom) || item.zoom < 1 || item.zoom > 4)) return false;
    if (item.shot !== 'custom' && item.zoom !== undefined) return false;
    if (item.x !== undefined && (!finiteNumber(item.x) || item.x < 0 || item.x > 1672)) return false;
    if (item.y !== undefined && (!finiteNumber(item.y) || item.y < 0 || item.y > 941)) return false;
    if (item.target === 'point' && (item.x === undefined || item.y === undefined)) return false;
    if (item.target !== 'point' && (item.x !== undefined || item.y !== undefined)) return false;
    if (item.movement === 'follow' && (item.target === 'point' || item.shot === 'wide')) return false;
    ids.add(item.id);
    end = item.start + item.duration;
  }
  return true;
}

export function validateEpisodeLibrary(value: unknown): EpisodeResult {
  if (!value || typeof value !== 'object' || (value as EpisodeLibrary).version !== 1 || !Array.isArray((value as EpisodeLibrary).episodes)) return { ok: false, error: 'Saved episodes are invalid.' };
  const episodes = (value as EpisodeLibrary).episodes;
  if (episodes.length > 100) return { ok: false, error: 'Too many episodes.' };
  const ids = new Set<string>();
  for (const episode of episodes) {
    if (!episode || !uuid.test(episode.id) || ids.has(episode.id) || typeof episode.name !== 'string' || episode.name !== episode.name.trim() || !episode.name || episode.name.length > 80 || !Array.isArray(episode.sceneIds) || episode.sceneIds.length > 100 || episode.sceneIds.some(id => typeof id !== 'string' || !uuid.test(id)) || episode.introId !== undefined && !uuid.test(episode.introId) || episode.creditsId !== undefined && !uuid.test(episode.creditsId) || episode.audio !== undefined && !validAudioClips(episode.audio, 360000) || episode.camera !== undefined && !validEpisodeCamera(episode.camera) || episode.sceneSettings !== undefined && (!Array.isArray(episode.sceneSettings) || episode.sceneSettings.length !== episode.sceneIds.length || episode.sceneSettings.some((setting, index) => !setting || typeof setting !== 'object' || Array.isArray(setting) || setting.duration !== undefined && (typeof setting.duration !== 'number' || !Number.isFinite(setting.duration) || setting.duration < .2 || setting.duration > 3600) || setting.transition !== undefined && (index === 0 || !setting.transition || typeof setting.transition !== 'object' || setting.transition.type !== 'fade-black' || typeof setting.transition.duration !== 'number' || !Number.isFinite(setting.transition.duration) || setting.transition.duration < .2 || setting.transition.duration > 2)))) return { ok: false, error: 'An episode has invalid details.' };
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
export type ProductionBlock = { kind: 'intro' | 'scene' | 'credits'; scene: TimedScene; start: number; duration: number; index: number; occurrenceIndex?: number; intro?: Intro; credits?: Credits };
export function productionBlocks(episode: Episode, scenes: TimedLibrary, intros?: IntroLibrary, credits?: CreditsLibrary): ProductionBlock[] {
  const blocks: ProductionBlock[] = [];
  let start = 0;
  const add = (kind: ProductionBlock['kind'], scene: TimedScene, duration: number, occurrenceIndex?: number, intro?: Intro, endCredits?: Credits) => { blocks.push({ kind, scene, start, duration, index: blocks.length, ...(occurrenceIndex === undefined ? {} : { occurrenceIndex }), ...(intro ? { intro } : {}), ...(endCredits ? { credits: endCredits } : {}) }); start += duration; };
  const intro = intros?.intros.find(item => item.id === episode.introId);
  if (intro) add('intro', intro, intro.duration, undefined, intro);
  episode.sceneIds.forEach((id, index) => { const scene = scenes.scenes.find(item => item.id === id); if (scene) add('scene', scene, episode.sceneSettings?.[index]?.duration ?? scene.duration, index); });
  const endCredits = credits?.credits.find(item => item.id === episode.creditsId);
  if (endCredits) add('credits', creditsAsScene(endCredits), endCredits.duration, undefined, undefined, endCredits);
  return blocks;
}
export function productionDuration(episode: Episode, scenes: TimedLibrary, intros?: IntroLibrary, credits?: CreditsLibrary): number {
  return productionBlocks(episode, scenes, intros, credits).reduce((sum, block) => sum + block.duration, 0);
}
export function productionPosition(episode: Episode, scenes: TimedLibrary, intros: IntroLibrary, credits: CreditsLibrary, time: number): (ProductionBlock & { localTime: number; total: number }) | null {
  if (missingSceneIds(episode, scenes).length || episode.introId && !intros.intros.some(item => item.id === episode.introId) || episode.creditsId && !credits.credits.some(item => item.id === episode.creditsId)) return null;
  const blocks = productionBlocks(episode, scenes, intros, credits);
  const total = productionDuration(episode, scenes, intros, credits);
  const current = Math.max(0, Math.min(total, time));
  const block = blocks.find((item, index) => current < item.start + item.duration || index === blocks.length - 1);
  return block ? { ...block, localTime: current - block.start, total } : null;
}
export function episodeDuration(episode: Episode, scenes: TimedLibrary): number {
  return productionDuration(episode, scenes);
}
export function speechFitsEpisode(episode: Episode, scenes: TimedLibrary, intros?: IntroLibrary, credits?: CreditsLibrary): boolean {
  const total = productionDuration(episode, scenes, intros, credits);
  return (episode.audio ?? []).every(clip => clip.speakerId === undefined || clip.start + clipLength(clip) <= total + 1e-7);
}

export function missingSceneIds(episode: Episode, scenes: TimedLibrary): string[] {
  const available = new Set(scenes.scenes.map(scene => scene.id));
  return [...new Set(episode.sceneIds.filter(id => !available.has(id)))];
}

/** The black overlay is centred on the cut; both scenes keep their normal clocks. */
export function episodeFadeAt(episode: Episode, scenes: TimedLibrary, time: number, intros?: IntroLibrary, credits?: CreditsLibrary): number {
  const blocks = productionBlocks(episode, scenes, intros, credits);
  for (const block of blocks) {
    if (block.kind !== 'scene' || !block.occurrenceIndex) continue;
    const transition = episode.sceneSettings?.[block.occurrenceIndex]?.transition;
    if (!transition) continue;
    const half = transition.duration / 2;
    const distance = Math.abs(time - block.start);
    if (distance < half) return 1 - distance / half;
  }
  return 0;
}

export function episodeTimingIssue(episode: Episode, scenes: TimedLibrary): string | null {
  const blocks = productionBlocks(episode, scenes).filter(block => block.kind === 'scene');
  for (const block of blocks) {
    if (block.duration < .2 || block.duration > 3600 || !Number.isFinite(block.duration)) return 'Episode scene duration must be between 0.2 seconds and 60 minutes.';
    const transition = episode.sceneSettings?.[block.occurrenceIndex!]?.transition;
    if (!transition) continue;
    const previous = blocks.find(candidate => candidate.occurrenceIndex === block.occurrenceIndex! - 1);
    if (!previous || transition.duration < .2 || transition.duration > 2 || transition.duration > Math.min(previous.duration, block.duration)) return 'Fade duration must be 0.2–2 seconds and fit both adjacent scenes.';
  }
  return null;
}

export function episodePosition(episode: Episode, scenes: TimedLibrary, time: number): EpisodePosition | null {
  if (missingSceneIds(episode, scenes).length || episode.sceneIds.length === 0) return null;
  const total = episodeDuration(episode, scenes);
  const current = Math.max(0, Math.min(total, time));
  const blocks = productionBlocks(episode, scenes);
  const block = blocks.find((item, index) => current < item.start + item.duration || index === blocks.length - 1);
  return block ? { scene: block.scene, index: block.occurrenceIndex!, localTime: current - block.start, start: block.start, total } : null;
}
