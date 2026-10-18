/**
 * Drawing for Max's phone, its communication symbols and the Bright Speak pop-up.
 *
 * Everything is vector Canvas work in the same flat, outlined cartoon style as the rest of the
 * Studio, so the phone scales with the character and no new artwork files are needed.
 */
import { PHONE_FADE_SECONDS, type PhonePopup, type PhoneSymbolId } from './phone';

const OUTLINE = '#2b1d4d';
const BODY = '#3c4a7a';
const BODY_EDGE = '#26305a';

/** A friendly, readable phone. `raise` slides it up into the hand, `tapping` lights the screen. */
export function drawPhone(context: CanvasRenderingContext2D, options: { x: number; y: number; scale: number; raise: number; tapping: boolean; direction: number }) {
  const { x, y, scale, raise, tapping, direction } = options;
  const height = 132 * scale;
  const width = 74 * scale;
  const radius = 14 * scale;
  const lift = (1 - raise) * height * 1.15;
  context.save();
  context.translate(x, y + lift);
  context.rotate(direction * 0.12 - (1 - raise) * 0.5);
  context.globalAlpha = Math.max(0, Math.min(1, raise * 1.4));
  const screen = Math.max(2, height * 0.09);
  context.fillStyle = BODY;
  context.strokeStyle = OUTLINE;
  context.lineWidth = 5 * scale;
  roundedRect(context, -width / 2, -height / 2, width, height, radius);
  context.fill();
  context.stroke();
  context.fillStyle = BODY_EDGE;
  roundedRect(context, -width / 2 + 6 * scale, -height / 2 + 6 * scale, width - 12 * scale, height - 12 * scale, radius * 0.7);
  context.fill();
  // Screen: quiet until tapped, so a tap is visible without flashing.
  context.fillStyle = tapping ? '#8ff3ff' : '#cfe6f5';
  roundedRect(context, -width / 2 + 9 * scale, -height / 2 + screen, width - 18 * scale, height - screen * 2 - 14 * scale, 6 * scale);
  context.fill();
  if (tapping) {
    context.fillStyle = 'rgba(255,255,255,.75)';
    roundedRect(context, -width / 2 + 16 * scale, -height / 2 + screen + 10 * scale, width - 32 * scale, 6 * scale, 3 * scale);
    context.fill();
    roundedRect(context, -width / 2 + 16 * scale, -height / 2 + screen + 26 * scale, (width - 40 * scale) * 0.6, 6 * scale, 3 * scale);
    context.fill();
  }
  context.fillStyle = '#e8eefc';
  context.beginPath();
  context.arc(0, height / 2 - 8 * scale, 5 * scale, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/** Draws one communication symbol inside a `size` box centred on (0,0). */
export function drawPhoneSymbol(context: CanvasRenderingContext2D, symbol: PhoneSymbolId, size: number) {
  const s = size / 2;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = OUTLINE;
  context.lineWidth = Math.max(2, size * 0.06);
  const circle = (fill: string, radius = 0.82) => { context.fillStyle = fill; context.beginPath(); context.arc(0, 0, s * radius, 0, Math.PI * 2); context.fill(); context.stroke(); };
  if (symbol === 'food') {
    circle('#ff8a8a');
    context.fillStyle = '#8ce06a';
    context.beginPath(); context.ellipse(s * 0.42, -s * 0.72, s * 0.3, s * 0.17, -0.5, 0, Math.PI * 2); context.fill(); context.stroke();
    context.fillStyle = '#7a4a22';
    roundedRect(context, -s * 0.07, -s * 1.02, s * 0.14, s * 0.32, s * 0.07); context.fill(); context.stroke();
  } else if (symbol === 'drink') {
    circle('#8fd8ff');
    context.fillStyle = '#fdfdfd';
    context.beginPath(); context.moveTo(-s * 0.45, -s * 0.5); context.lineTo(s * 0.45, -s * 0.5); context.lineTo(s * 0.3, s * 0.62); context.lineTo(-s * 0.3, s * 0.62); context.closePath(); context.fill(); context.stroke();
    context.fillStyle = '#7ec8f2';
    context.beginPath(); context.moveTo(-s * 0.4, s * 0.06); context.lineTo(s * 0.4, s * 0.06); context.lineTo(s * 0.3, s * 0.62); context.lineTo(-s * 0.3, s * 0.62); context.closePath(); context.fill(); context.stroke();
    context.strokeStyle = OUTLINE; context.lineWidth = Math.max(2, size * 0.09);
    context.beginPath(); context.moveTo(s * 0.1, -s * 0.95); context.lineTo(s * 0.28, -s * 0.5); context.stroke();
  } else if (symbol === 'toilet') {
    circle('#d9c7ff');
    context.fillStyle = '#fdfdfd';
    context.beginPath(); context.ellipse(0, s * 0.42, s * 0.36, s * 0.2, 0, 0, Math.PI * 2); context.fill(); context.stroke();
    roundedRect(context, -s * 0.3, -s * 0.34, s * 0.6, s * 0.72, s * 0.18); context.fill(); context.stroke();
  } else if (symbol === 'help') {
    circle('#ffd97a');
    context.fillStyle = OUTLINE;
    context.font = `bold ${Math.round(size * 0.95)}px Segoe UI`;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText('?', 0, s * 0.06);
  } else if (symbol === 'yes') {
    circle('#8ce06a');
    context.strokeStyle = '#1f5c1f'; context.lineWidth = Math.max(3, size * 0.16);
    context.beginPath(); context.moveTo(-s * 0.42, s * 0.02); context.lineTo(-s * 0.1, s * 0.38); context.lineTo(s * 0.46, -s * 0.36); context.stroke();
  } else if (symbol === 'no') {
    circle('#ff9d9d');
    context.strokeStyle = '#7c1f1f'; context.lineWidth = Math.max(3, size * 0.16);
    context.beginPath(); context.moveTo(-s * 0.38, -s * 0.38); context.lineTo(s * 0.38, s * 0.38); context.moveTo(s * 0.38, -s * 0.38); context.lineTo(-s * 0.38, s * 0.38); context.stroke();
  } else if (symbol === 'play') {
    circle('#9ad7ff');
    context.fillStyle = '#12406b';
    context.beginPath(); context.moveTo(-s * 0.3, -s * 0.44); context.lineTo(s * 0.46, 0); context.lineTo(-s * 0.3, s * 0.44); context.closePath(); context.fill(); context.stroke();
  } else if (symbol === 'love') {
    circle('#ffc0dd');
    context.fillStyle = '#e2568c';
    context.beginPath();
    context.moveTo(0, s * 0.6);
    context.bezierCurveTo(-s * 1.05, -s * 0.1, -s * 0.42, -s * 0.86, 0, -s * 0.28);
    context.bezierCurveTo(s * 0.42, -s * 0.86, s * 1.05, -s * 0.1, 0, s * 0.6);
    context.closePath(); context.fill(); context.stroke();
  } else {
    circle('#ffb4a2');
    context.fillStyle = '#fdfdfd';
    roundedRect(context, -s * 0.62, -s * 0.24, s * 1.24, s * 0.48, s * 0.16); context.fill(); context.stroke();
    context.fillStyle = '#e2568c';
    context.beginPath(); context.arc(-s * 0.2, 0, s * 0.09, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(s * 0.2, 0, s * 0.09, 0, Math.PI * 2); context.fill();
  }
  context.restore();
}

/**
 * The Bright Speak communication pop-up: symbol, message and a small speaker mark while the
 * phone is talking. Calm fade in and out only, no flashing.
 */
export function drawCommunicationPopup(context: CanvasRenderingContext2D, popup: PhonePopup, options: { x: number; y: number; width: number; scale: number }) {
  const { x, y, width, scale } = options;
  const height = 210 * scale;
  const symbolCentre = 80 * scale;
  const textLeft = 142 * scale;
  context.save();
  context.globalAlpha = popup.opacity;
  context.translate(x + width / 2, y + height / 2);
  const grow = 0.92 + 0.08 * popup.opacity;
  context.scale(grow, grow);
  context.translate(-width / 2, -height / 2);
  context.fillStyle = 'rgba(28, 18, 52, .16)';
  roundedRect(context, 5, 9, width, height, 30 * scale); context.fill();
  context.fillStyle = '#fffaf0';
  context.strokeStyle = OUTLINE;
  context.lineWidth = 6 * scale;
  roundedRect(context, 0, 0, width, height, 30 * scale);
  context.fill(); context.stroke();
  // The symbol sits in its own left column so a long message never sits on top of it.
  context.save();
  roundedRect(context, 0, 0, width, height, 30 * scale); context.clip();
  context.translate(symbolCentre, height / 2);
  drawPhoneSymbol(context, popup.symbol, 124 * scale);
  context.restore();
  context.beginPath();
  context.moveTo(width / 2 - 26 * scale, height - 2);
  context.lineTo(width / 2 + 22 * scale, height - 2);
  context.lineTo(width / 2 + 4 * scale, height + 30 * scale);
  context.closePath();
  context.fillStyle = '#fffaf0'; context.fill(); context.stroke();
  const textWidth = width - textLeft - 30 * scale;
  context.fillStyle = '#2b1d4d';
  context.font = `bold ${Math.round(46 * scale)}px Segoe UI`;
  context.textAlign = 'left'; context.textBaseline = 'middle';
  const lines = wrapText(context, popup.message, textWidth);
  const lineHeight = 56 * scale;
  const top = height / 2 - ((lines.length - 1) * lineHeight) / 2 - (popup.speaking ? 10 * scale : 0);
  lines.forEach((line, index) => context.fillText(line, textLeft, top + index * lineHeight, textWidth));
  if (popup.speaking) drawSpeakerMark(context, width - 40 * scale, 28 * scale, scale);
  context.restore();
}

/** A small, calm speaker mark so the audience can see the device is talking. */
function drawSpeakerMark(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  context.save();
  context.translate(x, y);
  context.fillStyle = '#2f7d4f';
  context.strokeStyle = '#1d4a30';
  context.lineWidth = 3 * scale;
  context.beginPath();
  context.moveTo(-9 * scale, -4 * scale); context.lineTo(-3 * scale, -4 * scale); context.lineTo(3 * scale, -10 * scale);
  context.lineTo(3 * scale, 10 * scale); context.lineTo(-3 * scale, 4 * scale); context.lineTo(-9 * scale, 4 * scale);
  context.closePath(); context.fill(); context.stroke();
  for (let i = 0; i < 2; i++) {
    context.beginPath();
    context.arc(5 * scale, 0, (7 + i * 5) * scale, -0.9, 0.9);
    context.stroke();
  }
  context.restore();
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  context.beginPath();
  if (typeof context.roundRect === 'function') context.roundRect(x, y, width, height, r);
  else {
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }
}

/** Re-exported so the renderer and the tests agree on the fade length. */
export const POPUP_FADE_SECONDS = PHONE_FADE_SECONDS;