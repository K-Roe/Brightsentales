import { useEffect, useRef, useState } from 'react';
import { portalCommand, PortalRejectedError } from './unityBridge';
import './portalV1.css';

type Phase = 'idle' | 'preparing' | 'departing' | 'awaiting' | 'arriving' | 'complete' | 'failed' | 'recovery';
const transferKey = 'brighttales.portal-v1.transfer-id';
const rememberedTransfer = () => { try { return sessionStorage.getItem(transferKey) ?? ''; } catch { return ''; } };
const rememberTransfer = (id: string) => { try { if (id) sessionStorage.setItem(transferKey, id); else sessionStorage.removeItem(transferKey); } catch { /* The Unity ID still protects the live session. */ } };
const pause = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

function gentleWhoosh(muted: boolean) {
  if (muted) return;
  try {
    const context = new AudioContext();
    const seconds = 0.55;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * 0.2;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.14, context.currentTime + 0.19);
    gain.gain.linearRampToValueAtTime(0.001, context.currentTime + seconds);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
    source.onended = () => { void context.close(); };
  } catch { /* Audio is optional; transfer is independent. */ }
}

export default function PortalV1Panel({ connected }: { connected: boolean }) {
  const [transferId, setTransferId] = useState(rememberedTransfer);
  const [phase, setPhase] = useState<Phase>(() => rememberedTransfer() ? 'recovery' : 'idle');
  const [message, setMessage] = useState(() => rememberedTransfer() ? 'A previous transfer needs a Unity status check before another send.' : 'Max is ready in this experimental preview.');
  const [walkFrame, setWalkFrame] = useState(0);
  const [muted, setMuted] = useState(true);
  const [hideMax, setHideMax] = useState(() => Boolean(rememberedTransfer()));
  const cancelled = useRef(false);
  const active = useRef(false);

  useEffect(() => {
    if (phase !== 'departing') return;
    const timer = window.setInterval(() => setWalkFrame(frame => (frame + 1) % 4), 190);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!connected && (phase === 'preparing' || phase === 'departing')) cancelled.current = true;
  }, [connected, phase]);

  const pollUntilComplete = async (id: string) => {
    for (let i = 0; i < 70; i++) {
      await pause(200);
      const reply = await portalCommand('status', id, new AbortController().signal);
      if (reply.status === 'complete') return;
      if (reply.status !== 'arriving') throw new Error(`Unity returned unexpected portal state: ${reply.status}.`);
    }
    throw new Error('Unity arrival has not completed. Use Check transfer before resetting.');
  };

  const start = async () => {
    if (active.current || phase !== 'idle') return;
    active.current = true;
    cancelled.current = false;
    const id = crypto.randomUUID().replaceAll('-', '');
    setTransferId(id);
    rememberTransfer(id);
    let prepared = false;
    let committed = false;
    let handoffAttempted = false;
    let prepareAttempted = false;
    setHideMax(false);
    setPhase('preparing');
    setMessage('Checking Unity portal readiness…');
    try {
      if (!connected) throw new Error('Connect to Unity before sending Max.');
      prepareAttempted = true;
      const ready = await portalCommand('prepare', id, new AbortController().signal);
      if (ready.status !== 'preparing') throw new Error('Unity did not reserve its portal.');
      prepared = true;
      if (cancelled.current) throw new Error('Transfer cancelled before handoff.');
      setPhase('departing');
      setMessage('Max is entering the BrightTales portal.');
      gentleWhoosh(muted);
      await pause(2600);
      if (cancelled.current) throw new Error('Transfer cancelled before handoff.');
      setPhase('awaiting');
      setMessage('Waiting for Unity to commit Max’s arrival…');
      handoffAttempted = true;
      try {
        const reply = await portalCommand('commit', id, new AbortController().signal);
        committed = reply.status === 'arriving' || reply.status === 'complete';
      } catch (error) {
        // A lost acknowledgement can mean Unity already committed. Query the same ID.
        const status = await portalCommand('status', id, new AbortController().signal);
        committed = status.status === 'arriving' || status.status === 'complete';
        if (!committed) throw error;
      }
      if (!committed) throw new Error('Unity did not commit the portal transfer.');
      setHideMax(true);
      setPhase('arriving');
      setMessage('Unity committed Max’s arrival. Waiting for the animation to finish…');
      await pollUntilComplete(id);
      setPhase('complete');
      setMessage('Max arrived in Unity and its portal closed.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Portal transfer failed.';
      if (prepareAttempted && !prepared && !handoffAttempted && !(error instanceof PortalRejectedError)) {
        try {
          const status = await portalCommand('status', id, new AbortController().signal);
          prepared = status.status === 'preparing';
          committed = status.status === 'arriving' || status.status === 'complete';
        } catch {
          setPhase('recovery');
          setMessage(`${detail} Unity's reservation status is unknown. Check transfer ${id.slice(0, 8)} before retrying.`);
          active.current = false;
          return;
        }
      }
      if (committed || handoffAttempted) {
        setHideMax(true); // Uncertain commit: keep the preview absent until the ID is reconciled.
        setPhase('recovery');
        setMessage(`${detail} Transfer ${id.slice(0, 8)} may already be in Unity. Check transfer before reset.`);
      } else {
        if (prepared) {
          try { await portalCommand('cancel', id, new AbortController().signal); }
          catch {
            setHideMax(false);
            setPhase('recovery');
            setMessage(`Unity's reservation could not be cancelled. Check transfer ${id.slice(0, 8)} before retrying.`);
            active.current = false;
            return;
          }
        }
        setPhase('failed');
        setMessage(`${detail} Max is restored in BrightTales.`);
      }
    } finally { active.current = false; }
  };

  const check = async () => {
    try {
      const reply = await portalCommand('status', transferId, new AbortController().signal);
      if (reply.status === 'complete') { setHideMax(true); setPhase('complete'); setMessage('Unity confirms Max arrived. Reset explicitly to review again.'); }
      else if (reply.status === 'arriving') { setHideMax(true); setPhase('arriving'); setMessage('Unity is still animating Max’s arrival.'); await pollUntilComplete(transferId); setPhase('complete'); setMessage('Unity confirms Max arrived.'); }
      else if (reply.status === 'preparing') { setHideMax(false); setPhase('recovery'); setMessage('Unity reserved Max but handoff was not committed. Reset will cancel this reservation.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Cannot confirm Unity transfer state.'); }
  };

  const reset = async () => {
    if (active.current) return;
    if (phase === 'failed') { setHideMax(false); setTransferId(''); rememberTransfer(''); setPhase('idle'); setMessage('Max is ready in this experimental preview.'); return; }
    try {
      const reply = await portalCommand('reset', transferId, new AbortController().signal);
      if (reply.status !== 'idle') throw new Error('Unity did not reset the portal.');
      setHideMax(false); setTransferId(''); rememberTransfer(''); setPhase('idle'); setMessage('Both portal previews reset. Max is visible in BrightTales.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unity reset failed; Max remains in the last confirmed state.'); }
  };

  const maxVisible = !hideMax;
  const portalOpen = ['departing', 'awaiting', 'arriving'].includes(phase);
  const maxArt = phase === 'departing' || phase === 'awaiting' ? `/art/max-side-v3-${walkFrame + 1}.png` : '/art/max-0.png';

  return <section aria-labelledby="portal-v1-heading" className="portal-v1-panel">
    <p className="eyebrow">EXPERIMENTAL · PORTAL V1 · MAX ONLY</p>
    <h2 id="portal-v1-heading">Send Max to Unity</h2>
    <div className="portal-v1-stage" aria-label={`Max portal preview: ${phase}`}>
      {maxVisible && <img className={`portal-v1-max ${phase === 'departing' || phase === 'awaiting' ? 'portal-v1-departing' : ''}`} src={maxArt} alt="Approved Max artwork" />}
      <div className={`portal-v1-door ${portalOpen ? 'portal-v1-open' : ''}`} aria-hidden="true"><div className="portal-v1-core" /><div className="portal-v1-rim" /><i /><i /><i /></div>
    </div>
    <p role="status">Transfer: {phase}. {message}</p>
    {transferId && <p><small>Transfer ID: {transferId}</small></p>}
    <div className="unity-connection-actions">
      <button type="button" onClick={() => void start()} disabled={!connected || phase !== 'idle'}>Send Max Through Portal</button>
      <button type="button" onClick={() => { cancelled.current = true; setMessage('Cancelling before handoff…'); }} disabled={phase !== 'departing'}>Cancel</button>
      <button type="button" onClick={() => void check()} disabled={!transferId || !['recovery', 'arriving'].includes(phase)}>Check transfer</button>
      <button type="button" onClick={() => void reset()} disabled={!['failed', 'complete', 'recovery'].includes(phase)}>Reset</button>
      <label><input type="checkbox" checked={muted} onChange={event => setMuted(event.target.checked)} /> Mute portal sound</label>
    </div>
    <p><small>The preview is temporary. Max’s saved BrightTales character is never removed. Handoff commits when Unity accepts arrival; completion appears only after Unity reports the arrival finished.</small></p>
  </section>;
}
