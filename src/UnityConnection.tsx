import { useEffect, useRef, useState } from 'react';
import { blinkMaxInUnity, connectToUnity, getUnityEditorStatus, launchUnityReview, openUnityPreviewScene, pingUnity, sendActingCommandToUnity, startUnityEditor, stopUnityEditor, UnityBridgeUnavailableError, UnityEditorControlError, UNITY_BRIDGE_URL, type ActingCharacter, type ActingCommand, type UnityEditorStatus } from './unityBridge';
import { createUnityPreviewStarter, UNITY_REVIEW_SCENE, type UnityPreviewStartupStage } from './unityPreviewStartup';
import PortalV1Panel from './PortalV1Panel';
import CartoonEngineV1Panel from './CartoonEngineV1Panel';
import StudioSceneUnityPanel from './StudioSceneUnityPanel';
import type { AudioAsset } from './audio';
import type { TimedLibrary } from './timedScenes';
import type { Brightling } from './maker';

type Status = 'disconnected' | 'connecting' | 'connected' | 'pinging' | 'commanding';

function waitForSignal(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

export default function UnityConnection({ scenes, characters, audioAssets, requestedSceneId, onStatusChange }: { scenes: TimedLibrary; characters: Brightling[]; audioAssets: AudioAsset[]; requestedSceneId?: string | null; onStatusChange?: (status: 'connected' | 'disconnected') => void }) {
  const [status, setStatus] = useState<Status>('disconnected');
  const [message, setMessage] = useState('Connection is off.');
  const [actor, setActor] = useState<ActingCharacter>('max');
  const [action, setAction] = useState<ActingCommand['action']>('look_at');
  const [target, setTarget] = useState<ActingCharacter>('maxine');
  const [editorStatus, setEditorStatus] = useState<UnityEditorStatus | 'Disconnected'>('Disconnected');
  const [editorBusy, setEditorBusy] = useState(false);
  const [startupStage, setStartupStage] = useState<UnityPreviewStartupStage>('Idle');
  const [startupDetail, setStartupDetail] = useState('');
  const pending = useRef<AbortController | null>(null);
  const previewStarter = useRef<ReturnType<typeof createUnityPreviewStarter> | null>(null);

  if (!previewStarter.current) {
    previewStarter.current = createUnityPreviewStarter({
      launch: signal => launchUnityReview(signal),
      getEditorStatus: signal => getUnityEditorStatus(signal),
      openScene: async signal => {
        const reply = await openUnityPreviewScene(signal);
        if (reply.activeScenePath !== UNITY_REVIEW_SCENE) throw new Error(`Unity did not confirm the ${UNITY_REVIEW_SCENE} scene. No preview was sent.`);
      },
      startPlayMode: async signal => { await startUnityEditor(signal); },
      connectBridge: async signal => {
        if (UNITY_BRIDGE_URL !== 'http://127.0.0.1:17844') throw new Error('Cartoon Preview requires bridge port 17844. Start Studio with Start-BrightTales-Review.cmd; legacy port 17843 is not used.');
        await connectToUnity(signal);
      },
      sleep: waitForSignal,
      now: () => Date.now(),
    });
  }

  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  useEffect(() => { onStatusChange?.(status === 'connected' ? 'connected' : 'disconnected'); }, [status, onStatusChange]);
  useEffect(() => () => onStatusChange?.('disconnected'), [onStatusChange]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const reply = await getUnityEditorStatus(controller.signal);
        if (active) setEditorStatus(reply.state);
        if (active && reply.state === 'Error' && reply.detail) setMessage(reply.detail);
      } catch (error) {
        if (active && error instanceof UnityEditorControlError) { setEditorStatus('Error'); setMessage(error.message); }
        else if (active) setEditorStatus('Disconnected');
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 2500);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, []);

  const waitForEditor = async (wanted: 'Playing' | 'Editor Ready', signal: AbortSignal, timeoutMs = 45000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const reply = await getUnityEditorStatus(signal);
      setEditorStatus(reply.state);
      if (reply.state === 'Error') throw new Error(reply.detail || 'Unity Editor reported an error.');
      if (reply.state === wanted) return;
      await waitForSignal(500, signal);
    }
    throw new Error(wanted === 'Playing' ? 'Unity did not confirm Play Mode within 45 seconds.' : 'Unity did not confirm that it left Play Mode within 45 seconds.');
  };

  const startEditor = async () => {
    const controller = new AbortController();
    pending.current?.abort();
    pending.current = controller;
    setEditorBusy(true);
    setEditorStatus('Starting');
    setStartupDetail('');
    setMessage('Starting the trusted BrightTales Unity launcher.');
    try {
      await previewStarter.current!.start(controller.signal, (stage, detail) => {
        if (pending.current !== controller) return;
        setStartupStage(stage);
        setStartupDetail(detail || '');
        if (stage === 'Connecting') setStatus('connecting');
        if (stage === 'Ready') { setEditorStatus('Playing'); setStatus('connected'); }
        const messages: Record<UnityPreviewStartupStage, string> = {
          Idle: 'Ready to start Cartoon Preview.',
          'Launching Unity': 'Checking for the correct Unity project and launching it if needed…',
          'Loading Project': detail || 'Unity is loading or compiling the BrightTales project…',
          'Opening Scene': 'Opening StudioLivingRoomExperimental in Unity…',
          'Entering Play Mode': 'Unity confirmed the preview scene. Entering Play Mode…',
          Connecting: 'Play Mode is confirmed. Connecting to the 17844 runtime bridge…',
          Ready: 'Cartoon Preview is ready. Studio is connected to Unity.',
          Failed: detail || 'Unity startup failed. Check the message and retry.',
        };
        setMessage(messages[stage]);
      });
      if (pending.current !== controller) return;
      setEditorStatus('Playing');
      setStatus('connected');
      setStartupStage('Ready');
      setMessage('Cartoon Preview is ready. Studio is connected to Unity.');
    } catch (error) {
      if (pending.current !== controller) return;
      setStatus('disconnected');
      const detail = error instanceof Error ? error.message : String(error);
      setStartupStage('Failed');
      setStartupDetail(detail);
      setMessage(detail);
      try {
        const latest = await getUnityEditorStatus(new AbortController().signal);
        setEditorStatus(latest.state);
      } catch (latestError) {
        if (latestError instanceof UnityEditorControlError) { setEditorStatus('Error'); setMessage(latestError.message); }
        else setEditorStatus('Disconnected');
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      setEditorBusy(false);
    }
  };
  const stopEditor = async () => {
    const controller = new AbortController();
    pending.current?.abort();
    pending.current = controller;
    setEditorBusy(true);
    setEditorStatus('Stopping');
    setMessage('Asking Unity to leave Play Mode…');
    try {
      const accepted = await stopUnityEditor(controller.signal);
      if (accepted.state === 'Error') throw new Error(accepted.detail || 'Unity could not stop Play Mode.');
      await waitForEditor('Editor Ready', controller.signal);
      if (pending.current !== controller) return;
      setStatus('disconnected');
      setEditorStatus('Editor Ready');
      setStartupStage('Idle');
      setStartupDetail('');
      setMessage('Unity confirmed Edit Mode. The runtime bridge has stopped.');
    } catch (error) {
      if (pending.current !== controller) return;
      setMessage(error instanceof TypeError
        ? 'Unity Editor control is unavailable. If Unity is closed, start it with the review launcher.'
        : error instanceof Error ? error.message : String(error));
      try {
        const latest = await getUnityEditorStatus(new AbortController().signal);
        setEditorStatus(latest.state);
      } catch (latestError) {
        if (latestError instanceof UnityEditorControlError) { setEditorStatus('Error'); setMessage(latestError.message); }
        else setEditorStatus('Disconnected');
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      setEditorBusy(false);
    }
  };

  const disconnect = () => {
    pending.current?.abort();
    pending.current = null;
    setStatus('disconnected');
    setMessage('Disconnected.');
  };

  const connect = async () => {
    const controller = new AbortController();
    pending.current = controller;
    setStatus('connecting');
    setMessage('Connecting to Unity…');
    try {
      await connectToUnity(controller.signal);
      if (pending.current !== controller) return;
      setStatus('connected');
      setMessage('Connected to Unity. Ready for Ping.');
    } catch (error) {
      if (pending.current !== controller) return;
      setStatus('disconnected');
      setMessage(error instanceof TypeError ? 'Unity is unavailable. Open the Unity project and press Play.' : error instanceof Error ? error.message : String(error));
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  };

  const ping = async () => {
    const controller = new AbortController();
    pending.current = controller;
    setStatus('pinging');
    setMessage('Sending Ping…');
    try {
      await pingUnity(controller.signal);
      if (pending.current !== controller) return;
      setStatus('connected');
      setMessage('Pong received from Unity.');
    } catch (error) {
      if (pending.current !== controller) return;
      setStatus('disconnected');
      setMessage(error instanceof TypeError ? 'Unity connection was lost. Press Connect to retry.' : String(error));
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  };

  const blinkMax = async () => {
    const controller = new AbortController();
    pending.current = controller;
    setStatus('commanding');
    setMessage('Sending max.blink…');
    try {
      await blinkMaxInUnity(controller.signal);
      if (pending.current !== controller) return;
      setStatus('connected');
      setMessage('Unity accepted max.blink. Watch the Unity Game view to see the blink.');
    } catch (error) {
      if (pending.current !== controller) return;
      setStatus(error instanceof TypeError || error instanceof UnityBridgeUnavailableError ? 'disconnected' : 'connected');
      setMessage(error instanceof TypeError ? 'Unity connection was lost. Press Connect to retry.' : error instanceof Error ? error.message : 'Unity could not accept max.blink.');
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  };

  const sendActing = async () => {
    const controller = new AbortController();
    pending.current = controller;
    setStatus('commanding');
    setMessage('Waiting for Unity to handle the acting command…');
    try {
      const command: ActingCommand = action === 'look_at' ? { actor, action, target } : { actor, action };
      const reply = await sendActingCommandToUnity(command, controller.signal);
      if (pending.current !== controller) return;
      setStatus('connected');
      setMessage(`Unity accepted ${reply.command} for ${reply.actor}. Watch the Unity Game view; animation completion is not confirmed.`);
    } catch (error) {
      if (pending.current !== controller) return;
      const unavailable = error instanceof TypeError || error instanceof UnityBridgeUnavailableError;
      setStatus(unavailable ? 'disconnected' : 'connected');
      setMessage(error instanceof TypeError ? 'Unity connection was lost. Press Connect to retry.' : error instanceof Error ? error.message : 'Unity rejected the acting command.');
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  };

  return <section className="unity-connection" aria-labelledby="unity-connection-heading">
    <p className="eyebrow">CARTOON PREVIEW · EXPERIMENTAL</p>
    <h1 id="unity-connection-heading">Watch your cartoon</h1>
    <p>Start the isolated preview stage, then connect and send a saved scene. Your scene stays editable in Scene Maker.</p>
    <p className="unity-connection-status" role="status"><strong>Unity Editor:</strong> {editorStatus}</p>
    <p className="unity-connection-status" role="status"><strong>Cartoon Preview startup:</strong> {startupStage}{startupStage === 'Failed' && startupDetail ? ` — ${startupDetail}` : ''}</p>
    <div className="unity-connection-actions">
      <button type="button" onClick={() => void startEditor()} disabled={editorBusy || editorStatus === 'Stopping'}>{startupStage === 'Failed' ? 'Retry Start Unity' : 'Start Unity'}</button>
      <button type="button" onClick={() => void stopEditor()} disabled={editorBusy || (editorStatus !== 'Playing' && editorStatus !== 'Starting')}>Stop Unity</button>
    </div>
    <p><small>Start Unity reuses the BrightTales Editor or launches it through the trusted review launcher, opens {UNITY_REVIEW_SCENE}, enters Play Mode, and connects through port 17844. Dirty Unity scenes are never replaced.</small></p>
    <p className="unity-connection-status" role="status"><strong>Runtime bridge:</strong> {status === 'connecting' ? 'Connecting' : status === 'pinging' ? 'Waiting for Pong' : status === 'commanding' ? 'Waiting for command response' : status === 'connected' ? 'Connected' : 'Disconnected'}</p>
    <p className="unity-connection-status" role="status"><strong>Bridge workflow:</strong> {status === 'connecting' ? 'Connecting' : status === 'pinging' ? 'Waiting for Pong' : status === 'commanding' ? 'Waiting for command response' : status === 'connected' ? 'Connected' : 'Disconnected'}</p>
    <p role="status">{message}</p>
    <div className="unity-connection-actions">
      <button type="button" onClick={connect} disabled={status !== 'disconnected'}>Connect preview</button>
      <button type="button" onClick={disconnect} disabled={status === 'disconnected'}>Disconnect</button>
    </div>
    <StudioSceneUnityPanel connected={status === 'connected'} library={scenes} characters={characters} audioAssets={audioAssets} requestedSceneId={requestedSceneId} />
    <details className="preview-diagnostics"><summary>Developer tools and earlier experiments</summary>
      <div className="unity-connection-actions"><button type="button" onClick={ping} disabled={status !== 'connected'}>Ping</button><button type="button" onClick={blinkMax} disabled={status !== 'connected'}>Blink Max</button></div>
    <section aria-labelledby="unity-director-controls-heading">
      <p className="eyebrow">EXPERIMENTAL · DIRECTOR CONTROLS V2</p>
      <h2 id="unity-director-controls-heading">Direct Max and Maxine</h2>
      <p>Open Character Acting V1.2 in Unity Play mode, then choose one command.</p>
      <div style={{ display: 'grid', gap: 12, maxWidth: 320 }}>
        <label>Character <select value={actor} onChange={event => setActor(event.target.value as ActingCharacter)}><option value="max">Max</option><option value="maxine">Maxine</option></select></label>
        <label>Action <select value={action} onChange={event => setAction(event.target.value as ActingCommand['action'])}><option value="look_at">Look At</option><option value="wave">Wave</option><option value="idle">Idle</option></select></label>
        <label>Target <select value={target} disabled={action !== 'look_at'} onChange={event => setTarget(event.target.value as ActingCharacter)}><option value="max">Max</option><option value="maxine">Maxine</option></select></label>
        <button type="button" onClick={sendActing} disabled={status !== 'connected'}>Send to Unity</button>
      </div>
      <p><small>An acknowledgement confirms Unity handled the command on its main thread. Watch the Game view for the pose or gesture.</small></p>
    </section>
    <PortalV1Panel connected={status === 'connected'} />
    <CartoonEngineV1Panel connected={status === 'connected'} />
    <small>Loopback address: {UNITY_BRIDGE_URL}. The connection is off until you press Connect.</small>
    </details>
  </section>;
}
