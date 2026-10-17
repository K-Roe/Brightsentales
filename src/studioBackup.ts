import { Brightling } from './maker';
import { validateLibrary } from './library';
import { parseScene, Scene } from './scene';
import { DEFAULT_PLACE_ORGANISATION, PLACE_FOLDERS_KEY, PlaceOrganisation, placesIn, validatePlaceOrganisation } from './placeFolders';
import { TIMED_SCENES_KEY, TimedLibrary, pruneTimedScenes, validateTimedLibrary } from './timedScenes';
import { EPISODES_KEY, EpisodeLibrary, speechFitsEpisode, validateEpisodeLibrary } from './episodes';
import { INTROS_KEY, validateIntroLibrary, type IntroLibrary } from './introductions';
import { type AudioBackupAsset, validAudioBackup } from './audio';

export const STUDIO_BACKUP_VERSION = 6;
export const RESTORE_JOURNAL_KEY = 'brightsenappstales.restore.v1';
export type StudioBackup = { version: 6; createdAt: string; characters: Brightling[]; scene: Scene | null; places: PlaceOrganisation; timedScenes: TimedLibrary | null; episodes: EpisodeLibrary | null; intros: IntroLibrary | null; audioAssets: AudioBackupAsset[] | null };
export type BackupResult = { ok: true; backup: StudioBackup } | { ok: false; error: string };
type Before = { library: string | null; scene: string | null; places?: string | null; timedScenes?: string | null; episodes?: string | null; intros?: string | null };
type Journal = { version: 1 | 2 | 3 | 4 | 5; phase: 'pending' | 'committed'; before: Before; restoreTimed?: boolean; restoreEpisodes?: boolean; restoreIntros?: boolean };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function validateStudioBackup(data: unknown): BackupResult {
  if (!data || typeof data !== 'object') return { ok: false, error: 'This is not a Studio Backup.' };
  const value = data as Record<string, unknown>;
  if (![1, 2, 3, 4, 5, STUDIO_BACKUP_VERSION].includes(value.version as number)) return { ok: false, error: 'Unsupported Studio Backup version.' };
  const version = value.version as number;
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
  const placeIdsForContent = [
    ...places.organisation.customPlaces.filter(place => !!places.organisation.artwork[place.id]).map(place => place.id),
    'living-room', ...['bedroom', 'garden'].filter(id => !!places.organisation.artwork[id]),
  ];
  const timed = version >= 3 && value.timedScenes !== null ? validateTimedLibrary(value.timedScenes, placeIdsForContent) : null;
  if (timed && !timed.ok) return { ok: false, error: timed.error };
  const timedScenes = timed?.ok ? timed.library : null;
  if (timedScenes && timedScenes.scenes.some(item => Object.keys(item.characters).some(id => id.startsWith('brightling-') && !library.characters.some(character => character.id === id)))) return { ok: false, error: 'A timed scene refers to a Brightling missing from this backup.' };
  if (version >= 4 && (!('episodes' in value) || !('timedScenes' in value))) return { ok: false, error: 'This Studio Backup is missing episode or timed scene data.' };
  const checkedEpisodes = version >= 4 ? validateEpisodeLibrary(value.episodes) : null;
  if (checkedEpisodes && !checkedEpisodes.ok) return { ok: false, error: checkedEpisodes.error };
  const episodes = checkedEpisodes?.ok ? checkedEpisodes.library : null;
  if (episodes && timedScenes && episodes.episodes.some(item => !speechFitsEpisode(item, timedScenes))) return { ok: false, error: 'An episode voice clip runs past its duration.' };
  if (version >= 5 && !validAudioBackup(value.audioAssets)) return { ok: false, error: 'Backup audio files are invalid.' };
  const audioAssets = version >= 5 ? value.audioAssets as AudioBackupAsset[] : null;
  const checkedIntros = version >= 6 && value.intros !== null ? validateIntroLibrary(value.intros, placeIdsForContent) : null;
  if (checkedIntros && !checkedIntros.ok) return { ok: false, error: checkedIntros.error };
  const intros = checkedIntros?.ok ? checkedIntros.library : null;
  if (intros && intros.intros.some(item => Object.keys(item.characters).some(id => id.startsWith('brightling-') && !library.characters.some(character => character.id === id)))) return { ok: false, error: 'An intro refers to a Brightling missing from this backup.' };
  const hasClips = (items?: { audio?: { assetId: string }[] }[]) => !!items?.some(item => item.audio?.length);
  if (audioAssets === null && (hasClips(timedScenes?.scenes) || hasClips(episodes?.episodes) || hasClips(intros?.intros))) return { ok: false, error: 'This backup has audio clips but no audio files.' };
  if (audioAssets) {
    const ids = new Set(audioAssets.map(asset => asset.id));
    const orphan = (items?: { audio?: { assetId: string }[] }[]) => !!items?.some(item => item.audio?.some(clip => !ids.has(clip.assetId)));
    if (orphan(timedScenes?.scenes) || orphan(episodes?.episodes) || orphan(intros?.intros)) return { ok: false, error: 'A saved audio clip refers to a missing backup audio file.' };
  }
  // Keep missing references intact. The Episode Maker marks them and blocks playback,
  // allowing a later backup to restore the original scene ID without losing the episode.
  return { ok: true, backup: { version: 6, createdAt: value.createdAt, characters: library.characters, scene, places: places.organisation, timedScenes, episodes, intros, audioAssets } };
}

export function createStudioBackup(characters: Brightling[], scene: Scene | null, date = new Date(), places: PlaceOrganisation = structuredClone(DEFAULT_PLACE_ORGANISATION), timedScenes: TimedLibrary = { version: 1, scenes: [] }, episodes: EpisodeLibrary = { version: 1, episodes: [] }, audioAssets: AudioBackupAsset[] = [], intros: IntroLibrary = { version: 1, intros: [] }): StudioBackup {
  return { version: 6, createdAt: date.toISOString(), characters, scene, places, timedScenes, episodes, intros, audioAssets };
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
    const version = journal.version ?? 0;
    if (![1, 2, 3, 4, 5].includes(version) || !['pending', 'committed'].includes(journal.phase ?? '') || !before || (before.library !== null && typeof before.library !== 'string') || (before.scene !== null && typeof before.scene !== 'string') || version !== 1 && before.places !== null && typeof before.places !== 'string' || version >= 3 && before.timedScenes !== null && typeof before.timedScenes !== 'string' || version >= 4 && before.episodes !== null && typeof before.episodes !== 'string' || version === 5 && before.intros !== null && typeof before.intros !== 'string') return null;
    return journal as Journal;
  } catch { return null; }
}

export function recoverStudioRestore(storage: Storage, libraryKey: string, sceneKey: string, placesKey = PLACE_FOLDERS_KEY, timedKey = TIMED_SCENES_KEY, episodesKey = EPISODES_KEY, introsKey = INTROS_KEY): { ok: boolean; error?: string } {
  try {
    const raw = storage.getItem(RESTORE_JOURNAL_KEY);
    if (raw === null) return { ok: true };
    const journal = parseJournal(raw);
    if (!journal) return { ok: false, error: 'An unfinished Studio restore has an invalid recovery record. Stored data was left untouched.' };
    if (journal.phase === 'pending') {
      writeOriginal(storage, libraryKey, journal.before.library);
      writeOriginal(storage, sceneKey, journal.before.scene);
      if (journal.version !== 1) writeOriginal(storage, placesKey, journal.before.places ?? null);
      if (journal.version >= 3 && journal.restoreTimed) writeOriginal(storage, timedKey, journal.before.timedScenes ?? null);
      if (journal.version >= 4 && journal.restoreEpisodes) writeOriginal(storage, episodesKey, journal.before.episodes ?? null);
      if (journal.version === 5 && journal.restoreIntros) writeOriginal(storage, introsKey, journal.before.intros ?? null);
    }
    storage.removeItem(RESTORE_JOURNAL_KEY);
    return { ok: true };
  } catch { return { ok: false, error: 'An unfinished Studio restore could not be recovered. Stored data was left untouched.' }; }
}

export function finalizeStudioRestore(storage: Storage): { ok: boolean; error?: string } {
  try {
    const raw = storage.getItem(RESTORE_JOURNAL_KEY);
    if (raw === null) return { ok: true };
    const journal = parseJournal(raw);
    if (!journal || journal.phase !== 'pending') return { ok: false, error: 'Studio restore journal is invalid. Stored data was left untouched.' };
    storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify({ ...journal, phase: 'committed' }));
    try { storage.removeItem(RESTORE_JOURNAL_KEY); } catch { /* A committed journal is safe to clear on launch. */ }
    return { ok: true };
  } catch { return { ok: false, error: 'Studio restore could not be finalised. Reload to recover it.' }; }
}

export function restoreStudioBackup(storage: Storage, libraryKey: string, sceneKey: string, backup: StudioBackup, placesKey = PLACE_FOLDERS_KEY, timedKey = TIMED_SCENES_KEY, episodesKey = EPISODES_KEY, deferCommit = false, introsKey = INTROS_KEY): { ok: boolean; error?: string } {
  const checked = validateStudioBackup(backup);
  if (!checked.ok) return { ok: false, error: checked.error };
  const recovery = recoverStudioRestore(storage, libraryKey, sceneKey, placesKey, timedKey, episodesKey, introsKey);
  if (!recovery.ok) return recovery;
  let before: Before;
  try { before = { library: storage.getItem(libraryKey), scene: storage.getItem(sceneKey), places: storage.getItem(placesKey), timedScenes: storage.getItem(timedKey), episodes: storage.getItem(episodesKey), intros: storage.getItem(introsKey) }; }
  catch { return { ok: false, error: 'Browser storage could not be read. Nothing was changed.' }; }
  const placeIds = placesIn(checked.backup.places).filter(place => place.artworkAvailable && place.background).map(place => place.id);
  let nextTimed = checked.backup.timedScenes;
  if (nextTimed === null && before.timedScenes !== null) {
    try {
      const current = validateTimedLibrary(JSON.parse(before.timedScenes!), placeIds);
      if (!current.ok) return { ok: false, error: 'This older backup cannot safely preserve existing timed scenes with its Places data. Nothing was changed.' };
      nextTimed = pruneTimedScenes(current.library, checked.backup.characters.map(item => item.id));
    } catch { return { ok: false, error: 'Existing timed scenes are invalid. Nothing was changed.' }; }
  }
  // A version 5 or older backup carries no intros, so existing intros are kept rather than cleared.
  let nextIntros = checked.backup.intros;
  if (nextIntros === null && before.intros !== null) {
    try {
      const current = validateIntroLibrary(JSON.parse(before.intros!), placeIds);
      if (!current.ok) return { ok: false, error: 'This older backup cannot safely preserve existing intros with its Places data. Nothing was changed.' };
      nextIntros = current.library;
    } catch { return { ok: false, error: 'Existing intros are invalid. Nothing was changed.' }; }
  }
  const pending: Journal = { version: 5, phase: 'pending', before, restoreTimed: nextTimed !== null, restoreEpisodes: checked.backup.episodes !== null, restoreIntros: nextIntros !== null };
  try {
    storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(pending));
    storage.setItem(libraryKey, JSON.stringify(checked.backup.characters));
    writeOriginal(storage, sceneKey, checked.backup.scene === null ? null : JSON.stringify(checked.backup.scene));
    storage.setItem(placesKey, JSON.stringify(checked.backup.places));
    if (nextTimed !== null) storage.setItem(timedKey, JSON.stringify(nextTimed));
    if (checked.backup.episodes !== null) storage.setItem(episodesKey, JSON.stringify(checked.backup.episodes));
    if (nextIntros !== null) storage.setItem(introsKey, JSON.stringify(nextIntros));
    if (deferCommit) return { ok: true };
    if (!finalizeStudioRestore(storage).ok) throw new Error('Could not commit Studio restore.');
    return { ok: true };
  } catch {
    const rollback = recoverStudioRestore(storage, libraryKey, sceneKey, placesKey, timedKey, episodesKey, introsKey);
    return { ok: false, error: rollback.ok ? 'Studio restore failed. Previous characters, scenes and places were restored.' : rollback.error };
  }
}
