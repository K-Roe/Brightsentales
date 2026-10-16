import { Brightling, validateBrightling } from './maker';
import { Scene } from './scene';

export type LibraryResult = { ok: true; characters: Brightling[] } | { ok: false; error: string };
export type ImportMode = 'merge' | 'replace';
const reserved = new Set(['max', 'maxine', 'oliver']);

export function validateLibrary(data: unknown): LibraryResult {
  const entries = Array.isArray(data) ? data : data && typeof data === 'object' && 'version' in data && data.version === 1 && 'characters' in data ? data.characters : null;
  if (!Array.isArray(entries)) return { ok: false, error: 'Expected a Brightling library JSON array or a version 1 backup.' };
  const ids = new Set<string>(), names = new Set(reserved);
  for (const entry of entries) {
    if (!validateBrightling(entry)) return { ok: false, error: 'A Brightling has missing or invalid details.' };
    const name = entry.name.trim().toLocaleLowerCase();
    if (ids.has(entry.id) || names.has(name)) return { ok: false, error: 'The library contains duplicate IDs or names, or a protected character name.' };
    ids.add(entry.id); names.add(name);
  }
  return { ok: true, characters: entries };
}

export function decodeLibrary(raw: string | null): LibraryResult {
  if (raw === null) return { ok: true, characters: [] };
  try { return validateLibrary(JSON.parse(raw)); }
  catch { return { ok: false, error: 'The saved Brightling library is not valid JSON.' }; }
}

export function prepareImport(current: Brightling[], incoming: Brightling[], mode: ImportMode): LibraryResult {
  if (mode === 'replace') return validateLibrary(incoming);
  const incomingIds = new Set(incoming.map(item => item.id));
  return validateLibrary([...current.filter(item => !incomingIds.has(item.id)), ...incoming]);
}

export function withoutCharacter(scene: Scene, id: string): Scene {
  if (reserved.has(id)) return scene;
  const characters = { ...scene.characters };
  delete characters[id];
  return { ...scene, characters };
}

export function pruneScene(scene: Scene, library: Brightling[]): Scene {
  const available = new Set([...reserved, ...library.map(item => item.id)]);
  return { ...scene, characters: Object.fromEntries(Object.entries(scene.characters).filter(([id]) => available.has(id))) };
}

export function backupLibrary(library: Brightling[]): string {
  return JSON.stringify({ version: 1, characters: library }, null, 2);
}
