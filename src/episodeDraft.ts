import type { Episode } from './episodes';

/** Compare persisted episode fields; an absent audio array and an empty one render alike. */
export function episodeSnapshot(episode: Episode): string {
  return JSON.stringify({
    id: episode.id,
    name: episode.name,
    sceneIds: episode.sceneIds,
    introId: episode.introId ?? null,
    creditsId: episode.creditsId ?? null,
    audio: [...(episode.audio ?? [])].sort((left, right) => left.id.localeCompare(right.id)).map(clip => ({
      id: clip.id, assetId: clip.assetId, start: clip.start, trimStart: clip.trimStart,
      trimEnd: clip.trimEnd, volume: clip.volume, fadeIn: clip.fadeIn, fadeOut: clip.fadeOut,
    })),
  });
}

export function episodeHasUnsavedChanges(episode: Episode | null, savedSnapshot: string | null): boolean {
  return episode !== null && (savedSnapshot === null || episodeSnapshot(episode) !== savedSnapshot);
}
