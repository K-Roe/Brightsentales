import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE, moveTowards, parseScene } from './scene';

describe('local scene', () => {
  it('reopens a saved JSON scene with independent positions and destinations', () => {
    const scene = structuredClone(DEFAULT_SCENE);
    scene.characters.max.start = { x: 325, y: 700 };
    scene.characters.maxine.destination = { x: 1280, y: 820 };
    expect(parseScene(JSON.stringify(scene))).toEqual(scene);
  });

  it('rejects invalid stored coordinates', () => {
    const scene = structuredClone(DEFAULT_SCENE);
    scene.characters.max.start.x = Number.POSITIVE_INFINITY;
    expect(parseScene(JSON.stringify(scene))).toBeNull();
    expect(parseScene('{broken')).toBeNull();
  });

  it('lands precisely on the destination without overshooting', () => {
    const target = { x: 300, y: 750 };
    let point = { x: 100, y: 680 };
    for (let i = 0; i < 100; i++) point = moveTowards(point, target, 5);
    expect(point).toEqual(target);
  });
});
