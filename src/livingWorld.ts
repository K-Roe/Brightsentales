import { type Point } from './scene';
import { stateAt, type SceneState, type TimedScene } from './timedScenes';
import { directionTo, frameForDistance, TURN_MS } from './walking';
import { phoneStateAt } from './phone';

export type BehaviourPreferences = { activity: number; curiosity: number; sociability: number };
export type LivingWorldSettings = { enabled: true; mode?: 'v1.1'; preferences?: Record<string, BehaviourPreferences> };
export type WorldActivity = 'rest' | 'observe' | 'explore' | 'approach' | 'return' | 'anticipate' | 'settle';
export type WorldState = { state: SceneState; activity: WorldActivity; autonomous: boolean };

const defaults: Record<string, BehaviourPreferences> = {
  max: { activity: .38, curiosity: .58, sociability: .18 },
  maxine: { activity: .62, curiosity: .72, sociability: .42 },
};
const fallback: BehaviourPreferences = { activity: .45, curiosity: .5, sociability: .25 };
const interests: Record<string, Point[]> = {
  max: [{ x: 385, y: 790 }, { x: 570, y: 790 }, { x: 740, y: 790 }],
  maxine: [{ x: 930, y: 790 }, { x: 1110, y: 790 }, { x: 1270, y: 790 }],
};
const minSeparation = 255;
const samePoint = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 2;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const smooth = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const hash = (value: string) => { let n = 2166136261; for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619); return n >>> 0; };
const random = (seed: number, index: number) => { let n = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0; n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15; n = Math.imul(n, 0x846ca68b); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const durationFor = (a: Point, b: Point) => Math.max(1.6, distance(a, b) / 105 + TURN_MS / 1000);

type Segment = { start: number; end: number; from: Point; to: Point; activity: WorldActivity; facing?: -1 | 1 };
type Plan = Record<string, Segment[]>;
const plans = new WeakMap<TimedScene, Plan>();

const pointDuring = (segment: Segment, time: number): Point => {
  if (segment.activity === 'rest' || segment.activity === 'observe' || segment.activity === 'anticipate' || segment.activity === 'settle') return segment.from;
  const turn = Math.min((segment.end - segment.start) * .2, TURN_MS / 1000);
  const progress = smooth((time - segment.start - turn) / Math.max(.001, segment.end - segment.start - turn));
  return { x: segment.from.x + (segment.to.x - segment.from.x) * progress, y: segment.from.y + (segment.to.y - segment.from.y) * progress };
};

const plannedPoint = (scene: TimedScene, plan: Plan, id: string, time: number): Point => {
  const segment = plan[id]?.find(item => item.start <= time && time < item.end);
  return segment ? pointDuring(segment, time) : stateAt(scene, id, time).point;
};

function safePath(scene: TimedScene, plan: Plan, id: string, from: Point, to: Point, start: number, end: number, separation = minSeparation): boolean {
  if (to.x < 310 || to.x > 1360 || to.y < 760 || to.y > 815) return false;
  for (let time = start; time <= end + .001; time += .2) {
    const point = pointDuring({ start, end, from, to, activity: 'explore' }, time);
    for (const other of Object.keys(scene.characters)) {
      if (other === id || !stateAt(scene, other, time).visible) continue;
      if (distance(point, plannedPoint(scene, plan, other, time)) < separation) return false;
    }
  }
  return true;
}

function safeStay(scene: TimedScene, plan: Plan, id: string, point: Point, start: number, end: number, separation: number): boolean {
  for (let time = start; time <= end + .001; time += .25) {
    for (const other of Object.keys(scene.characters)) {
      if (other === id || !stateAt(scene, other, time).visible) continue;
      if (distance(point, plannedPoint(scene, plan, other, time)) < separation) return false;
    }
  }
  return true;
}

function boundaries(scene: TimedScene, id: string): number[] {
  const times = [0, scene.duration];
  for (const action of scene.actions.filter(item => item.characterId === id)) times.push(action.start, action.start + action.duration);
  for (const action of (scene.phone ?? []).filter(item => item.characterId === id)) times.push(action.start, action.start + action.duration);
  return [...new Set(times)].sort((a, b) => a - b);
}

function directorBusy(scene: TimedScene, id: string, time: number): boolean {
  if (scene.actions.some(action => action.characterId === id && action.duration > 0 && action.start <= time && time < action.start + action.duration)) return true;
  if ((scene.phone ?? []).some(action => action.characterId === id && action.start <= time && time < action.start + action.duration)) return true;
  const phone = phoneStateAt(scene, id, time);
  return phone.held || phone.raise > 0;
}

function buildPlan(scene: TimedScene): Plan {
  const plan: Plan = {};
  const ids = Object.keys(scene.characters).sort();
  for (const id of ids) {
    const seed = hash(`${scene.id}:${id}`);
    const prefs = scene.livingWorld?.preferences?.[id] ?? defaults[id] ?? fallback;
    const segments: Segment[] = [];
    plan[id] = segments;
    const edges = boundaries(scene, id);
    let choice = 0;
    for (let interval = 0; interval < edges.length - 1; interval++) {
      const start = edges[interval], end = edges[interval + 1];
      const baseline = stateAt(scene, id, (start + end) / 2);
      if (end - start < 2.5 || !baseline.visible || baseline.gestureFrame || baseline.greetingV3 || directorBusy(scene, id, (start + end) / 2)) continue;
      const anchor = stateAt(scene, id, start).point;
      let current = anchor;
      let cursor = start;
      const hasDirectorNext = end < scene.duration - .001;
      const limit = hasDirectorNext ? end - 3.3 : end - .25;
      while (cursor + 3.5 < limit) {
        const rest = 1.8 + random(seed, ++choice) * (4.5 - 2 * prefs.activity);
        const restEnd = Math.min(limit, cursor + rest);
        segments.push({ start: cursor, end: restEnd, from: current, to: current, activity: random(seed, ++choice) < prefs.curiosity ? 'observe' : 'rest' });
        cursor = restEnd;
        if (cursor + 2.5 >= limit || random(seed, ++choice) > prefs.activity + .22) continue;
        const otherId = ids.find(other => other !== id);
        const social = !!otherId && random(seed, ++choice) < prefs.sociability;
        const other = otherId ? plannedPoint(scene, plan, otherId, cursor) : null;
        const candidates: Point[] = social && other ? [
          { x: clamp(other.x + (current.x >= other.x ? 265 : -265), 310, 1360), y: 790 },
          { x: clamp(other.x + (current.x >= other.x ? 295 : -295), 310, 1360), y: 790 },
        ] : [];
        const places = interests[id] ?? [{ x: clamp(anchor.x - 150, 310, 1360), y: 790 }, { x: clamp(anchor.x + 150, 310, 1360), y: 790 }];
        const offset = Math.floor(random(seed, ++choice) * places.length);
        for (let i = 0; i < places.length; i++) candidates.push(places[(offset + i) % places.length]);
        const target = candidates.find(point => {
          const walkEnd = cursor + durationFor(current, point);
          const backEnd = walkEnd + durationFor(point, anchor) + .25;
          return !samePoint(current, point) && distance(current, point) >= 70 && walkEnd < limit && (!hasDirectorNext || backEnd <= end) && safePath(scene, plan, id, current, point, cursor, walkEnd) && (!hasDirectorNext || safePath(scene, plan, id, point, anchor, end - durationFor(point, anchor) - .25, end - .25));
        });
        if (!target) continue;
        const walkEnd = cursor + durationFor(current, target);
        segments.push({ start: cursor, end: walkEnd, from: current, to: target, activity: social && candidates.indexOf(target) < 2 ? 'approach' : 'explore' });
        current = target;
        cursor = walkEnd;
      }
      if (hasDirectorNext && !samePoint(current, anchor)) {
        const returnStart = Math.max(cursor, end - durationFor(current, anchor) - .25);
        if (returnStart > cursor) segments.push({ start: cursor, end: returnStart, from: current, to: current, activity: 'rest' });
        const returnEnd = Math.min(end, returnStart + durationFor(current, anchor));
        if (returnEnd <= end && safePath(scene, plan, id, current, anchor, returnStart, returnEnd)) {
          segments.push({ start: returnStart, end: returnEnd, from: current, to: anchor, activity: 'return' });
          cursor = returnEnd;
          current = anchor;
        }
      }
      if (cursor < end) segments.push({ start: cursor, end, from: current, to: current, activity: 'rest' });
    }
  }
  return plan;
}

type PlaceChoice = { key: string; point: Point; affinity: number; social?: boolean };
const homePlaces: Record<string, PlaceChoice[]> = {
  max: [
    { key: 'window', point: { x: 390, y: 790 }, affinity: 1.2 },
    { key: 'rug-left', point: { x: 650, y: 790 }, affinity: 1 },
    { key: 'rug-middle', point: { x: 790, y: 790 }, affinity: .65 },
  ],
  maxine: [
    { key: 'rug-right', point: { x: 960, y: 790 }, affinity: 1.1 },
    { key: 'sofa-front', point: { x: 1110, y: 790 }, affinity: .8 },
    { key: 'bookshelf', point: { x: 1280, y: 790 }, affinity: 1 },
  ],
};

/** V1.1 keeps V1's clock and collision model, but plans fewer purposeful trips. */
function buildPolishedPlan(scene: TimedScene): Plan {
  const plan: Plan = {};
  const ids = Object.keys(scene.characters).sort();
  for (const id of ids) {
    const seed = hash(`${scene.id}:${id}:v1.1`);
    const prefs = scene.livingWorld?.preferences?.[id] ?? defaults[id] ?? fallback;
    const segments: Segment[] = [];
    plan[id] = segments;
    const recent: string[] = [];
    let choice = 0;
    let lastApproach = -Infinity;
    const edges = boundaries(scene, id);
    for (let interval = 0; interval < edges.length - 1; interval++) {
      const start = edges[interval], end = edges[interval + 1];
      const baseline = stateAt(scene, id, (start + end) / 2);
      if (end - start < 3 || !baseline.visible || baseline.gestureFrame || baseline.greetingV3 || directorBusy(scene, id, (start + end) / 2)) continue;
      const anchor = stateAt(scene, id, start).point;
      const hasDirectorNext = end < scene.duration - .001;
      let current = anchor;
      let cursor = start;
      while (cursor + 5 < (hasDirectorNext && !samePoint(current, anchor) ? end - durationFor(current, anchor) - .25 : end)) {
        const moveLimit = hasDirectorNext && !samePoint(current, anchor) ? end - durationFor(current, anchor) - .25 : end;
        const pause = 5.2 + random(seed, ++choice) * 6.2 + (1 - prefs.activity) * 2.2;
        const pauseEnd = Math.min(moveLimit, cursor + pause);
        segments.push({ start: cursor, end: pauseEnd, from: current, to: current, activity: random(seed, ++choice) < prefs.curiosity ? 'observe' : 'rest' });
        cursor = pauseEnd;
        if (cursor + 6.2 >= moveLimit || random(seed, ++choice) > .16 + prefs.activity * .37) continue;

        const places = homePlaces[id] ?? [
          { key: 'near-left', point: { x: clamp(anchor.x - 170, 310, 1360), y: 790 }, affinity: .9 },
          { key: 'near-right', point: { x: clamp(anchor.x + 170, 310, 1360), y: 790 }, affinity: .9 },
        ];
        const candidates = [...places];
        const otherId = ids.find(other => other !== id);
        if (otherId && cursor - lastApproach > 16 && random(seed, ++choice) < prefs.sociability) {
          const other = plannedPoint(scene, plan, otherId, cursor + 2);
          const side = current.x >= other.x ? 1 : -1;
          const horizon = Math.min(end, cursor + 18);
          let nearestExtent = other.x;
          for (let sample = cursor; sample <= horizon; sample += .5) {
            const x = plannedPoint(scene, plan, otherId, sample).x;
            nearestExtent = side > 0 ? Math.max(nearestExtent, x) : Math.min(nearestExtent, x);
          }
          candidates.push({ key: `near-${otherId}`, point: { x: clamp(nearestExtent + side * 300, 310, 1360), y: 790 }, affinity: 1.2, social: true });
        }
        const anticipation = .27, settle = .34, minimumDwell = 4.8;
        const scored = candidates.map((candidate, index) => {
          const walkStart = cursor + anticipation;
          const walkEnd = walkStart + durationFor(current, candidate.point);
          const returnDuration = hasDirectorNext ? durationFor(candidate.point, anchor) : 0;
          const returnStart = end - returnDuration - .25;
          const usable = distance(current, candidate.point) >= (candidate.social ? 90 : 115)
            && walkEnd + settle + minimumDwell <= returnStart
            && safePath(scene, plan, id, current, candidate.point, walkStart, walkEnd, 285)
            && safeStay(scene, plan, id, candidate.point, walkEnd, returnStart, 285)
            && (!hasDirectorNext || safePath(scene, plan, id, candidate.point, anchor, returnStart, end - .25, 285));
          const repeatPenalty = recent.includes(candidate.key) ? 1.6 : 0;
          const score = candidate.affinity + random(seed, choice * 17 + index) * .65 - distance(current, candidate.point) / 950 - repeatPenalty;
          return { candidate, score, usable, walkStart, walkEnd };
        }).filter(item => item.usable).sort((a, b) => b.score - a.score);
        const selected = scored[0];
        if (!selected || selected.score < .35) continue;
        const { candidate, walkStart, walkEnd } = selected;
        segments.push({ start: cursor, end: walkStart, from: current, to: current, activity: 'anticipate' });
        segments.push({ start: walkStart, end: walkEnd, from: current, to: candidate.point, activity: candidate.social ? 'approach' : 'explore' });
        const facing = directionTo(current, candidate.point, baseline.direction);
        segments.push({ start: walkEnd, end: walkEnd + settle, from: candidate.point, to: candidate.point, activity: 'settle', facing });
        current = candidate.point;
        cursor = walkEnd + settle;
        recent.push(candidate.key);
        if (recent.length > 2) recent.shift();
        if (candidate.social) lastApproach = cursor;
      }
      if (hasDirectorNext && !samePoint(current, anchor)) {
        const travel = durationFor(current, anchor);
        const returnStart = end - travel - .25;
        if (returnStart >= cursor && safePath(scene, plan, id, current, anchor, returnStart, end - .25, 285)) {
          if (cursor < returnStart) segments.push({ start: cursor, end: returnStart, from: current, to: current, activity: 'rest' });
          segments.push({ start: returnStart, end: end - .25, from: current, to: anchor, activity: 'return' });
          segments.push({ start: end - .25, end, from: anchor, to: anchor, activity: 'settle', facing: directionTo(current, anchor, baseline.direction) });
          cursor = end;
          current = anchor;
        }
      }
      if (cursor < end) segments.push({ start: cursor, end, from: current, to: current, activity: 'rest' });
    }
  }
  return plan;
}

export function livingWorldAt(scene: TimedScene, id: string, time: number): WorldState {
  const base = stateAt(scene, id, time);
  if (!scene.livingWorld?.enabled || scene.placeId !== 'living-room' || !base.visible || base.gestureFrame || directorBusy(scene, id, time)) return { state: base, activity: 'rest', autonomous: false };
  let plan = plans.get(scene);
  if (!plan) { plan = scene.livingWorld?.mode === 'v1.1' ? buildPolishedPlan(scene) : buildPlan(scene); plans.set(scene, plan); }
  const segment = plan[id]?.find(item => item.start <= time && time < item.end);
  if (!segment) return { state: base, activity: 'rest', autonomous: false };
  const point = pointDuring(segment, time);
  if (segment.activity === 'rest' || segment.activity === 'observe' || segment.activity === 'anticipate') {
    const expression = segment.activity === 'anticipate' ? { anchor: 'foot' as const, scaleY: 1 - .006 * smooth((time - segment.start) / (segment.end - segment.start)) } : undefined;
    return { state: { ...base, point, pose: 'idle', frame: 0, expression }, activity: segment.activity, autonomous: true };
  }
  if (segment.activity === 'settle') return { state: { ...base, point, pose: 'side', frame: 0, direction: segment.facing ?? base.direction }, activity: 'settle', autonomous: true };
  const direction = directionTo(segment.from, segment.to, base.direction);
  const travelled = distance(segment.from, point);
  return { state: { ...base, point, pose: 'side', frame: travelled < 1 ? 0 : frameForDistance(id as 'max' | 'maxine', travelled), direction }, activity: segment.activity, autonomous: true };
}
