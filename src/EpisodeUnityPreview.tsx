import { useEffect, useRef, useState } from 'react';
import type { AudioAsset } from './audio';
import { episodePlaybackClips } from './audioPlayback';
import type { Episode } from './episodes';
import type { TimedLibrary } from './timedScenes';
import { prepareStudioEpisode, studioEpisodeCommand, studioEpisodeRevision, validateStudioEpisodeForUnity, type StudioEpisodeAction } from './studioEpisodeBridge';
import { studioSceneCommand } from './studioSceneBridge';
import { ensureEpisodeUnityReady, runEpisodePreviewWorkflow, type EpisodePreviewRun, type EpisodePreviewStage } from './episodeUnityOrchestration';
import type { Brightling } from './maker';

const storageKey = 'brighttales.studio-episode.preview';
type Run = { runId: string; episodeId: string; revision: string };
function storedRun(): Run | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Run | null;
    return value && /^[a-f0-9]{32}$/.test(value.runId) && /^[a-f0-9]{64}$/.test(value.revision) ? value : null;
  } catch { return null; }
}
function storedSceneRun(): { runId: string; sceneId: string; revision: string } | null {
  try {
    const runId = sessionStorage.getItem('brighttales.studio-scene.run') ?? '';
    const sceneId = sessionStorage.getItem('brighttales.studio-scene.scene') ?? '';
    const revision = sessionStorage.getItem('brighttales.studio-scene.revision') ?? '';
    return /^[a-f0-9]{32}$/.test(runId) && /^[a-f0-9-]{36}$/.test(sceneId) && /^[a-f0-9]{64}$/.test(revision) ? { runId, sceneId, revision } : null;
  } catch { return null; }
}

const labels: Record<EpisodePreviewStage, string> = {
  ready: 'Ready', validating: 'Validating episode', 'starting-unity': 'Starting Unity Play Mode', 'waiting-for-bridge': 'Waiting for Unity bridge',
  transferring: 'Transferring episode', 'starting-playback': 'Preparing playback', playing: 'Playing', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled',
};
const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
  const abort = () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
});

export default function EpisodeUnityPreview({ episode, scenes, characters, audioAssets, saved }: {
  episode: Episode; scenes: TimedLibrary; characters: Brightling[]; audioAssets: AudioAsset[]; saved: boolean;
}) {
  const [run, setRun] = useState<Run | null>(storedRun);
  const [phase, setPhase] = useState<EpisodePreviewStage>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [message, setMessage] = useState(saved ? 'Preview the saved episode in Unity with one click.' : 'Save the episode before previewing it in Unity.');
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const current = useRef({ run, episode, scenes, characters, audioAssets, saved });
  current.current = { run, episode, scenes, characters, audioAssets, saved };
  useEffect(() => () => pending.current?.abort(), []);

  const updateRun = (next: Run | null) => {
    setRun(next);
    try { if (next) sessionStorage.setItem(storageKey, JSON.stringify(next)); else sessionStorage.removeItem(storageKey); } catch { /* Current component keeps the run. */ }
  };

  const reportStage = (stage: EpisodePreviewStage) => {
    setPhase(stage);
    const text = stage === 'ready' ? 'Ready to preview the saved episode.' :
      stage === 'validating' ? 'Checking scenes, camera targets, custom Brightlings and audio references.' :
      stage === 'starting-unity' ? 'Asking Unity to enter Play Mode and waiting for confirmation.' :
      stage === 'waiting-for-bridge' ? 'Unity is playing. Waiting for its runtime bridge.' :
      stage === 'transferring' ? 'Preparing custom Brightlings and sending the episode.' :
      stage === 'starting-playback' ? 'Unity received the episode. Preparing audio and playback.' :
      stage === 'playing' ? 'Unity confirmed episode playback.' : stage === 'completed' ? 'Unity confirmed the episode completed.' : message;
    setMessage(text);
  };

  const preview = async () => {
    if (pending.current || !current.current.saved) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setPhase('validating'); setMessage('Checking scenes, camera targets, custom Brightlings and audio references.');
    try {
      const state = current.current;
      let definitions: Awaited<ReturnType<typeof validateStudioEpisodeForUnity>> = [];
      const result = await runEpisodePreviewWorkflow({
        signal: controller.signal,
        previousRun: state.run,
        onStage: reportStage,
        validate: async () => { definitions = await validateStudioEpisodeForUnity(state.episode, state.scenes, state.audioAssets, state.characters); },
        ensureReady: () => ensureEpisodeUnityReady({ signal: controller.signal, onStage: reportStage }),
        prepare: () => prepareStudioEpisode(state.episode, state.scenes, state.audioAssets, controller.signal, fetch, window.location.origin, state.characters, definitions),
        makeRun: async config => ({ runId: crypto.randomUUID().replaceAll('-', ''), episodeId: state.episode.id, revision: await studioEpisodeRevision(config) }),
        resetPrevious: async previous => {
          if (previous) {
            try { await studioEpisodeCommand('reset', previous.runId, previous.episodeId, controller.signal, { revision: previous.revision }); }
            catch (error) {
              if (!(error instanceof Error && error.message.includes('Unknown saved scene run ID'))) throw new Error(`Unity could not reset the previous episode preview: ${error instanceof Error ? error.message : String(error)}. Use Reset in the troubleshooting controls, then try again.`);
            }
            updateRun(null);
          }
          const previousScene = storedSceneRun();
          if (previousScene) {
            try { await studioSceneCommand('reset', previousScene.runId, previousScene.sceneId, controller.signal, { revision: previousScene.revision }); }
            catch (error) {
              if (!(error instanceof Error && error.message.includes('Unknown saved scene run ID'))) throw new Error(`Unity could not reset the previous scene preview: ${error instanceof Error ? error.message : String(error)}. Reset that preview in Unity Connection, then retry.`);
            }
            for (const key of ['brighttales.studio-scene.run', 'brighttales.studio-scene.scene', 'brighttales.studio-scene.revision']) sessionStorage.removeItem(key);
          }
        },
        load: async (next, config) => {
          const loaded = await studioEpisodeCommand('load', next.runId, next.episodeId, controller.signal, { config });
          updateRun({ ...next, revision: loaded.revision });
        },
        waitUntilLoaded: async next => {
          const deadline = Date.now() + 60_000;
          while (Date.now() < deadline) {
            const currentState = await studioEpisodeCommand('status', next.runId, next.episodeId, controller.signal, { revision: next.revision });
            setElapsed(currentState.elapsed); setSceneIndex(currentState.sceneIndex);
            if (currentState.status === 'loaded') return;
            if (currentState.status !== 'loading') throw new Error('Unity rejected the loaded episode before playback could start.');
            await sleep(500, controller.signal);
          }
          throw new Error('Unity did not finish preparing the episode audio within 60 seconds.');
        },
        play: async next => { await studioEpisodeCommand('play', next.runId, next.episodeId, controller.signal, { revision: next.revision }); },
        confirmPlaying: async next => {
          const deadline = Date.now() + 5_000;
          while (Date.now() < deadline) {
            const currentState = await studioEpisodeCommand('status', next.runId, next.episodeId, controller.signal, { revision: next.revision });
            setElapsed(currentState.elapsed); setSceneIndex(currentState.sceneIndex);
            if (currentState.status === 'playing') return 'playing' as const;
            if (currentState.status === 'complete') return 'completed' as const;
            if (currentState.status !== 'loaded') throw new Error('Unity accepted the play request but did not confirm that playback started.');
            await sleep(250, controller.signal);
          }
          throw new Error('Unity accepted the play request but did not confirm that playback started.');
        },
        cleanup: async next => { await studioEpisodeCommand('reset', next.runId, next.episodeId, new AbortController().signal, { revision: next.revision }); updateRun(null); },
      });
      const finalRun = { ...result.run };
      updateRun(finalRun);
      if (result.status === 'playing') setMessage('Unity confirmed episode playback.');
      else setMessage('Unity confirmed the episode completed.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setPhase('cancelled'); setMessage('Preview cancelled. Unity was left in a safe stopped or loaded state.');
      } else {
        setPhase('failed');
        setMessage(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      setBusy(false);
    }
  };

  const execute = async (action: StudioEpisodeAction) => {
    if (pending.current || !run) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true);
    try {
      const reply = await studioEpisodeCommand(action, run.runId, run.episodeId, controller.signal, { revision: run.revision });
      setElapsed(reply.elapsed); setSceneIndex(reply.sceneIndex);
      if (action === 'reset') updateRun(null);
      setPhase(reply.status === 'playing' ? 'playing' : reply.status === 'complete' ? 'completed' : 'ready');
      setMessage(action === 'reset' ? 'Unity confirmed the preview reset.' : `Unity confirmed ${action}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { if (pending.current === controller) pending.current = null; setBusy(false); }
  };

  const cancel = () => pending.current?.abort();
  useEffect(() => {
    if (!run || phase !== 'playing' || busy) return;
    const timer = window.setInterval(() => {
      if (pending.current) return;
      const controller = new AbortController(); pending.current = controller;
      void studioEpisodeCommand('status', run.runId, run.episodeId, controller.signal, { revision: run.revision })
        .then(reply => {
          setElapsed(reply.elapsed); setSceneIndex(reply.sceneIndex);
          if (reply.status === 'complete') { setPhase('completed'); setMessage('Unity confirmed the episode completed.'); }
          else if (reply.status !== 'playing') { setPhase('failed'); setMessage('Unity stopped reporting episode playback. Check Unity and retry the preview.'); }
        })
        .catch(error => { setPhase('failed'); setMessage(error instanceof Error ? error.message : String(error)); })
        .finally(() => { if (pending.current === controller) pending.current = null; });
    }, 800);
    return () => window.clearInterval(timer);
  }, [run, phase, busy]);

  const availableAudio = new Set(audioAssets.map(asset => asset.id));
  const missingAudio = [...new Set(episodePlaybackClips(episode, scenes).map(clip => clip.assetId))].filter(id => !availableAudio.has(id));
  return <section className="episode-unity-preview" aria-label="Unity episode preview">
    <div className="episode-section-heading"><div><h2>Preview Episode in Unity</h2><p>Unity starts automatically, loads the saved cast and audio, then plays from the beginning.</p></div></div>
    {!saved && <p role="status">Save this episode before previewing it in Unity.</p>}
    {missingAudio.length > 0 && <p role="alert">An episode audio file is missing. Restore it in Audio Library before previewing.</p>}
    <div className="scene-actions">
      <button type="button" className="scene-primary" disabled={!saved || busy || missingAudio.length > 0} onClick={() => void preview()}>{busy ? labels[phase] : 'Preview Episode in Unity'}</button>
      {busy && <button type="button" onClick={cancel}>Cancel preparation</button>}
    </div>
    <p role="status"><strong>{labels[phase]}:</strong> {message} {run && `${elapsed.toFixed(1)}s · scene ${sceneIndex + 1} of ${episode.sceneIds.length}`}</p>
    <details className="preview-diagnostics"><summary>Unity preview controls and troubleshooting</summary>
      <p>Use these controls to inspect or stop a preview. If Unity Editor is closed, start it with <code>Start-BrightTales-Review.cmd</code>.</p>
      <div className="scene-actions">
        <button type="button" disabled={!run || busy || !['ready', 'completed'].includes(phase)} onClick={() => void execute('play')}>Play / Replay</button>
        <button type="button" disabled={!run || busy || phase !== 'playing'} onClick={() => void execute('pause')}>Pause</button>
        <button type="button" disabled={!run || busy || phase !== 'playing'} onClick={() => void execute('stop')}>Stop at beginning</button>
        <button type="button" disabled={!run || busy} onClick={() => void execute('reset')}>Reset Unity preview</button>
      </div>
      <p><small>Unity episode preview supports saved scenes with up to four saved modular Brightlings plus supported scene and episode audio. Intros, credits and Bright Speak remain available in Studio playback.</small></p>
    </details>
  </section>;
}
