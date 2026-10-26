import { describe, expect, it, vi } from 'vitest';
import { ensureEpisodeUnityReady, runEpisodePreviewWorkflow, type EpisodePreviewRun, type EpisodePreviewStage, type EpisodePreviewWorkflowOps } from './episodeUnityOrchestration';
import type { EpisodePreviewStatus } from './episodeUnityOrchestration';

const ready: EpisodePreviewStatus = { state: 'Editor Ready', isPlaying: false };
const playing: EpisodePreviewStatus = { state: 'Playing', isPlaying: true };
const controller = () => new AbortController();

describe('one-click Unity episode preview orchestration', () => {
  it('reuses an already-playing Editor and waits for delayed runtime bridge readiness', async () => {
    let bridgeAttempts = 0;
    const stages: string[] = [];
    await ensureEpisodeUnityReady({
      signal: controller().signal, onStage: stage => stages.push(stage),
      getEditorStatus: async () => playing, startEditor: vi.fn(),
      connectBridge: async () => { if (++bridgeAttempts < 3) throw new TypeError('not ready'); },
      sleep: async () => undefined,
    });
    expect(stages).toEqual(['waiting-for-bridge']);
    expect(bridgeAttempts).toBe(3);
  });

  it('starts a stopped Editor, waits for confirmed Play Mode, then bridge readiness', async () => {
    let polls = 0; const stages: EpisodePreviewStage[] = [];
    await ensureEpisodeUnityReady({
      signal: controller().signal, onStage: stage => stages.push(stage),
      getEditorStatus: async () => ++polls < 2 ? { state: 'Starting', isPlaying: false } : playing,
      startEditor: async () => ({ state: 'Starting', isPlaying: false }),
      connectBridge: async () => undefined, sleep: async () => undefined,
    });
    expect(stages).toEqual(['starting-unity', 'waiting-for-bridge']);
    expect(polls).toBe(2);
  });

  it('explains that a closed Editor must be opened with the review launcher', async () => {
    await expect(ensureEpisodeUnityReady({ signal: controller().signal, onStage: () => undefined,
      getEditorStatus: async () => { throw new TypeError('connection refused'); } }))
      .rejects.toThrow('Start the BrightTales Unity project with Start-BrightTales-Review.cmd');
  });

  it('surfaces start rejection and bounded bridge timeout', async () => {
    await expect(ensureEpisodeUnityReady({ signal: controller().signal, onStage: () => undefined,
      getEditorStatus: async () => ready, startEditor: async () => ({ state: 'Error', isPlaying: false, detail: 'compile error' }) }))
      .rejects.toThrow('compile error');
    let now = 0;
    await expect(ensureEpisodeUnityReady({ signal: controller().signal, onStage: () => undefined,
      getEditorStatus: async () => playing, connectBridge: async () => { throw new TypeError('bridge down'); },
      now: () => now, bridgeTimeoutMs: 1500, sleep: async ms => { now += ms; } }))
      .rejects.toThrow('runtime bridge did not become ready');
  });

  it('prevents duplicate preview runs while a preparation is in flight', async () => {
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const first = workflow({ validate: () => wait });
    const pending = runEpisodePreviewWorkflow(first);
    await expect(runEpisodePreviewWorkflow(workflow())).rejects.toThrow('already being prepared');
    release(); await pending;
  });

  it('resets the previous run and acknowledges transfer and playback in order', async () => {
    const events: string[] = [];
    const previous: EpisodePreviewRun = { runId: 'b'.repeat(32), episodeId: 'old', revision: 'c'.repeat(64) };
    const result = await runEpisodePreviewWorkflow(workflow({ previousRun: previous,
      resetPrevious: async () => { events.push('reset'); },
      load: async () => { events.push('load'); }, waitUntilLoaded: async () => { events.push('loaded'); },
      play: async () => { events.push('play-from-zero'); }, confirmPlaying: async () => { events.push('confirmed-playing'); return 'playing'; },
    }));
    expect(events).toEqual(['reset', 'load', 'loaded', 'play-from-zero', 'confirmed-playing']);
    expect(result.status).toBe('playing');
  });

  it('does not play after transfer failure and cleans up an unconfirmed load', async () => {
    const play = vi.fn();
    await expect(runEpisodePreviewWorkflow(workflow({ prepare: async () => { throw new Error('audio transfer failed'); }, play })))
      .rejects.toThrow('audio transfer failed');
    expect(play).not.toHaveBeenCalled();
    const cleanup = vi.fn();
    await expect(runEpisodePreviewWorkflow(workflow({ load: async () => { throw new Error('load rejected'); }, cleanup })))
      .rejects.toThrow('load rejected');
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('resets Unity when audio preparation or playback confirmation fails', async () => {
    const cleanup = vi.fn(); const play = vi.fn();
    await expect(runEpisodePreviewWorkflow(workflow({ waitUntilLoaded: async () => { throw new Error('audio decode rejected'); }, play, cleanup })))
      .rejects.toThrow('audio decode rejected');
    expect(play).not.toHaveBeenCalled(); expect(cleanup).toHaveBeenCalledOnce();
    const playbackCleanup = vi.fn();
    await expect(runEpisodePreviewWorkflow(workflow({ confirmPlaying: async () => { throw new Error('playback not confirmed'); }, cleanup: playbackCleanup })))
      .rejects.toThrow('playback not confirmed');
    expect(playbackCleanup).toHaveBeenCalledOnce();
  });

  it('cancels safely during audio preparation before submitting the episode', async () => {
    const abort = controller(); const cleanup = vi.fn(); const load = vi.fn();
    await expect(runEpisodePreviewWorkflow(workflow({ signal: abort.signal,
      prepare: async () => { abort.abort(); return 'payload'; }, load, cleanup })))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(load).not.toHaveBeenCalled(); expect(cleanup).not.toHaveBeenCalled();
  });
});

function workflow(overrides: Partial<EpisodePreviewWorkflowOps<string>> = {}): EpisodePreviewWorkflowOps<string> {
  return {
    signal: controller().signal, onStage: () => undefined, validate: async () => undefined,
    ensureReady: async () => undefined, prepare: async () => 'payload',
    makeRun: () => ({ runId: 'a'.repeat(32), episodeId: 'episode-1', revision: 'd'.repeat(64) }),
    resetPrevious: async () => undefined, load: async () => undefined, waitUntilLoaded: async () => undefined,
    play: async () => undefined, confirmPlaying: async () => 'playing', cleanup: async () => undefined,
    ...overrides,
  };
}
