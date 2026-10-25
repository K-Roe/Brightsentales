import { describe, expect, it } from 'vitest';
import type { TimedLibrary, TimedScene } from './timedScenes';
import type { Episode, EpisodeCameraShot } from './episodes';
import { validateEpisodeLibrary } from './episodes';
import { addEpisodeCameraShot, cameraZoom, episodeCameraIssue, episodeCameraTargets, episodeCameraView, removeEpisodeCameraShot, updateEpisodeCameraShot } from './episodeCamera';
import { productionDuration } from './episodes';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const cameraId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const scene = (n: number, duration: number): TimedScene => ({
  id: id(n), name: `Scene ${n}`, duration, placeId: 'living-room',
  characters: { max: { x: 836, y: 790 }, maxine: { x: 1100, y: 790 } },
  actions: [],
});
const scenes: TimedLibrary = { version: 1, scenes: [scene(1, 10), scene(2, 6)] };
const episode: Episode = { id: id(9), name: 'Camera episode', sceneIds: [id(1), id(2)] };
const shot = (n: number, patch: Partial<EpisodeCameraShot> = {}): EpisodeCameraShot => ({ id: cameraId(n), start: 0, duration: 2, shot: 'wide', target: 'max', movement: 'static', ...patch });

describe('episode camera direction', () => {
  it('leaves legacy episodes to their saved scene cameras', () => {
    expect(episodeCameraView(episode, scenes, 3)).toBeUndefined();
    expect(episodeCameraIssue(episode, scenes)).toBeNull();
  });

  it('frames wide, medium, close-up and custom shots predictably', () => {
    const medium = { ...episode, camera: [shot(1, { shot: 'medium' })] };
    const close = { ...episode, camera: [shot(1, { shot: 'close-up', target: 'maxine' })] };
    const custom = { ...episode, camera: [shot(1, { shot: 'custom', target: 'point', x: 836, y: 470, zoom: 3 })] };
    const mediumView = episodeCameraView(medium, scenes, 1)!;
    expect(mediumView.x).toBe(836); expect(mediumView.zoom).toBe(1.4); expect(mediumView.y).toBeCloseTo(605, 0);
    expect(episodeCameraView(close, scenes, 1)).toMatchObject({ x: 1100, y: 540, zoom: 2.7 });
    expect(episodeCameraView(custom, scenes, 1)).toMatchObject({ x: 836, y: 470, zoom: 3 });
    expect(cameraZoom(shot(1, { shot: 'custom', zoom: 4 }))).toBe(4);
    expect(cameraZoom(shot(1, { shot: 'custom', zoom: 99 }))).toBe(4);
    expect(validateEpisodeLibrary({ version: 1, episodes: [medium] }).ok).toBe(true);
  });

  it('holds a static shot and pans smoothly from the previous framing', () => {
    const staticShot = { ...episode, camera: [shot(1, { shot: 'medium' })] };
    expect(episodeCameraView(staticShot, scenes, 1.9)).toEqual(episodeCameraView(staticShot, scenes, .1));
    expect(episodeCameraView(staticShot, scenes, 5)).toEqual(episodeCameraView(staticShot, scenes, 1));
    const pan = { ...episode, camera: [shot(1, { duration: 2 }), shot(2, { start: 2, duration: 2, shot: 'medium', movement: 'pan' })] };
    expect(episodeCameraView(pan, scenes, 2)).toMatchObject({ x: 836, y: 470.5, zoom: 1 });
    expect(episodeCameraView(pan, scenes, 3)!.y).toBeGreaterThan(episodeCameraView(pan, scenes, 2)!.y);
    expect(episodeCameraView(pan, scenes, 3)!.y).toBeLessThan(episodeCameraView(pan, scenes, 4)!.y);
    const panEnd = episodeCameraView(pan, scenes, 4)!;
    expect(panEnd.x).toBe(836); expect(panEnd.zoom).toBe(1.4); expect(panEnd.y).toBeCloseTo(605, 0);
  });

  it('follows a Brightling deterministically on the occurrence clock', () => {
    const walking: TimedLibrary = { version: 1, scenes: [{ ...scene(1, 10), actions: [{ id: id(31), characterId: 'max', type: 'walk', start: 0, duration: 4, point: { x: 1200, y: 790 }, motion: 'gentle' }] }, scene(2, 6)] };
    const following = { ...episode, camera: [shot(1, { duration: 8, shot: 'medium', movement: 'follow' })] };
    const start = episodeCameraView(following, walking, 0)!;
    const middle = episodeCameraView(following, walking, 2)!;
    const end = episodeCameraView(following, walking, 3.9)!;
    expect(middle.x).toBeGreaterThan(start.x);
    expect(end.x).toBeGreaterThan(middle.x);
    expect(episodeCameraView(following, walking, 2)).toEqual(middle);
    const across = { ...episode, camera: [shot(1, { start: 9, duration: 3, shot: 'close-up', target: 'maxine' })] };
    expect(episodeCameraView(across, scenes, 10.5)!.x).toBe(1100);
  });

  it('uses the full production clock when an episode has an intro', () => {
    const intro = { ...scene(3, 8), seriesTitle: 'Series', episodeTitle: 'Episode', titleStyle: 'banner' as const };
    const withIntro = { ...episode, introId: intro.id, camera: [shot(1, { start: 8, duration: 4, shot: 'medium', movement: 'follow' })] };
    const walking: TimedLibrary = { version: 1, scenes: [{ ...scene(1, 10), actions: [{ id: id(32), characterId: 'max', type: 'walk', start: 0, duration: 4, point: { x: 1200, y: 790 }, motion: 'gentle' }] }, scene(2, 6)] };
    const view = episodeCameraView(withIntro, walking, 9, { version: 1, intros: [intro] });
    expect(view?.x).toBeGreaterThan(836);
    expect(view?.x).toBeLessThan(1000);
  });

  it('never substitutes a different Brightling when a target is missing', () => {
    const onlyMax: TimedLibrary = { version: 1, scenes: [scene(1, 4), { ...scene(2, 6), characters: { maxine: { x: 1100, y: 790 } } }] };
    const across = { ...episode, camera: [shot(1, { start: 0, duration: 8, shot: 'close-up', target: 'max' })] };
    const before = episodeCameraView(across, onlyMax, 3.9)!;
    const after = episodeCameraView(across, onlyMax, 5)!;
    expect(after.x).toBe(before.x);
    expect(after.x).toBe(836);
    expect(episodeCameraTargets(episode, scenes).map(target => target.id)).toEqual(['max', 'maxine']);

    const following = { ...episode, camera: [shot(1, { start: 8, duration: 8, shot: 'close-up', target: 'max', movement: 'follow' })] };
    const lastSeen = episodeCameraView(following, onlyMax, 9.9)!;
    expect(episodeCameraView(following, onlyMax, 10.5)).toEqual(lastSeen);
    expect(episodeCameraView(following, onlyMax, 16)).toEqual(lastSeen);
  });

  it('validates shot timing, overlap, targets and custom zoom', () => {
    const total = productionDuration(episode, scenes);
    expect(total).toBe(16);
    expect(episodeCameraIssue({ ...episode, camera: [shot(1)] }, scenes)).toBeNull();
    expect(episodeCameraIssue({ ...episode, camera: [shot(1), shot(2, { start: 1 })] }, scenes)).toMatch(/overlap/);
    expect(episodeCameraIssue({ ...episode, camera: [shot(1, { start: 15, duration: 2 })] }, scenes)).toMatch(/inside the episode/);
    expect(episodeCameraIssue({ ...episode, camera: [shot(1, { target: 'unknown' })] }, scenes)).toMatch(/not in this episode/);
    expect(episodeCameraIssue({ ...episode, camera: [shot(1, { shot: 'custom', zoom: .5 })] }, scenes)).toMatch(/zoom/);
    expect(episodeCameraIssue({ ...episode, camera: [shot(1, { movement: 'follow' })] }, scenes)).toMatch(/Follow/);
    expect(episodeCameraIssue({ ...episode, camera: [shot(1, { target: 'point' })] }, scenes)).toMatch(/Fixed camera/);
    expect(episodeCameraIssue({ ...episode, camera: [null, shot(1)] as unknown as EpisodeCameraShot[] }, scenes)).toMatch(/invalid ID/);
    expect(validateEpisodeLibrary({ version: 1, episodes: [{ ...episode, camera: [shot(1), shot(2, { start: 1 })] }] }).ok).toBe(false);
  });

  it('round-trips a saved camera track and rejects malformed payloads', () => {
    const directed = { ...episode, camera: [shot(1, { start: 0, duration: 3 }), shot(2, { start: 3, duration: 2, shot: 'medium', target: 'maxine', movement: 'pan' })] };
    const encoded = JSON.parse(JSON.stringify({ version: 1, episodes: [directed] }));
    const decoded = validateEpisodeLibrary(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.library.episodes[0].camera).toEqual(directed.camera);
    const malformed = [
      { ...directed, camera: 'wide' },
      { ...directed, camera: [{ ...shot(1), id: 'bad' }] },
      { ...directed, camera: [shot(1), shot(1)] },
      { ...directed, camera: [{ ...shot(1), duration: .1 }] },
      { ...directed, camera: [{ ...shot(1), target: 'point', x: 9999, y: 0 }] },
      { ...directed, camera: [{ ...shot(1), shot: 'custom' }] },
      { ...directed, camera: [{ ...shot(1), shot: 'medium', zoom: 2 }] },
      { ...directed, camera: [{ ...shot(1), start: Number.NaN }] },
      { ...directed, camera: [{ ...shot(1), target: 'max', x: 10 }] },
      { ...directed, camera: [{ ...shot(1), target: 'point', movement: 'follow', x: 836, y: 470 }] },
    ];
    for (const item of malformed) expect(validateEpisodeLibrary({ version: 1, episodes: [item] }).ok).toBe(false);
  });

  it('adds, edits and removes shots without touching other episode data', () => {
    const added = addEpisodeCameraShot(episode, 16, 1.2, 'max');
    if ('error' in added) throw new Error(added.error);
    expect(added.shot.start).toBe(1.2);
    expect(added.episode.camera).toHaveLength(1);
    const second = addEpisodeCameraShot(added.episode, 16, 1.5, 'maxine');
    if ('error' in second) throw new Error(second.error);
    expect(second.shot.start).toBe(4.2);
    const edited = updateEpisodeCameraShot(second.episode, second.shot.id, { shot: 'medium' });
    expect(edited.camera![1].shot).toBe('medium');
    const removed = removeEpisodeCameraShot(edited, second.shot.id);
    expect(removed.camera).toHaveLength(1);
    expect(removeEpisodeCameraShot(removed, added.shot.id).camera).toBeUndefined();
    expect(episode.sceneIds).toEqual([id(1), id(2)]);
  });
});
