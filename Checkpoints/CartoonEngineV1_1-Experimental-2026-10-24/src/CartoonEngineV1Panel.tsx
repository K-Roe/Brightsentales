import { useEffect, useRef, useState } from 'react';
import { livingRoomUnityConfig, livingRoomUnityPolishedConfig, unitySceneCommand, UnityBridgeTimeoutError, type UnitySceneConfig, type UnitySceneReply, type UnityLivingRoomSceneId } from './unityBridge';

type Camera = UnitySceneConfig['camera'];

/** Temporary review controls; Scene Maker and its saved timeline remain authoritative. */
export default function CartoonEngineV1Panel({ connected }: { connected: boolean }) {
  const [camera, setCamera] = useState<Camera>({ shot: 'wide', focus: 'both' });
  const [variant, setVariant] = useState<'v1' | 'v1_1'>(() => {
    try { return sessionStorage.getItem('brighttales.cartoon-v1.variant') === 'v1_1' ? 'v1_1' : 'v1'; } catch { return 'v1'; }
  });
  const sceneId: UnityLivingRoomSceneId = variant === 'v1_1' ? 'max-maxine-living-room-v1-1' : 'max-maxine-living-room-v1';
  const [runId, setRunId] = useState(() => { try { return sessionStorage.getItem('brighttales.cartoon-v1.run-id') ?? ''; } catch { return ''; } });
  const [phase, setPhase] = useState<'idle' | 'loading' | 'loaded' | 'playing' | 'complete' | 'error'>(() => {
    try { return sessionStorage.getItem('brighttales.cartoon-v1.run-id') ? 'error' : 'idle'; } catch { return 'idle'; }
  });
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState(() => {
    try { return sessionStorage.getItem('brighttales.cartoon-v1.run-id')
      ? 'A prior run may still be active in Unity. Connect and Check status before resetting or sending another scene.'
      : 'Open Cartoon Living Room V1 in Unity Play mode.'; }
    catch { return 'Open Cartoon Living Room V1 in Unity Play mode.'; }
  });
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);

  const sendScene = async () => {
    if (!connected || pending.current || runId) return;
    const id = crypto.randomUUID().replaceAll('-', '');
    try { sessionStorage.setItem('brighttales.cartoon-v1.run-id', id); } catch { /* Recovery still available until this tab closes. */ }
    try { sessionStorage.setItem('brighttales.cartoon-v1.variant', variant); } catch { /* Storage may be disabled. */ }
    const controller = new AbortController(); pending.current = controller;
    setRunId(id); setPhase('loading'); setElapsed(0);
    setMessage('Sending validated Living Room scene to Unity…');
    try {
      const result = await unitySceneCommand('load', id, controller.signal, { config: variant === 'v1_1' ? livingRoomUnityPolishedConfig() : livingRoomUnityConfig(camera.shot, camera.focus) });
      if (pending.current !== controller) return;
      if (result.status !== 'loaded') throw new Error('Unity did not load the scene.');
      setPhase('loaded'); setMessage('Unity loaded Max, Maxine and the Living Room. Press Play scene.');
    } catch (error) {
      if (pending.current !== controller) return;
      setPhase('error'); setMessage(error instanceof Error ? error.message : 'Unity could not load the scene.');
      if (!(error instanceof TypeError) && !(error instanceof UnityBridgeTimeoutError)) {
        setRunId('');
        try { sessionStorage.removeItem('brighttales.cartoon-v1.run-id'); } catch { /* Storage may be disabled. */ }
        try { sessionStorage.removeItem('brighttales.cartoon-v1.variant'); } catch { /* Storage may be disabled. */ }
      }
    } finally { if (pending.current === controller) pending.current = null; }
  };

  const playScene = async () => {
    if (!connected || pending.current || phase !== 'loaded') return;
    const controller = new AbortController(); pending.current = controller;
    setMessage('Asking Unity to start the 26-second cartoon…');
    try {
      const started = await unitySceneCommand('play', runId, controller.signal, { sceneId });
      if (pending.current !== controller) return;
      if (started.status !== 'playing') throw new Error('Unity did not start playback.');
      setPhase('playing'); setMessage('Unity playback started. Waiting for Unity to report completion.');
      const deadline = Date.now() + 40000;
      while (Date.now() < deadline && !controller.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const report: UnitySceneReply = await unitySceneCommand('status', runId, controller.signal, { sceneId });
        if (pending.current !== controller) return;
        setElapsed(report.elapsed);
        if (report.status === 'complete') {
          setPhase('complete'); setMessage('Unity completed the 26-second cartoon. Watch the Game view for visual review.');
          return;
        }
        if (report.status !== 'playing') throw new Error(`Unity reported ${report.status} during playback.`);
      }
      throw new Error('Unity did not report completion within 40 seconds. Check Play mode and the scene run before resetting.');
    } catch (error) {
      if (pending.current !== controller) return;
      setPhase('error'); setMessage(`${error instanceof Error ? error.message : 'Playback status is unknown.'} Reconnect, then use Check status with this run ID before resetting.`);
    } finally { if (pending.current === controller) pending.current = null; }
  };

  const checkStatus = async () => {
    if (!connected || !runId || pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    try {
      const report = await unitySceneCommand('status', runId, controller.signal, { sceneId });
      if (pending.current !== controller) return;
      setPhase(report.status === 'idle' ? 'idle' : report.status);
      setElapsed(report.elapsed);
      setMessage(`Unity reports ${report.status} at ${report.elapsed.toFixed(1)} / 26 seconds.`);
    } catch (error) {
      if (pending.current === controller) setMessage(error instanceof Error ? error.message : 'Could not check Unity status.');
    } finally { if (pending.current === controller) pending.current = null; }
  };

  const reset = async () => {
    if (!connected || !runId || (pending.current && phase !== 'playing')) return;
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    try {
      const result = await unitySceneCommand('reset', runId, controller.signal, { sceneId });
      if (pending.current !== controller) return;
      if (result.status !== 'idle') throw new Error('Unity did not reset the scene.');
      setPhase('idle'); setRunId(''); setElapsed(0);
      try { sessionStorage.removeItem('brighttales.cartoon-v1.run-id'); } catch { /* Storage may be disabled. */ }
      try { sessionStorage.removeItem('brighttales.cartoon-v1.variant'); } catch { /* Storage may be disabled. */ }
      setMessage('Unity reset this run. Send a new scene when ready.');
    } catch (error) {
      if (pending.current === controller) setMessage(error instanceof Error ? error.message : 'Could not reset Unity.');
    } finally { if (pending.current === controller) pending.current = null; }
  };

  return <section aria-labelledby="cartoon-engine-v1-heading" style={{ borderTop: '1px solid currentColor', marginTop: 24, paddingTop: 12 }}>
    <p className="eyebrow">EXPERIMENTAL · 2.5D CARTOON ENGINE {variant === 'v1_1' ? 'V1.1' : 'V1'}</p>
    <h2 id="cartoon-engine-v1-heading">Max and Maxine’s Living Room</h2>
    <p>A 26-second Unity review scene using the approved characters and Living Room illustration.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
      <label>Review version <select value={variant} disabled={!!runId || !!pending.current} onChange={event => setVariant(event.target.value as 'v1' | 'v1_1')}>
        <option value="v1">V1 baseline</option><option value="v1_1">V1.1 character polish</option>
      </select></label>
      <label>Starting shot <select value={camera.shot} disabled={variant === 'v1_1' || (phase !== 'idle' && phase !== 'error')} onChange={event => setCamera(value => ({ ...value, shot: event.target.value as Camera['shot'] }))}>
        <option value="wide">Wide</option><option value="medium">Medium</option><option value="close-up">Close-up</option>
      </select></label>
      <label>Focus <select value={camera.focus} disabled={variant === 'v1_1' || (phase !== 'idle' && phase !== 'error')} onChange={event => setCamera(value => ({ ...value, focus: event.target.value as Camera['focus'] }))}>
        <option value="both">Both</option><option value="max">Max</option><option value="maxine">Maxine</option>
      </select></label>
      <button type="button" onClick={sendScene} disabled={!connected || !!pending.current || !!runId || phase === 'loading' || phase === 'loaded' || phase === 'playing'}>Send Scene to Unity</button>
      <button type="button" onClick={playScene} disabled={!connected || phase !== 'loaded' || !!pending.current}>Play scene</button>
      <button type="button" onClick={checkStatus} disabled={!connected || !runId || !!pending.current}>Check status</button>
      <button type="button" onClick={reset} disabled={!connected || !runId || (!!pending.current && phase !== 'playing')}>{phase === 'playing' ? 'Stop / Reset' : 'Reset'}</button>
    </div>
    <p role="status">{message}</p>
    <p><small>Connection: {connected ? 'Connected' : 'Disconnected'} · Unity state: {phase} · Playback: {elapsed.toFixed(1)} / 26 s{runId ? ` · Run ${runId.slice(0, 8)}` : ''}</small></p>
  </section>;
}
