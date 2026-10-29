import { validateEpisodeLibrary, type Episode } from './episodes';
import { validateTimedLibrary, type TimedScene } from './timedScenes';

export const EPISODE_WORKSPACE_KEY = 'brightsenappstales.episode-workspace.v1';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export type EpisodeFolder = { id: string; name: string; createdAt: string };
export type EpisodeTestPreview = { id: string; title: string; purpose: string; episodeId: string; createdAt: string; folderId: string | null; snapshot: Episode; scenes: TimedScene[] };
export type EpisodeWorkspace = { version: 1; folders: EpisodeFolder[]; assignments: Record<string, string>; lastEdited: Record<string, string>; testPreviews: EpisodeTestPreview[] };
export const EMPTY_EPISODE_WORKSPACE: EpisodeWorkspace = { version: 1, folders: [], assignments: {}, lastEdited: {}, testPreviews: [] };
export type WorkspaceResult = { ok: true; workspace: EpisodeWorkspace } | { ok: false; error: string };

export function validateEpisodeWorkspace(value: unknown): WorkspaceResult {
  if (!value || typeof value !== 'object') return { ok: false, error: 'Episode organization data is invalid.' };
  const workspace = value as Partial<EpisodeWorkspace>;
  if (workspace.version !== 1 || !Array.isArray(workspace.folders) || !workspace.assignments || typeof workspace.assignments !== 'object' || Array.isArray(workspace.assignments) || !workspace.lastEdited || typeof workspace.lastEdited !== 'object' || Array.isArray(workspace.lastEdited) || !Array.isArray(workspace.testPreviews)) return { ok: false, error: 'Episode organization data is invalid.' };
  if (workspace.folders.length > 200 || workspace.testPreviews.length > 500) return { ok: false, error: 'Episode organization has too many folders or visual previews.' };
  const folderIds = new Set<string>(), folderNames = new Set<string>();
  for (const folder of workspace.folders) {
    if (!folder || !/^folder-[0-9a-f-]{36}$/i.test(folder.id) || !folder.name || folder.name !== folder.name.trim() || folder.name.length > 60 || typeof folder.createdAt !== 'string' || Number.isNaN(Date.parse(folder.createdAt)) || folderIds.has(folder.id) || folderNames.has(folder.name.toLocaleLowerCase())) return { ok: false, error: 'A folder has invalid or duplicate details.' };
    folderIds.add(folder.id); folderNames.add(folder.name.toLocaleLowerCase());
  }
  for (const [episodeId, folderId] of Object.entries(workspace.assignments)) if (!uuid.test(episodeId) || typeof folderId !== 'string' || !folderIds.has(folderId)) return { ok: false, error: 'An episode folder assignment is invalid.' };
  for (const [episodeId, date] of Object.entries(workspace.lastEdited)) if (!uuid.test(episodeId) || typeof date !== 'string' || Number.isNaN(Date.parse(date))) return { ok: false, error: 'An episode edit date is invalid.' };
  const previewIds = new Set<string>();
  for (const item of workspace.testPreviews) {
    if (!item || !uuid.test(item.id) || !uuid.test(item.episodeId) || !item.title || item.title !== item.title.trim() || item.title.length > 80 || typeof item.purpose !== 'string' || item.purpose.length > 240 || typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)) || item.folderId !== null && (typeof item.folderId !== 'string' || !folderIds.has(item.folderId)) || previewIds.has(item.id) || !item.snapshot || item.snapshot.id !== item.episodeId || !Array.isArray(item.scenes)) return { ok: false, error: 'A visual test preview has invalid details.' };
    if (!item.snapshot.sceneIds.length || !validateEpisodeLibrary({ version: 1, episodes: [item.snapshot] }).ok || !validateTimedLibrary({ version: 1, scenes: item.scenes }, [...new Set(item.scenes.map(scene => scene.placeId))]).ok || item.snapshot.sceneIds.some(id => !item.scenes.some(scene => scene.id === id))) return { ok: false, error: 'A visual test preview contains an invalid episode snapshot.' };
    previewIds.add(item.id);
  }
  return { ok: true, workspace: workspace as EpisodeWorkspace };
}

export function decodeEpisodeWorkspace(raw: string | null): WorkspaceResult {
  if (raw === null) return { ok: true, workspace: structuredClone(EMPTY_EPISODE_WORKSPACE) };
  try { return validateEpisodeWorkspace(JSON.parse(raw)); }
  catch { return { ok: false, error: 'Saved episode organization is not valid JSON.' }; }
}

export function makeEpisodeFolder(workspace: EpisodeWorkspace, name: string, now = new Date()): EpisodeWorkspace | null {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > 60 || workspace.folders.some(folder => folder.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) return null;
  return { ...workspace, folders: [...workspace.folders, { id: `folder-${crypto.randomUUID()}`, name: clean, createdAt: now.toISOString() }] };
}

export function renameEpisodeFolder(workspace: EpisodeWorkspace, id: string, name: string): EpisodeWorkspace | null {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!workspace.folders.some(folder => folder.id === id) || !clean || clean.length > 60 || workspace.folders.some(folder => folder.id !== id && folder.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) return null;
  return { ...workspace, folders: workspace.folders.map(folder => folder.id === id ? { ...folder, name: clean } : folder) };
}

export function deleteEpisodeFolder(workspace: EpisodeWorkspace, id: string): EpisodeWorkspace | null {
  if (!workspace.folders.some(folder => folder.id === id)) return null;
  const assignments = Object.fromEntries(Object.entries(workspace.assignments).filter(([, folderId]) => folderId !== id));
  return { ...workspace, folders: workspace.folders.filter(folder => folder.id !== id), assignments, testPreviews: workspace.testPreviews.map(item => item.folderId === id ? { ...item, folderId: null } : item) };
}

export function moveEpisodeToFolder(workspace: EpisodeWorkspace, episodeId: string, folderId: string | null): EpisodeWorkspace | null {
  if (!uuid.test(episodeId) || folderId !== null && !workspace.folders.some(folder => folder.id === folderId)) return null;
  const assignments = { ...workspace.assignments };
  if (folderId === null) delete assignments[episodeId]; else assignments[episodeId] = folderId;
  return { ...workspace, assignments, testPreviews: workspace.testPreviews.map(item => item.episodeId === episodeId ? { ...item, folderId } : item) };
}

export function recordEpisodeSaved(workspace: EpisodeWorkspace, episode: Episode, date = new Date()): EpisodeWorkspace {
  return { ...workspace, lastEdited: { ...workspace.lastEdited, [episode.id]: date.toISOString() } };
}

export function addEpisodeTestPreview(workspace: EpisodeWorkspace, episode: Episode, scenes: TimedScene[], title: string, purpose: string, date = new Date()): EpisodeWorkspace | null {
  const cleanTitle = title.trim(), cleanPurpose = purpose.trim();
  if (!uuid.test(episode.id) || !episode.sceneIds.length || !cleanTitle || cleanTitle.length > 80 || cleanPurpose.length > 240) return null;
  if (!validateEpisodeLibrary({ version: 1, episodes: [episode] }).ok || !validateTimedLibrary({ version: 1, scenes }, [...new Set(scenes.map(scene => scene.placeId))]).ok || episode.sceneIds.some(id => !scenes.some(scene => scene.id === id))) return null;
  const preview: EpisodeTestPreview = { id: crypto.randomUUID(), title: cleanTitle, purpose: cleanPurpose, episodeId: episode.id, createdAt: date.toISOString(), folderId: workspace.assignments[episode.id] ?? null, snapshot: structuredClone(episode), scenes: structuredClone(scenes) };
  return { ...workspace, testPreviews: [preview, ...workspace.testPreviews].slice(0, 500) };
}
