import type { SceneState, TimedAction, TimedScene } from './timedScenes';

export type CartoonLifeSettings = { enabled: true; ambience?: boolean; mode?: 'v2' };
export type LifeMotion = { scaleX: number; scaleY: number; offsetY: number };
const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const end = (action: TimedAction) => action.start + action.duration;

/** A sparse, repeatable blink cadence. Only complete approved idle sprites may use it. */
export function blinkAt(id: string, time: number): boolean {
  const intervals = [3.3, 5.7, 4.2, 6.1];
  let at = time + (id === 'maxine' ? 2.1 : 1);
  if (at < 0) return false;
  for (let i = 0; i < 20; i++) {
    at -= intervals[i % intervals.length];
    if (at >= 0 && at < .2) return true;
    if (at < 0) return false;
  }
  return false;
}

/** Experimental blink variant derived at runtime; the approved PNG is never changed. */
export function makeBlinkFrame(idle: HTMLImageElement, id: 'max' | 'maxine'): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = idle.naturalWidth; canvas.height = idle.naturalHeight;
  const context = canvas.getContext('2d')!;
  context.drawImage(idle, 0, 0);
  const eye = (x: number, y: number, rx: number, ry: number, top: string, bottom: string, line: string, lashes: boolean) => {
    context.save(); context.shadowColor = top; context.shadowBlur = 6;
    const fill = context.createLinearGradient(0, y - ry, 0, y + ry);
    fill.addColorStop(0, top); fill.addColorStop(1, bottom);
    context.fillStyle = fill; context.beginPath(); context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); context.fill();
    context.restore();
    context.strokeStyle = line; context.lineWidth = 4; context.lineCap = 'round';
    context.beginPath(); context.moveTo(x - rx + 6, y + 1); context.quadraticCurveTo(x, y + 19, x + rx - 6, y + 1); context.stroke();
    if (lashes) for (const side of [-1, 1]) {
      const tip = x + side * (rx - 7);
      context.beginPath(); context.moveTo(tip, y + 2); context.lineTo(tip + side * 7, y - 5); context.stroke();
    }
  };
  if (id === 'max') {
    eye(158, 254, 42, 46, '#50d7c9', '#60d3c4', '#20686d', false);
    eye(287, 254, 42, 46, '#50d7c9', '#60d3c4', '#20686d', false);
  } else {
    eye(158, 315, 37, 40, '#f59db7', '#f59ebd', '#71305d', true);
    eye(258, 315, 37, 40, '#f59db7', '#f59ebd', '#71305d', true);
  }
  return canvas;
}

/** Tiny, foot-anchored motion evaluated only from saved scene time. */
export function lifeMotionAt(scene: TimedScene, id: string, time: number, state: SceneState, occupied: boolean): LifeMotion | null {
  if (!scene.life?.enabled || !state.visible || occupied || state.expression || state.gestureFrame || state.sideWaveFrame) return null;
  const actions = scene.actions.filter(action => action.characterId === id);
  const current = actions.find(action => action.start <= time && end(action) > time && action.duration > 0);
  const next = actions.filter(action => action.start > time && (action.type === 'walk' || action.type === 'wave')).sort((a, b) => a.start - b.start)[0];
  const previous = actions.filter(action => end(action) <= time && (action.type === 'walk' || action.type === 'wave')).sort((a, b) => end(b) - end(a))[0];
  if (state.pose === 'side' && current?.type === 'walk') {
    const seconds = Math.max(0, time - current.start);
    const envelope = Math.min(1, seconds / .3, (end(current) - time) / .3);
    const beat = Math.sin(seconds * Math.PI * 5);
    return { scaleX: 1, scaleY: 1, offsetY: -2.2 * beat * beat * Math.max(0, envelope) };
  }
  if (state.pose !== 'idle' || current && current.type !== 'wait') return null;
  let scaleY = 1;
  let scaleX = 1;
  let offsetY = 0;
  // Short rests between breaths prevent continuous mechanical bobbing.
  const phase = (time + (id === 'maxine' ? 1.7 : .4)) % 5.8;
  if (phase < 3.5) {
    const breath = Math.sin(Math.PI * phase / 3.5) ** 2;
    scaleY += .006 * breath;
    scaleX -= .002 * breath;
  }
  if (next && next.start - time < .3) {
    const anticipation = ease(1 - (next.start - time) / .3);
    scaleY -= .012 * anticipation;
    scaleX += .006 * anticipation;
  }
  if (previous && time - end(previous) < .5) {
    const elapsed = time - end(previous);
    offsetY += 2.5 * Math.exp(-elapsed * 8) * Math.sin(elapsed * 13);
  }
  return { scaleX, scaleY, offsetY };
}

/** Ambient light stays within the painted Living Room window. No art is altered. */
export function drawLivingRoomLife(context: CanvasRenderingContext2D, time: number) {
  context.save();
  context.beginPath(); context.rect(30, 20, 330, 420); context.clip();
  const glow = context.createRadialGradient(175 + 10 * Math.sin(time * .28), 190, 10, 175, 190, 300);
  glow.addColorStop(0, `rgba(255, 242, 177, ${.05 + .012 * Math.sin(time * .5)})`);
  glow.addColorStop(1, 'rgba(255, 242, 177, 0)');
  context.fillStyle = glow; context.fillRect(0, 0, 380, 470);
  for (let i = 0; i < 3; i++) {
    const period = 7 + i * 1.3;
    const phase = (time + i * 2.4) % period / period;
    const x = 75 + i * 83 + 9 * Math.sin(time * .37 + i);
    const y = 380 - phase * 300;
    const alpha = .1 * Math.sin(Math.PI * phase) ** 2;
    context.fillStyle = `rgba(255, 250, 211, ${alpha})`;
    context.beginPath(); context.arc(x, y, 3 + i, 0, Math.PI * 2); context.fill();
  }
  context.restore();
}
