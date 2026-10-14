export async function readReference(file: File, maxSide = 1600): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Maximum image size is 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error('Image processing is unavailable.');
    if (maxSide > 256) { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(maxSide <= 256 ? 'image/png' : 'image/jpeg', 0.85);
  } finally { bitmap.close(); }
}
