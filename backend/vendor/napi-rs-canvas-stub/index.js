// No-op stand-in for @napi-rs/canvas (see package.json for why this exists).
// pdfjs-dist's Node "legacy" build and pdf-parse's image-extraction worker both
// `require("@napi-rs/canvas")` to get DOMMatrix/ImageData/Path2D polyfills and a
// createCanvas() for rendering. We can't provide real rendering here, so callers
// that actually try to rasterize a page get a clear, catchable error instead of
// the native addon's SIGILL.

class Unsupported {
  constructor() {
    throw new Error('@napi-rs/canvas is stubbed out on this host (native addon incompatible with the CPU) - PDF page rendering/image extraction is unavailable.');
  }
}

function createCanvas() {
  throw new Error('@napi-rs/canvas is stubbed out on this host (native addon incompatible with the CPU) - PDF page rendering/image extraction is unavailable.');
}

module.exports = {
  Canvas: Unsupported,
  DOMMatrix: Unsupported,
  ImageData: Unsupported,
  Path2D: Unsupported,
  createCanvas,
};
