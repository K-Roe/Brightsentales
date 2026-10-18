import { makePack, type Brightling } from './maker';
import { maxSpriteSource, maxineSpriteSource, type MaxOutfit, type MaxineOutfit } from './outfit';
import { HEIGHT, WIDTH } from './scene';
import { stateAt, type TimedScene } from './timedScenes';
import { creditRowsAt, type CreditLine, type CreditsMode } from './credits';
import { phoneAnchor, phonePopupBox, phoneStateAt, type PhoneState } from './phone';
import { drawCommunicationPopup, drawPhone } from './phoneArt';

type Sprite = HTMLImageElement | HTMLCanvasElement;
export type PreviewPack = { idle: Sprite; side: Sprite[]; wave: Sprite[] };
const image = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const item = new Image(); item.onload = () => resolve(item); item.onerror = reject; item.src = url; });
/** Source pixel size of the approved frames, used to map a measured hand anchor onto the stage. */
const SOURCE = { idle: { width: 434, height: 724 }, moving: { width: 500, height: 724 } };
const PHONE_SCALE = 0.5;

export async function previewPack(id: string, characters: Brightling[], maxOutfit: MaxOutfit, maxineOutfit: MaxineOutfit): Promise<PreviewPack | null> {
  const custom = characters.find(item => item.id === id);
  if (custom) return makePack(custom);
  if (id !== 'max' && id !== 'maxine') return null;
  const source = (pose: 'idle' | 'side' | 'wave', frame = 0) => id === 'max' ? maxSpriteSource(maxOutfit, pose, frame) : maxineSpriteSource(maxineOutfit, pose, frame);
  return { idle: await image(source('idle')), side: await Promise.all(Array.from({ length: 5 }, (_, i) => image(source('side', i)))), wave: await Promise.all(Array.from({ length: 3 }, (_, i) => image(source('wave', i)))) };
}

export function drawScenePreview(context: CanvasRenderingContext2D, scene: TimedScene, time: number, room: HTMLImageElement, packs: Record<string, PreviewPack>) {
  context.clearRect(0, 0, WIDTH, HEIGHT);
  context.drawImage(room, 0, 0, WIDTH, HEIGHT);
  const states = Object.keys(scene.characters).map(id => ({ id, state: stateAt(scene, id, time), phone: phoneStateAt(scene, id, time) })).filter(item => item.state.visible && packs[item.id]);
  states.sort((a, b) => a.state.point.y - b.state.point.y);
  for (const { id, state, phone } of states) {
    const { x, y } = state.point;
    const pack = packs[id];
    context.save();
    context.fillStyle = 'rgba(68, 42, 75, .22)'; context.beginPath(); context.ellipse(x, y - 3, 87, 17, 0, 0, Math.PI * 2); context.fill();
    const width = state.pose === 'side' ? (state.frame === 0 ? 213 : 239) : state.pose === 'wave' ? 245 : 213;
    const height = 355;
    const source = state.pose === 'idle' ? SOURCE.idle : SOURCE.moving;
    const top = y - height - (state.pose === 'side' && state.frame > 0 && state.frame % 2 === 0 ? 3 : 0);
    const left = x - width / 2;
    if (state.pose === 'side') {
      context.translate(x, y); context.scale(state.direction, 1);
      context.drawImage(pack.side[state.frame], -width / 2, -height - (state.frame > 0 && state.frame % 2 === 0 ? 3 : 0), width, height);
    } else if (state.pose === 'wave') context.drawImage(pack.wave[state.frame - 1], left, top, width, height);
    else context.drawImage(pack.idle, left, top, width, height);
    context.restore();
    if (phone.held || phone.raise > 0) {
      const anchor = phoneAnchor(id, state.pose, state.pose === 'idle' ? 0 : state.pose === 'wave' ? state.frame : state.frame, phone.hand, {
        x: left, y: top, width, height, sourceWidth: source.width, sourceHeight: source.height, direction: state.pose === 'side' ? state.direction : 1,
      });
      if (anchor) {
        // Sit the phone just outside the hand so it reads as held rather than painted on the leg.
        const outward = anchor.x < left + width / 2 ? -1 : 1;
        drawPhone(context, { x: anchor.x + outward * 15 * PHONE_SCALE, y: anchor.y + 30 * PHONE_SCALE, scale: PHONE_SCALE, raise: phone.raise, tapping: phone.tapping, direction: state.direction });
      }
    }
  }
  // Communication pop-ups sit above the cast so a pop-up is never half hidden behind a Brightling.
  for (const { id, state, phone } of states) {
    if (!phone.popup) continue;
    const width = 470 * PHONE_SCALE;
    const box = phonePopupBox(state.point.x, state.point.y, phone.popup.position, width);
    drawCommunicationPopup(context, phone.popup, { x: box.x, y: box.y, width, scale: PHONE_SCALE });
  }
}

/**
 * Wraps `drawScenePreview` so an intro keeps the exact scene animation engine and
 * approved artwork selection, then overlays its own title text. The intro passes
 * itself as a `TimedScene` because it is one.
 */
export function drawIntroPreview(context: CanvasRenderingContext2D, intro: TimedScene, seriesTitle: string, episodeTitle: string, titleStyle: 'plain' | 'banner', opacity: number, time: number, room: HTMLImageElement, packs: Record<string, PreviewPack>) {
  drawScenePreview(context, intro, time, room, packs);
  if (opacity <= 0.002) return;
  const shrink = Math.min(1, 0.94 + 0.06 * opacity);
  context.save();
  context.globalAlpha = opacity;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  if (titleStyle === 'banner') {
    const rise = (1 - opacity) * 46;
    const bandTop = 96 + rise;
    context.fillStyle = 'rgba(40, 24, 66, .74)';
    context.beginPath();
    if (typeof context.roundRect === 'function') context.roundRect(150, bandTop, WIDTH - 300, 226, 34);
    else context.rect(150, bandTop, WIDTH - 300, 226);
    context.fill();
    context.fillStyle = 'rgba(255, 236, 140, .9)';
    context.font = 'bold 44px Segoe UI';
    context.fillText(seriesTitle, WIDTH / 2, bandTop + 74, WIDTH - 400);
    context.fillStyle = '#fffaf0';
    context.font = 'bold 96px Segoe UI';
    context.fillText(episodeTitle, WIDTH / 2, bandTop + 166, WIDTH - 340);
  } else {
    const rise = (1 - opacity) * 26;
    context.shadowColor = 'rgba(28, 16, 48, .92)';
    context.shadowBlur = 18;
    context.lineJoin = 'round';
    context.lineWidth = 14;
    context.strokeStyle = 'rgba(28, 16, 48, .82)';
    context.fillStyle = '#fffaf0';
    context.font = `bold ${Math.round(76 * shrink)}px Segoe UI`;
    context.strokeText(seriesTitle, WIDTH / 2, 168 + rise, WIDTH - 300);
    context.fillText(seriesTitle, WIDTH / 2, 168 + rise, WIDTH - 300);
    context.font = `bold ${Math.round(112 * shrink)}px Segoe UI`;
    context.strokeText(episodeTitle, WIDTH / 2, 286 + rise, WIDTH - 240);
    context.fillText(episodeTitle, WIDTH / 2, 286 + rise, WIDTH - 240);
  }
  context.restore();
}

/**
 * Draws end credits over the place background using the same `drawScenePreview`
 * background pass, so credits and scenes share one renderer and one audio clock.
 * Text is drawn onto a darkened band to keep contrast readable over any artwork.
 */
export function drawCreditsPreview(context: CanvasRenderingContext2D, credits: TimedScene, title: string, lines: CreditLine[], mode: CreditsMode, scrollSpeed: number, time: number, room: HTMLImageElement) {
  drawScenePreview(context, credits, time, room, {});
  const fade = Math.min(0.6, credits.duration / 4);
  const opacity = Math.max(0, Math.min(1, (credits.duration - time) / fade));
  if (opacity <= 0.002) return;
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, 'rgba(24, 14, 44, .78)');
  gradient.addColorStop(.5, 'rgba(24, 14, 44, .58)');
  gradient.addColorStop(1, 'rgba(24, 14, 44, .82)');
  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const draw = (text: string, y: number, size: number, weight: string, colour: string) => {
    if (!text || y < -90 || y > HEIGHT + 90) return;
    context.font = `${weight} ${size}px Segoe UI`;
    context.lineJoin = 'round';
    context.lineWidth = 8;
    context.strokeStyle = 'rgba(18, 10, 34, .85)';
    context.strokeText(text, WIDTH / 2, y, WIDTH - 180);
    context.fillStyle = colour;
    context.fillText(text, WIDTH / 2, y, WIDTH - 180);
  };
  const rows = creditRowsAt({ title, mode, duration: credits.duration, scrollSpeed, lines }, time);
  for (const row of rows.rows) draw(row.text, row.y, row.size, row.weight, row.colour);
  context.restore();
}
