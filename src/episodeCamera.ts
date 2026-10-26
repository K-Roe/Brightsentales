import { HEIGHT, WIDTH, type Point } from './scene';
import { livingWorldAt } from './livingWorld';
import { productionBlocks, productionDuration, type Episode, type EpisodeCameraShot } from './episodes';
import type { IntroLibrary } from './introductions';
import type { CreditsLibrary } from './credits';
import { stateAt, type TimedLibrary, type TimedScene } from './timedScenes';
import type { Brightling } from './maker';

export type CameraView = { x: number; y: number; zoom: number };
export const WIDE_CAMERA_VIEW: CameraView = { x: WIDTH / 2, y: HEIGHT / 2, zoom: 1 };
export type EpisodeCameraTarget = { id: string; name: string };

const SHOTS = ['wide', 'medium', 'close-up', 'custom'] as const;
const MOVEMENTS = ['static', 'pan', 'follow'] as const;
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const clampView = ({ x, y, zoom }: CameraView): CameraView => ({ zoom, x: Math.max(WIDTH / (2 * zoom), Math.min(WIDTH - WIDTH / (2 * zoom), x)), y: Math.max(HEIGHT / (2 * zoom), Math.min(HEIGHT - HEIGHT / (2 * zoom), y)) });

export function cameraZoom(shot: EpisodeCameraShot): number {
  if (shot.shot === 'wide') return 1;
  if (shot.shot === 'medium') return 1.4;
  if (shot.shot === 'close-up') return 2.7;
  return Math.max(1, Math.min(4, shot.zoom ?? 2));
}

export const cameraShotName = (shot: EpisodeCameraShot['shot']) => shot === 'close-up' ? 'Close-Up' : shot === 'custom' ? 'Custom Shot' : shot === 'medium' ? 'Medium Shot' : 'Wide Shot';
export const cameraMovementName = (movement: EpisodeCameraShot['movement']) => movement === 'pan' ? 'Pan' : movement === 'follow' ? 'Follow' : 'Static';

/** Targets are the characters actually present anywhere in this episode, never a guessed substitute. */
export function episodeCameraTargets(episode: Episode, scenes: TimedLibrary, characters: Brightling[] = []): EpisodeCameraTarget[] {
  const ids = new Set<string>();
  for (const id of episode.sceneIds) {
    const scene = scenes.scenes.find(candidate => candidate.id === id);
    if (scene) for (const characterId of Object.keys(scene.characters)) ids.add(characterId);
  }
  return [...ids].filter(id => id !== 'point').sort((a, b) => (a === 'max' ? -1 : b === 'max' ? 1 : a === 'maxine' ? -1 : b === 'maxine' ? 1 : a.localeCompare(b)))
    .map(id => ({ id, name: id === 'max' ? 'Max' : id === 'maxine' ? 'Maxine' : characters.find(character => character.id === id)?.name ?? 'Saved Brightling' }));
}

function blockAt(episode: Episode, scenes: TimedLibrary, intros: IntroLibrary | undefined, credits: CreditsLibrary | undefined, time: number) {
  const blocks = productionBlocks(episode, scenes, intros, credits);
  return blocks.find(block => time >= block.start && time < block.start + block.duration) ?? blocks.at(-1);
}

function characterPoint(scene: TimedScene, id: string, time: number): Point | null {
  if (!scene.characters[id]) return null;
  return scene.livingWorld?.enabled ? livingWorldAt(scene, id, time).state.point : stateAt(scene, id, time).point;
}

function viewFor(episode: Episode, scenes: TimedLibrary, intros: IntroLibrary | undefined, credits: CreditsLibrary | undefined, shot: EpisodeCameraShot, time: number): CameraView | null {
  const zoom = cameraZoom(shot);
  if (shot.shot === 'wide') return WIDE_CAMERA_VIEW;
  if (shot.target === 'point') return clampView({ x: shot.x ?? WIDTH / 2, y: shot.y ?? HEIGHT / 2, zoom });
  const block = blockAt(episode, scenes, intros, credits, time);
  const point = block ? characterPoint(block.scene, shot.target, Math.min(Math.max(0, time - block.start), block.scene.duration)) : null;
  if (!point) return null;
  const lift = shot.shot === 'close-up' ? 250 : shot.shot === 'medium' ? 175 : 140;
  return clampView({ x: point.x, y: point.y - lift, zoom });
}

/** Follows the last occurrence containing this target; a cut to another cast never changes targets. */
function followViewFor(episode: Episode, scenes: TimedLibrary, intros: IntroLibrary | undefined, credits: CreditsLibrary | undefined, shot: EpisodeCameraShot, time: number): CameraView | null {
  const zoom = cameraZoom(shot);
  if (shot.target === 'point' || shot.shot === 'wide') return viewFor(episode, scenes, intros, credits, shot, time);
  let found: CameraView | null = null;
  for (const block of productionBlocks(episode, scenes, intros, credits)) {
    if (block.start > time) break;
    if (!block.scene.characters[shot.target]) continue;
    const local = Math.min(Math.max(0, time - block.start), block.scene.duration);
    const point = characterPoint(block.scene, shot.target, local);
    if (!point) continue;
    const lift = shot.shot === 'close-up' ? 250 : shot.shot === 'medium' ? 175 : 140;
    found = clampView({ x: point.x, y: point.y - lift, zoom });
  }
  return found;
}

/**
 * Evaluates episode camera direction on the canonical P6 occurrence clock.
 * `undefined` means the episode has no camera track and the scene camera stays in charge.
 * A shot holds its last available framing when its target is not in the active scene;
 * it never swaps in a different character.
 */
export function episodeCameraView(episode: Episode, scenes: TimedLibrary, time: number, intros?: IntroLibrary, credits?: CreditsLibrary): CameraView | undefined {
  if (!episode.camera?.length) return undefined;
  const shots = [...episode.camera].sort((a, b) => a.start - b.start);
  let view = WIDE_CAMERA_VIEW;
  for (const shot of shots) {
    if (time < shot.start) break;
    const end = shot.start + shot.duration;
    if (time < end) {
      if (shot.movement === 'pan' && shot.duration > 0) {
        const destination = viewFor(episode, scenes, intros, credits, shot, shot.start) ?? view;
        const t = smooth((time - shot.start) / shot.duration);
        return clampView({ x: view.x + (destination.x - view.x) * t, y: view.y + (destination.y - view.y) * t, zoom: view.zoom + (destination.zoom - view.zoom) * t });
      }
      return shot.movement === 'follow'
        ? followViewFor(episode, scenes, intros, credits, shot, time) ?? viewFor(episode, scenes, intros, credits, shot, shot.start) ?? view
        : viewFor(episode, scenes, intros, credits, shot, shot.start) ?? view;
    }
    view = (shot.movement === 'follow'
      ? followViewFor(episode, scenes, intros, credits, shot, end)
      : viewFor(episode, scenes, intros, credits, shot, shot.start)) ?? view;
  }
  return view;
}

const UID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Structural and semantic checks for saving/transferring episode camera direction. */
export function episodeCameraIssue(episode: Episode, scenes: TimedLibrary, total = productionDuration(episode, scenes)): string | null {
  if (episode.camera === undefined) return null;
  if (!Array.isArray(episode.camera) || episode.camera.length > 100) return 'The episode camera needs a valid list of at most 100 shots.';
  const ids = new Set<string>();
  const targets = new Set(episodeCameraTargets(episode, scenes).map(target => target.id));
  let end = 0;
  const ordered = [...episode.camera].sort((a, b) => (finite(a?.start) ? a.start : 0) - (finite(b?.start) ? b.start : 0));
  for (const shot of ordered) {
    if (!shot || typeof shot !== 'object' || typeof shot.id !== 'string' || !UID.test(shot.id) || ids.has(shot.id)) return 'A camera shot has an invalid ID.';
    if (!SHOTS.includes(shot.shot)) return 'Choose a supported camera shot.';
    if (!MOVEMENTS.includes(shot.movement)) return 'Choose Static, Pan or Follow camera movement.';
    if (shot.target !== 'point' && (typeof shot.target !== 'string' || !targets.has(shot.target))) return `Camera target “${String(shot.target)}” is not in this episode. Choose an available Brightling or a fixed position.`;
    if (!finite(shot.start) || shot.start < 0 || !finite(shot.duration) || shot.duration < .5 || shot.start + shot.duration > total + 1e-7) return 'Camera shots must stay inside the episode and last at least 0.5 seconds.';
    if (shot.start < end - 1e-7) return 'Camera shots cannot overlap. Move or shorten one first.';
    if (shot.shot === 'custom' && (shot.zoom === undefined || !finite(shot.zoom) || shot.zoom < 1 || shot.zoom > 4)) return 'Custom Shot zoom must be between 1x and 4x.';
    if (shot.shot !== 'custom' && shot.zoom !== undefined) return 'Only Custom Shot uses a manual zoom.';
    if (shot.target === 'point' && (!finite(shot.x) || !finite(shot.y) || shot.x < 0 || shot.x > WIDTH || shot.y < 0 || shot.y > HEIGHT)) return 'Fixed camera positions must stay inside the Living Room stage.';
    if (shot.target !== 'point' && (shot.x !== undefined || shot.y !== undefined)) return 'Character camera shots do not use a fixed position.';
    if (shot.movement === 'follow' && (shot.target === 'point' || shot.shot === 'wide')) return 'Follow needs a Brightling target and a medium, close-up or custom shot.';
    ids.add(shot.id);
    end = shot.start + shot.duration;
  }
  return null;
}

type Selection = { episode: Episode; shot: EpisodeCameraShot } | { error: string };

/** Adds a shot at the playhead, sliding forward past existing shots instead of overwriting them. */
export function addEpisodeCameraShot(episode: Episode, total: number, at: number, target: string): Selection {
  if (total < .5) return { error: 'Add a scene before adding a camera shot.' };
  const shots = [...(episode.camera ?? [])].sort((a, b) => a.start - b.start);
  let start = Math.max(0, Math.min(at, total - .5));
  for (const shot of shots) {
    if (start < shot.start + shot.duration - 1e-7 && start + .5 > shot.start) start = shot.start + shot.duration;
  }
  if (start > total - .5) return { error: 'There is no room for another camera shot at this point. Move the playhead or remove a shot.' };
  const next = shots.find(shot => shot.start > start);
  const duration = Math.max(.5, Math.min(3, total - start, next ? next.start - start : Infinity));
  const shot: EpisodeCameraShot = { id: crypto.randomUUID(), start, duration, shot: 'wide', target, movement: 'static' };
  return { episode: { ...episode, camera: [...shots, shot].sort((a, b) => a.start - b.start) }, shot };
}

export function updateEpisodeCameraShot(episode: Episode, id: string, patch: Partial<EpisodeCameraShot>): Episode {
  return { ...episode, camera: (episode.camera ?? []).map(shot => shot.id === id ? { ...shot, ...patch } : shot).sort((a, b) => a.start - b.start) };
}

export function removeEpisodeCameraShot(episode: Episode, id: string): Episode {
  const camera = (episode.camera ?? []).filter(shot => shot.id !== id);
  return { ...episode, ...(camera.length ? { camera } : { camera: undefined }) };
}
