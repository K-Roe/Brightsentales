import { Point } from './scene';

export type Direction = -1 | 1;
export type Motion = {
  direction: Direction;
  distance: number;
  turnUntil: number;
  stopUntil: number;
  moving: boolean;
};

export const WALK_SPEED = 235;
export const TURN_MS = 110;
export const STOP_MS = 110;
export const FRAME_DISTANCE = 29;

export function directionTo(from: Point, to: Point, previous: Direction): Direction {
  return Math.abs(to.x - from.x) < 1 ? previous : to.x > from.x ? 1 : -1;
}

export function frameForDistance(distance: number): number {
  return 1 + Math.floor(Math.max(0, distance) / FRAME_DISTANCE) % 4;
}
