import type { Episode } from './episodes';
import { type StudioBackup, validateStudioBackup } from './studioBackup';

export type LocalEpisodeBackupResult = { ok: true; backup: StudioBackup } | { ok: false; error: string };

/** Make a compact native Backup v8 containing only one episode and its referenced data. */
export function makeLocalEpisodeBackup(source: StudioBackup, episode: Episode): LocalEpisodeBackupResult {
  const sourceEpisodes = source.episodes?.episodes;
  const sourceScenes = source.timedScenes?.scenes;
  if (!sourceEpisodes || !sourceScenes || !sourceEpisodes.some(item => item.id === episode.id)) return { ok: false, error: 'The saved episode could not be found in the current Studio snapshot.' };
  const scenes = sourceScenes.filter(scene => episode.sceneIds.includes(scene.id));
  if (episode.sceneIds.some(id => !scenes.some(scene => scene.id === id))) return { ok: false, error: 'A scene used by this episode is missing.' };
  const intro = episode.introId ? source.intros?.intros.find(item => item.id === episode.introId) : undefined;
  const credits = episode.creditsId ? source.credits?.credits.find(item => item.id === episode.creditsId) : undefined;
  if (episode.introId && !intro || episode.creditsId && !credits) return { ok: false, error: 'The saved intro or credits for this episode are missing.' };
  const characterIds = new Set([...scenes.flatMap(scene => Object.keys(scene.characters)), ...(intro ? Object.keys(intro.characters) : [])].filter(id => id.startsWith('brightling-')));
  const audioIds = new Set([...(episode.audio ?? []).map(clip => clip.assetId), ...scenes.flatMap(scene => (scene.audio ?? []).map(clip => clip.assetId)), ...(intro?.audio ?? []).map(clip => clip.assetId), ...(credits?.audio ?? []).map(clip => clip.assetId)]);
  const audioAssets = source.audioAssets?.filter(asset => audioIds.has(asset.id)) ?? [];
  if ([...audioIds].some(id => !audioAssets.some(asset => asset.id === id))) return { ok: false, error: 'A voice or music file used by this episode is missing.' };
  const result: StudioBackup = {
    ...source, scene: null,
    characters: source.characters.filter(character => characterIds.has(character.id)),
    timedScenes: { version: 1, scenes },
    episodes: { version: 1, episodes: [episode] },
    intros: { version: 1, intros: intro ? [intro] : [] },
    credits: { version: 1, credits: credits ? [credits] : [] },
    projects: { version: 1, music: [], effects: [] }, audioAssets, voiceSettings: null,
  };
  const checked = validateStudioBackup(result);
  return checked.ok ? { ok: true, backup: checked.backup } : { ok: false, error: checked.error };
}
