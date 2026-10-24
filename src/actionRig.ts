/** AC-01 visual acceptance failed. The supplied cut-outs do not contain a
 * continuous torso/shoulder behind the moving limbs and retain original-arm
 * fragments. Keep the approved standing sprite visible while rig editing is
 * disabled; do not render misleading broken poses. */
export const MAX_RIG_EDITABLE = false;
export const MAX_NEUTRAL_ART_URL = '/art/max-0.png';
export type MaxActionRig = HTMLImageElement;

let cache: Promise<MaxActionRig> | undefined;
export function loadMaxActionRig(): Promise<MaxActionRig> {
  return cache ??= new Promise<MaxActionRig>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Approved Max standing artwork could not load.'));
    image.src = MAX_NEUTRAL_ART_URL;
  }).catch(error => { cache = undefined; throw error; });
}

export function drawMaxActionRig(context: CanvasRenderingContext2D, rig: MaxActionRig, x: number, y: number, width: number, height: number) {
  context.drawImage(rig, x, y, width, height);
}
