import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOURS, nameAvailable, recolourPixels, validateBrightling } from './maker';
import { decodeLibrary } from './library';
import { parseScene } from './scene';

const male = { id: 'brightling-11111111-1111-4111-8111-111111111111', name: 'Charlie', template: 'male' as const, ...DEFAULT_COLOURS.male };

describe('Brightling Maker storage and artwork', () => {
  it('validates saved specs and ignores corrupt library entries', () => {
    expect(validateBrightling(male)).toBe(true);
    expect(decodeLibrary(JSON.stringify([male, male, { ...male, id: 'bad' }])).ok).toBe(false);
    expect(validateBrightling({ ...male, hair: 'not-a-colour' })).toBe(false);
    expect(nameAvailable(' charlie ', [male])).toBe(false);
    expect(nameAvailable('Max', [male])).toBe(false);
    expect(nameAvailable('Ruby', [male])).toBe(true);
  });

  it('saves and reopens modular appearance with stable identity and scene references', () => {
    const modular = { ...male, appearance: { version: 2 as const, headShape: 'wide' as const, eyeStyle: 'sparkle' as const,
      earShape: 'long' as const, hairStyle: 'swoop' as const, headDecoration: 'star' as const,
      bodyShape: 'tall' as const, clothingStyle: 'jacket' as const } };
    const decoded = decodeLibrary(JSON.stringify([modular]));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.characters[0]).toEqual(modular);
    expect(validateBrightling({ ...modular, appearance: { ...modular.appearance, version: 1 as never } })).toBe(false);
  });

  it('keeps an older Max and Maxine scene readable while retaining custom positions', () => {
    const old = { version: 1, characters: { max: { start: { x: 500, y: 750 }, destination: null }, maxine: { start: { x: 1000, y: 750 }, destination: null } } };
    expect(parseScene(JSON.stringify(old))?.characters.max.start.x).toBe(500);
    const newer = { ...old, characters: { ...old.characters, [male.id]: { start: { x: 810, y: 830 }, destination: { x: 440, y: 750 } } } };
    expect(parseScene(JSON.stringify(newer))?.characters[male.id]).toEqual({ start: { x: 810, y: 830 }, destination: { x: 440, y: 750 } });
  });

  it('recolours only masked pixels and preserves alpha and original source bytes', () => {
    class TestImageData { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} }
    const old = globalThis.ImageData;
    Object.assign(globalThis, { ImageData: TestImageData });
    try {
      const source = new TestImageData(new Uint8ClampedArray([40, 180, 190, 255, 20, 20, 30, 255, 0, 0, 0, 0]), 3, 1) as ImageData;
      const mask = (first: number) => new TestImageData(new Uint8ClampedArray([first, first, first, 255, 0, 0, 0, 255, 0, 0, 0, 0]), 3, 1) as ImageData;
      const masks = { body: mask(255), hair: mask(0), clothing: mask(0) };
      const first = recolourPixels(source, masks, male);
      const second = recolourPixels(source, masks, male);
      expect([...first.data]).toEqual([...second.data]);
      expect([...first.data.slice(0, 3)]).not.toEqual([40, 180, 190]);
      expect([...first.data.slice(3)]).toEqual([255, 20, 20, 30, 255, 0, 0, 0, 0]);
      expect([...source.data.slice(0, 4)]).toEqual([40, 180, 190, 255]);
    } finally { Object.assign(globalThis, { ImageData: old }); }
  });
});
