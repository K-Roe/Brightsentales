import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { maxOutfitFrom, maxSpriteSource, maxineOutfitFrom, maxineSpriteSource } from './outfit';
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

const maxineFrames = [
  'maxine-0.png', 'maxine-side-0.png',
  'maxine-side-v3-1.png', 'maxine-side-v3-2.png', 'maxine-side-v3-3.png', 'maxine-side-v3-4.png',
  'maxine-wave-1.png', 'maxine-wave-2.png', 'maxine-wave-3.png',
];
const approvedMaxineHashes = [
  '1ee42700da5f1ecda658a6d06865d317726a241bd6d29c628911d58a622158c1',
  'b0e6a3309b446625613a1a15faa34e50c20a37ecd85d3f6e55662c0a134882b4',
  '3bfa933e30d0f2d66028a05ddb1fecd79fbf1c49570f489964cfb97966fbe2c3',
  'c6b0c9b61c47f83dde48e0ff58e238deaca4dec4e2dbf62395b12485b95e6f21',
  '4e69a77c5c78fe9484e44e4232d8ea930baeb110fe8c1f75da21e6290c76784a',
  '1ff0f4988ca114fc42ca3f6f2c3f4919d7384b70fc999c61649059ace77b2aaa',
  '31e573c0022b92d5ee80e5e1f86b35b86f654bd3df2b2635a77bc8ca12453528',
  '605ed8e9610efe53ac476c16636789718e95e1654a655720e7d145d4edcc2058',
  '753a664e4d191bac1a35715f72bd8f4e4ca44288507ef1b8148133ccd5fd9249',
];

describe('Maxine production outfit', () => {
  it('maps both complete nine-pose sets in the existing runtime order', () => {
    for (const outfit of ['original', 'tshirt-leggings'] as const) {
      const urls = [maxineSpriteSource(outfit, 'idle'), ...Array.from({ length: 5 }, (_, i) => maxineSpriteSource(outfit, 'side', i)), ...Array.from({ length: 3 }, (_, i) => maxineSpriteSource(outfit, 'wave', i))];
      expect(urls).toEqual(maxineFrames.map(name => `/art/${outfit === 'original' ? '' : 'maxine-tshirt/'}${name}`));
    }
  });

  it('ships the exact nine approved artwork files without changing the proof or original', () => {
    for (const [index, name] of maxineFrames.entries()) {
      const production = readFileSync(new URL(`../public/art/maxine-tshirt/${name}`, import.meta.url));
      const proof = readFileSync(new URL(`../proofs/milestone5b-q/frames/${name}`, import.meta.url));
      expect(production.equals(proof)).toBe(true);
      expect(createHash('sha256').update(production).digest('hex')).toBe(approvedMaxineHashes[index]);
    }
    expect(createHash('sha256').update(readFileSync(new URL('../public/art/maxine-0.png', import.meta.url))).digest('hex')).toBe('0a8be579504df4534b2b074a4e147856ecb99f34246f91fbb04e15236f4da26c');
  });

  it('keeps Max and Maxine selections independent across scene save and Studio Backup restore', () => {
    const scene = { ...structuredClone(DEFAULT_SCENE), maxOutfit: 'tshirt-trousers' as const, maxineOutfit: 'tshirt-leggings' as const };
    expect(parseScene(JSON.stringify(scene))).toEqual(scene);
    const backup = createStudioBackup([], scene);
    expect(validateStudioBackup(JSON.parse(JSON.stringify(backup)))).toEqual({ ok: true, backup });
    const entries = new Map<string, string>();
    const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } };
    expect(restoreStudioBackup(storage, LIBRARY_KEY, STORAGE_KEY, backup).ok).toBe(true);
    expect(parseScene(storage.getItem(STORAGE_KEY))?.maxineOutfit).toBe('tshirt-leggings');
    expect(parseScene(storage.getItem(STORAGE_KEY))?.maxOutfit).toBe('tshirt-trousers');
  });

  it('defaults legacy and unknown Maxine outfit IDs safely without changing Max', () => {
    expect(maxineOutfitFrom(parseScene(JSON.stringify(DEFAULT_SCENE))?.maxineOutfit)).toBe('original');
    expect(maxineOutfitFrom('mystery')).toBe('original');
    const legacy = { ...DEFAULT_SCENE, maxOutfit: 'tshirt-trousers', maxineOutfit: 'mystery' };
    expect(parseScene(JSON.stringify(legacy))).toEqual({ ...DEFAULT_SCENE, maxOutfit: 'tshirt-trousers' });
    const checked = validateStudioBackup({ ...createStudioBackup([], DEFAULT_SCENE), scene: legacy });
    expect(checked.ok && checked.backup.scene).toEqual({ ...DEFAULT_SCENE, maxOutfit: 'tshirt-trousers' });
  });
});
