import { describe, expect, it } from 'vitest';
import { clipLength, effectiveVolume, validAudioBackup, validAudioClips, type AudioClip } from './audio';
import { episodePlaybackClips } from './audioPlayback';
import type { Episode } from './episodes';
import type { TimedLibrary } from './timedScenes';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const clip: AudioClip = { id: id(1), assetId: id(2), start: 2, trimStart: 1, trimEnd: 6, volume: .6, fadeIn: 1, fadeOut: 2 };
describe('audio clips', () => {
  it('validates trim, volume and fade bounds', () => {
    expect(validAudioClips([clip], 10)).toBe(true);
    expect(validAudioClips([{ ...clip, trimEnd: .5 }], 10)).toBe(false);
    expect(validAudioClips([{ ...clip, volume: 2 }], 10)).toBe(false);
    expect(validAudioClips([clip, clip], 10)).toBe(false);
    expect(clipLength(clip)).toBe(5);
  });
  it('applies fades and the scene-music reduction beneath episode music', () => {
    expect(effectiveVolume(clip, 2)).toBe(0);
    expect(effectiveVolume(clip, 3)).toBeCloseTo(.6);
    expect(effectiveVolume(clip, 6)).toBeCloseTo(.3);
    expect(effectiveVolume(clip, 3, true)).toBeCloseTo(.3);
    expect(effectiveVolume(clip, 7)).toBe(0);
  });
  it('offsets scene clips for repeated scenes while keeping episode music continuous', () => {
    const sceneId = id(3);
    const library: TimedLibrary = { version: 1, scenes: [{ id: sceneId, name: 'Hello', duration: 10, placeId: 'living-room', characters: {}, actions: [], audio: [clip] }] };
    const episode: Episode = { id: id(4), name: 'Repeat', sceneIds: [sceneId, sceneId], audio: [{ ...clip, id: id(5), start: 0, trimStart: 0, trimEnd: 20 }] };
    const scheduled = episodePlaybackClips(episode, library);
    expect(scheduled.map(item => [item.key, item.start])).toEqual([[`episode:${id(5)}`, 0], [`scene:0:${id(1)}`, 2], [`scene:1:${id(1)}`, 12]]);
  });
  it('rejects corrupt backup metadata before import', () => {
    expect(validAudioBackup([{ id: id(1), name: 'Sound', kind: 'effect', mime: 'audio/wav', duration: 1, size: 2, data: 'AAAA', sha256: '0'.repeat(64) }])).toBe(true);
    expect(validAudioBackup([{ id: id(1), name: 'Sound', kind: 'effect', mime: 'audio/wav', duration: 1, size: 2, data: '@@@@', sha256: '0'.repeat(64) }])).toBe(false);
  });
});
