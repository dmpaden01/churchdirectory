// pdfjs-dist's Node "legacy" build expects DOMMatrix/ImageData/Path2D to exist (either
// natively or via @napi-rs/canvas) and unconditionally constructs one at module load time
// (`const SCALE_MATRIX = new DOMMatrix();`), outside any try/catch. On hosts where
// @napi-rs/canvas's native addon can't load (see backend/vendor/napi-rs-canvas-stub - e.g.
// a CPU without AVX), that top-level call throws and crashes the whole process before a
// single route is registered. Importing this file first (see server.js) pre-populates
// minimal, non-native polyfills so pdfjs-dist finds them already present and skips its own
// (crashing) canvas require. Actual page rendering/image extraction still isn't available
// on such hosts - only text extraction, which doesn't exercise these APIs.
if (!globalThis.DOMMatrix) {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      if (Array.isArray(init) && init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      } else {
        this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      }
    }
    multiply() { return this; }
    multiplySelf() { return this; }
    preMultiplySelf() { return this; }
    invertSelf() { return this; }
    translate() { return this; }
    scale() { return this; }
    transformPoint(p) { return p; }
  };
}

if (!globalThis.ImageData) {
  globalThis.ImageData = class ImageData {
    constructor(dataOrWidth, widthOrHeight, height) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height;
      }
    }
  };
}

if (!globalThis.Path2D) {
  globalThis.Path2D = class Path2D {
    addPath() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    rect() {}
    arc() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
  };
}
