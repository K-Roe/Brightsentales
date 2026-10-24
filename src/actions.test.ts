import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { newAction, poseAt, validateActionLibrary } from './actions';
import { drawMaxActionRig, MAX_NEUTRAL_ART_URL, MAX_RIG_EDITABLE } from './actionRig';

describe('Action Creator data and evaluation', () => {
  it('keeps the failed cut-out rig unavailable and uses approved neutral art', () => {
    expect(MAX_RIG_EDITABLE).toBe(false);
    expect(MAX_NEUTRAL_ART_URL).toBe('/art/max-0.png');
    const source = {} as HTMLImageElement;
    const calls: unknown[][] = [];
    drawMaxActionRig({ drawImage: (...args: unknown[]) => calls.push(args) } as unknown as CanvasRenderingContext2D, source, 0, 0, 434, 724);
    expect(calls).toEqual([[source, 0, 0, 434, 724]]);
  });
  it('interpolates between authored poses without moving the end points', () => {
    const action = newAction();
    action.keyframes[1].pose['arm-left'] = 60;
    expect(poseAt(action, 0)['arm-left']).toBe(0);
    expect(poseAt(action, 1)['arm-left']).toBe(30);
    expect(poseAt(action, 2)['arm-left']).toBe(60);
    expect(Math.abs(poseAt(action, 0.001)['arm-left'] - poseAt(action, 0)['arm-left'])).toBeLessThan(0.001);
    expect(Math.abs(poseAt(action, 1.999)['arm-left'] - poseAt(action, 2)['arm-left'])).toBeLessThan(0.001);
  });

  it('rejects unsorted, missing-end and unsupported poses', () => {
    const action = newAction();
    expect(validateActionLibrary({ version: 1, actions: [action] }).ok).toBe(true);
    action.keyframes[1].time = 1;
    expect(validateActionLibrary({ version: 1, actions: [action] }).ok).toBe(false);
    action.keyframes[1].time = 2;
    action.keyframes[1].pose['hand-right'] = 90;
    expect(validateActionLibrary({ version: 1, actions: [action] }).ok).toBe(false);
  });

  it('loads the three AC-01 import fixtures and returns each to its neutral pose', () => {
    for (const filename of ['max-one-arm-wave', 'max-reach-and-return', 'max-both-arms-excited']) {
      const action = JSON.parse(readFileSync(new URL(`../proofs/ac-01/test-actions/${filename}.json`, import.meta.url), 'utf8'));
      expect(validateActionLibrary({ version: 1, actions: [action] }).ok).toBe(true);
      expect(poseAt(action, action.duration)).toEqual(poseAt(action, 0));
    }
  });
});
