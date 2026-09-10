import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Standard PDF matrix composition: applies `m` first, then the current transform `ctm`.
function multiplyMatrix(m, ctm) {
  return [
    m[0] * ctm[0] + m[1] * ctm[2],
    m[0] * ctm[1] + m[1] * ctm[3],
    m[2] * ctm[0] + m[3] * ctm[2],
    m[2] * ctm[1] + m[3] * ctm[3],
    m[4] * ctm[0] + m[5] * ctm[2] + ctm[4],
    m[4] * ctm[1] + m[5] * ctm[3] + ctm[5],
  ];
}

// Walks a page's operator list tracking the transform stack (save/restore/cm) to find
// where each embedded image is actually drawn, since pdf.js doesn't expose this directly.
async function getImagePositions(page) {
  const opList = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const positions = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    if (fn === OPS.save) {
      stack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() || ctm;
    } else if (fn === OPS.transform) {
      ctm = multiplyMatrix(args, ctm);
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
      // Images paint into the unit square; take the transformed center's Y.
      const centerY = ctm[1] * 0.5 + ctm[3] * 0.5 + ctm[5];
      positions.push({ name: args[0], y: centerY });
    }
  }
  return positions;
}

// Matches each embedded image to the family it visually belongs to, by finding the
// nearest family header directly above the image on the same page. This is precise
// enough to tell which specific family (among several sharing a page) has no photo,
// which a simple "photo count per page" heuristic cannot do.
//
// entries: [{ index, pageNum, prefix }] - one per family; prefix is the distinctive
//   "LastName," text used to locate that family's header line among the page's raw
//   text runs (pdf-parse's line-joined text doesn't line up 1:1 with pdf.js's items,
//   so matching must happen against pdf.js's own text items here).
// Returns Map<imageName, familyIndex>.
export async function matchImagesToFamilies(pdfBuffer, entries) {
  const byPage = new Map();
  entries.forEach((entry) => {
    if (entry.pageNum == null || !entry.prefix) return;
    if (!byPage.has(entry.pageNum)) byPage.set(entry.pageNum, []);
    byPage.get(entry.pageNum).push(entry);
  });

  const doc = await getDocument({ data: new Uint8Array(Buffer.from(pdfBuffer)) }).promise;
  const imageNameToFamilyIndex = new Map();

  try {
    for (const [pageNum, pageEntries] of byPage) {
      const page = await doc.getPage(pageNum);
      const [textContent, imagePositions] = await Promise.all([
        page.getTextContent(),
        getImagePositions(page),
      ]);

      const usedItemIndices = new Set();
      const headerYs = pageEntries
        .map((entry) => {
          const idx = textContent.items.findIndex(
            (item, i) => !usedItemIndices.has(i) && item.str.trim().startsWith(entry.prefix),
          );
          if (idx === -1) return null;
          usedItemIndices.add(idx);
          return { index: entry.index, y: textContent.items[idx].transform[5] };
        })
        .filter(Boolean);

      for (const img of imagePositions) {
        // The image belongs to the nearest header above it: smallest header Y that's still >= image Y.
        let best = null;
        for (const h of headerYs) {
          if (h.y >= img.y && (best === null || h.y < best.y)) best = h;
        }
        if (best) imageNameToFamilyIndex.set(img.name, best.index);
      }
    }
  } finally {
    await doc.destroy();
  }

  return imageNameToFamilyIndex;
}
