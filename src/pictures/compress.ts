// Big enough for a sharp tile on a 2x screen, small enough that 500 photos stay around 25 MB.
export const MAX_SIDE = 480;

export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('could not encode photo'))), type, quality),
  );
}

/** Shrinks a camera photo to a small WebP (JPEG on phones that cannot make WebP). */
export async function compressPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no canvas');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    // Browsers that cannot encode WebP silently return PNG, which would be far bigger.
    const webp = await toBlob(canvas, 'image/webp', 0.7);
    return webp.type === 'image/webp' ? webp : await toBlob(canvas, 'image/jpeg', 0.75);
  } finally {
    bitmap.close();
  }
}
