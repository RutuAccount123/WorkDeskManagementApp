export async function encodeImage(file) {
  if (!file) throw new Error('Choose an image file.');
  if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
    throw new Error('Choose an image file smaller than 10 MB.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not process this image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
  } finally {
    bitmap.close();
  }
}
