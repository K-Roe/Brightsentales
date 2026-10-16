import { validPlaceArtwork } from './placeFolders';

const maxSourceBytes = 12_000_000;
const maxDimension = 1672;

export async function preparePlaceArtwork(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (!file.size || file.size > maxSourceBytes) throw new Error('Choose an image smaller than 12 MB.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('This image could not be opened. Choose another PNG, JPEG or WebP file.'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width > 8000 || bitmap.height > 8000 || bitmap.width * bitmap.height > 40_000_000) throw new Error('Image dimensions are too large. Choose an image under 8000 pixels per side.');
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/webp', 0.82);
    if (!validPlaceArtwork(result)) throw new Error('The prepared image is too large for browser storage. Choose a smaller image.');
    return result;
  } finally { bitmap.close(); }
}
