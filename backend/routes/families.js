import express from 'express';
import { PDFParse } from 'pdf-parse';
import Family from '../models/Family.js';
import upload from '../middleware/upload.js';
import uploadPdf from '../middleware/uploadPdf.js';
import { requireRole } from '../middleware/auth.js';
import {
  parseDirectoryPdf,
  flagExistingMatches,
  buildPhotoMatchEntries,
  attachPhotos,
  stripInternalFields,
} from '../utils/parseDirectoryPdf.js';
import { matchImagesToFamilies } from '../utils/pdfPhotoMatcher.js';

const router = express.Router();

// Fields excluded everywhere except the dedicated photo-serving routes below,
// so listing/editing a family never pulls raw image bytes through the JSON API.
const EXCLUDE_PHOTO_DATA = '-photo.data -individuals.photo.data';

function findFile(files, fieldname) {
  return files.find((f) => f.fieldname === fieldname);
}

function toPhoto(file) {
  return file ? { data: file.buffer, contentType: file.mimetype } : undefined;
}

// Build the individuals array for save, handling new/removed/kept photos.
function buildIndividuals(rawIndividuals, existingIndividuals, files) {
  return rawIndividuals.map((raw, index) => {
    const existing = existingIndividuals?.[index];
    let photo = existing?.photo || undefined;

    if (raw.removePhoto) photo = undefined;

    if (raw._photoField) {
      const file = findFile(files, raw._photoField);
      if (file) photo = toPhoto(file);
    }

    return {
      role: raw.role,
      firstName: raw.firstName,
      lastName: raw.lastName,
      gender: raw.gender,
      cellPhone: raw.cellPhone || undefined,
      email: raw.email || undefined,
      birthday: raw.birthday || undefined,
      photo,
    };
  });
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
      .select(`${EXCLUDE_PHOTO_DATA} -address -aptSuite -zipCode -homePhone -anniversary`)
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
      const imageMatches = await matchImagesToFamilies(req.file.buffer, photoEntries);
      if (imageMatches.size > 0) {
        const imageResult = await parser.getImage();
        const imagesByName = new Map();
        imageResult.pages.forEach((p) => p.images.forEach((img) => imagesByName.set(img.name, img)));
        families = attachPhotos(families, imageMatches, imagesByName);
      }
    }

    res.json({ families: stripInternalFields(families) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/families/:id/photo - the family's own photo
router.get('/:id/photo', async (req, res) => {
  try {
    const family = await Family.findById(req.params.id).select('photo');
    if (!family?.photo?.data) return res.status(404).end();
    res.set('Content-Type', family.photo.contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(family.photo.data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/families/:id/individuals/:index/photo - one individual's photo
router.get('/:id/individuals/:index/photo', async (req, res) => {
  try {
    const family = await Family.findById(req.params.id).select('individuals');
    const individual = family?.individuals?.[req.params.index];
    if (!individual?.photo?.data) return res.status(404).end();
    res.set('Content-Type', individual.photo.contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(individual.photo.data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/families/:id - full family record
router.get('/:id', async (req, res) => {
  try {
    const family = await Family.findById(req.params.id).select(EXCLUDE_PHOTO_DATA);
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

    const individuals = buildIndividuals(payload.individuals || [], [], files);
    if (individuals.length === 0 || individuals[0].role !== 'head') {
      return res.status(400).json({ error: 'A head of household is required.' });
    }

    let photo;
    if (payload._photoField) {
      const file = findFile(files, payload._photoField);
      if (file) photo = toPhoto(file);
    }

    const family = new Family({
      familyName: individuals[0].lastName,
      address: payload.address,
      aptSuite: payload.aptSuite || undefined,
      city: payload.city,
      state: payload.state,
      zipCode: payload.zipCode,
      homePhone: payload.homePhone || undefined,
      anniversary: payload.anniversary || undefined,
      photo,
      individuals,
    });

    await family.save();
    const saved = await Family.findById(family._id).select(EXCLUDE_PHOTO_DATA);
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/families/:id - update an existing family (admin only)
router.put('/:id', requireRole('admin'), upload.any(), async (req, res) => {
  try {
    const existing = await Family.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Family not found' });

    const payload = JSON.parse(req.body.data || '{}');
    const files = req.files || [];

    const individuals = buildIndividuals(payload.individuals || [], existing.individuals, files);
    if (individuals.length === 0 || individuals[0].role !== 'head') {
      return res.status(400).json({ error: 'A head of household is required.' });
    }

    let photo = existing.photo;
    if (payload.removeFamilyPhoto) photo = undefined;
    if (payload._photoField) {
      const file = findFile(files, payload._photoField);
      if (file) photo = toPhoto(file);
    }

    existing.familyName = individuals[0].lastName;
    existing.address = payload.address;
    existing.aptSuite = payload.aptSuite || undefined;
    existing.city = payload.city;
    existing.state = payload.state;
    existing.zipCode = payload.zipCode;
    existing.homePhone = payload.homePhone || undefined;
    existing.anniversary = payload.anniversary || undefined;
    existing.photo = photo;
    existing.individuals = individuals;

    await existing.save();
    const saved = await Family.findById(existing._id).select(EXCLUDE_PHOTO_DATA);
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/families/:id (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const family = await Family.findByIdAndDelete(req.params.id);
    if (!family) return res.status(404).json({ error: 'Family not found' });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
