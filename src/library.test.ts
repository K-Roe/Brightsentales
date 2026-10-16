import { describe, expect, it } from 'vitest';
import { Brightling, DEFAULT_COLOURS } from './maker';
import { backupLibrary, decodeLibrary, prepareImport, pruneScene, validateLibrary, withoutCharacter } from './library';
import { DEFAULT_SCENE, parseScene } from './scene';

const charlie: Brightling = { id: 'brightling-11111111-1111-4111-8111-111111111111', name: 'Charlie', template: 'male', ...DEFAULT_COLOURS.male };
const lily: Brightling = { id: 'brightling-22222222-2222-4222-8222-222222222222', name: 'Lily', template: 'female', ...DEFAULT_COLOURS.female };

describe('studio library', () => {
  it('accepts existing array storage and versioned backups without changing IDs', () => {
    expect(decodeLibrary(JSON.stringify([charlie]))).toEqual({ ok: true, characters: [charlie] });
    expect(decodeLibrary(backupLibrary([charlie, lily]))).toEqual({ ok: true, characters: [charlie, lily] });
    expect(decodeLibrary(null)).toEqual({ ok: true, characters: [] });
  });
  it('rejects malformed data and duplicate or protected names without dropping entries silently', () => {
    expect(decodeLibrary('{bad').ok).toBe(false);
    expect(validateLibrary([charlie, { ...lily, name: 'CHARLIE' }]).ok).toBe(false);
    expect(validateLibrary([{ ...charlie, name: 'Max' }]).ok).toBe(false);
    expect(validateLibrary([charlie, { ...charlie, name: 'Other' }]).ok).toBe(false);
  });
  it('merges by stable ID and rejects name collisions between different IDs', () => {
    const updated = { ...charlie, name: 'Charles', body: '#91D9F1' };
    expect(prepareImport([charlie, lily], [updated], 'merge')).toEqual({ ok: true, characters: [lily, updated] });
    expect(prepareImport([charlie], [{ ...lily, name: 'Charlie' }], 'merge').ok).toBe(false);
    expect(prepareImport([charlie], [lily], 'replace')).toEqual({ ok: true, characters: [lily] });
  });
  it('keeps existing scene IDs through edits, and removes only deleted or replaced custom IDs', () => {
    const scene = structuredClone(DEFAULT_SCENE);
    scene.characters[charlie.id] = { start: { x: 800, y: 780 }, destination: { x: 1000, y: 800 } };
    scene.characters[lily.id] = { start: { x: 900, y: 810 }, destination: null };
    expect(parseScene(JSON.stringify(scene))?.characters[charlie.id]).toEqual(scene.characters[charlie.id]);
    const deleted = withoutCharacter(scene, charlie.id);
    expect(deleted.characters[charlie.id]).toBeUndefined();
    expect(deleted.characters[lily.id]).toEqual(scene.characters[lily.id]);
    expect(deleted.characters.max).toEqual(scene.characters.max);
    expect(withoutCharacter(scene, 'max')).toBe(scene);
    expect(pruneScene(scene, [lily]).characters[charlie.id]).toBeUndefined();
  });
});
