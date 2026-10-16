import { PLACES, type Place } from './placeCatalog';

export const PLACE_FOLDERS_KEY = 'brightsenappstales.place-folders.v1';
export type PlaceFolder = { id: string; name: string; protected: boolean };
export type PlaceOrganisation = {
  version: 1;
  folders: PlaceFolder[];
  assignments: Record<string, string | null>;
  customPlaces: Place[];
  removedDefaultPlaceIds: string[];
  artwork: Record<string, string>;
};
export type OrganisationResult = { ok: true; organisation: PlaceOrganisation } | { ok: false; error: string };

const removableDefaultIds = ['bedroom', 'garden'];
const customPlaceId = /^place-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const artworkPrefix = 'data:image/webp;base64,';
const maxArtworkLength = 1_800_000;

export function validPlaceArtwork(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith(artworkPrefix) || value.length > maxArtworkLength) return false;
  const encoded = value.slice(artworkPrefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) return false;
  try {
    const bytes = atob(encoded);
    const declaredSize = bytes.charCodeAt(4) | bytes.charCodeAt(5) << 8 | bytes.charCodeAt(6) << 16 | bytes.charCodeAt(7) << 24;
    return bytes.length >= 20 && bytes.slice(0, 4) === 'RIFF' && bytes.slice(8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.slice(12, 16)) && declaredSize + 8 === bytes.length;
  }
  catch { return false; }
}

export const DEFAULT_PLACE_ORGANISATION: PlaceOrganisation = {
  version: 1,
  folders: [
    { id: 'house', name: 'House', protected: true },
    { id: 'park', name: 'Park', protected: true },
  ],
  assignments: { 'living-room': 'house', bedroom: 'house', garden: 'house' },
  customPlaces: [],
  removedDefaultPlaceIds: [],
  artwork: {},
};

export function placesIn(organisation: PlaceOrganisation): Place[] {
  return [...PLACES.filter(place => !organisation.removedDefaultPlaceIds.includes(place.id)), ...organisation.customPlaces].map(place => organisation.artwork[place.id]
    ? { ...place, background: organisation.artwork[place.id], artworkAvailable: true }
    : place);
}

export function validatePlaceOrganisation(data: unknown): OrganisationResult {
  if (!data || typeof data !== 'object') return { ok: false, error: 'Places folder data is invalid.' };
  const value = data as Partial<PlaceOrganisation>;
  if (value.version !== 1 || !Array.isArray(value.folders) || !value.assignments || typeof value.assignments !== 'object' || Array.isArray(value.assignments)) return { ok: false, error: 'Places folder data is invalid.' };
  const ids = new Set<string>(), names = new Set<string>();
  for (const folder of value.folders) {
    if (!folder || typeof folder !== 'object' || typeof folder.id !== 'string' || typeof folder.name !== 'string' || typeof folder.protected !== 'boolean') return { ok: false, error: 'A Places folder has invalid details.' };
    if (!/^(house|park|folder-[a-f0-9-]{36})$/.test(folder.id) || !folder.name.trim() || folder.name !== folder.name.trim() || folder.name.length > 40 || ids.has(folder.id) || names.has(folder.name.toLocaleLowerCase())) return { ok: false, error: 'A Places folder has an invalid or duplicate ID or name.' };
    if ((folder.id === 'house' || folder.id === 'park') !== folder.protected) return { ok: false, error: 'Protected Places folders cannot be changed.' };
    if (folder.id === 'house' && folder.name !== 'House' || folder.id === 'park' && folder.name !== 'Park') return { ok: false, error: 'Protected Places folders cannot be renamed.' };
    ids.add(folder.id); names.add(folder.name.toLocaleLowerCase());
  }
  if (!ids.has('house') || !ids.has('park')) return { ok: false, error: 'The default Places folders are missing.' };

  const customPlaces = value.customPlaces === undefined ? [] : value.customPlaces;
  const removedDefaultPlaceIds = value.removedDefaultPlaceIds === undefined ? [] : value.removedDefaultPlaceIds;
  if (!Array.isArray(customPlaces) || !Array.isArray(removedDefaultPlaceIds) || new Set(removedDefaultPlaceIds).size !== removedDefaultPlaceIds.length || removedDefaultPlaceIds.some(id => !removableDefaultIds.includes(id))) return { ok: false, error: 'Places contain invalid removals.' };
  const placeIds = new Set(PLACES.filter(place => !removedDefaultPlaceIds.includes(place.id)).map(place => place.id));
  const placeNames = new Set(PLACES.filter(place => !removedDefaultPlaceIds.includes(place.id)).map(place => place.name.toLocaleLowerCase()));
  for (const place of customPlaces) {
    if (!place || typeof place !== 'object' || typeof place.id !== 'string' || !customPlaceId.test(place.id) || typeof place.name !== 'string' || !place.name || place.name !== place.name.trim() || place.name.length > 60 || place.background !== null || place.protected !== false || place.artworkAvailable !== false || placeIds.has(place.id) || placeNames.has(place.name.toLocaleLowerCase())) return { ok: false, error: 'A custom place has invalid or duplicate details.' };
    placeIds.add(place.id); placeNames.add(place.name.toLocaleLowerCase());
  }
  const assignments = value.assignments as Record<string, unknown>;
  if (Object.keys(assignments).length !== placeIds.size || [...placeIds].some(id => !Object.hasOwn(assignments, id) || assignments[id] !== null && (typeof assignments[id] !== 'string' || !ids.has(assignments[id])))) return { ok: false, error: 'Places assignments contain an unknown place or folder.' };
  const artwork = value.artwork === undefined ? {} : value.artwork;
  if (!artwork || typeof artwork !== 'object' || Array.isArray(artwork) || Object.entries(artwork).some(([id, image]) => id === 'living-room' || !placeIds.has(id) || !validPlaceArtwork(image))) return { ok: false, error: 'Places artwork is invalid or changes the protected Living Room.' };
  return { ok: true, organisation: { version: 1, folders: value.folders, assignments: value.assignments, customPlaces, removedDefaultPlaceIds, artwork } };
}

export function decodePlaceOrganisation(raw: string | null): OrganisationResult {
  if (raw === null) return { ok: true, organisation: structuredClone(DEFAULT_PLACE_ORGANISATION) };
  try { return validatePlaceOrganisation(JSON.parse(raw)); }
  catch { return { ok: false, error: 'Saved Places folder data is not valid JSON.' }; }
}

export function addPlace(organisation: PlaceOrganisation, id: string, name: string, folderId: string | null): PlaceOrganisation | null {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!customPlaceId.test(id) || !clean || clean.length > 60 || placesIn(organisation).some(place => place.id === id || place.name.toLocaleLowerCase() === clean.toLocaleLowerCase()) || folderId !== null && !organisation.folders.some(folder => folder.id === folderId)) return null;
  return { ...organisation, customPlaces: [...organisation.customPlaces, { id, name: clean, background: null, protected: false, artworkAvailable: false }], assignments: { ...organisation.assignments, [id]: folderId } };
}

export function removePlace(organisation: PlaceOrganisation, id: string): PlaceOrganisation | null {
  const place = placesIn(organisation).find(item => item.id === id);
  if (!place || place.protected) return null;
  const { [id]: _removed, ...assignments } = organisation.assignments;
  const { [id]: _removedArtwork, ...artwork } = organisation.artwork;
  return {
    ...organisation,
    assignments,
    artwork,
    customPlaces: organisation.customPlaces.filter(item => item.id !== id),
    removedDefaultPlaceIds: removableDefaultIds.includes(id) ? [...organisation.removedDefaultPlaceIds, id] : organisation.removedDefaultPlaceIds,
  };
}

export function setPlaceArtwork(organisation: PlaceOrganisation, id: string, image: string): PlaceOrganisation | null {
  const place = placesIn(organisation).find(item => item.id === id);
  if (!place || place.protected || !validPlaceArtwork(image)) return null;
  return { ...organisation, artwork: { ...organisation.artwork, [id]: image } };
}

export function movePlace(organisation: PlaceOrganisation, placeId: string, folderId: string | null): PlaceOrganisation | null {
  if (!placesIn(organisation).some(place => place.id === placeId) || folderId !== null && !organisation.folders.some(folder => folder.id === folderId)) return null;
  return { ...organisation, assignments: { ...organisation.assignments, [placeId]: folderId } };
}

export function removeEmptyFolder(organisation: PlaceOrganisation, id: string): PlaceOrganisation | null {
  const folder = organisation.folders.find(item => item.id === id);
  if (!folder || folder.protected || Object.values(organisation.assignments).includes(id)) return null;
  return { ...organisation, folders: organisation.folders.filter(item => item.id !== id) };
}
