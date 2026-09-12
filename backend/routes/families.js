import express from 'express';
import { PDFParse } from 'pdf-parse';
import Family from '../models/Family.js';
import upload from '../middleware/upload.js';
import uploadPdf from '../middleware/uploadPdf.js';
import { requireRole } from '../middleware/auth.js';
import { savePhoto, deletePhoto, photoAbsolutePath } from '../utils/photoStorage.js';
import {
  parseDirectoryPdf,
  flagExistingMatches,
  buildPhotoMatchEntries,
  attachPhotos,
  stripInternalFields,
  isDraftIdenticalToFamily,
} from '../utils/parseDirectoryPdf.js';
import { matchImagesToFamilies } from '../utils/pdfPhotoMatcher.js';
import { normalizeAnniversary } from '../utils/anniversary.js';
import { normalizeBirthday } from '../utils/birthday.js';

const router = express.Router();

function findFile(files, fieldname) {
  return files.find((f) => f.fieldname === fieldname);
}

async function toPhoto(file) {
  if (!file) return undefined;
  const filename = await savePhoto(file.buffer, file.mimetype);
  return { filename, contentType: file.mimetype };
}

// Every photo filename currently referenced by a family document (its own
// plus each individual's), used to work out which files on disk are no
// longer referenced after a save and can be deleted.
function collectPhotoFilenames(family) {
  const filenames = [];
  if (family?.photo?.filename) filenames.push(family.photo.filename);
  (family?.individuals || []).forEach((ind) => {
    if (ind?.photo?.filename) filenames.push(ind.photo.filename);
  });
  return filenames;
}

async function deleteUnreferencedPhotos(beforeFilenames, afterFilenames) {
  const kept = new Set(afterFilenames);
  await Promise.all(beforeFilenames.filter((f) => !kept.has(f)).map(deletePhoto));
}

// Build the individuals array for save, handling new/removed/kept photos.
async function buildIndividuals(rawIndividuals, existingIndividuals, files) {
  return Promise.all(rawIndividuals.map(async (raw, index) => {
    const existing = existingIndividuals?.[index];
    let photo = existing?.photo || undefined;

    if (raw.removePhoto) photo = undefined;

    if (raw._photoField) {
      const file = findFile(files, raw._photoField);
      if (file) photo = await toPhoto(file);
    }

    return {
      role: raw.role,
      firstName: raw.firstName,
      lastName: raw.lastName,
      roleStatus: raw.roleStatus || undefined,
      cellPhone: raw.cellPhone || undefined,
      email: raw.email || undefined,
      birthday: normalizeBirthday(raw.birthday),
      photo,
    };
  }));
}

// Pulls the import-review notes/highlights out of a save payload, if the
// client supplied them (only the bulk "Accept All Changes" import path does).
// A normal save - whether a brand-new family, a manual edit, or one-at-a-time
// import review - never includes these, so saving through the regular form
// always clears whatever was persisted from an earlier bulk import.
function reviewFieldsFromPayload(payload) {
  return {
    reviewNotes: Array.isArray(payload.reviewNotes) && payload.reviewNotes.length > 0
      ? payload.reviewNotes
      : undefined,
    reviewChangedFields: payload.reviewChangedFields && typeof payload.reviewChangedFields === 'object'
      ? payload.reviewChangedFields
      : undefined,
  };
}

// GET /api/families?search=lastName - list families, optionally filtered by family name
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = search
      ? { familyName: { $regex: search.trim(), $options: 'i' } }
      : {};
    const families = await Family.find(filter)
      .sort({ familyName: 1 })
      .select('-address -aptSuite -zipCode -homePhone -anniversary')
      .lean();
    res.json(families);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/families/parse-pdf - extract draft families from a legacy directory PDF for review.
// Nothing is saved here; the client reviews/completes each draft and creates it via POST /.
router.post('/parse-pdf', requireRole('admin'), uploadPdf.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file was provided.' });
    const parser = new PDFParse({ data: req.file.buffer });
    const textResult = await parser.getText();
    const parsed = parseDirectoryPdf(textResult.text, textResult.pages);
    const existingFamilies = await Family.find({}, 'familyName address').lean();
    let families = flagExistingMatches(parsed, existingFamilies);

    const photoEntries = buildPhotoMatchEntries(families).filter((e) => e.pageNum != null && e.prefix);
    if (photoEntries.length > 0) {
      try {
        const imageMatches = await matchImagesToFamilies(req.file.buffer, photoEntries);
        if (imageMatches.size > 0) {
          const imageResult = await parser.getImage();
          const imagesByName = new Map();
          imageResult.pages.forEach((p) => p.images.forEach((img) => imagesByName.set(img.name, img)));
          families = attachPhotos(families, imageMatches, imagesByName);
        }
      } catch (photoErr) {
        // Photo extraction needs PDF page rendering, which isn't available on every host
        // (see backend/vendor/napi-rs-canvas-stub). Degrade to photo-less drafts rather
        // than failing the whole import.
        families.forEach((f) => f.notes.push('Photos could not be imported from the source PDF on this server.'));
      }
    }

    // Drop drafts that exactly match what's already saved (address, every
    // field, and the photo) - nothing would change if saved, so there's
    // nothing to review.
    const addressMatchIds = [...new Set(
      families.filter((f) => f.existingMatch === 'address').map((f) => f.existingFamilyId),
    )];
    let skippedUpToDateCount = 0;
    if (addressMatchIds.length > 0) {
      const fullExisting = await Family.find({ _id: { $in: addressMatchIds } }).lean();
      const existingById = new Map(fullExisting.map((f) => [String(f._id), f]));
      const before = families.length;
      families = families.filter((f) => {
        if (f.existingMatch !== 'address') return true;
        const existing = existingById.get(f.existingFamilyId);
        return !(existing && isDraftIdenticalToFamily(f, existing));
      });
      skippedUpToDateCount = before - families.length;
    }

    res.json({ families: stripInternalFields(families), skippedUpToDateCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/families/:id/photo - the family's own photo
router.get('/:id/photo', async (req, res) => {
  try {
    const family = await Family.findById(req.params.id).select('photo');
    if (!family?.photo?.filename) return res.status(404).end();
    res.set('Content-Type', family.photo.contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    res.sendFile(photoAbsolutePath(family.photo.filename), (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/families/:id/individuals/:index/photo - one individual's photo
router.get('/:id/individuals/:index/photo', async (req, res) => {
  try {
    const family = await Family.findById(req.params.id).select('individuals');
    const individual = family?.individuals?.[req.params.index];
    if (!individual?.photo?.filename) return res.status(404).end();
    res.set('Content-Type', individual.photo.contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    res.sendFile(photoAbsolutePath(individual.photo.filename), (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/families/:id - full family record
router.get('/:id', async (req, res) => {
  try {
    const family = await Family.findById(req.params.id);
    if (!family) return res.status(404).json({ error: 'Family not found' });
    res.json(family);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/families/:id/complete-review - dismisses needsReview and any
// import-review notes/highlights without touching the family's actual data
// (admin only). Lets a reviewer confirm a flagged family looks fine as-is
// from the read-only view, without a full edit-and-save round trip.
router.patch('/:id/complete-review', requireRole('admin'), async (req, res) => {
  try {
    const family = await Family.findByIdAndUpdate(
      req.params.id,
      { $set: { needsReview: false }, $unset: { reviewNotes: '', reviewChangedFields: '' } },
      { new: true },
    );
    if (!family) return res.status(404).json({ error: 'Family not found' });
    res.json(family);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/families - create a new family (admin only)
router.post('/', requireRole('admin'), upload.any(), async (req, res) => {
  try {
    const payload = JSON.parse(req.body.data || '{}');
    const files = req.files || [];

    const individuals = await buildIndividuals(payload.individuals || [], [], files);
    if (individuals.length === 0 || individuals[0].role !== 'head') {
      return res.status(400).json({ error: 'A head of household is required.' });
    }

    let photo;
    if (payload._photoField) {
      const file = findFile(files, payload._photoField);
      if (file) photo = await toPhoto(file);
    }

    const family = new Family({
      familyName: individuals[0].lastName,
      address: payload.address,
      aptSuite: payload.aptSuite || undefined,
      city: payload.city,
      state: payload.state,
      zipCode: payload.zipCode,
      homePhone: payload.homePhone || undefined,
      anniversary: normalizeAnniversary(payload.anniversary),
      needsReview: Boolean(payload.needsReview),
      ...reviewFieldsFromPayload(payload),
      photo,
      individuals,
    });

    await family.save();
    res.status(201).json(family);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/families/:id - update an existing family (admin only)
router.put('/:id', requireRole('admin'), upload.any(), async (req, res) => {
  try {
    const existing = await Family.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Family not found' });

    const beforePhotos = collectPhotoFilenames(existing);

    const payload = JSON.parse(req.body.data || '{}');
    const files = req.files || [];

    const individuals = await buildIndividuals(payload.individuals || [], existing.individuals, files);
    if (individuals.length === 0 || individuals[0].role !== 'head') {
      return res.status(400).json({ error: 'A head of household is required.' });
    }

    let photo = existing.photo;
    if (payload.removeFamilyPhoto) photo = undefined;
    if (payload._photoField) {
      const file = findFile(files, payload._photoField);
      if (file) photo = await toPhoto(file);
    }

    existing.familyName = individuals[0].lastName;
    existing.address = payload.address;
    existing.aptSuite = payload.aptSuite || undefined;
    existing.city = payload.city;
    existing.state = payload.state;
    existing.zipCode = payload.zipCode;
    existing.homePhone = payload.homePhone || undefined;
    existing.anniversary = normalizeAnniversary(payload.anniversary);
    existing.needsReview = Boolean(payload.needsReview);
    const { reviewNotes, reviewChangedFields } = reviewFieldsFromPayload(payload);
    existing.reviewNotes = reviewNotes;
    existing.reviewChangedFields = reviewChangedFields;
    existing.photo = photo;
    existing.individuals = individuals;

    await existing.save();
    await deleteUnreferencedPhotos(beforePhotos, collectPhotoFilenames(existing));
    res.json(existing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/families/:id (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const family = await Family.findByIdAndDelete(req.params.id);
    if (!family) return res.status(404).json({ error: 'Family not found' });
    await Promise.all(collectPhotoFilenames(family).map(deletePhoto));
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
