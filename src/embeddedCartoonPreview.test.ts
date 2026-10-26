import { describe, expect, it } from 'vitest';
import { DEFAULT_PLACE_ORGANISATION } from './placeFolders';
import { embeddedPreviewIssue } from './embeddedCartoonPreviewValidation';
import type { TimedScene } from './timedScenes';

const scene: TimedScene = { id: '11111111-1111-4111-8111-000000000001', name: 'Saved scene', duration: 8, placeId: 'living-room', characters: { max: { x: 500, y: 780 } }, actions: [] };

describe('embedded Cartoon Preview readiness', () => {
  it('accepts an existing valid saved scene without changing it', () => {
    const before = structuredClone(scene);
    expect(embeddedPreviewIssue(scene, [], DEFAULT_PLACE_ORGANISATION, [])).toBeNull();
    expect(scene).toEqual(before);
  });
  it('explains when a saved custom Brightling is missing', () => {
    const custom = { ...scene, characters: { 'brightling-11111111-1111-4111-8111-000000000002': { x: 500, y: 780 } } };
    expect(embeddedPreviewIssue(custom, [], DEFAULT_PLACE_ORGANISATION, [])).toContain('missing from the saved Brightling library');
  });
  it('blocks locations without available artwork', () => {
    expect(embeddedPreviewIssue({ ...scene, placeId: 'bedroom' }, [], DEFAULT_PLACE_ORGANISATION, [])).toContain('location');
  });
  it('uses the canonical scene validation for bad duration or camera data', () => {
    expect(embeddedPreviewIssue({ ...scene, duration: 0 }, [], DEFAULT_PLACE_ORGANISATION, [])).toContain('invalid details');
    expect(embeddedPreviewIssue({ ...scene, camera: [{ id: 'bad', start: 0, duration: 9, shot: 'close' } as never] }, [], DEFAULT_PLACE_ORGANISATION, [])).toContain('Camera keyframes');
  });
});
