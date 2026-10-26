import { connectToUnity, getUnityEditorStatus, startUnityEditor, UnityBridgeUnavailableError, type UnityEditorStatus } from './unityBridge';

export type EpisodePreviewStage = 'ready' | 'validating' | 'starting-unity' | 'waiting-for-bridge' | 'transferring' | 'starting-playback' | 'playing' | 'completed' | 'failed' | 'cancelled';
export type EpisodePreviewStatus = { state: UnityEditorStatus; isPlaying: boolean; detail?: string };

export type EpisodeUnityOrchestration = {
  signal: AbortSignal;
  onStage: (stage: EpisodePreviewStage) => void;
  getEditorStatus?: (signal: AbortSignal) => Promise<EpisodePreviewStatus>;
  startEditor?: (signal: AbortSignal) => Promise<EpisodePreviewStatus>;
  connectBridge?: (signal: AbortSignal) => Promise<unknown>;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  editorTimeoutMs?: number;
  bridgeTimeoutMs?: number;
};

export type EpisodePreviewRun = { runId: string; episodeId: string; revision: string };
export type EpisodePreviewWorkflowOps<Prepared> = {
  signal: AbortSignal;
  previousRun?: EpisodePreviewRun | null;
  onStage: (stage: EpisodePreviewStage) => void;
  validate: () => Promise<void>;
  ensureReady: () => Promise<void>;
  prepare: () => Promise<Prepared>;
  makeRun: (prepared: Prepared) => EpisodePreviewRun | Promise<EpisodePreviewRun>;
  resetPrevious: (run: EpisodePreviewRun | null | undefined) => Promise<void>;
  load: (run: EpisodePreviewRun, prepared: Prepared) => Promise<void>;
  waitUntilLoaded: (run: EpisodePreviewRun) => Promise<void>;
  play: (run: EpisodePreviewRun) => Promise<void>;
  confirmPlaying: (run: EpisodePreviewRun) => Promise<'playing' | 'completed'>;
  cleanup: (run: EpisodePreviewRun) => Promise<void>;
};

let episodePreviewActive = false;

/** Single-flight orchestration around the existing episode bridge, used by the one-click Studio action. */
export async function runEpisodePreviewWorkflow<Prepared>(ops: EpisodePreviewWorkflowOps<Prepared>): Promise<{ run: EpisodePreviewRun; status: 'playing' | 'completed' }> {
  if (episodePreviewActive) throw new Error('An episode preview is already being prepared.');
  episodePreviewActive = true;
  let run: EpisodePreviewRun | null = null;
  let loadRequested = false;
  try {
    if (ops.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    ops.onStage('validating'); await ops.validate();
    if (ops.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    await ops.ensureReady();
    if (ops.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    ops.onStage('transferring'); const prepared = await ops.prepare();
    if (ops.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    await ops.resetPrevious(ops.previousRun);
    if (ops.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    run = await ops.makeRun(prepared);
    ops.onStage('transferring'); loadRequested = true; await ops.load(run, prepared);
    ops.onStage('starting-playback'); await ops.waitUntilLoaded(run);
    if (ops.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    await ops.play(run);
    const status = await ops.confirmPlaying(run);
    ops.onStage(status === 'completed' ? 'completed' : 'playing');
    return { run, status };
  } catch (error) {
    if (run && loadRequested) {
      try { await ops.cleanup(run); } catch { /* Keep Unity's acknowledged run available for manual reset. */ }
    }
    throw error;
  } finally { episodePreviewActive = false; }
}

export function waitForEpisodeUnity(signal: AbortSignal, options: Pick<EpisodeUnityOrchestration, 'sleep'> = {}): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return (options.sleep ?? defaultSleep)(500, signal);
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    const abort = () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
}

/** Starts the already-open BrightTales Editor when needed and confirms the existing runtime bridge. */
export async function ensureEpisodeUnityReady(options: EpisodeUnityOrchestration): Promise<void> {
  const { signal, onStage } = options;
  const status = options.getEditorStatus ?? getUnityEditorStatus;
  const start = options.startEditor ?? startUnityEditor;
  const connect = options.connectBridge ?? connectToUnity;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const editorTimeout = options.editorTimeoutMs ?? 45_000;

  let editor: EpisodePreviewStatus;
  try { editor = await status(signal); }
  catch (error) {
    if (error instanceof TypeError) throw new Error('Unity Editor is not available. Start the BrightTales Unity project with Start-BrightTales-Review.cmd, then try again.');
    throw error;
  }
  throwIfAborted(signal);
  if (editor.state === 'Error') throw new Error(editor.detail || 'Unity Editor control reported an error.');
  if (editor.state === 'Editor Ready') {
    onStage('starting-unity');
    editor = await start(signal);
    if (editor.state === 'Error') throw new Error(editor.detail || 'Unity rejected the Play Mode request.');
  } else if (editor.state === 'Stopping') {
    onStage('starting-unity');
    const end = now() + editorTimeout;
    while (editor.state !== 'Editor Ready' && now() < end) {
      throwIfAborted(signal);
      editor = await status(signal);
      if (editor.state === 'Error') throw new Error(editor.detail || 'Unity Editor control reported an error.');
      if (editor.state !== 'Editor Ready') await sleep(500, signal);
    }
    if (editor.state !== 'Editor Ready') throw new Error('Unity did not finish leaving Play Mode. Try Stop Unity, then preview again.');
    editor = await start(signal);
  }

  if (editor.state !== 'Playing') {
    onStage('starting-unity');
    const end = now() + editorTimeout;
    while (now() < end) {
      throwIfAborted(signal);
      editor = await status(signal);
      if (editor.state === 'Playing' && editor.isPlaying) break;
      if (editor.state === 'Error') throw new Error(editor.detail || 'Unity Editor reported an error while starting Play Mode.');
      await sleep(500, signal);
    }
  }
  if (editor.state !== 'Playing' || !editor.isPlaying) throw new Error('Unity did not confirm Play Mode within 45 seconds.');

  onStage('waiting-for-bridge');
  const bridgeEnd = now() + (options.bridgeTimeoutMs ?? 30_000);
  let lastError: unknown;
  while (now() < bridgeEnd) {
    throwIfAborted(signal);
    try { await connect(signal); return; }
    catch (error) {
      lastError = error;
      if (!(error instanceof TypeError || error instanceof UnityBridgeUnavailableError)) throw error;
      await sleep(750, signal);
    }
  }
  throw new Error(lastError instanceof Error
    ? `Unity entered Play Mode, but the runtime bridge did not become ready: ${lastError.message}`
    : 'Unity entered Play Mode, but the runtime bridge did not become ready within 30 seconds.');
}
