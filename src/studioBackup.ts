import { Brightling } from './maker';
import { validateLibrary } from './library';
import { parseScene, Scene } from './scene';
import { DEFAULT_PLACE_ORGANISATION, PLACE_FOLDERS_KEY, PlaceOrganisation, placesIn, validatePlaceOrganisation } from './placeFolders';
import { TIMED_SCENES_KEY, TimedLibrary, pruneTimedScenes, validateTimedLibrary } from './timedScenes';
import { EPISODES_KEY, EpisodeLibrary, validateEpisodeLibrary } from './episodes';
import { type AudioBackupAsset, validAudioBackup } from './audio';

export const STUDIO_BACKUP_VERSION = 5;
export const RESTORE_JOURNAL_KEY = 'brightsenappstales.restore.v1';
export type StudioBackup = { version: 5; createdAt: string; characters: Brightling[]; scene: Scene | null; places: PlaceOrganisation; timedScenes: TimedLibrary | null; episodes: EpisodeLibrary | null; audioAssets: AudioBackupAsset[] | null };
export type BackupResult = { ok: true; backup: StudioBackup } | { ok: false; error: string };
type Before = { library: string | null; scene: string | null; places?: string | null; timedScenes?: string | null; episodes?: string | null };
type Journal = { version: 1 | 2 | 3 | 4; phase: 'pending' | 'committed'; before: Before; restoreTimed?: boolean; restoreEpisodes?: boolean };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function validateStudioBackup(data: unknown): BackupResult {
  if (!data || typeof data !== 'object') return { ok: false, error: 'This is not a Studio Backup.' };
  const value = data as Record<string, unknown>;
  if (![1, 2, 3, 4, STUDIO_BACKUP_VERSION].includes(value.version as number)) return { ok: false, error: 'Unsupported Studio Backup version.' };
  if (typeof value.createdAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.createdAt) || Number.isNaN(Date.parse(value.createdAt))) return { ok: false, error: 'The backup timestamp is invalid.' };
  const library = validateLibrary(value.characters);
  if (!library.ok) return { ok: false, error: library.error };
  let scene: Scene | null = null;
  if (value.scene !== null) {
    if (!value.scene || typeof value.scene !== 'object' || !('characters' in value.scene) || !value.scene.characters || typeof value.scene.characters !== 'object' || Array.isArray(value.scene.characters)) return { ok: false, error: 'The saved scene is invalid.' };
    scene = parseScene(JSON.stringify(value.scene));
    if (!scene || Object.keys(scene.characters).length !== Object.keys(value.scene.characters).length) return { ok: false, error: 'The saved scene contains invalid characters or positions.' };
    for (const [id, original] of Object.entries(value.scene.characters as Record<string, { start?: { x?: number; y?: number }; destination?: { x?: number; y?: number } | null }>)) {
      const parsed = scene.characters[id];
      if (!parsed || parsed.start.x !== original?.start?.x || parsed.start.y !== original?.start?.y || (parsed.destination?.x ?? null) !== (original?.destination?.x ?? null) || (parsed.destination?.y ?? null) !== (original?.destination?.y ?? null)) return { ok: false, error: 'The saved scene contains invalid characters or positions.' };
    }
    const ids = new Set(library.characters.map(item => item.id));
    if (Object.keys(scene.characters).some(id => id.startsWith('brightling-') && !ids.has(id))) return { ok: false, error: 'The saved scene refers to a Brightling missing from this backup.' };
  }
  const places = value.version === 1 ? validatePlaceOrganisation(structuredClone(DEFAULT_PLACE_ORGANISATION)) : validatePlaceOrganisation(value.places);
  if (!places.ok) return { ok: false, error: places.error };
  const timed = (value.version === 3 || value.version === 4 || value.version === 5) && value.timedScenes !== null ? validateTimedLibrary(value.timedScenes, [
    ...places.organisation.customPlaces.filter(place => !!places.organisation.artwork[place.id]).map(place => place.id),
    'living-room', ...['bedroom', 'garden'].filter(id => !!places.organisation.artwork[id]),
  ]) : null;
  if (timed && !timed.ok) return { ok: false, error: timed.error };
  const timedScenes = timed?.ok ? timed.library : null;
  if (timedScenes && timedScenes.scenes.some(item => Object.keys(item.characters).some(id => id.startsWith('brightling-') && !library.characters.some(character => character.id === id)))) return { ok: false, error: 'A timed scene refers to a Brightling missing from this backup.' };
  if ((value.version === 4 || value.version === 5) && (!('episodes' in value) || !('timedScenes' in value))) return { ok: false, error: 'This Studio Backup is missing episode or timed scene data.' };
  const checkedEpisodes = value.version === 4 || value.version === 5 ? validateEpisodeLibrary(value.episodes) : null;
  if (checkedEpisodes && !checkedEpisodes.ok) return { ok: false, error: checkedEpisodes.error };
  const episodes = checkedEpisodes?.ok ? checkedEpisodes.library : null;
  if (value.version === 5 && !validAudioBackup(value.audioAssets)) return { ok: false, error: 'Backup audio files are invalid.' };
  const audioAssets = value.version === 5 ? value.audioAssets as AudioBackupAsset[] : null;
  if (audioAssets === null && (timedScenes?.scenes.some(item => item.audio?.length) || episodes?.episodes.some(item => item.audio?.length))) return { ok: false, error: 'This backup has audio clips but no audio files.' };
  if (audioAssets) {
    const ids = new Set(audioAssets.map(asset => asset.id));
    if (timedScenes?.scenes.some(item => item.audio?.some(clip => !ids.has(clip.assetId))) || episodes?.episodes.some(item => item.audio?.some(clip => !ids.has(clip.assetId)))) return { ok: false, error: 'A saved audio clip refers to a missing backup audio file.' };
  }
  // Keep missing references intact. The Episode Maker marks them and blocks playback,
  // allowing a later backup to restore the original scene ID without losing the episode.
  return { ok: true, backup: { version: 5, createdAt: value.createdAt, characters: library.characters, scene, places: places.organisation, timedScenes, episodes, audioAssets } };
}

export function createStudioBackup(characters: Brightling[], scene: Scene | null, date = new Date(), places: PlaceOrganisation = structuredClone(DEFAULT_PLACE_ORGANISATION), timedScenes: TimedLibrary = { version: 1, scenes: [] }, episodes: EpisodeLibrary = { version: 1, episodes: [] }, audioAssets: AudioBackupAsset[] = []): StudioBackup {
  return { version: 5, createdAt: date.toISOString(), characters, scene, places, timedScenes, episodes, audioAssets };
}

function writeOriginal(storage: Storage, key: string, value: string | null) {
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
}

function parseJournal(raw: string): Journal | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const journal = value as Partial<Journal>;
    const before = journal.before;
    if (![1, 2, 3, 4].includes(journal.version ?? 0) || !['pending', 'committed'].includes(journal.phase ?? '') || !before || (before.library !== null && typeof before.library !== 'string') || (before.scene !== null && typeof before.scene !== 'string') || journal.version !== 1 && before.places !== null && typeof before.places !== 'string' || (journal.version === 3 || journal.version === 4) && before.timedScenes !== null && typeof before.timedScenes !== 'string' || journal.version === 4 && before.episodes !== null && typeof before.episodes !== 'string') return null;
    return journal as Journal;
  } catch { return null; }
}

export function recoverStudioRestore(storage: Storage, libraryKey: string, sceneKey: string, placesKey = PLACE_FOLDERS_KEY, timedKey = TIMED_SCENES_KEY, episodesKey = EPISODES_KEY): { ok: boolean; error?: string } {
  try {
    const raw = storage.getItem(RESTORE_JOURNAL_KEY);
    if (raw === null) return { ok: true };
    const journal = parseJournal(raw);
    if (!journal) return { ok: false, error: 'An unfinished Studio restore has an invalid recovery record. Stored data was left untouched.' };
    if (journal.phase === 'pending') {
      writeOriginal(storage, libraryKey, journal.before.library);
      writeOriginal(storage, sceneKey, journal.before.scene);
      if (journal.version !== 1) writeOriginal(storage, placesKey, journal.before.places ?? null);
      if ((journal.version === 3 || journal.version === 4) && journal.restoreTimed) writeOriginal(storage, timedKey, journal.before.timedScenes ?? null);
      if (journal.version === 4 && journal.restoreEpisodes) writeOriginal(storage, episodesKey, journal.before.episodes ?? null);
    }
    storage.removeItem(RESTORE_JOURNAL_KEY);
    return { ok: true };
  } catch { return { ok: false, error: 'An unfinished Studio restore could not be recovered. Stored data was left untouched.' }; }
}

export function restoreStudioBackup(storage: Storage, libraryKey: string, sceneKey: string, backup: StudioBackup, placesKey = PLACE_FOLDERS_KEY, timedKey = TIMED_SCENES_KEY, episodesKey = EPISODES_KEY): { ok: boolean; error?: string } {
  const checked = validateStudioBackup(backup);
  if (!checked.ok) return { ok: false, error: checked.error };
  const recovery = recoverStudioRestore(storage, libraryKey, sceneKey, placesKey, timedKey, episodesKey);
  if (!recovery.ok) return recovery;
  let before: Before;
  try { before = { library: storage.getItem(libraryKey), scene: storage.getItem(sceneKey), places: storage.getItem(placesKey), timedScenes: storage.getItem(timedKey), episodes: storage.getItem(episodesKey) }; }
  catch { return { ok: false, error: 'Browser storage could not be read. Nothing was changed.' }; }
  let nextTimed = checked.backup.timedScenes;
  if (nextTimed === null && before.timedScenes !== null) {
    try {
      const placeIds = placesIn(checked.backup.places).filter(place => place.artworkAvailable && place.background).map(place => place.id);
      const current = validateTimedLibrary(JSON.parse(before.timedScenes!), placeIds);
      if (!current.ok) return { ok: false, error: 'This older backup cannot safely preserve existing timed scenes with its Places data. Nothing was changed.' };
      nextTimed = pruneTimedScenes(current.library, checked.backup.characters.map(item => item.id));
    } catch { return { ok: false, error: 'Existing timed scenes are invalid. Nothing was changed.' }; }
  }
  const pending: Journal = { version: 4, phase: 'pending', before, restoreTimed: nextTimed !== null, restoreEpisodes: checked.backup.episodes !== null };
  try {
    storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(pending));
    storage.setItem(libraryKey, JSON.stringify(checked.backup.characters));
    writeOriginal(storage, sceneKey, checked.backup.scene === null ? null : JSON.stringify(checked.backup.scene));
    storage.setItem(placesKey, JSON.stringify(checked.backup.places));
    if (nextTimed !== null) storage.setItem(timedKey, JSON.stringify(nextTimed));
    if (checked.backup.episodes !== null) storage.setItem(episodesKey, JSON.stringify(checked.backup.episodes));
    storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify({ ...pending, phase: 'committed' }));
    try { storage.removeItem(RESTORE_JOURNAL_KEY); } catch { /* Committed data is safe; cleanup retries on next launch. */ }
    return { ok: true };
  } catch {
    const rollback = recoverStudioRestore(storage, libraryKey, sceneKey, placesKey, timedKey, episodesKey);
    return { ok: false, error: rollback.ok ? 'Studio restore failed. Previous characters, scenes and places were restored.' : rollback.error };
  }
}
