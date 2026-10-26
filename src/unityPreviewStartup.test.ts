import { describe, expect, it, vi } from 'vitest';
import { createUnityPreviewStarter, UNITY_REVIEW_SCENE, type UnityPreviewStartupDependencies } from './unityPreviewStartup';

function setup(overrides: Partial<UnityPreviewStartupDependencies> = {}) {
  let now = 0;
  const launch = vi.fn<UnityPreviewStartupDependencies['launch']>(async () => ({ status: 'started', processId: 42 }));
  const getEditorStatus = vi.fn<UnityPreviewStartupDependencies['getEditorStatus']>(async () => ({ state: 'Editor Ready', activeScenePath: UNITY_REVIEW_SCENE }));
  const openScene = vi.fn(async () => {});
  const startPlayMode = vi.fn(async () => {});
  const connectBridge = vi.fn(async () => {});
  const sleep = vi.fn(async (ms: number) => { now += ms; });
  const dependencies: UnityPreviewStartupDependencies = {
    launch, getEditorStatus, openScene, startPlayMode, connectBridge, sleep, now: () => now,
    ...overrides,
  };
  return { dependencies, launch, getEditorStatus, openScene, startPlayMode, connectBridge, sleep, now: () => now };
}

describe('Cartoon Preview automatic Unity startup', () => {
  it.each(['started', 'reused'] as const)('opens the review scene, confirms Play Mode, reconnects, then reports Ready when Unity is %s', async launchState => {
    const state = setup();
    state.launch.mockResolvedValue({ status: launchState, processId: launchState === 'started' ? 41 : 42 });
    state.getEditorStatus
      .mockResolvedValueOnce({ state: 'Editor Ready', activeScenePath: '' })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE });
    state.connectBridge.mockRejectedValueOnce(new Error('Unity Play mode is not updating yet.'));
    const stages: string[] = [];
    const starter = createUnityPreviewStarter(state.dependencies, { pollIntervalMs: 1 });
    await starter.start(new AbortController().signal, stage => stages.push(stage));
    expect(state.launch).toHaveBeenCalledOnce();
    expect(state.openScene).toHaveBeenCalledOnce();
    expect(state.startPlayMode).toHaveBeenCalledOnce();
    expect(state.connectBridge).toHaveBeenCalledTimes(2);
    expect(stages).toEqual(['Launching Unity', 'Loading Project', 'Opening Scene', 'Entering Play Mode', 'Connecting', 'Ready']);
  });

  it('waits through Unity compilation/import delay before opening the scene', async () => {
    const state = setup();
    state.openScene.mockRejectedValueOnce(new Error('Unity is compiling or importing assets.'));
    state.getEditorStatus
      .mockResolvedValueOnce({ state: 'Editor Ready' })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE });
    const stages: string[] = [];
    await createUnityPreviewStarter(state.dependencies, { pollIntervalMs: 10 }).start(new AbortController().signal, stage => stages.push(stage));
    expect(state.openScene).toHaveBeenCalledTimes(2);
    expect(stages).toContain('Loading Project');
  });

  it('retries Editor status while Unity is compiling or importing', async () => {
    const state = setup();
    const compileDelay = Object.assign(new Error('Unity Editor is compiling or importing assets.'), { name: 'UnityEditorControlError' });
    state.getEditorStatus.mockRejectedValueOnce(compileDelay)
      .mockResolvedValueOnce({ state: 'Editor Ready', activeScenePath: UNITY_REVIEW_SCENE })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE });
    const stages: string[] = [];
    await createUnityPreviewStarter(state.dependencies, { pollIntervalMs: 10 }).start(new AbortController().signal, stage => stages.push(stage));
    expect(state.getEditorStatus).toHaveBeenCalledTimes(4);
    expect(stages).toContain('Loading Project');
  });

  it('waits through compilation/import delay before requesting Play Mode', async () => {
    const state = setup();
    state.startPlayMode.mockRejectedValueOnce(new Error('Unity is compiling scripts.'));
    state.getEditorStatus
      .mockResolvedValueOnce({ state: 'Editor Ready', activeScenePath: UNITY_REVIEW_SCENE })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE });
    const stages: string[] = [];
    await createUnityPreviewStarter(state.dependencies, { pollIntervalMs: 10 }).start(new AbortController().signal, stage => stages.push(stage));
    expect(state.startPlayMode).toHaveBeenCalledTimes(2);
    expect(stages).toContain('Loading Project');
  });

  it('times out with a useful project-loading failure and allows a retry', async () => {
    let fail = true;
    const state = setup({
      launch: vi.fn<UnityPreviewStartupDependencies['launch']>(async () => {
        if (fail) throw new Error('Trusted launcher could not start Unity.');
        return { status: 'reused', processId: 42 };
      }),
    });
    const starter = createUnityPreviewStarter(state.dependencies, { editorTimeoutMs: 20, pollIntervalMs: 10 });
    const firstStages: string[] = [];
    await expect(starter.start(new AbortController().signal, stage => firstStages.push(stage))).rejects.toThrow('Trusted launcher could not start Unity');
    expect(firstStages.at(-1)).toBe('Failed');
    fail = false;
    state.getEditorStatus
      .mockResolvedValueOnce({ state: 'Editor Ready', activeScenePath: '' })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE });
    await starter.start(new AbortController().signal, () => {});
  });

  it('reports a bounded timeout if the Editor control never becomes ready', async () => {
    const state = setup({ getEditorStatus: vi.fn<UnityPreviewStartupDependencies['getEditorStatus']>(async () => { throw new TypeError('Editor disconnected'); }) });
    const stages: string[] = [];
    const starter = createUnityPreviewStarter(state.dependencies, { editorTimeoutMs: 25, pollIntervalMs: 10 });
    await expect(starter.start(new AbortController().signal, stage => stages.push(stage))).rejects.toThrow('did not finish loading within 1 seconds');
    expect(stages.at(-1)).toBe('Failed');
  });

  it('reports a runtime bridge timeout instead of claiming Ready', async () => {
    const state = setup({ connectBridge: vi.fn<UnityPreviewStartupDependencies['connectBridge']>(async () => { throw new TypeError('bridge disconnected'); }) });
    state.getEditorStatus
      .mockResolvedValueOnce({ state: 'Editor Ready' })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: UNITY_REVIEW_SCENE });
    const stages: string[] = [];
    const starter = createUnityPreviewStarter(state.dependencies, { bridgeTimeoutMs: 25, pollIntervalMs: 10 });
    await expect(starter.start(new AbortController().signal, stage => stages.push(stage))).rejects.toThrow('17844 runtime bridge did not become ready');
    expect(stages).not.toContain('Ready');
    expect(stages.at(-1)).toBe('Failed');
  });

  it('deduplicates simultaneous clicks and rejects a different scene without connecting', async () => {
    const state = setup();
    state.getEditorStatus.mockResolvedValueOnce({ state: 'Editor Ready' })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: 'Assets/Scenes/Other.unity' })
      .mockResolvedValueOnce({ state: 'Playing', activeScenePath: 'Assets/Scenes/Other.unity' });
    const starter = createUnityPreviewStarter(state.dependencies);
    const controller = new AbortController();
    const one = starter.start(controller.signal, () => {});
    const two = starter.start(controller.signal, () => {});
    expect(two).toBe(one);
    await expect(one).rejects.toThrow('not the Cartoon Preview scene');
    expect(state.launch).toHaveBeenCalledOnce();
    expect(state.connectBridge).not.toHaveBeenCalled();
  });
});
