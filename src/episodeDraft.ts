import type { Episode } from './episodes';

/** Compare persisted episode fields; omitted empty tracks render like empty tracks. */
export function episodeSnapshot(episode: Episode): string {
  return JSON.stringify({
    id: episode.id,
    name: episode.name,
    sceneIds: episode.sceneIds,
    sceneSettings: episode.sceneIds.map((_, index) => ({
      duration: episode.sceneSettings?.[index]?.duration ?? null,
      transition: episode.sceneSettings?.[index]?.transition ?? null,
    })),
    camera: [...(episode.camera ?? [])].sort((left, right) => left.start - right.start).map(shot => ({
      id: shot.id, start: shot.start, duration: shot.duration, shot: shot.shot,
      target: shot.target, movement: shot.movement, x: shot.x ?? null, y: shot.y ?? null, zoom: shot.zoom ?? null,
    })),
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
