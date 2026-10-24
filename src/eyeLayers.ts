/**
 * Experimental transparent eyelid layers. They cover only each registered eye;
 * approved character frames remain the authoritative body artwork underneath.
 */
export type EyePose = 'idle' | 'side' | 'wave' | 'phone';
export type EyeTemplate = 'male' | 'female';
type Eye = { x: number; y: number; rx: number; ry: number };
type Frame = HTMLImageElement | HTMLCanvasElement;
export type EyeLayer = { canvas: HTMLCanvasElement; x: number; y: number };
const both = (left: number, right: number, y: number, rx: number, ry: number): Eye[] => [{ x: left, y, rx, ry }, { x: right, y, rx, ry }];
const one = (x: number, y: number, rx: number, ry: number): Eye[] => [{ x, y, rx, ry }];

/** Registrations refer to approved source-pixel coordinates, not stage geometry. */
export function eyeRegistration(template: EyeTemplate, pose: EyePose, frame: number): Eye[] | null {
  if (template === 'male') {
    if (pose === 'idle') return both(158, 287, 254, 42, 46);
    if (pose === 'phone') return both(155, 282, 255, 42, 46);
    if (pose === 'wave') return both(215, 346, 245, 42, 46);
    return [one(305, 255, 34, 46), one(310, 255, 34, 46), one(367, 259, 34, 46), one(366, 258, 34, 46), one(382, 259, 34, 46)][frame] ?? null;
  }
  if (pose === 'idle' || pose === 'phone') return both(158, 258, 315, 37, 40);
  if (pose === 'wave') return both(185, 299, 283, 36, 39);
  return [one(374, 267, 28, 42), one(366, 260, 28, 42), one(368, 272, 28, 42), one(370, 279, 28, 42), one(380, 278, 28, 42)][frame] ?? null;
}

function pixel(data: ImageData, x: number, y: number): [number, number, number] {
  const at = (Math.max(0, Math.min(data.height - 1, Math.round(y))) * data.width + Math.max(0, Math.min(data.width - 1, Math.round(x)))) * 4;
  return [data.data[at], data.data[at + 1], data.data[at + 2]];
}
const css = ([r, g, b]: [number, number, number]) => `rgb(${r}, ${g}, ${b})`;

/** Returns a transparent canvas; nothing outside the eye regions is painted. */
export function makeEyeLayer(sprite: Frame, template: EyeTemplate, pose: EyePose, frame = 0): EyeLayer | null {
  const eyes = eyeRegistration(template, pose, frame);
  if (!eyes) return null;
  const width = sprite instanceof HTMLImageElement ? sprite.naturalWidth : sprite.width;
  const height = sprite instanceof HTMLImageElement ? sprite.naturalHeight : sprite.height;
  const source = document.createElement('canvas'); source.width = width; source.height = height;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) return null;
  sourceContext.drawImage(sprite, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, width, height);
  const left = Math.max(0, Math.floor(Math.min(...eyes.map(eye => eye.x - eye.rx - 10))));
  const topEdge = Math.max(0, Math.floor(Math.min(...eyes.map(eye => eye.y - eye.ry - 10))));
  const right = Math.min(width, Math.ceil(Math.max(...eyes.map(eye => eye.x + eye.rx + 10))));
  const bottomEdge = Math.min(height, Math.ceil(Math.max(...eyes.map(eye => eye.y + eye.ry + 10))));
  const layer = document.createElement('canvas'); layer.width = right - left; layer.height = bottomEdge - topEdge;
  const context = layer.getContext('2d');
  if (!context) return null;
  context.translate(-left, -topEdge);
  for (const eye of eyes) {
    if (eye.x + eye.rx >= width || eye.y + eye.ry >= height) continue;
    const top = pixel(pixels, eye.x, eye.y - eye.ry - 10);
    const bottom = pixel(pixels, eye.x, eye.y + eye.ry + 11);
    const gradient = context.createLinearGradient(eye.x, eye.y - eye.ry, eye.x, eye.y + eye.ry);
    gradient.addColorStop(0, css(top)); gradient.addColorStop(1, css(bottom));
    context.save();
    context.shadowColor = css(top); context.shadowBlur = 5;
    context.fillStyle = gradient;
    context.beginPath(); context.ellipse(eye.x, eye.y, eye.rx, eye.ry, 0, 0, Math.PI * 2); context.fill();
    context.restore();
    context.strokeStyle = template === 'male' ? '#20686d' : '#71305d';
    context.lineWidth = 4; context.lineCap = 'round';
    context.beginPath(); context.moveTo(eye.x - eye.rx + 6, eye.y + 1); context.quadraticCurveTo(eye.x, eye.y + 18, eye.x + eye.rx - 6, eye.y + 1); context.stroke();
    if (template === 'female') for (const side of [-1, 1]) {
      const tip = eye.x + side * (eye.rx - 7);
      context.beginPath(); context.moveTo(tip, eye.y + 2); context.lineTo(tip + side * 7, eye.y - 5); context.stroke();
    }
  }
  return { canvas: layer, x: left, y: topEdge };
}
