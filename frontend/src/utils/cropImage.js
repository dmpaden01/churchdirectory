// Renders the crop area a user picked in <PhotoCropModal> onto a canvas at
// its native pixel size, producing a File cropped to exactly that region -
// used so uploaded photos always end up at the app's standard 3:2 ratio
// regardless of the source image's original shape.

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = url;
  });
}

export async function cropImageToFile(imageUrl, croppedAreaPixels, fileName, mimeType) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(croppedAreaPixels.width);
  canvas.height = Math.round(croppedAreaPixels.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) { reject(new Error('Failed to crop image')); return; }
      resolve(result);
    }, mimeType, 0.92);
  });

  return new File([blob], fileName, { type: mimeType });
}
