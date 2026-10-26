import { useEffect, useRef, useState } from 'react';
import type { AudioAsset } from './audio';
import { episodePlaybackClips } from './audioPlayback';
import type { Episode } from './episodes';
import type { TimedLibrary } from './timedScenes';
import { prepareStudioEpisode, studioEpisodeCommand, type StudioEpisodeAction, type StudioEpisodeReply } from './studioEpisodeBridge';
import { connectToUnity } from './unityBridge';
import type { Brightling } from './maker';

const storageKey = 'brighttales.studio-episode.preview';
type Run = { runId: string; episodeId: string; revision: string };
function storedRun(): Run | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Run | null;
    return value && /^[a-f0-9]{32}$/.test(value.runId) && /^[a-f0-9]{64}$/.test(value.revision) ? value : null;
  } catch { return null; }
}

export default function EpisodeUnityPreview({ episode, scenes, characters, audioAssets, saved }: {
  episode: Episode; scenes: TimedLibrary; characters: Brightling[]; audioAssets: AudioAsset[]; saved: boolean;
}) {
  const [run, setRun] = useState<Run | null>(storedRun);
  const [phase, setPhase] = useState<StudioEpisodeReply['status'] | 'unknown'>(run ? 'unknown' : 'idle');
  const [elapsed, setElapsed] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [message, setMessage] = useState(saved ? 'Send the saved episode to Unity when the preview scene is open.' : 'Save the episode, then preview it in Unity.');
  const pending = useRef<AbortController | null>(null);
  const current = useRef({ run, episode, scenes, characters, audioAssets, saved });
  current.current = { run, episode, scenes, characters, audioAssets, saved };
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { if (!run && phase === 'idle') setMessage(saved ? 'Send the saved episode to Unity when the preview scene is open.' : 'Save the episode, then preview it in Unity.'); }, [saved, run, phase]);

  const execute = async (action: StudioEpisodeAction) => {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    const state = current.current;
    const target = action === 'load' ? state.episode.id : state.run?.episodeId;
    const id = action === 'load' ? crypto.randomUUID().replaceAll('-', '') : state.run?.runId;
    if (!target || !id || action === 'load' && !state.saved) {
      pending.current = null; setMessage('Save the episode before sending it to Unity.'); return;
    }
    setMessage(action === 'load' ? 'Preparing the saved episode and its audio…' : `Unity: ${action}…`);
    try {
      if (action === 'load') await connectToUnity(controller.signal);
      const config = action === 'load' ? await prepareStudioEpisode(state.episode, state.scenes, state.audioAssets, controller.signal, fetch, window.location.origin, state.characters) : undefined;
      const reply = await studioEpisodeCommand(action, id, target, controller.signal,
        action === 'load' ? { config } : { revision: state.run?.revision });
      if (pending.current !== controller) return;
      if (action === 'load') {
        const next = { runId: id, episodeId: target, revision: reply.revision };
        setRun(next);
        try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Current tab keeps the run. */ }
      } else if (action === 'reset') {
        setRun(null);
        try { sessionStorage.removeItem(storageKey); } catch { /* Current tab is reset. */ }
      }
      setPhase(reply.status); setElapsed(reply.elapsed); setSceneIndex(reply.sceneIndex);
      setMessage(reply.status === 'loading' ? 'Unity is loading the episode audio.' :
        reply.status === 'playing' ? `Playing scene ${reply.sceneIndex + 1} of ${state.episode.sceneIds.length}.` :
        reply.status === 'paused' ? 'Episode paused.' :
        reply.status === 'complete' ? 'Episode complete. Press Play to replay.' :
        reply.status === 'loaded' ? 'Episode ready. Press Play.' : 'Preview reset.');
    } catch (error) {
      if (pending.current === controller) {
        setPhase('unknown');
        setMessage(error instanceof Error ? error.message : String(error));
      }
    } finally { if (pending.current === controller) pending.current = null; }
  };

  useEffect(() => {
    if (!run || phase !== 'playing' && phase !== 'loading') return;
    const timer = window.setInterval(() => { if (!pending.current) void execute('status'); }, 600);
    return () => window.clearInterval(timer);
    // Polling reads the latest run through current.current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, phase]);

  const busy = !!pending.current;
  const otherRun = run && run.episodeId !== episode.id;
  const availableAudio = new Set(audioAssets.map(asset => asset.id));
  const missingAudio = [...new Set(episodePlaybackClips(episode, scenes).map(clip => clip.assetId))]
    .filter(id => !availableAudio.has(id));
  return <section className="episode-unity-preview" aria-label="Unity episode preview">
    <div className="episode-section-heading"><div><h2>Preview full episode in Unity</h2><p>Scenes cut in sequence; episode music continues across scene changes.</p></div></div>
    {otherRun && <p role="status">Another saved episode is loaded. Reset it before sending this one.</p>}
    {missingAudio.length > 0 && <p role="status">Waiting for saved audio. If it stays unavailable, restore the missing file in Audio Library.</p>}
    <div className="scene-actions">
      <button type="button" disabled={!saved || !!run || busy || missingAudio.length > 0} onClick={() => void execute('load')}>Send saved episode</button>
      <button type="button" disabled={!run || busy || !['loaded', 'paused', 'complete'].includes(phase)} onClick={() => void execute('play')}>Play / Replay</button>
      <button type="button" disabled={!run || busy || phase !== 'playing'} onClick={() => void execute('pause')}>Pause</button>
      <button type="button" disabled={!run || busy || !['loaded', 'paused', 'playing', 'complete'].includes(phase)} onClick={() => void execute('stop')}>Stop</button>
      <button type="button" disabled={!run || busy} onClick={() => void execute('reset')}>Reset</button>
      {run && phase === 'unknown' && <button type="button" onClick={() => void execute('status')}>Check status</button>}
      {run && phase === 'unknown' && <button type="button" onClick={() => {
        if (!window.confirm('Only forget this preview after Unity has stopped or been reset. Forget it locally?')) return;
        setRun(null); setPhase('idle'); setElapsed(0); setSceneIndex(0);
        try { sessionStorage.removeItem(storageKey); } catch { /* Current tab is cleared. */ }
      }}>Forget local run</button>}
    </div>
    <p role="status">{message} {run && `${elapsed.toFixed(1)}s · scene ${sceneIndex + 1}`}</p>
    <p><small>Unity preview supports saved Living Room scenes with up to four saved modular Brightlings, Max or Maxine, plus supported scene and episode audio. Intros, credits and Bright Speak remain available in Studio playback.</small></p>
  </section>;
}
