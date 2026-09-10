import { Jimp } from 'jimp';

const FAVICON_SIZE = 50;

// Scales the uploaded logo down to a 50x50 favicon. Uses contain() so both
// dimensions are scaled by the same factor (no independent x/y stretch) and
// the result is padded with transparency to fill out the square, rather than
// cropping any of the image away.
export async function generateFaviconBuffer(sourceBuffer) {
  const image = await Jimp.read(sourceBuffer);
  image.contain({ w: FAVICON_SIZE, h: FAVICON_SIZE });
  const data = await image.getBuffer('image/png');
  return { data, contentType: 'image/png' };
}
