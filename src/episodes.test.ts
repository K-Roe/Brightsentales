import { describe, expect, it } from 'vitest';
import { advanceSceneTime, stateAt, type TimedLibrary, type TimedScene } from './timedScenes';
import { decodeEpisodeLibrary, episodeDuration, episodePosition, missingSceneIds, productionBlocks, productionDuration, productionPosition, speechFitsEpisode, validateEpisodeLibrary, type Episode } from './episodes';
import { episodePlaybackClips } from './audioPlayback';
import type { IntroLibrary } from './introductions';
import type { CreditsLibrary } from './credits';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const scene = (n: number, duration: number): TimedScene => ({ id: id(n), name: `Scene ${n}`, duration, placeId: 'living-room', characters: { max: { x: 400 + n, y: 790 } }, actions: [{ id: id(n + 10), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 400 + n, y: 790 } }] });
const scenes: TimedLibrary = { version: 1, scenes: [scene(1, 10), scene(2, 15), scene(3, 8)] };
const episode: Episode = { id: id(9), name: 'Our First Episode', sceneIds: scenes.scenes.map(item => item.id) };

describe('episode timing and references', () => {
  it('maps the global clock to distinct scene-local clocks at exact boundaries', () => {
    expect(episodeDuration(episode, scenes)).toBe(33);
    expect(episodePosition(episode, scenes, 9.9)?.index).toBe(0);
    expect(episodePosition(episode, scenes, 10)).toMatchObject({ index: 1, localTime: 0, start: 10 });
    expect(episodePosition(episode, scenes, 25)).toMatchObject({ index: 2, localTime: 0, start: 25 });
    expect(episodePosition(episode, scenes, 33)).toMatchObject({ index: 2, localTime: 8 });
    expect(advanceSceneTime(32.8, .5, 33)).toBe(33);
  });
  it('starts each scene from its own actions and follows updated scene data', () => {
    const second = episodePosition(episode, scenes, 10)!;
    expect(stateAt(second.scene, 'max', second.localTime).point.x).toBe(402);
    const updated = { version: 1 as const, scenes: scenes.scenes.map(item => item.id === id(2) ? { ...item, characters: { max: { x: 900, y: 790 } }, actions: [{ ...item.actions[0], point: { x: 900, y: 790 } }] } : item) };
    expect(stateAt(episodePosition(episode, updated, 10)!.scene, 'max', 0).point.x).toBe(900);
  });
  it('allows repeat references and reordered durations', () => {
    const repeated = { ...episode, sceneIds: [id(3), id(1), id(1)] };
    expect(episodeDuration(repeated, scenes)).toBe(28);
    expect(episodePosition(repeated, scenes, 18)?.index).toBe(2);
  });
  it('blocks playback when a referenced scene is missing and validates persisted data', () => {
    const missing = { ...episode, sceneIds: [...episode.sceneIds, id(90)] };
    expect(missingSceneIds(missing, scenes)).toEqual([id(90)]);
    expect(episodePosition(missing, scenes, 0)).toBeNull();
    const valid = { version: 1 as const, episodes: [episode] };
    expect(decodeEpisodeLibrary(JSON.stringify(valid))).toEqual({ ok: true, library: valid });
    expect(validateEpisodeLibrary({ version: 1, episodes: [{ ...episode, id: 'bad' }] }).ok).toBe(false);
    expect(validateEpisodeLibrary({ version: 1, episodes: [episode, episode] }).ok).toBe(false);
  });
  it('assembles reusable intro, scenes and credits on one clock without changing legacy episodes', () => {
    const clip = { id: id(90), assetId: id(91), start: 1, trimStart: 0, trimEnd: 2, volume: .7, fadeIn: 0, fadeOut: 0, speakerId: 'narrator' };
    const intros: IntroLibrary = { version: 1, intros: [{ ...scene(7, 5), audio: [clip], seriesTitle: 'BrightTales', episodeTitle: 'Meet Max and Maxine', titleStyle: 'banner' }] };
    const credits: CreditsLibrary = { version: 1, credits: [{ id: id(8), name: 'Ending', title: 'Thanks for watching', duration: 4, placeId: 'living-room', lines: [{ id: id(81), heading: 'Created by', name: 'BrightSenApps', role: '' }], mode: 'static', scrollSpeed: 1, audio: [{ ...clip, id: id(92) }] }] };
    const production = { ...episode, introId: id(7), creditsId: id(8) };
    expect(productionBlocks(production, scenes, intros, credits).map(block => [block.kind, block.start])).toEqual([['intro', 0], ['scene', 5], ['scene', 15], ['scene', 30], ['credits', 38]]);
    expect(productionDuration(production, scenes, intros, credits)).toBe(42);
    expect(productionPosition(production, scenes, intros, credits, 5)).toMatchObject({ kind: 'scene', start: 5, localTime: 0 });
    expect(productionPosition(production, scenes, intros, credits, 38)).toMatchObject({ kind: 'credits', start: 38, localTime: 0 });
    expect(productionPosition(production, scenes, intros, credits, 42)).toMatchObject({ kind: 'credits', localTime: 4 });
    expect(episodePlaybackClips(production, scenes, intros, credits).map(item => [item.start, item.key])).toEqual([[1, `intro:0:${id(90)}`], [39, `credits:4:${id(92)}`]]);
    expect(validateEpisodeLibrary({ version: 1, episodes: [production] }).ok).toBe(true);
    expect(validateEpisodeLibrary({ version: 1, episodes: [{ ...production, introId: 'bad' }] }).ok).toBe(false);
    const narration = { id: id(90), assetId: id(91), start: 38, trimStart: 0, trimEnd: 3, volume: .7, fadeIn: 0, fadeOut: 0, speakerId: 'narrator' };
    expect(speechFitsEpisode({ ...production, audio: [narration] }, scenes, intros, credits)).toBe(true);
    expect(speechFitsEpisode({ ...production, audio: [{ ...narration, start: 40 }] }, scenes, intros, credits)).toBe(false);
    expect(productionPosition(production, scenes, { version: 1, intros: [] }, credits, 0)).toBeNull();
    expect(episodeDuration(episode, scenes)).toBe(33);
  });
});
