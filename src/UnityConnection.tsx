import { useEffect, useRef, useState } from 'react';
import { blinkMaxInUnity, connectToUnity, pingUnity, UnityBridgeUnavailableError, UNITY_BRIDGE_URL } from './unityBridge';

type Status = 'disconnected' | 'connecting' | 'connected' | 'pinging' | 'commanding';

export default function UnityConnection() {
  const [status, setStatus] = useState<Status>('disconnected');
  const [message, setMessage] = useState('Connection is off.');
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);

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

  return <section className="unity-connection" aria-labelledby="unity-connection-heading">
    <p className="eyebrow">EXPERIMENTAL · LOCAL ONLY</p>
    <h1 id="unity-connection-heading">Unity Connection</h1>
    <p>Start the Unity project in Play mode, then connect to test the bridge.</p>
    <p className="unity-connection-status" role="status"><strong>Status:</strong> {status === 'connecting' ? 'Connecting' : status === 'pinging' ? 'Waiting for Pong' : status === 'commanding' ? 'Waiting for command response' : status === 'connected' ? 'Connected' : 'Disconnected'}</p>
    <p role="status">{message}</p>
    <div className="unity-connection-actions">
      <button type="button" onClick={connect} disabled={status !== 'disconnected'}>Connect</button>
      <button type="button" onClick={disconnect} disabled={status === 'disconnected'}>Disconnect</button>
      <button type="button" onClick={ping} disabled={status !== 'connected'}>Ping</button>
      <button type="button" onClick={blinkMax} disabled={status !== 'connected'}>Blink Max</button>
    </div>
    <small>Loopback address: {UNITY_BRIDGE_URL}. The connection is off until you press Connect.</small>
  </section>;
}
