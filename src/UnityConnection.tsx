import { useEffect, useRef, useState } from 'react';
import { blinkMaxInUnity, connectToUnity, pingUnity, sendActingCommandToUnity, UnityBridgeUnavailableError, UNITY_BRIDGE_URL, type ActingCharacter, type ActingCommand } from './unityBridge';
import PortalV1Panel from './PortalV1Panel';
import CartoonEngineV1Panel from './CartoonEngineV1Panel';
import StudioSceneUnityPanel from './StudioSceneUnityPanel';
import type { AudioAsset } from './audio';
import type { TimedLibrary } from './timedScenes';

type Status = 'disconnected' | 'connecting' | 'connected' | 'pinging' | 'commanding';

export default function UnityConnection({ scenes, audioAssets, requestedSceneId, onStatusChange }: { scenes: TimedLibrary; audioAssets: AudioAsset[]; requestedSceneId?: string | null; onStatusChange?: (status: 'connected' | 'disconnected') => void }) {
  const [status, setStatus] = useState<Status>('disconnected');
  const [message, setMessage] = useState('Connection is off.');
  const [actor, setActor] = useState<ActingCharacter>('max');
  const [action, setAction] = useState<ActingCommand['action']>('look_at');
  const [target, setTarget] = useState<ActingCharacter>('maxine');
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  useEffect(() => { onStatusChange?.(status === 'connected' ? 'connected' : 'disconnected'); }, [status, onStatusChange]);
  useEffect(() => () => onStatusChange?.('disconnected'), [onStatusChange]);

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
    <p className="unity-connection-status" role="status"><strong>Status:</strong> {status === 'connecting' ? 'Connecting' : status === 'pinging' ? 'Waiting for Pong' : status === 'commanding' ? 'Waiting for command response' : status === 'connected' ? 'Connected' : 'Disconnected'}</p>
    <p role="status">{message}</p>
    <div className="unity-connection-actions">
      <button type="button" onClick={connect} disabled={status !== 'disconnected'}>Connect preview</button>
      <button type="button" onClick={disconnect} disabled={status === 'disconnected'}>Disconnect</button>
    </div>
    <StudioSceneUnityPanel connected={status === 'connected'} library={scenes} audioAssets={audioAssets} requestedSceneId={requestedSceneId} />
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
