import express from 'express';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { PDFParse } from 'pdf-parse';
import Family from '../models/Family.js';
import upload from '../middleware/upload.js';
import uploadPdf from '../middleware/uploadPdf.js';
import {
  parseDirectoryPdf,
  flagExistingMatches,
  buildPhotoMatchEntries,
  attachPhotos,
  stripInternalFields,
} from '../utils/parseDirectoryPdf.js';
import { matchImagesToFamilies } from '../utils/pdfPhotoMatcher.js';

const router = express.Router();

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

function extensionFor(mimetype) {
  return mimetype === 'image/png' ? '.png' : '.jpg';
}

function familyDir(familyId) {
  return path.join(UPLOADS_ROOT, String(familyId));
}

function savePhoto(file, familyId, baseName) {
  const dir = familyDir(familyId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${baseName}${extensionFor(file.mimetype)}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return `/uploads/${familyId}/${filename}`;
}

function deletePhoto(photoPath) {
  if (!photoPath) return;
  const absolute = path.join(process.cwd(), photoPath.replace(/^\//, ''));
  fs.rm(absolute, { force: true }, () => {});
}

function findFile(files, fieldname) {
  return files.find((f) => f.fieldname === fieldname);
}

// Build the individuals array for save, handling new/removed/kept photos.
function buildIndividuals(rawIndividuals, existingIndividuals, files, familyId) {
  return rawIndividuals.map((raw, index) => {
    const existing = existingIndividuals?.[index];
    let photoPath = existing?.photoPath || undefined;

    if (raw.removePhoto && photoPath) {
      deletePhoto(photoPath);
      photoPath = undefined;
    }

    if (raw._photoField) {
      const file = findFile(files, raw._photoField);
      if (file) {
        if (photoPath) deletePhoto(photoPath);
        photoPath = savePhoto(file, familyId, `individual-${index}`);
      }
    }

    return {
      role: raw.role,
      firstName: raw.firstName,
      lastName: raw.lastName,
      gender: raw.gender,
      cellPhone: raw.cellPhone || undefined,
      email: raw.email || undefined,
      birthday: raw.birthday || undefined,
      photoPath,
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
      .select('familyName city state photoPath individuals')
      .lean();
    res.json(families);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/families/parse-pdf - extract draft families from a legacy directory PDF for review.
// Nothing is saved here; the client reviews/completes each draft and creates it via POST /.
router.post('/parse-pdf', uploadPdf.single('pdf'), async (req, res) => {
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

// POST /api/families - create a new family
router.post('/', upload.any(), async (req, res) => {
  try {
    const payload = JSON.parse(req.body.data || '{}');
    const familyId = new mongoose.Types.ObjectId();
    const files = req.files || [];

    const individuals = buildIndividuals(payload.individuals || [], [], files, familyId);
    if (individuals.length === 0 || individuals[0].role !== 'head') {
      return res.status(400).json({ error: 'A head of household is required.' });
    }

    let photoPath;
    if (payload._photoField) {
      const file = findFile(files, payload._photoField);
      if (file) photoPath = savePhoto(file, familyId, 'family');
    }

    const family = new Family({
      _id: familyId,
      familyName: individuals[0].lastName,
      address: payload.address,
      aptSuite: payload.aptSuite || undefined,
      city: payload.city,
      state: payload.state,
      zipCode: payload.zipCode,
      homePhone: payload.homePhone || undefined,
      anniversary: payload.anniversary || undefined,
      photoPath,
      individuals,
    });

    await family.save();
    res.status(201).json(family);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/families/:id - update an existing family
router.put('/:id', upload.any(), async (req, res) => {
  try {
    const existing = await Family.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Family not found' });

    const payload = JSON.parse(req.body.data || '{}');
    const files = req.files || [];
    const familyId = existing._id;

    const individuals = buildIndividuals(
      payload.individuals || [],
      existing.individuals,
      files,
      familyId,
    );
    if (individuals.length === 0 || individuals[0].role !== 'head') {
      return res.status(400).json({ error: 'A head of household is required.' });
    }

    let photoPath = existing.photoPath;
    if (payload.removeFamilyPhoto && photoPath) {
      deletePhoto(photoPath);
      photoPath = undefined;
    }
    if (payload._photoField) {
      const file = findFile(files, payload._photoField);
      if (file) {
        if (photoPath) deletePhoto(photoPath);
        photoPath = savePhoto(file, familyId, 'family');
      }
    }

    existing.familyName = individuals[0].lastName;
    existing.address = payload.address;
    existing.aptSuite = payload.aptSuite || undefined;
    existing.city = payload.city;
    existing.state = payload.state;
    existing.zipCode = payload.zipCode;
    existing.homePhone = payload.homePhone || undefined;
    existing.anniversary = payload.anniversary || undefined;
    existing.photoPath = photoPath;
    existing.individuals = individuals;

    await existing.save();
    res.json(existing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/families/:id
router.delete('/:id', async (req, res) => {
  try {
    const family = await Family.findByIdAndDelete(req.params.id);
    if (!family) return res.status(404).json({ error: 'Family not found' });
    fs.rm(familyDir(family._id), { recursive: true, force: true }, () => {});
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
