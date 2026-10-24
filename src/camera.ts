import { HEIGHT, WIDTH, type Point } from './scene';
import type { TimedScene } from './timedScenes';
import { stateAt } from './timedScenes';
import { livingWorldAt } from './livingWorld';

export type CameraShot = 'wide' | 'medium' | 'close-up';
export type CameraFocus = 'max' | 'maxine' | 'group' | 'point';
export type CameraKeyframe = { id: string; shot: CameraShot; focus: CameraFocus; point?: Point; follow?: boolean; start: number; duration: number };
export type CameraView = { x: number; y: number; zoom: number };
export const WIDE_CAMERA: CameraView = { x: WIDTH / 2, y: HEIGHT / 2, zoom: 1 };
const zoomFor = { wide: 1, medium: 1.4, 'close-up': 2.7 } satisfies Record<CameraShot, number>;
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const clampView = ({ x, y, zoom }: CameraView): CameraView => ({ zoom, x: Math.max(WIDTH / (2 * zoom), Math.min(WIDTH - WIDTH / (2 * zoom), x)), y: Math.max(HEIGHT / (2 * zoom), Math.min(HEIGHT - HEIGHT / (2 * zoom), y)) });

function target(scene: TimedScene, key: CameraKeyframe, time: number): CameraView {
  const zoom = zoomFor[key.shot];
  if (key.shot === 'wide') return WIDE_CAMERA;
  if (key.focus === 'point') return clampView({ ...key.point!, zoom });
  const at = key.follow ? time : key.start;
  const ids = key.focus === 'group' ? Object.keys(scene.characters) : [key.focus];
  const points = ids.filter(id => scene.characters[id]).map(id => scene.livingWorld?.enabled ? livingWorldAt(scene, id, at).state.point : stateAt(scene, id, at).point);
  if (!points.length) return clampView({ ...WIDE_CAMERA, zoom });
  const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const y = points.reduce((sum, point) => sum + point.y, 0) / points.length - (key.shot === 'close-up' ? 250 : 175);
  return clampView({ x, y, zoom });
}

/** Evaluated by absolute scene time in both preview and WebM renderers. */
export function cameraAt(scene: TimedScene, time: number): CameraView {
  const keys = [...(scene.camera ?? [])].sort((a, b) => a.start - b.start);
  let view = WIDE_CAMERA;
  for (const key of keys) {
    if (time < key.start) break;
    const destination = target(scene, key, time);
    if (key.duration > 0 && time < key.start + key.duration) {
      const from = cameraAt({ ...scene, camera: keys.filter(item => item.start < key.start) }, key.start);
      const t = smooth((time - key.start) / key.duration);
      return clampView({ x: from.x + (destination.x - from.x) * t, y: from.y + (destination.y - from.y) * t, zoom: from.zoom + (destination.zoom - from.zoom) * t });
    }
    view = destination;
  }
  return view;
}

export function validCamera(scene: TimedScene): boolean {
  if (scene.camera === undefined) return true;
  if (!Array.isArray(scene.camera) || scene.camera.length > 100) return false;
  const ids = new Set<string>();
  const prior: CameraKeyframe[] = [];
  let end = 0;
  for (const key of [...scene.camera].sort((a, b) => a.start - b.start)) {
    if (!key || typeof key.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9-]{27}$/.test(key.id) || ids.has(key.id) || !['wide', 'medium', 'close-up'].includes(key.shot) || !['max', 'maxine', 'group', 'point'].includes(key.focus) || typeof key.start !== 'number' || !Number.isFinite(key.start) || key.start < end - 1e-7 || typeof key.duration !== 'number' || !Number.isFinite(key.duration) || key.duration < 0 || key.start > 0 && key.duration < .6 || key.duration > 15 || key.start + key.duration > scene.duration + 1e-7 || key.shot === 'close-up' && key.focus === 'group' || (key.focus === 'max' || key.focus === 'maxine') && !scene.characters[key.focus] || key.focus === 'group' && !Object.keys(scene.characters).length || key.focus === 'point' && (!key.point || !Number.isFinite(key.point.x) || !Number.isFinite(key.point.y) || key.point.x < 0 || key.point.x > WIDTH || key.point.y < 0 || key.point.y > HEIGHT) || key.focus !== 'point' && key.point !== undefined || key.follow !== undefined && typeof key.follow !== 'boolean' || key.follow && (key.focus === 'point' || key.shot === 'wide')) return false;
    if (key.duration > 0) {
      const from = cameraAt({ ...scene, camera: prior }, key.start);
      const to = target(scene, key, key.start + key.duration);
      if (Math.hypot(to.x - from.x, to.y - from.y) * Math.min(from.zoom, to.zoom) / key.duration > 500 || Math.abs(to.zoom - from.zoom) / key.duration > 1.5) return false;
    }
    ids.add(key.id);
    prior.push(key);
    end = key.start + key.duration;
  }
  return true;
}
