import express from 'express';
import Setting from '../models/Setting.js';
import upload from '../middleware/upload.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateFaviconBuffer } from '../utils/generateFavicon.js';
import { savePhoto, deletePhoto, photoAbsolutePath } from '../utils/photoStorage.js';

const router = express.Router();

const SINGLETON_ID = 'singleton';

function servePhoto(photo, res) {
  if (!photo?.filename) return res.status(404).end();
  res.set('Content-Type', photo.contentType);
  res.set('Cache-Control', 'no-cache');
  res.sendFile(photoAbsolutePath(photo.filename), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
}

// GET /api/settings/logo - the original full-size uploaded image (public: not
// sensitive, and may be displayed as site branding before login).
router.get('/logo', async (req, res) => {
  try {
    const settings = await Setting.findById(SINGLETON_ID).select('logo');
    servePhoto(settings?.logo, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/settings/favicon - the auto-generated 50x50 version (public: the
// browser needs this before anyone signs in, e.g. for the login page's tab icon).
router.get('/favicon', async (req, res) => {
  try {
    const settings = await Setting.findById(SINGLETON_ID).select('favicon');
    servePhoto(settings?.favicon, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/settings/logo - upload a new site logo (admin only). Stores the
// original as-is and derives+stores the 50x50 favicon from it in one step.
router.put('/logo', requireAuth, requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file was provided.' });

    const previous = await Setting.findById(SINGLETON_ID).select('logo favicon');
    const faviconBuffer = await generateFaviconBuffer(req.file.buffer);

    const logoFilename = await savePhoto(req.file.buffer, req.file.mimetype);
    const faviconFilename = await savePhoto(faviconBuffer.data, faviconBuffer.contentType);

    await Setting.findByIdAndUpdate(
      SINGLETON_ID,
      {
        _id: SINGLETON_ID,
        logo: { filename: logoFilename, contentType: req.file.mimetype },
        favicon: { filename: faviconFilename, contentType: faviconBuffer.contentType },
      },
      { upsert: true },
    );

    await Promise.all([deletePhoto(previous?.logo?.filename), deletePhoto(previous?.favicon?.filename)]);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/settings/logo - revert to the built-in default (admin only)
router.delete('/logo', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const previous = await Setting.findByIdAndUpdate(SINGLETON_ID, { $unset: { logo: '', favicon: '' } });
    await Promise.all([deletePhoto(previous?.logo?.filename), deletePhoto(previous?.favicon?.filename)]);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
