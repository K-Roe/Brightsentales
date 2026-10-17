export type MaxOutfit = 'original' | 'tshirt-trousers';
export type MaxineOutfit = 'original' | 'tshirt-leggings';

export const MAX_OUTFITS: ReadonlyArray<{ id: MaxOutfit; label: string }> = [
  { id: 'original', label: 'Original Hoodie' },
  { id: 'tshirt-trousers', label: 'T-Shirt & Trousers' },
];
export const MAXINE_OUTFITS: ReadonlyArray<{ id: MaxineOutfit; label: string }> = [
  { id: 'original', label: 'Original Hoodie & Skirt' },
  { id: 'tshirt-leggings', label: 'T-Shirt & Leggings' },
];

export function maxOutfitFrom(value: unknown): MaxOutfit {
  return value === 'tshirt-trousers' ? 'tshirt-trousers' : 'original';
}

export function maxineOutfitFrom(value: unknown): MaxineOutfit {
  return value === 'tshirt-leggings' ? 'tshirt-leggings' : 'original';
}

export function maxSpriteSource(outfit: MaxOutfit, pose: 'idle' | 'side' | 'wave', frame = 0): string {
  const name = pose === 'idle' ? 'max-0.png' : pose === 'side' ? frame === 0 ? 'max-side-0.png' : `max-side-v3-${frame}.png` : `max-wave-${frame + 1}.png`;
  return outfit === 'original' ? `/art/${name}` : `/art/max-tshirt/${name}`;
}

export function maxineSpriteSource(outfit: MaxineOutfit, pose: 'idle' | 'side' | 'wave', frame = 0): string {
  const name = pose === 'idle' ? 'maxine-0.png' : pose === 'side' ? frame === 0 ? 'maxine-side-0.png' : `maxine-side-v3-${frame}.png` : `maxine-wave-${frame + 1}.png`;
  return outfit === 'original' ? `/art/${name}` : `/art/maxine-tshirt/${name}`;
}
