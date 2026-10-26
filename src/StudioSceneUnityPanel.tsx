import { useEffect, useRef, useState } from 'react';
import type { TimedLibrary } from './timedScenes';
import { prepareBrightlings, studioSceneCommand, studioSceneConfig } from './studioSceneBridge';
import { transferStudioAudio } from './studioAudioTransfer';
import type { AudioAsset } from './audio';
import type { Brightling } from './maker';

const friendlyPreviewError = (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  if (/revision|older version/i.test(detail)) return 'This preview has an older version. Reset it, then send your saved scene again.';
  if (/another run|reserved/i.test(detail)) return 'Another preview is still open. Reset that preview before sending this scene.';
  if (/failed to fetch|network|timed out|unavailable/i.test(detail)) return 'The preview engine is unavailable. Open the experimental scene in Unity Play mode, then reconnect.';
  return detail;
};

/** Developer preview of saved Scene Maker data; the fixed approved V1.1 panel stays available. */
export default function StudioSceneUnityPanel({ connected, library, characters, audioAssets, requestedSceneId }: { connected: boolean; library: TimedLibrary; characters: Brightling[]; audioAssets: AudioAsset[]; requestedSceneId?: string | null }) {
  const [selectedId, setSelectedId] = useState('');
  const [runId, setRunId] = useState(() => { try { return sessionStorage.getItem('brighttales.studio-scene.run') ?? ''; } catch { return ''; } });
  const [loadedId, setLoadedId] = useState(() => { try { return sessionStorage.getItem('brighttales.studio-scene.scene') ?? ''; } catch { return ''; } });
  const [revision, setRevision] = useState(() => { try { return sessionStorage.getItem('brighttales.studio-scene.revision') ?? ''; } catch { return ''; } });
  const [phase, setPhase] = useState<'idle' | 'loading' | 'loaded' | 'playing' | 'complete' | 'unknown'>(() => {
    try { return sessionStorage.getItem('brighttales.studio-scene.run') ? 'unknown' : 'idle'; } catch { return 'idle'; }
  });
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState('Select a saved Scene Maker scene. Open StudioLivingRoomExperimental in Unity Play mode.');
  const [diagnostic, setDiagnostic] = useState('');
  const pending = useRef<AbortController | null>(null);
  const selected = library.scenes.find(scene => scene.id === selectedId);
  useEffect(() => { if (requestedSceneId && library.scenes.some(scene => scene.id === requestedSceneId)) setSelectedId(requestedSceneId); }, [requestedSceneId, library]);

  useEffect(() => () => pending.current?.abort(), []);

  const execute = async (action: 'load' | 'play' | 'status' | 'reset') => {
    if (!connected || pending.current) return;
    const scene = action === 'load' ? selected : library.scenes.find(item => item.id === loadedId);
    if (!scene) { setMessage('Choose a saved scene before sending.'); return; }
    const id = action === 'load' ? crypto.randomUUID().replaceAll('-', '') : runId;
    const controller = new AbortController(); pending.current = controller;
    setMessage(action === 'load' ? 'Preparing your cartoon preview…' : action === 'play' ? 'Starting the performance…' : action === 'reset' ? 'Resetting the stage…' : 'Checking the performance…');
    try {
      const media = action === 'load' && scene.audio?.length ? await transferStudioAudio(scene, audioAssets, controller.signal) : undefined;
      const definitions = action === 'load' ? await prepareBrightlings(scene, characters) : [];
      const config = action === 'load' ? studioSceneConfig(scene, media, definitions) : undefined;
      if (action === 'load') {
        setRunId(id); setLoadedId(scene.id); setPhase('unknown');
        try { sessionStorage.setItem('brighttales.studio-scene.run', id); sessionStorage.setItem('brighttales.studio-scene.scene', scene.id); } catch { /* Current tab still retains the run. */ }
      }
      const reply = await studioSceneCommand(action, id, scene.id, controller.signal, action === 'load' ? { config } : { revision });
      if (pending.current !== controller) return;
      if (action === 'load') {
        setRevision(reply.revision);
        try { sessionStorage.setItem('brighttales.studio-scene.revision', reply.revision); } catch { /* Current tab retains the run. */ }
      }
      if (action === 'reset') {
        setRunId(''); setLoadedId(''); setRevision('');
        try { sessionStorage.removeItem('brighttales.studio-scene.run'); sessionStorage.removeItem('brighttales.studio-scene.scene'); sessionStorage.removeItem('brighttales.studio-scene.revision'); } catch { /* Current tab has been reset. */ }
      }
      setPhase(reply.status === 'idle' ? 'idle' : reply.status);
      setElapsed(reply.elapsed); setDuration(reply.duration);
      setDiagnostic(`Scene ${reply.sceneId}; revision ${reply.revision}; run ${reply.runId}; ${reply.status}; ${reply.elapsed.toFixed(1)} / ${reply.duration.toFixed(1)} seconds.`);
      setMessage(reply.status === 'loading' ? 'Loading scene audio in Unity…' : reply.status === 'loaded' ? `“${scene.name}” is ready to play.` : reply.status === 'playing' ? `Playing “${scene.name}”… ${reply.elapsed.toFixed(1)} of ${reply.duration.toFixed(1)} seconds.` : reply.status === 'complete' ? `“${scene.name}” has finished. Reset to play it again.` : 'The stage is reset. Send a saved scene to preview it again.');
    } catch (error) {
      if (pending.current !== controller) return;
      setPhase('unknown');
      setDiagnostic(error instanceof Error ? error.message : String(error));
      setMessage(friendlyPreviewError(error));
    } finally { if (pending.current === controller) pending.current = null; }
  };

  useEffect(() => {
    if (!connected || phase !== 'playing' && phase !== 'loading' || !runId || !loadedId) return;
    const timer = window.setInterval(() => {
      if (pending.current) return;
      void execute('status');
    }, 600);
    return () => window.clearInterval(timer);
    // execute reads the latest component state on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, phase, runId, loadedId]);

  return <section aria-labelledby="studio-unity-heading">
    <p className="eyebrow">CARTOON PREVIEW</p>
    <h2 id="studio-unity-heading">Watch your scene perform</h2>
    <p>Choose a saved scene, send it to the preview stage, then play. Living Room, Max, Maxine, gentle walks, looking toward each other, waves, Camera V1 shots and scene audio clips are supported.</p>
    <label>Saved scene <select aria-label="Saved scene for Unity" value={selectedId} disabled={!!runId || !!pending.current} onChange={event => setSelectedId(event.target.value)}>
      <option value="">Choose a saved scene</option>
      {library.scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
    </select></label>
    <div className="scene-actions">
      <button type="button" disabled={!connected || !selected || !!runId || !!pending.current} onClick={() => void execute('load')}>Send scene to preview</button>
      <button type="button" disabled={!connected || phase !== 'loaded' || !!pending.current} onClick={() => void execute('play')}>Play</button>
      <button type="button" disabled={!connected || !runId || !!pending.current} onClick={() => void execute('status')}>Check status</button>
      <button type="button" disabled={!connected || !runId || !!pending.current} onClick={() => void execute('reset')}>Reset</button>
      {phase === 'unknown' && runId && <button type="button" onClick={() => {
        if (!window.confirm('Only forget this run after checking Unity is stopped or reset. Forget it locally?')) return;
        setRunId(''); setLoadedId(''); setRevision(''); setPhase('idle');
        try { sessionStorage.removeItem('brighttales.studio-scene.run'); sessionStorage.removeItem('brighttales.studio-scene.scene'); sessionStorage.removeItem('brighttales.studio-scene.revision'); } catch { /* Storage may be unavailable. */ }
      }}>Forget local run</button>}
    </div>
    <p role="status">{message}</p>
    {runId && <p><small>{phase} · {elapsed.toFixed(1)} / {duration.toFixed(1)} s</small></p>}
    <details className="preview-diagnostics"><summary>Developer diagnostics</summary><p>{diagnostic || 'No command details yet.'}</p></details>
  </section>;
}
