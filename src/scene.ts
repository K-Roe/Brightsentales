export type CharacterId = string;
export type Point = { x: number; y: number };
export type Character = { start: Point; destination: Point | null };
import { maxOutfitFrom, type MaxOutfit } from './outfit';
export type Scene = { version: 1; characters: Record<CharacterId, Character>; maxOutfit?: MaxOutfit };

export const WIDTH = 1672;
export const HEIGHT = 941;
export const STORAGE_KEY = 'brightsenappstales.scene.v1';
export const DEFAULT_SCENE: Scene = {
  version: 1,
  characters: {
    max: { start: { x: 575, y: 790 }, destination: null },
    maxine: { start: { x: 1090, y: 790 }, destination: null },
  },
};

export function clampPoint(point: Point): Point {
  return { x: Math.max(115, Math.min(1557, point.x)), y: Math.max(615, Math.min(875, point.y)) };
}

export function parseScene(value: string | null): Scene | null {
  if (!value) return null;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('characters' in data)) return null;
    const characters = data.characters as Record<string, { start?: Point; destination?: Point | null }>;
    const valid = (p: Point | null | undefined): p is Point => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
    if (!['max', 'maxine'].every(id => valid(characters?.[id]?.start) && (characters[id].destination == null || valid(characters[id].destination)))) return null;
    const output: Scene['characters'] = {};
    for (const [id, character] of Object.entries(characters)) {
      if (!/^(max|maxine|oliver|brightling-[a-f0-9-]{36})$/.test(id)) continue;
      if (!valid(character?.start) || (character.destination != null && !valid(character.destination))) return null;
      output[id] = { start: clampPoint(character.start), destination: character.destination ? clampPoint(character.destination) : null };
    }
    const maxOutfit = maxOutfitFrom((data as { maxOutfit?: unknown }).maxOutfit);
    return { version: 1, characters: output, ...(maxOutfit === 'original' ? {} : { maxOutfit }) };
  } catch { return null; }
}

export function moveTowards(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= distance || length === 0) return { ...to };
  return { x: from.x + dx / length * distance, y: from.y + dy / length * distance };
}
