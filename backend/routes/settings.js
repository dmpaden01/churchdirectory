import express from 'express';
import Setting from '../models/Setting.js';
import upload from '../middleware/upload.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

const SINGLETON_ID = 'singleton';

// GET /api/settings/favicon - public (no auth): the browser needs this before
// anyone signs in, e.g. for the login page's own tab icon.
router.get('/favicon', async (req, res) => {
  try {
    const settings = await Setting.findById(SINGLETON_ID).select('favicon');
    if (!settings?.favicon?.data) return res.status(404).end();
    res.set('Content-Type', settings.favicon.contentType);
    res.set('Cache-Control', 'no-cache');
    res.send(settings.favicon.data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/settings/favicon - replace the site favicon (admin only)
router.put('/favicon', requireAuth, requireRole('admin'), upload.single('favicon'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file was provided.' });
    await Setting.findByIdAndUpdate(
      SINGLETON_ID,
      { _id: SINGLETON_ID, favicon: { data: req.file.buffer, contentType: req.file.mimetype } },
      { upsert: true },
    );
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/settings/favicon - revert to the built-in default (admin only)
router.delete('/favicon', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await Setting.findByIdAndUpdate(SINGLETON_ID, { $unset: { favicon: '' } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
