import express from 'express';
import { access } from 'fs/promises';
import Family from '../models/Family.js';
import { requireWallKey } from '../middleware/auth.js';
import { photoAbsolutePath } from '../utils/photoStorage.js';

const router = express.Router();

router.use(requireWallKey);

// GET /api/wall/families?key=... - minimal data for the read-only wall
// display: family name, family photo, and each member's role/first name/
// photo presence. Also includes lastName and roleStatus, needed for the
// Staff/Elders/Deacons roster page (see WallPage.jsx) - still deliberately
// excludes contact info, birthdays, and address, since this endpoint has no
// per-user auth, just a shared key.
router.get('/families', async (req, res) => {
  try {
    const families = await Family.find({})
      .sort({ familyName: 1 })
      .select('familyName photo individuals.role individuals.firstName individuals.lastName individuals.roleStatus individuals.photo')
      .lean();
    res.json(families);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shared by both photo routes below. Checks the file exists before setting a
// long-lived Cache-Control - a 404 response must never be cached, or a photo
// added later would stay "missing" in already-loaded browser tabs until the
// cache expires.
async function servePhoto(photo, res) {
  if (!photo?.filename) return res.status(404).end();
  const absPath = photoAbsolutePath(photo.filename);
  try {
    await access(absPath);
  } catch {
    return res.status(404).end();
  }
  res.set('Content-Type', photo.contentType);
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(absPath, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
}

// GET /api/wall/families/:id/photo?key=... - the family's own photo
router.get('/families/:id/photo', async (req, res) => {
  try {
    const family = await Family.findById(req.params.id).select('photo');
    await servePhoto(family?.photo, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/wall/families/:id/individuals/:index/photo?key=... - one
// individual's photo, for the Staff/Elders/Deacons roster page.
router.get('/families/:id/individuals/:index/photo', async (req, res) => {
  try {
    const family = await Family.findById(req.params.id).select('individuals');
    const individual = family?.individuals?.[req.params.index];
    await servePhoto(individual?.photo, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
