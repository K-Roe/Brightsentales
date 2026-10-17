import { describe, expect, it } from 'vitest';
import { clipLength, effectiveVolume, validAudioBackup, validAudioClips, validAudioInfo, type AudioClip } from './audio';
import { episodePlaybackClips } from './audioPlayback';
import { speechFitsEpisode, type Episode } from './episodes';
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
  it('keeps attributed speech and narration within their scene or episode duration', () => {
    const speech = { ...clip, id: id(6), start: 4, trimStart: 0, trimEnd: 5, speakerId: 'max' };
    expect(validAudioClips([speech], 10)).toBe(true);
    expect(validAudioClips([{ ...speech, speakerId: 'narrator' }], 10)).toBe(true);
    expect(validAudioClips([{ ...speech, start: 6 }], 10)).toBe(false);
    expect(validAudioClips([{ ...speech, speakerId: 'unknown' }], 10)).toBe(false);
    expect(validAudioInfo({ id: id(7), name: 'Recorded hello', kind: 'speech', mime: 'audio/wav', duration: 5, size: 100 })).toBe(true);
  });
  it('offsets scene dialogue for repeated scenes and keeps episode narration across scenes', () => {
    const sceneId = id(8);
    const line = { ...clip, id: id(9), start: 2, trimStart: 0, trimEnd: 3, speakerId: 'max' };
    const narration = { ...clip, id: id(10), start: 8, trimStart: 0, trimEnd: 4, speakerId: 'narrator' };
    const library: TimedLibrary = { version: 1, scenes: [{ id: sceneId, name: 'Hello', duration: 10, placeId: 'living-room', characters: { max: { x: 600, y: 790 } }, actions: [], audio: [line] }] };
    const episode: Episode = { id: id(11), name: 'Repeat', sceneIds: [sceneId, sceneId], audio: [narration] };
    expect(episodePlaybackClips(episode, library).map(item => [item.key, item.start, item.speakerId])).toEqual([
      [`episode:${id(10)}`, 8, 'narrator'], [`scene:0:${id(9)}`, 2, 'max'], [`scene:1:${id(9)}`, 12, 'max'],
    ]);
    expect(validAudioClips([narration], 20)).toBe(true);
    expect(validAudioClips([narration], 10)).toBe(false);
    expect(speechFitsEpisode(episode, library)).toBe(true);
    expect(speechFitsEpisode({ ...episode, audio: [{ ...narration, start: 18 }] }, library)).toBe(false);
    expect(validAudioClips([clip], 10)).toBe(true); // Existing non-verbal audio is unchanged.
  });
});
