import { describe, expect, it } from 'vitest';
import { episodeAudioSpan, episodeTimelineTicks, episodeTimelineWidth } from './episodeTimeline';
import type { PlaybackClip } from './audioPlayback';

describe('episode timeline display clock', () => {
  it('keeps zoom and ruler on one episode clock, including the final boundary', () => {
    expect(episodeTimelineWidth(7.5, 0)).toBe('100%');
    expect(episodeTimelineWidth(7.5, 2)).toBe('1080px');
    const ticks = episodeTimelineTicks(7.5, 2);
    expect(ticks[0]).toBe(0);
    expect(ticks.at(-1)).toBe(7.5);
    expect(ticks.every((value, index) => index === 0 || value > ticks[index - 1])).toBe(true);
    expect(episodeTimelineTicks(3600, 4).length).toBeLessThan(100);
  });

  it('places episode and repeated-scene audio at their actual global positions', () => {
    const clip: PlaybackClip = { id: 'a', key: 'scene:2:a', source: 'scene', assetId: 'music', start: 6, trimStart: 0, trimEnd: 3, volume: .5, fadeIn: 0, fadeOut: 0 };
    expect(episodeAudioSpan(clip, 7.5)).toEqual({ left: 80, width: 20 });
    expect(episodeAudioSpan({ ...clip, start: 8 }, 7.5)).toBeNull();
  });
});
