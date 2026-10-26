export const UNITY_REVIEW_SCENE = 'Assets/Scenes/StudioLivingRoomExperimental.unity';

export type UnityPreviewStartupStage = 'Idle' | 'Launching Unity' | 'Loading Project' | 'Opening Scene' | 'Entering Play Mode' | 'Connecting' | 'Ready' | 'Failed';
export type UnityPreviewEditorStatus = { state: 'Editor Ready' | 'Starting' | 'Playing' | 'Stopping' | 'Error'; detail?: string; activeScenePath?: string };

export type UnityPreviewStartupDependencies = {
  launch: (signal: AbortSignal) => Promise<{ status: 'started' | 'reused'; processId: number }>;
  getEditorStatus: (signal: AbortSignal) => Promise<UnityPreviewEditorStatus>;
  openScene: (signal: AbortSignal) => Promise<void>;
  startPlayMode: (signal: AbortSignal) => Promise<void>;
  connectBridge: (signal: AbortSignal) => Promise<void>;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  now: () => number;
};

export type UnityPreviewStartupOptions = {
  editorTimeoutMs?: number;
  playTimeoutMs?: number;
  bridgeTimeoutMs?: number;
  pollIntervalMs?: number;
};

function isAbort(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError'; }
function isCompileDelay(error: unknown): boolean {
  return error instanceof Error && /compil(?:e|ing)|import(?:ing)? assets|Editor is updating/i.test(error.message);
}

export function createUnityPreviewStarter(
  dependencies: UnityPreviewStartupDependencies,
  options: UnityPreviewStartupOptions = {},
) {
  const editorTimeoutMs = options.editorTimeoutMs ?? 180000;
  const playTimeoutMs = options.playTimeoutMs ?? 90000;
  const bridgeTimeoutMs = options.bridgeTimeoutMs ?? 45000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  let active: Promise<void> | null = null;

  async function waitForEditorReady(signal: AbortSignal, deadline: number, onStage: (stage: UnityPreviewStartupStage, detail?: string) => void) {
    let lastError: unknown;
    while (dependencies.now() < deadline) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      let status: UnityPreviewEditorStatus;
      try { status = await dependencies.getEditorStatus(signal); }
      catch (error) {
        if (isAbort(error)) throw error;
        if (error instanceof Error && ((error.name === 'UnityEditorControlError' && !isCompileDelay(error)) || /authentication|origin rejected|unsupported|port \d+ is unavailable/i.test(error.message))) throw error;
        lastError = error;
        onStage('Loading Project', error instanceof Error ? error.message : undefined);
        await dependencies.sleep(pollIntervalMs, signal);
        continue;
      }
      if (status.state === 'Error') throw new Error(status.detail || 'Unity Editor reported an error.');
      return status;
    }
    throw new Error(lastError instanceof Error
      ? `Unity Editor did not finish loading within ${Math.ceil(editorTimeoutMs / 1000)} seconds. ${lastError.message}`
      : `Unity Editor did not finish loading within ${Math.ceil(editorTimeoutMs / 1000)} seconds. Check Unity's compile/import progress, then retry.`);
  }

  async function run(signal: AbortSignal, onStage: (stage: UnityPreviewStartupStage, detail?: string) => void) {
    try {
      onStage('Launching Unity');
      await dependencies.launch(signal);

      onStage('Loading Project');
      await waitForEditorReady(signal, dependencies.now() + editorTimeoutMs, onStage);

      onStage('Opening Scene');
      const sceneDeadline = dependencies.now() + editorTimeoutMs;
      while (true) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        try { await dependencies.openScene(signal); break; }
        catch (error) {
          if (!isCompileDelay(error) || dependencies.now() >= sceneDeadline) throw error;
          onStage('Loading Project', error instanceof Error ? error.message : undefined);
          await dependencies.sleep(pollIntervalMs, signal);
          onStage('Opening Scene');
        }
      }

      onStage('Entering Play Mode');
      const playDeadline = dependencies.now() + playTimeoutMs;
      while (true) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        try { await dependencies.startPlayMode(signal); break; }
        catch (error) {
          if (!isCompileDelay(error) || dependencies.now() >= playDeadline) throw error;
          onStage('Loading Project', error instanceof Error ? error.message : undefined);
          await dependencies.sleep(pollIntervalMs, signal);
          onStage('Entering Play Mode');
        }
      }
      let playing = false;
      while (dependencies.now() < playDeadline) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const current = await dependencies.getEditorStatus(signal);
        if (current.state === 'Error') throw new Error(current.detail || 'Unity Editor reported an error while entering Play Mode.');
        if (current.state === 'Playing') { playing = true; break; }
        await dependencies.sleep(pollIntervalMs, signal);
      }
      if (!playing) throw new Error(`Unity did not confirm Play Mode within ${Math.ceil(playTimeoutMs / 1000)} seconds.`);
      const playingStatus = await dependencies.getEditorStatus(signal);
      if (playingStatus.activeScenePath && playingStatus.activeScenePath !== UNITY_REVIEW_SCENE) {
        throw new Error(`Unity entered Play Mode in '${playingStatus.activeScenePath}', not the Cartoon Preview scene. Stop safely, then retry.`);
      }

      onStage('Connecting');
      const bridgeDeadline = dependencies.now() + bridgeTimeoutMs;
      let lastBridgeError: unknown;
      while (dependencies.now() < bridgeDeadline) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        try { await dependencies.connectBridge(signal); onStage('Ready'); return; }
        catch (error) {
          if (isAbort(error)) throw error;
          if (!(error instanceof TypeError || (error instanceof Error && /unavailable|not ready|not updating|disconnected|timeout|health/i.test(error.message)))) throw error;
          lastBridgeError = error;
          await dependencies.sleep(pollIntervalMs, signal);
        }
      }
      throw new Error(lastBridgeError instanceof Error
        ? `Unity is playing Cartoon Preview, but the 17844 runtime bridge did not become ready: ${lastBridgeError.message}`
        : 'Unity is playing Cartoon Preview, but the 17844 runtime bridge did not become ready in time.');
    } catch (error) {
      if (!isAbort(error)) onStage('Failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  return {
    start(signal: AbortSignal, onStage: (stage: UnityPreviewStartupStage, detail?: string) => void) {
      if (active) return active;
      active = run(signal, onStage).finally(() => { active = null; });
      return active;
    },
  };
}
