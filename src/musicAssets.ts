import type { AudioAsset, AudioKind } from './audio';
import { renderEffect, renderMusic, type RenderResult } from './musicRender';
import type { EffectProject, MusicProject } from './musicProject';
import { wavBlob } from './wav';

/**
 * Bridges the Music Studio to the existing Audio Library.
 *
 * A rendered composition becomes an ordinary `AudioAsset` with `audio/wav`, so it
 * works everywhere the Audio Library already works: intros, scenes, credits and
 * future episode assembly, with no new playback path.
 */
export async function renderMusicToAsset(project: MusicProject): Promise<AudioAsset> {
  const result = await renderMusic(project);
  return toAsset(project.name, 'music', result);
}

export async function renderEffectToAsset(effect: EffectProject): Promise<AudioAsset> {
  const result = await renderEffect(effect);
  return toAsset(effect.name, 'effect', result);
}

function toAsset(name: string, kind: AudioKind, result: RenderResult): AudioAsset {
  // Mono sources are duplicated so the mixer path is identical for music and effects.
  const channels = result.channels.length >= 2 ? result.channels : [result.channels[0], result.channels[0]];
  const blob = wavBlob(channels, result.sampleRate);
  return { id: crypto.randomUUID(), name: name.slice(0, 120).trim(), kind, mime: 'audio/wav', duration: result.duration, size: blob.size, blob };
}

/** True when a project is worth rendering: silence would be a confusing result. */
export const hasContent = (project: MusicProject) => project.tracks.some(track => track.notes.length > 0);