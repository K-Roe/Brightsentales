import { describe, expect, it } from 'vitest';
import { editActionTiming } from './timelineEditing';
import { validateTimedLibrary, type TimedScene } from './timedScenes';

const uid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const scene: TimedScene = { id: uid(1), name: 'Thirty seconds', duration: 30, placeId: 'living-room', characters: { max: { x: 500, y: 790 }, maxine: { x: 900, y: 800 } }, actions: [
  { id: uid(2), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 500, y: 790 } },
  { id: uid(3), characterId: 'max', type: 'walk', start: 1, duration: 3, point: { x: 800, y: 790 } },
  { id: uid(4), characterId: 'max', type: 'wave', start: 6, duration: 1.62 },
  { id: uid(5), characterId: 'maxine', type: 'walk', start: 2, duration: 4, point: { x: 600, y: 800 } },
] };

describe('visual timeline editing', () => {
  it('snaps movement and prevents a same-character overlap', () => {
    expect(editActionTiming(scene, uid(3), 'move', .62)?.start).toBe(1.5);
    expect(editActionTiming(scene, uid(3), 'move', 4)?.start).toBe(3);
    expect(editActionTiming(scene, uid(3), 'move', 40)?.start).toBe(27);
  });
  it('resizes within scene and next action, preserving wave minimum', () => {
    expect(editActionTiming(scene, uid(3), 'resize', 4)?.duration).toBe(5);
    expect(editActionTiming(scene, uid(4), 'resize', -4)?.duration).toBe(1.62);
    expect(editActionTiming(scene, uid(4), 'resize', 40)?.duration).toBe(24);
  });
  it('leaves another character independent and keeps the data valid', () => {
    const changed = editActionTiming(scene, uid(5), 'move', -1)!;
    const updated = { ...scene, actions: scene.actions.map(item => item.id === changed.id ? changed : item) };
    expect(changed.start).toBe(1);
    expect(validateTimedLibrary({ version: 1, scenes: [updated] }).ok).toBe(true);
  });
});
