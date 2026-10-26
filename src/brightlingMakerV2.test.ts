import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateBrightlingFrames } from './brightling';
import { decodeLibrary, validateLibrary } from './library';

const fixture = JSON.parse(readFileSync(new URL('../proofs/cartoon-foundation-p10/proof-characters.json', import.meta.url), 'utf8')) as unknown;

describe('Brightling Maker V2 proof characters', () => {
  it('validates three distinct, versioned modular character definitions for existing-library save/reopen', () => {
    const result = validateLibrary(fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.characters).toHaveLength(3);
    expect(result.characters.map(item => item.appearance?.version)).toEqual([2, 2, 2]);
    expect(new Set(result.characters.map(item => item.id)).size).toBe(3);
    expect(new Set(result.characters.map(item => item.name)).size).toBe(3);
    const reopened = decodeLibrary(JSON.stringify(result.characters));
    expect(reopened.ok && reopened.characters).toEqual(result.characters);
  });

  it('generates stable, visibly different supported feature combinations', () => {
    const validated = validateLibrary(fixture);
    if (!validated.ok) throw new Error(validated.error);
    const renders = validated.characters.map((item, index) => {
      const appearance = item.appearance!;
      const spec = { id: `proof-${index}`, name: item.name, bodyColour: item.body, hairColour: item.hair,
        clothingColour: item.clothing, headShape: appearance.headShape, eyeStyle: appearance.eyeStyle,
        earShape: appearance.earShape, hairStyle: appearance.hairStyle, headDecoration: appearance.headDecoration,
        bodyShape: appearance.bodyShape, clothingStyle: appearance.clothingStyle };
      return generateBrightlingFrames(spec);
    });
    expect(new Set(renders.map(item => item.idle)).size).toBe(3);
    expect(renders).toEqual(validated.characters.map((item, index) => {
      const appearance = item.appearance!;
      return generateBrightlingFrames({ id: `proof-${index}`, name: item.name, bodyColour: item.body, hairColour: item.hair,
        clothingColour: item.clothing, headShape: appearance.headShape, eyeStyle: appearance.eyeStyle,
        earShape: appearance.earShape, hairStyle: appearance.hairStyle, headDecoration: appearance.headDecoration,
        bodyShape: appearance.bodyShape, clothingStyle: appearance.clothingStyle });
    }));
  });
});
