import { makeEyeLayer } from '../eyeLayers';
import type { StandingRig, LayerName } from './physicalRig';

const base = '/art/experimental/max-living-v1/';
const load = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Cannot load ${url}`));
  image.src = url;
});

/** Max-specific art registrations; no other Brightling inherits these pixels. */
export async function loadMaxLivingRig(): Promise<StandingRig> {
  const names: LayerName[] = ['hidden-fill', 'neck-back', 'lower', 'upper', 'chest', 'head'];
  const images = await Promise.all(names.map(name => load(`${base}${name}.png`)));
  const layers = Object.fromEntries(names.map((name, index) => [name, images[index]])) as Record<LayerName, HTMLImageElement>;
  return {
    geometry: { width: 434, height: 724, neck: [217, 380], chest: [217, 516], waist: [217, 562] },
    motion: { upperLift: .75, upperLean: .55, chestLift: .45, chestWidth: .004,
      chestHeight: .001, headAngleScale: .38 },
    layers,
    blink: makeEyeLayer(layers.head, 'male', 'idle'),
  };
}
