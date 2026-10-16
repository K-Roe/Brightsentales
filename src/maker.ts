export type Template = 'male' | 'female';
export type Brightling = { id: string; name: string; template: Template; body: string; hair: string; clothing: string };
export const LIBRARY_KEY = 'brightsenappstales.brightlings.v1';
export const FRAMES = ['0', 'side-0', 'side-v3-1', 'side-v3-2', 'side-v3-3', 'side-v3-4', 'wave-1', 'wave-2', 'wave-3'] as const;
export const PALETTES = {
  body: ['#66DCAA', '#91D9F1', '#F7B788', '#F4B6CE', '#F4B486', '#A6DCF2'],
  hair: ['#8740B6', '#274B9C', '#87502E', '#8851B6', '#A55235', '#B73979'],
  clothing: ['#F18A3A', '#46B869', '#D94B55', '#BBA5E8', '#43B9B0', '#EBCB53'],
};
export const DEFAULT_COLOURS: Record<Template, Pick<Brightling, 'body' | 'hair' | 'clothing'>> = {
  male: { body: '#66DCAA', hair: '#8740B6', clothing: '#F18A3A' },
  female: { body: '#F4B6CE', hair: '#8851B6', clothing: '#BBA5E8' },
};

const hex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function validateBrightling(value: unknown): value is Brightling {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Brightling>;
  return typeof item.id === 'string' && /^brightling-[a-f0-9-]{36}$/.test(item.id)
    && typeof item.name === 'string' && item.name.trim().length >= 1 && item.name.trim().length <= 32
    && (item.template === 'male' || item.template === 'female')
    && hex(item.body) && hex(item.hair) && hex(item.clothing);
}
export function parseLibrary(value: string | null): Brightling[] {
  if (!value) return [];
  try {
    const data: unknown = JSON.parse(value);
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const names = new Set(['max', 'maxine', 'oliver']);
    return data.filter((item): item is Brightling => {
      if (!validateBrightling(item) || seen.has(item.id) || names.has(item.name.trim().toLocaleLowerCase())) return false;
      seen.add(item.id); names.add(item.name.trim().toLocaleLowerCase());
      return true;
    });
  } catch { return []; }
}
export function nameAvailable(name: string, library: Brightling[]): boolean {
  const normalised = name.trim().toLocaleLowerCase();
  return !['max', 'maxine', 'oliver', ...library.map(item => item.name.toLocaleLowerCase())].includes(normalised);
}
export const sourceName = (template: Template, frame: string) => `${template === 'male' ? 'max' : 'maxine'}-${frame}.png`;
export const maskUrl = (template: Template, frame: string, region: string) => `/recolour-masks/${template}/${sourceName(template, frame).replace('.png', '')}-${region}.png`;

type HSV = [number, number, number];
function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h / 6 + 1) % 1;
  }
  return [h, max === 0 ? 0 : d / max, max];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const parts: [number, number, number][] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]];
  return parts[i % 6].map(x => x * 255) as [number, number, number];
}
function targetHsv(hexValue: string): HSV {
  return rgbToHsv(...([1, 3, 5].map(i => parseInt(hexValue.slice(i, i + 2), 16)) as [number, number, number]));
}
const BASE: Record<Template, Record<string, HSV>> = {
  male: { body: [0.47, 0.68, 0.85], hair: [0.49, 0.95, 0.73], clothing: [0.72, 0.65, 0.80] },
  female: { body: [0.95, 0.43, 0.98], hair: [0.78, 0.67, 0.78], clothing: [0.08, 0.15, 0.98] },
};
export function recolourPixels(source: ImageData, masks: Record<string, ImageData>, spec: Pick<Brightling, 'template' | 'body' | 'hair' | 'clothing'>): ImageData {
  const output = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  const keys = ['hair', 'body', 'clothing'];
  const targets = Object.fromEntries(keys.map(key => [key, targetHsv(spec[key as 'body' | 'hair' | 'clothing'])])) as Record<string, HSV>;
  const data = source.data, result = output.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (!alpha) continue;
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    const transformed = [0, 0, 0];
    let total = 0;
    for (const key of keys) {
      const amount = masks[key].data[i] / alpha;
      if (!amount) continue;
      const [baseHue, baseSat, baseVal] = BASE[spec.template][key];
      let [targetHue, targetSat, targetVal] = targets[key];
      if (spec.template === 'female' && key === 'hair') {
        const deviation = (h - baseHue + 1.5) % 1 - 0.5;
        targetHue = (targetHue + Math.min(0.026, Math.max(-0.035, deviation * 0.4)) + 1) % 1;
      }
      const rgb = hsvToRgb(targetHue, Math.min(1, s * targetSat / baseSat), Math.min(1, v * targetVal / baseVal));
      for (let channel = 0; channel < 3; channel++) transformed[channel] += rgb[channel] * amount;
      total += amount;
      if (spec.template === 'female') break;
    }
    if (total) for (let channel = 0; channel < 3; channel++) result[i + channel] = Math.round(data[i + channel] * Math.max(0, 1 - total) + transformed[channel]);
  }
  return output;
}

async function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const result = new Image(); result.onload = () => resolve(result); result.onerror = () => reject(new Error(`Missing artwork: ${url}`)); result.src = url; });
}
function pixels(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
const sourceCache = new Map<string, Promise<{ source: ImageData; masks: Record<string, ImageData> }>>();
async function frameAssets(template: Template, frame: string) {
  const key = `${template}:${frame}`;
  if (!sourceCache.has(key)) sourceCache.set(key, (async () => {
    const filename = sourceName(template, frame);
    const keys = ['hair', 'body', 'clothing'];
    const [art, ...maskImages] = await Promise.all([image(`/art/${filename}`), ...keys.map(region => image(maskUrl(template, frame, template === 'male' && region === 'clothing' ? 'hoodie' : region)))]);
    const source = pixels(art), masks = Object.fromEntries(keys.map((region, index) => [region, pixels(maskImages[index])]));
    if (Object.values(masks).some(mask => mask.width !== source.width || mask.height !== source.height)) throw new Error(`Mask dimensions differ for ${filename}`);
    return { source, masks };
  })().catch(error => { sourceCache.delete(key); throw error; }));
  return sourceCache.get(key)!;
}
export async function makeFrame(spec: Pick<Brightling, 'template' | 'body' | 'hair' | 'clothing'>, frame: string): Promise<HTMLCanvasElement> {
  const { source, masks } = await frameAssets(spec.template, frame);
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  context.putImageData(recolourPixels(source, masks, spec), 0, 0);
  return canvas;
}
export async function makePack(spec: Pick<Brightling, 'template' | 'body' | 'hair' | 'clothing'>) {
  const frames = await Promise.all(FRAMES.map(frame => makeFrame(spec, frame)));
  return { idle: frames[0], side: frames.slice(1, 6), wave: frames.slice(6, 9) };
}
