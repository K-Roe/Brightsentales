import { describe, expect, it } from 'vitest';
import { readWorkspace, saveWorkspace, WORKSPACE_KEY } from './workspacePreference';

describe('workspace preference', () => {
  it('defaults to Studio 3.0 without writing or interpreting invalid scene data', () => {
    const values = new Map([[WORKSPACE_KEY, 'unknown'], ['brightsenappstales.timed-scenes.v1', 'invalid scene']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    expect(readWorkspace(storage)).toBe('studio3');
    expect(values.get('brightsenappstales.timed-scenes.v1')).toBe('invalid scene');
  });

  it('persists Classic and restores it after a fresh read', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(saveWorkspace('classic', storage)).toBe(true);
    expect(readWorkspace(storage)).toBe('classic');
    expect(values.size).toBe(1);
  });

  it('keeps a usable session default when browser storage is unavailable', () => {
    expect(readWorkspace({ getItem: () => { throw Error('blocked'); } })).toBe('studio3');
    expect(saveWorkspace('classic', { setItem: () => { throw Error('blocked'); } })).toBe(false);
  });
});
