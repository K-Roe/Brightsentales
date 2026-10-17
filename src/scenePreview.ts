import { makePack, type Brightling } from './maker';
import { maxSpriteSource, maxineSpriteSource, type MaxOutfit, type MaxineOutfit } from './outfit';
import { HEIGHT, WIDTH } from './scene';
import { stateAt, type TimedScene } from './timedScenes';

type Sprite = HTMLImageElement | HTMLCanvasElement;
export type PreviewPack = { idle: Sprite; side: Sprite[]; wave: Sprite[] };
const image = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const item = new Image(); item.onload = () => resolve(item); item.onerror = reject; item.src = url; });

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
  const states = Object.keys(scene.characters).map(id => ({ id, state: stateAt(scene, id, time) })).filter(item => item.state.visible && packs[item.id]);
  states.sort((a, b) => a.state.point.y - b.state.point.y);
  for (const { id, state } of states) {
    const { x, y } = state.point;
    const pack = packs[id];
    context.save();
    context.fillStyle = 'rgba(68, 42, 75, .22)'; context.beginPath(); context.ellipse(x, y - 3, 87, 17, 0, 0, Math.PI * 2); context.fill();
    if (state.pose === 'side') {
      const width = state.frame === 0 ? 213 : 239;
      context.translate(x, y); context.scale(state.direction, 1);
      context.drawImage(pack.side[state.frame], -width / 2, -355 - (state.frame > 0 && state.frame % 2 === 0 ? 3 : 0), width, 355);
    } else if (state.pose === 'wave') context.drawImage(pack.wave[state.frame - 1], x - 245 / 2, y - 355, 245, 355);
    else context.drawImage(pack.idle, x - 213 / 2, y - 355, 213, 355);
    context.restore();
  }
}
