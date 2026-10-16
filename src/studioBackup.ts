import { Brightling } from './maker';
import { validateLibrary } from './library';
import { parseScene, Scene } from './scene';
import { DEFAULT_PLACE_ORGANISATION, PLACE_FOLDERS_KEY, PlaceOrganisation, validatePlaceOrganisation } from './placeFolders';

export const STUDIO_BACKUP_VERSION = 2;
export const RESTORE_JOURNAL_KEY = 'brightsenappstales.restore.v1';
export type StudioBackup = { version: 2; createdAt: string; characters: Brightling[]; scene: Scene | null; places: PlaceOrganisation };
export type BackupResult = { ok: true; backup: StudioBackup } | { ok: false; error: string };
type Before = { library: string | null; scene: string | null; places?: string | null };
type Journal = { version: 1 | 2; phase: 'pending' | 'committed'; before: Before };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function validateStudioBackup(data: unknown): BackupResult {
  if (!data || typeof data !== 'object') return { ok: false, error: 'This is not a Studio Backup.' };
  const value = data as Record<string, unknown>;
  if (value.version !== 1 && value.version !== STUDIO_BACKUP_VERSION) return { ok: false, error: 'Unsupported Studio Backup version.' };
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
  return { ok: true, backup: { version: 2, createdAt: value.createdAt, characters: library.characters, scene, places: places.organisation } };
}

export function createStudioBackup(characters: Brightling[], scene: Scene | null, date = new Date(), places: PlaceOrganisation = structuredClone(DEFAULT_PLACE_ORGANISATION)): StudioBackup {
  return { version: 2, createdAt: date.toISOString(), characters, scene, places };
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
    if (journal.version !== 1 && journal.version !== 2 || !['pending', 'committed'].includes(journal.phase ?? '') || !before || (before.library !== null && typeof before.library !== 'string') || (before.scene !== null && typeof before.scene !== 'string') || journal.version === 2 && before.places !== null && typeof before.places !== 'string') return null;
    return journal as Journal;
  } catch { return null; }
}

export function recoverStudioRestore(storage: Storage, libraryKey: string, sceneKey: string, placesKey = PLACE_FOLDERS_KEY): { ok: boolean; error?: string } {
  try {
    const raw = storage.getItem(RESTORE_JOURNAL_KEY);
    if (raw === null) return { ok: true };
    const journal = parseJournal(raw);
    if (!journal) return { ok: false, error: 'An unfinished Studio restore has an invalid recovery record. Stored data was left untouched.' };
    if (journal.phase === 'pending') {
      writeOriginal(storage, libraryKey, journal.before.library);
      writeOriginal(storage, sceneKey, journal.before.scene);
      if (journal.version === 2) writeOriginal(storage, placesKey, journal.before.places ?? null);
    }
    storage.removeItem(RESTORE_JOURNAL_KEY);
    return { ok: true };
  } catch { return { ok: false, error: 'An unfinished Studio restore could not be recovered. Stored data was left untouched.' }; }
}

export function restoreStudioBackup(storage: Storage, libraryKey: string, sceneKey: string, backup: StudioBackup, placesKey = PLACE_FOLDERS_KEY): { ok: boolean; error?: string } {
  const checked = validateStudioBackup(backup);
  if (!checked.ok) return { ok: false, error: checked.error };
  const recovery = recoverStudioRestore(storage, libraryKey, sceneKey, placesKey);
  if (!recovery.ok) return recovery;
  let before: Before;
  try { before = { library: storage.getItem(libraryKey), scene: storage.getItem(sceneKey), places: storage.getItem(placesKey) }; }
  catch { return { ok: false, error: 'Browser storage could not be read. Nothing was changed.' }; }
  const pending: Journal = { version: 2, phase: 'pending', before };
  try {
    storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(pending));
    storage.setItem(libraryKey, JSON.stringify(checked.backup.characters));
    writeOriginal(storage, sceneKey, checked.backup.scene === null ? null : JSON.stringify(checked.backup.scene));
    storage.setItem(placesKey, JSON.stringify(checked.backup.places));
    storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify({ ...pending, phase: 'committed' }));
    try { storage.removeItem(RESTORE_JOURNAL_KEY); } catch { /* Committed data is safe; cleanup retries on next launch. */ }
    return { ok: true };
  } catch {
    const rollback = recoverStudioRestore(storage, libraryKey, sceneKey, placesKey);
    return { ok: false, error: rollback.ok ? 'Studio restore failed. Previous characters, scene and places were restored.' : rollback.error };
  }
}
