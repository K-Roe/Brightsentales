import { describe, expect, it } from 'vitest';
import { PLACES } from './placeCatalog';
import { addPlace, decodePlaceOrganisation, DEFAULT_PLACE_ORGANISATION, movePlace, placesIn, removeEmptyFolder, removePlace, setPlaceArtwork, validatePlaceOrganisation } from './placeFolders';

const tinyWebp = 'data:image/webp;base64,UklGRjgAAABXRUJQVlA4ICwAAACQAQCdASoCAAIAAgA0JaACdLoAA5gA/vmTb/+QH/+QH/+QH/8gP+IXeyAwAA==';

describe('Places library', () => {
  it('has stable unique IDs and only exposes the approved Living Room artwork', () => {
    expect(PLACES.map(place => place.id)).toEqual(['living-room', 'bedroom', 'garden']);
    expect(new Set(PLACES.map(place => place.id)).size).toBe(PLACES.length);
    expect(PLACES[0]).toMatchObject({ name: 'Living Room', background: '/art/living-room.png', protected: true, artworkAvailable: true });
    for (const place of PLACES.slice(1)) expect(place).toMatchObject({ background: null, artworkAvailable: false });
  });
  it('moves places by stable ID and protects non-empty or default folders', () => {
    const folder = { id: 'folder-11111111-1111-4111-8111-111111111111', name: 'My Places', protected: false };
    const initial = { ...structuredClone(DEFAULT_PLACE_ORGANISATION), folders: [...DEFAULT_PLACE_ORGANISATION.folders, folder] };
    const moved = movePlace(initial, 'bedroom', folder.id)!;
    expect(moved.assignments.bedroom).toBe(folder.id);
    expect(removeEmptyFolder(moved, folder.id)).toBeNull();
    const back = movePlace(moved, 'bedroom', 'house')!;
    expect(removeEmptyFolder(back, folder.id)?.folders).not.toContainEqual(folder);
    expect(removeEmptyFolder(back, 'house')).toBeNull();
    expect(movePlace(back, 'living-room', null)?.assignments['living-room']).toBeNull();
    expect(movePlace(back, 'unknown', folder.id)).toBeNull();
  });
  it('validates persisted folder IDs and assignments without changing missing storage', () => {
    expect(decodePlaceOrganisation(null)).toEqual({ ok: true, organisation: DEFAULT_PLACE_ORGANISATION });
    expect(decodePlaceOrganisation('{broken').ok).toBe(false);
    expect(validatePlaceOrganisation({ ...DEFAULT_PLACE_ORGANISATION, assignments: { ...DEFAULT_PLACE_ORGANISATION.assignments, bedroom: 'missing' } }).ok).toBe(false);
    expect(validatePlaceOrganisation({ ...DEFAULT_PLACE_ORGANISATION, assignments: { ...DEFAULT_PLACE_ORGANISATION.assignments, extra: null } }).ok).toBe(false);
    expect(validatePlaceOrganisation({ ...DEFAULT_PLACE_ORGANISATION, customPlaces: null }).ok).toBe(false);
    expect(validatePlaceOrganisation({ ...DEFAULT_PLACE_ORGANISATION, folders: [{ id: 'house', name: 'House', protected: false }, DEFAULT_PLACE_ORGANISATION.folders[1]] }).ok).toBe(false);
  });
  it('adds, moves, persists and deletes custom places without touching protected artwork', () => {
    const id = 'place-11111111-1111-4111-8111-111111111111';
    const added = addPlace(DEFAULT_PLACE_ORGANISATION, id, '  Treehouse  ', 'house')!;
    expect(placesIn(added).find(place => place.id === id)).toMatchObject({ name: 'Treehouse', background: null, artworkAvailable: false });
    expect(added.assignments[id]).toBe('house');
    expect(addPlace(added, id, 'Another', null)).toBeNull();
    expect(addPlace(added, 'place-22222222-2222-4222-8222-222222222222', 'Treehouse', null)).toBeNull();
    const moved = movePlace(added, id, null)!;
    expect(decodePlaceOrganisation(JSON.stringify(moved))).toEqual({ ok: true, organisation: moved });
    const removed = removePlace(moved, id)!;
    expect(placesIn(removed).some(place => place.id === id)).toBe(false);
    expect(Object.hasOwn(removed.assignments, id)).toBe(false);
    expect(removePlace(removed, 'living-room')).toBeNull();
    expect(placesIn(removed).find(place => place.id === 'living-room')).toEqual(PLACES[0]);
  });
  it('can delete nonprotected default places while loading older folder data', () => {
    const { customPlaces: _customPlaces, removedDefaultPlaceIds: _removedDefaultPlaceIds, ...oldData } = DEFAULT_PLACE_ORGANISATION;
    expect(decodePlaceOrganisation(JSON.stringify(oldData))).toEqual({ ok: true, organisation: DEFAULT_PLACE_ORGANISATION });
    const removed = removePlace(DEFAULT_PLACE_ORGANISATION, 'bedroom')!;
    expect(removed.removedDefaultPlaceIds).toEqual(['bedroom']);
    expect(placesIn(removed).some(place => place.id === 'bedroom')).toBe(false);
    expect(decodePlaceOrganisation(JSON.stringify(removed))).toEqual({ ok: true, organisation: removed });
    expect(validatePlaceOrganisation({ ...removed, assignments: { ...removed.assignments, bedroom: 'house' } }).ok).toBe(false);
  });
  it('saves uploaded artwork with a place and protects the Living Room image', () => {
    const id = 'place-11111111-1111-4111-8111-111111111111';
    const added = addPlace(DEFAULT_PLACE_ORGANISATION, id, 'Treehouse', 'house')!;
    const withArtwork = setPlaceArtwork(added, id, tinyWebp)!;
    expect(placesIn(withArtwork).find(place => place.id === id)).toMatchObject({ background: tinyWebp, artworkAvailable: true });
    expect(setPlaceArtwork(withArtwork, 'living-room', tinyWebp)).toBeNull();
    expect(validatePlaceOrganisation({ ...withArtwork, artwork: { ...withArtwork.artwork, 'living-room': tinyWebp } }).ok).toBe(false);
    expect(validatePlaceOrganisation({ ...withArtwork, artwork: { [id]: 'data:image/svg+xml;base64,PHN2Zz4=' } }).ok).toBe(false);
    expect(decodePlaceOrganisation(JSON.stringify(withArtwork))).toEqual({ ok: true, organisation: withArtwork });
    expect(removePlace(withArtwork, id)?.artwork[id]).toBeUndefined();
  });
});
