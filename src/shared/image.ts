/**
 * Shrinks a picture in the browser before it is uploaded, so free storage and data transfer last.
 * Longest side is capped, and quality is lowered until the file is small.
 */
export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
  extension: 'webp' | 'jpg';
}

const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export async function resizeImage(file: File, maxSide = 1200, targetBytes = 200_000): Promise<ResizedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a picture file.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That picture is too large. Choose one under 15 MB.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('We could not read that picture. Try a JPG, PNG or WebP file.');
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process that picture.');
  context.fillStyle = '#ffffff'; // transparent areas become white instead of black
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  let type = 'image/webp';
  let quality = 0.82;
  let blob = await encode(type, quality);
  if (!blob || blob.type !== 'image/webp') {
    type = 'image/jpeg'; // older Safari cannot create WebP
    blob = await encode(type, quality);
  }
  if (!blob) throw new Error('Could not process that picture.');

  while (blob.size > targetBytes && quality > 0.4) {
    quality -= 0.1;
    const smaller = await encode(type, quality);
    if (!smaller) break;
    blob = smaller;
  }

  return { blob, width, height, extension: type === 'image/webp' ? 'webp' : 'jpg' };
}
