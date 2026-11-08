// Shrinks camera photos before storing: phone photos are 3–8 MB each,
// a 1280px JPEG is ~150–300 KB and still readable for finding a shelf.

async function resize(bitmap, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  return { blob, width: w, height: h };
}

export async function processPhoto(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const full = await resize(bitmap, 1280, 0.75);
    const thumb = await resize(bitmap, 240, 0.7);
    return { blob: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
  } finally {
    bitmap.close?.();
  }
}
