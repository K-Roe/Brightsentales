import type { AudioAsset } from './audio';
import { placesIn, type PlaceOrganisation } from './placeFolders';
import { validateAudioReferences } from './sceneVideoExport';
import type { Brightling } from './maker';
import { validateTimedLibrary, type TimedScene } from './timedScenes';

/** Shared readiness check for the in-app Canvas preview. It never edits saved scene data. */
export function embeddedPreviewIssue(scene: TimedScene, characters: Brightling[], places: PlaceOrganisation, audioAssets: AudioAsset[]): string | null {
  const availablePlaces = placesIn(places).filter(place => place.artworkAvailable && place.background);
  const place = availablePlaces.find(item => item.id === scene.placeId);
  if (!place) return `The saved location for “${scene.name}” is missing or has no artwork.`;
  const validation = validateTimedLibrary({ version: 1, scenes: [scene] }, availablePlaces.map(item => item.id));
  if (!validation.ok) return validation.error;
  for (const id of Object.keys(scene.characters)) {
    const character = characters.find(item => item.id === id);
    if (id !== 'max' && id !== 'maxine' && !character) {
      return `${id} is used in “${scene.name}” but is missing from the saved Brightling library.`;
    }
  }
  try { validateAudioReferences(scene.audio ?? [], audioAssets, scene.duration); }
  catch (error) { return error instanceof Error ? error.message : 'Scene audio is not ready for playback.'; }
  return null;
}
