import { clipLength } from './audio';
import type { PlaybackClip } from './audioPlayback';

export type EpisodeZoom = 0 | 1 | 2 | 4;
const PIXELS_PER_SECOND = 72;

export function episodeTimelineWidth(total: number, zoom: EpisodeZoom): string {
  return zoom === 0 ? '100%' : `${Math.max(640, total * PIXELS_PER_SECOND * zoom)}px`;
}

function niceStep(minimum: number): number {
  if (minimum <= 0) return .5;
  const order = 10 ** Math.floor(Math.log10(minimum));
  return [1, 2, 5, 10].map(value => value * order).find(value => value >= minimum) ?? 10 * order;
}

export function episodeTimelineTicks(total: number, zoom: EpisodeZoom): number[] {
  if (total <= 0) return [0];
  const step = niceStep(zoom === 0 ? total / 5 : Math.max(total / 80, 80 / (PIXELS_PER_SECOND * zoom)));
  const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, index) => Number((index * step).toFixed(3)));
  if (total - ticks.at(-1)! > .001) ticks.push(total);
  return ticks;
}

export function episodeAudioSpan(clip: PlaybackClip, total: number): { left: number; width: number } | null {
  if (total <= 0 || clip.start >= total || clip.start + clipLength(clip) <= 0) return null;
  const start = Math.max(0, clip.start);
  const end = Math.min(total, clip.start + clipLength(clip));
  return { left: start / total * 100, width: (end - start) / total * 100 };
}
