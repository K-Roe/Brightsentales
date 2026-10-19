import { useEffect, useRef } from 'react';
import { clipLength, effectiveVolume, type AudioAsset, type AudioClip } from './audio';
import { productionBlocks, type Episode } from './episodes';
import type { TimedLibrary } from './timedScenes';
import type { IntroLibrary } from './introductions';
import type { CreditsLibrary } from './credits';

export type PlaybackClip = AudioClip & { key: string; source: 'scene' | 'episode' };
export const scenePlaybackClips = (clips: AudioClip[] = []): PlaybackClip[] => clips.map(clip => ({ ...clip, key: clip.id, source: 'scene' }));

export function episodePlaybackClips(episode: Episode, scenes: TimedLibrary, intros?: IntroLibrary, credits?: CreditsLibrary): PlaybackClip[] {
  const output: PlaybackClip[] = (episode.audio ?? []).map(clip => ({ ...clip, key: `episode:${clip.id}`, source: 'episode' }));
  productionBlocks(episode, scenes, intros, credits).forEach(({ scene, index, start, kind }) => {
    for (const clip of scene.audio ?? []) {
      const remaining = scene.duration - clip.start;
      if (remaining <= 0) continue;
      output.push({ ...clip, start: start + clip.start, trimEnd: Math.min(clip.trimEnd, clip.trimStart + remaining), key: `${kind}:${index}:${clip.id}`, source: 'scene' });
    }
  });
  return output;
}

type Player = { element: HTMLAudioElement; url: string };
export function useAudioPlayback(clips: PlaybackClip[], assets: AudioAsset[], time: number, playing: boolean, onError: (message: string) => void) {
  const players = useRef(new Map<string, Player>());
  const warned = useRef(new Set<string>());
  const stop = () => { for (const player of players.current.values()) { player.element.pause(); player.element.removeAttribute('src'); player.element.load(); URL.revokeObjectURL(player.url); } players.current.clear(); };
  const sync = (at: number) => {
    const active = new Set<string>();
    const byId = new Map(assets.map(asset => [asset.id, asset]));
    const episodeMusic = clips.some(clip => clip.source === 'episode' && byId.get(clip.assetId)?.kind === 'music' && at >= clip.start && at < clip.start + clipLength(clip));
    for (const clip of clips) {
      if (at < clip.start || at >= clip.start + clipLength(clip)) continue;
      const asset = byId.get(clip.assetId);
      if (!asset) { if (!warned.current.has(clip.assetId)) { warned.current.add(clip.assetId); onError(`Audio file for a clip is missing: ${clip.assetId}`); } continue; }
      active.add(clip.key);
      let player = players.current.get(clip.key);
      if (!player) {
        const url = URL.createObjectURL(asset.blob);
        const element = new Audio(url); element.preload = 'auto';
        player = { element, url }; players.current.set(clip.key, player);
      }
      const target = clip.trimStart + at - clip.start;
      try { if (Math.abs(player.element.currentTime - target) > .2) player.element.currentTime = target; } catch { /* Metadata may still be loading; the next clock tick retries. */ }
      player.element.volume = Math.min(1, effectiveVolume(clip, at, episodeMusic && clip.source === 'scene' && asset.kind === 'music'));
      if (player.element.paused) void player.element.play().catch(() => { if (!warned.current.has('playback')) { warned.current.add('playback'); onError('Audio playback was blocked. Press Play again after interacting with the page.'); } });
    }
    for (const [key, player] of players.current) if (!active.has(key)) { player.element.pause(); player.element.removeAttribute('src'); player.element.load(); URL.revokeObjectURL(player.url); players.current.delete(key); }
  };
  useEffect(() => { if (playing) sync(time); else stop(); });
  useEffect(() => () => stop(), []);
  return { startAt: sync, stop };
}
