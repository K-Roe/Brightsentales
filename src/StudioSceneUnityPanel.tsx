import { useEffect, useRef, useState } from 'react';
import type { TimedLibrary } from './timedScenes';
import { studioSceneCommand, studioSceneConfig } from './studioSceneBridge';

/** Developer preview of saved Scene Maker data; the fixed approved V1.1 panel stays available. */
export default function StudioSceneUnityPanel({ connected, library }: { connected: boolean; library: TimedLibrary }) {
  const [selectedId, setSelectedId] = useState('');
  const [runId, setRunId] = useState(() => { try { return sessionStorage.getItem('brighttales.studio-scene.run') ?? ''; } catch { return ''; } });
  const [loadedId, setLoadedId] = useState(() => { try { return sessionStorage.getItem('brighttales.studio-scene.scene') ?? ''; } catch { return ''; } });
  const [revision, setRevision] = useState(() => { try { return sessionStorage.getItem('brighttales.studio-scene.revision') ?? ''; } catch { return ''; } });
  const [phase, setPhase] = useState<'idle' | 'loaded' | 'playing' | 'complete' | 'unknown'>(() => {
    try { return sessionStorage.getItem('brighttales.studio-scene.run') ? 'unknown' : 'idle'; } catch { return 'idle'; }
  });
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState('Select a saved Scene Maker scene. Open StudioLivingRoomExperimental in Unity Play mode.');
  const pending = useRef<AbortController | null>(null);
  const selected = library.scenes.find(scene => scene.id === selectedId);

  useEffect(() => () => pending.current?.abort(), []);

  const execute = async (action: 'load' | 'play' | 'status' | 'reset') => {
    if (!connected || pending.current) return;
    const scene = action === 'load' ? selected : library.scenes.find(item => item.id === loadedId);
    if (!scene) { setMessage('Choose a saved scene before sending.'); return; }
    let config;
    if (action === 'load') {
      try { config = studioSceneConfig(scene); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Scene is not supported by Unity.'); return; }
    }
    const id = action === 'load' ? crypto.randomUUID().replaceAll('-', '') : runId;
    const controller = new AbortController(); pending.current = controller;
    if (action === 'load') {
      setRunId(id); setLoadedId(scene.id); setPhase('unknown');
      try { sessionStorage.setItem('brighttales.studio-scene.run', id); sessionStorage.setItem('brighttales.studio-scene.scene', scene.id); } catch { /* Current tab still retains the run. */ }
    }
    setMessage(`Waiting for Unity to ${action} the saved scene…`);
    try {
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
      setMessage(`Unity reports ${reply.status} for “${scene.name}” (revision ${reply.revision.slice(0, 12)}) at ${reply.elapsed.toFixed(1)} / ${reply.duration.toFixed(1)} seconds.`);
    } catch (error) {
      if (pending.current !== controller) return;
      setPhase('unknown');
      setMessage(`${error instanceof Error ? error.message : 'Unity did not complete this request.'} Check Unity Play mode and status before sending another run.`);
    } finally { if (pending.current === controller) pending.current = null; }
  };

  useEffect(() => {
    if (!connected || phase !== 'playing' || !runId || !loadedId) return;
    const timer = window.setInterval(() => {
      if (pending.current) return;
      void execute('status');
    }, 600);
    return () => window.clearInterval(timer);
    // execute reads the latest component state on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, phase, runId, loadedId]);

  return <section aria-labelledby="studio-unity-heading">
    <p className="eyebrow">EXPERIMENTAL · SAVED SCENE TRANSFER</p>
    <h2 id="studio-unity-heading">Send a saved Scene Maker scene</h2>
    <p>Phase 1 supports the approved Living Room, Max/Maxine and Appear, Walk, Wait, Wave and Disappear. Other features show a reason before transfer.</p>
    <label>Saved scene <select aria-label="Saved scene for Unity" value={selectedId} disabled={!!runId || !!pending.current} onChange={event => setSelectedId(event.target.value)}>
      <option value="">Choose a saved scene</option>
      {library.scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
    </select></label>
    <div className="scene-actions">
      <button type="button" disabled={!connected || !selected || !!runId || !!pending.current} onClick={() => void execute('load')}>Send saved scene</button>
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
    {runId && <p><small>Run {runId.slice(0, 8)} · {phase} · {elapsed.toFixed(1)} / {duration.toFixed(1)} s</small></p>}
  </section>;
}
