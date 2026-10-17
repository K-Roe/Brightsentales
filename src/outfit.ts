export type MaxOutfit = 'original' | 'tshirt-trousers';

export const MAX_OUTFITS: ReadonlyArray<{ id: MaxOutfit; label: string }> = [
  { id: 'original', label: 'Original Hoodie' },
  { id: 'tshirt-trousers', label: 'T-Shirt & Trousers' },
];

export function maxOutfitFrom(value: unknown): MaxOutfit {
  return value === 'tshirt-trousers' ? 'tshirt-trousers' : 'original';
}

export function maxSpriteSource(outfit: MaxOutfit, pose: 'idle' | 'side' | 'wave', frame = 0): string {
  const name = pose === 'idle' ? 'max-0.png' : pose === 'side' ? frame === 0 ? 'max-side-0.png' : `max-side-v3-${frame}.png` : `max-wave-${frame + 1}.png`;
  return outfit === 'original' ? `/art/${name}` : `/art/max-tshirt/${name}`;
}
