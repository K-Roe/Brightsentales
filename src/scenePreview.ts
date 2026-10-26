import { makePack, type Brightling } from './maker';
import { maxSpriteSource, maxineSpriteSource, type MaxOutfit, type MaxineOutfit } from './outfit';
import { HEIGHT, WIDTH } from './scene';
import { objectAt, stateAt, type GestureFrame, type TimedScene } from './timedScenes';
import { creditRowsAt, type CreditLine, type CreditsMode } from './credits';
import { PHONE_POPUP_HEIGHT, PHONE_POPUP_SCALE, PHONE_POPUP_WIDTH, illustratedPhoneFrameAt, phoneAnchor, phonePopupBox, phoneStateAt, type PhoneState } from './phone';
import { drawCommunicationPopup, drawPhone } from './phoneArt';
import { footAnchor, footDrop } from './spriteGrounding';
import { cameraAt } from './camera';
import { blinkAt, drawLivingRoomLife, lifeMotionAt, makeBlinkFrame } from './cartoonLife';
import { livingWorldAt } from './livingWorld';
import { characterLifeAt } from './brightlingLife';
import { makeEyeLayer, type EyeLayer, type EyeTemplate } from './eyeLayers';

type Sprite = HTMLImageElement | HTMLCanvasElement;
type PhoneSprites = { enter: Sprite; hold: Sprite; 'tap-start': Sprite; 'tap-mid': Sprite; raise: Sprite; touch: Sprite };
type EyeLayers = { idle: EyeLayer | null; side: (EyeLayer | null)[]; wave: (EyeLayer | null)[]; phone?: Partial<Record<keyof PhoneSprites, EyeLayer | null>> };
export type PreviewPack = { idle: Sprite; blink?: Sprite; eyes?: EyeLayers; side: Sprite[]; wave: Sprite[]; sideWave?: Sprite[]; gestures?: Partial<Record<GestureFrame, Sprite>>; chair?: Sprite; phone?: PhoneSprites };
const image = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const item = new Image(); item.onload = () => resolve(item); item.onerror = reject; item.src = url; });
/** Source pixel size of the approved frames, used to map a measured hand anchor onto the stage. */
const SOURCE = { idle: { width: 434, height: 724 }, moving: { width: 500, height: 724 } };
const PHONE_SCALE = 0.5;

function eyeLayers(pack: PreviewPack, template: EyeTemplate): EyeLayers {
  return {
    idle: makeEyeLayer(pack.idle, template, 'idle'),
    side: pack.side.map((sprite, frame) => makeEyeLayer(sprite, template, 'side', frame)),
    wave: pack.wave.map((sprite, frame) => makeEyeLayer(sprite, template, 'wave', frame)),
    phone: pack.phone ? Object.fromEntries(Object.entries(pack.phone).map(([key, sprite]) => [key, makeEyeLayer(sprite, template, 'phone')])) : undefined,
  };
}

export async function previewPack(id: string, characters: Brightling[], maxOutfit: MaxOutfit, maxineOutfit: MaxineOutfit, gestureFrames: GestureFrame[] = [], sideWave = false, life: boolean | 'v2' = false): Promise<PreviewPack | null> {
  const custom = characters.find(item => item.id === id);
  if (custom) {
    const pack = await makePack(custom);
    return life === 'v2' ? { ...pack, eyes: eyeLayers(pack, custom.template) } : pack;
  }
  if (id !== 'max' && id !== 'maxine') return null;
  const source = (pose: 'idle' | 'side' | 'wave', frame = 0) => id === 'max' ? maxSpriteSource(maxOutfit, pose, frame) : maxineSpriteSource(maxineOutfit, pose, frame);
  const phone = id === 'max' && maxOutfit === 'original' ? {
    enter: await image('/art/phone/max-phone-enter.png'), hold: await image('/art/phone/max-phone-hold.png'),
    'tap-start': await image('/art/phone/max-phone-tap-start.png'), 'tap-mid': await image('/art/phone/max-phone-tap-mid.png'),
    raise: await image('/art/phone/max-phone-raise.png'), touch: await image('/art/phone/max-phone-touch.png'),
  } : undefined;
  const originalOutfit = id === 'max' ? maxOutfit === 'original' : maxineOutfit === 'original';
  const gestures = originalOutfit ? Object.fromEntries(await Promise.all(gestureFrames.map(async frame => [frame, await image(`/art/provisional-actions/${id}/${frame}.png`)] as const))) : undefined;
  const sideWaveFrames = sideWave && originalOutfit ? await Promise.all(Array.from({ length: 3 }, (_, index) => image(`/art/provisional-actions/greeting-v2/${id}-side-wave-${index + 1}.png`))) : undefined;
  const chair = gestureFrames.includes('sit-seated') ? await image('/art/provisional-actions/chair.png') : undefined;
  const idle = await image(source('idle'));
  const pack: PreviewPack = { idle, blink: life && originalOutfit ? makeBlinkFrame(idle, id) : undefined, side: await Promise.all(Array.from({ length: 5 }, (_, i) => image(source('side', i)))), wave: await Promise.all(Array.from({ length: 3 }, (_, i) => image(source('wave', i)))), sideWave: sideWaveFrames, gestures, chair, phone };
  if (life === 'v2') pack.eyes = eyeLayers(pack, id === 'max' ? 'male' : 'female');
  return pack;
}

function drawToy(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.fillStyle = '#563284'; context.beginPath(); context.arc(x, y, 19, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#ffcb43'; context.beginPath(); context.arc(x, y, 16, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#fff1ac'; context.beginPath(); context.ellipse(x - 5, y - 6, 5, 3, -.5, 0, Math.PI * 2); context.fill();
  context.restore();
}

/** An explicit episode camera override wins; `undefined` keeps the saved scene camera. */
export function drawScenePreview(context: CanvasRenderingContext2D, scene: TimedScene, time: number, room: HTMLImageElement, packs: Record<string, PreviewPack>, camera?: { x: number; y: number; zoom: number }) {
  context.clearRect(0, 0, WIDTH, HEIGHT);
  const view = camera ?? (scene.camera?.length ? cameraAt(scene, time) : null);
  if (view) {
    context.save();
    context.translate(WIDTH / 2, HEIGHT / 2);
    context.scale(view.zoom, view.zoom);
    context.translate(-view.x, -view.y);
  }
  context.drawImage(room, 0, 0, WIDTH, HEIGHT);
  if (scene.life?.enabled && scene.life.ambience !== false && scene.placeId === 'living-room') drawLivingRoomLife(context, time);
  const lifeV2 = scene.life?.mode === 'v2' || scene.livingWorld?.enabled === true;
  // Furniture and floor props join the cast's existing foot-Y depth ordering.
  // A chair is drawn just behind its seated Brightling at the same floor point.
  const furnishings = scene.actions.filter(item => item.type === 'sit-down' && item.seat === 'chair').map(action => ({ point: stateAt(scene, action.characterId, action.start).point, chair: packs[action.characterId]?.chair })).filter((item): item is { point: { x: number; y: number }; chair: Sprite } => !!item.chair);
  const floorToys = (scene.objects ?? []).map(object => objectAt(scene, object.id, time)).filter((item): item is NonNullable<typeof item> => !!item && (item.phase === 'floor' || item.phase === 'reach'));
  const floorItems = [...furnishings.map(item => ({ y: item.point.y, draw: () => context.drawImage(item.chair, item.point.x - 130, item.point.y - 265, 260, 265) })), ...floorToys.map(item => ({ y: item.point.y + 17, draw: () => drawToy(context, item.point.x, item.point.y) }))].sort((a, b) => a.y - b.y);
  const states = Object.keys(scene.characters).map(id => ({ id, state: livingWorldAt(scene, id, time).state, phone: phoneStateAt(scene, id, time) })).filter(item => item.state.visible && packs[item.id]);
  states.sort((a, b) => a.state.point.y - b.state.point.y);
  let floorIndex = 0;
  for (const { id, state, phone } of states) {
    while (floorIndex < floorItems.length && floorItems[floorIndex].y <= state.point.y) floorItems[floorIndex++].draw();
    const { x, y } = state.point;
    const pack = packs[id];
    context.save();
    // Ground shadow sits exactly on the floor at the character's foot point.
    context.fillStyle = 'rgba(68, 42, 75, .22)'; context.beginPath(); context.ellipse(x, y, 87, 17, 0, 0, Math.PI * 2); context.fill();
    const height = 355;
    const proportionalSide = state.pose === 'side' && state.greetingV3;
    const width = proportionalSide ? SOURCE.moving.width / SOURCE.moving.height * height
      : state.pose === 'side' ? (state.frame === 0 ? 213 : 239) : state.pose === 'wave' ? 245 : 213;
    const source = state.pose === 'idle' ? SOURCE.idle : SOURCE.moving;
    const characterId = id === 'max' || id === 'maxine' ? id : 'max';
    const anchor = footAnchor(characterId, state.pose, state.frame);
    const drop = footDrop(state.pose, anchor.y, height);
    const top = y - height + drop;
    const stanceX = proportionalSide ? footAnchor(characterId, 'side', 0).x : .5;
    const left = x - (state.pose === 'side' && state.direction < 0 ? 1 - stanceX : stanceX) * width;
    // Bright Speak owns the hands while held. Keep its approved illustrated or
    // composite path, and resume the gesture after the phone is put away.
    const gestureFrame = phone.held || phone.raise > 0 ? undefined : state.gestureFrame;
    const illustrated = id === 'max' && state.pose === 'idle' && phone.hand === 'left' && pack.phone && (phone.held || phone.raise > 0);
    const phonePose = illustrated ? illustratedPhoneFrameAt(scene, id, time, phone) : 'idle';
    const phoneFrame: Sprite | null = illustrated ? phonePose === 'idle' ? pack.idle : pack.phone![phonePose] : null;
    const sprite: Sprite | null = phoneFrame
      ? phoneFrame
      : gestureFrame && pack.gestures?.[gestureFrame]
      ? pack.gestures[gestureFrame]!
      : state.sideWaveFrame && pack.sideWave?.[state.sideWaveFrame - 1]
      ? pack.sideWave[state.sideWaveFrame - 1]
      : state.pose === 'side'
      ? pack.side[state.frame]
      : state.pose === 'wave'
      ? pack.wave[state.frame - 1]
      : scene.life?.enabled && !lifeV2 && state.pose === 'idle' && !state.expression && !phone.held && !phone.raise && pack.blink && blinkAt(id, time)
      ? pack.blink
      : pack.idle;
    const controller = lifeV2 ? characterLifeAt(scene, id, time, state, phone.held || phone.raise > 0) : null;
    const life = controller ? { scaleX: controller.breathX, scaleY: controller.breathY, offsetY: controller.lift } : lifeMotionAt(scene, id, time, state, !!(phone.held || phone.raise > 0));
    const eyelid = controller?.blinking && !gestureFrame && !state.sideWaveFrame && pack.eyes
      ? illustrated ? phonePose === 'idle' ? pack.eyes.idle : pack.eyes.phone?.[phonePose]
        : state.pose === 'side' ? pack.eyes.side[state.frame]
        : state.pose === 'wave' ? pack.eyes.wave[state.frame - 1]
        : pack.eyes.idle
      : null;
    if (sprite) {
      context.save();
      // Existing gestures retain their centre pivot. New whole-frame actions use
      // the measured foot line so stretching cannot lift the shoes from the floor.
      const centerX = x;
      const footPivot = state.expression?.anchor === 'foot' || !!life;
      const centerY = footPivot ? top + anchor.y * height : top + height / 2;
      context.translate(centerX, centerY);
      const scaleX = (state.expression?.scaleX ?? 1) * (life?.scaleX ?? 1);
      const scaleY = (state.expression?.scaleY ?? 1) * (life?.scaleY ?? 1);
      if (state.pose === 'side') context.scale(state.direction * scaleX, scaleY);
      else context.scale(scaleX, scaleY);
      if (state.expression?.rotate) context.rotate((state.expression.rotate * Math.PI) / 180);
      context.translate(state.expression?.offsetX ?? 0, (state.expression?.offsetY ?? 0) + (life?.offsetY ?? 0));
      context.drawImage(sprite, -stanceX * width, footPivot ? -anchor.y * height : -height / 2, width, height);
      if (eyelid) {
        const sourceWidth = sprite instanceof HTMLImageElement ? sprite.naturalWidth : sprite.width;
        const sourceHeight = sprite instanceof HTMLImageElement ? sprite.naturalHeight : sprite.height;
        context.drawImage(eyelid.canvas,
          -stanceX * width + eyelid.x / sourceWidth * width,
          (footPivot ? -anchor.y * height : -height / 2) + eyelid.y / sourceHeight * height,
          eyelid.canvas.width / sourceWidth * width,
          eyelid.canvas.height / sourceHeight * height);
      }
      context.restore();
    }
    context.restore();
    if (!illustrated && (phone.held || phone.raise > 0)) {
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
  while (floorIndex < floorItems.length) floorItems[floorIndex++].draw();
  for (const object of scene.objects ?? []) {
    const state = objectAt(scene, object.id, time);
    if (state && state.phase !== 'floor' && state.phase !== 'reach') drawToy(context, state.point.x, state.point.y);
  }
  // Communication pop-ups sit above the cast so a pop-up is never half hidden behind a Brightling.
  for (const { id, state, phone } of states) {
    if (!phone.popup) continue;
    const box = phonePopupBox(state.point.x, state.point.y, phone.popup.position);
    drawCommunicationPopup(context, phone.popup, { x: box.x, y: box.y, width: PHONE_POPUP_WIDTH, scale: PHONE_POPUP_SCALE });
  }
  if (view) context.restore();
}

/**
 * Wraps `drawScenePreview` so an intro keeps the exact scene animation engine and
 * approved artwork selection, then overlays its own title text. The intro passes
 * itself as a `TimedScene` because it is one.
 */
export function drawIntroPreview(context: CanvasRenderingContext2D, intro: TimedScene, seriesTitle: string, episodeTitle: string, titleStyle: 'plain' | 'banner', opacity: number, time: number, room: HTMLImageElement, packs: Record<string, PreviewPack>, camera?: { x: number; y: number; zoom: number }) {
  drawScenePreview(context, intro, time, room, packs, camera);
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
export function drawCreditsPreview(context: CanvasRenderingContext2D, credits: TimedScene, title: string, lines: CreditLine[], mode: CreditsMode, scrollSpeed: number, time: number, room: HTMLImageElement, camera?: { x: number; y: number; zoom: number }) {
  drawScenePreview(context, credits, time, room, {}, camera);
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
