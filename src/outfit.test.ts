import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { maxOutfitFrom, maxSpriteSource } from './outfit';
import { DEFAULT_SCENE, parseScene, STORAGE_KEY } from './scene';
import { LIBRARY_KEY } from './maker';
import { createStudioBackup, restoreStudioBackup, validateStudioBackup } from './studioBackup';

const frames = [
  'max-0.png', 'max-side-0.png',
  'max-side-v3-1.png', 'max-side-v3-2.png', 'max-side-v3-3.png', 'max-side-v3-4.png',
  'max-wave-1.png', 'max-wave-2.png', 'max-wave-3.png',
];
const candidateHashes = [
  '985325be600380ad06aa024f8c2250e592aba7201945593f380abd37b622e89b',
  'c73cab7b42425cb5e89e855317a6c9c6ee88048de678027b8f9a8a71c46f7f98',
  '02d048bc25cbd1786c4f2e346b3d9a45f4e1845206a8fb8702627d0dc7108f8f',
  'b72d40dc6357f280b47ac02a6f0f04a30deb46fe37893c297a3e3dac84f9246b',
  'a7c6860744c24a89b0089f5791d03f346fd5b6d0ac525d116182cea6b31849ee',
  '682c063c7e00ce9e567587676f4db050a907991753e27cbc2e13f841a0199338',
  'db7b33d347adaac4b3a4315bbb29254e48a3a6db4b3af9ab3f9f01492934eaa5',
  '0466a515dc282ddce2da8388f433add3bb9caceaa6ac2f525eb5b310d0fde1da',
  '48609616b2dacb1b7f2ad3b86a52abad372dee2c8202ced2972867d5a37f7fd0',
];

describe('Max production outfit', () => {
  it('maps both complete nine-pose sets without changing frame order', () => {
    for (const outfit of ['original', 'tshirt-trousers'] as const) {
      const urls = [maxSpriteSource(outfit, 'idle'), ...Array.from({ length: 5 }, (_, i) => maxSpriteSource(outfit, 'side', i)), ...Array.from({ length: 3 }, (_, i) => maxSpriteSource(outfit, 'wave', i))];
      expect(urls).toEqual(frames.map(name => `/art/${outfit === 'original' ? '' : 'max-tshirt/'}${name}`));
    }
  });

  it('ships the exact approved candidate bytes', () => {
    for (const [index, name] of frames.entries()) {
      const bytes = readFileSync(new URL(`../public/art/max-tshirt/${name}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(candidateHashes[index]);
    }
  });

  it('persists the selected outfit in existing scenes and Studio Backups', () => {
    const scene = { ...structuredClone(DEFAULT_SCENE), maxOutfit: 'tshirt-trousers' as const };
    expect(parseScene(JSON.stringify(scene))).toEqual(scene);
    const backup = createStudioBackup([], scene);
    expect(validateStudioBackup(JSON.parse(JSON.stringify(backup)))).toEqual({ ok: true, backup });
    const entries = new Map<string, string>();
    const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } };
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, backup).ok).toBe(true);
    expect(parseScene(storage.getItem(STORAGE_KEY))?.maxOutfit).toBe('tshirt-trousers');
  });

  it('keeps legacy scenes and unknown outfit IDs on the original hoodie', () => {
    expect(maxOutfitFrom(parseScene(JSON.stringify(DEFAULT_SCENE))?.maxOutfit)).toBe('original');
    expect(parseScene(JSON.stringify({ ...DEFAULT_SCENE, maxOutfit: 'mystery' }))).toEqual(DEFAULT_SCENE);
    expect(maxOutfitFrom('mystery')).toBe('original');
    const olderBackup = createStudioBackup([], DEFAULT_SCENE);
    expect(validateStudioBackup(olderBackup).ok).toBe(true);
    const unknownBackup = { ...olderBackup, scene: { ...DEFAULT_SCENE, maxOutfit: 'mystery' } };
    const checked = validateStudioBackup(unknownBackup);
    expect(checked.ok && checked.backup.scene).toEqual(DEFAULT_SCENE);
  });
});
