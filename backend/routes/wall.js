import express from 'express';
import { access } from 'fs/promises';
import Family from '../models/Family.js';
import { requireWallKey } from '../middleware/auth.js';
import { photoAbsolutePath } from '../utils/photoStorage.js';

const router = express.Router();

router.use(requireWallKey);

// GET /api/wall/families?key=... - minimal data for the read-only wall
// display: family name, family photo, and each member's role/first name
// only. Deliberately excludes last names, contact info, birthdays, and
// address - this endpoint has no per-user auth, just a shared key.
router.get('/families', async (req, res) => {
  try {
    const families = await Family.find({})
      .sort({ familyName: 1 })
      .select('familyName photo individuals.role individuals.firstName')
      .lean();
    res.json(families);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wall/families/:id/photo?key=... - the family's own photo
router.get('/families/:id/photo', async (req, res) => {
  try {
    const family = await Family.findById(req.params.id).select('photo');
    if (!family?.photo?.filename) return res.status(404).end();

    // Check the file exists before setting a long-lived Cache-Control - a 404
    // response must never be cached, or a photo added later would stay
    // "missing" in already-loaded browser tabs until the cache expires.
    const absPath = photoAbsolutePath(family.photo.filename);
    try {
      await access(absPath);
    } catch {
      return res.status(404).end();
    }

    res.set('Content-Type', family.photo.contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    res.sendFile(absPath, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
