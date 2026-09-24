import express from 'express';
import Setting from '../models/Setting.js';
import upload from '../middleware/upload.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateFaviconBuffer } from '../utils/generateFavicon.js';
import { savePhoto, deletePhoto, photoAbsolutePath } from '../utils/photoStorage.js';
import { gitVersion } from '../utils/gitVersion.js';
import { geocodeStatus, syncGeocodes } from '../utils/geocoder.js';

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

// GET /api/settings/version - public: branch/tag + short commit hash, shown
// in the footer on every page (see gitVersion.js for where this comes from).
router.get('/version', (req, res) => {
  res.json(gitVersion);
});

// GET /api/settings/church-name - public: read by the /wall kiosk display
// (which has no signed-in user) to show in place of the default title.
router.get('/church-name', async (req, res) => {
  try {
    const settings = await Setting.findById(SINGLETON_ID).select('churchName');
    res.json({ churchName: settings?.churchName || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/settings/church-name (admin only) - blank clears it back to unset.
router.put('/church-name', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const churchName = typeof req.body.churchName === 'string' ? req.body.churchName.trim() : '';
    if (churchName) {
      await Setting.findByIdAndUpdate(SINGLETON_ID, { _id: SINGLETON_ID, churchName }, { upsert: true });
    } else {
      await Setting.findByIdAndUpdate(SINGLETON_ID, { $unset: { churchName: '' } });
    }
    res.json({ churchName: churchName || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const MAPS_KEY_FIELDS = ['googleMapsApiKey', 'googleGeocodingApiKey'];

// Keys are write-only here: the page only learns whether each one is set.
async function mapsSettingsResponse() {
  const settings = await Setting.findById(SINGLETON_ID)
    .select('googleMapsApiKey googleGeocodingApiKey googleMapId')
    .lean();
  return {
    googleMapsApiKeySet: Boolean(settings?.googleMapsApiKey),
    googleGeocodingApiKeySet: Boolean(settings?.googleGeocodingApiKey),
    googleMapId: settings?.googleMapId || '',
    geocoding: await geocodeStatus(),
  };
}

// GET /api/settings/maps (admin only) - Family Map settings plus how far
// geocoding of family addresses has gotten.
router.get('/maps', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    res.json(await mapsSettingsResponse());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/settings/maps (admin only). Key fields: a non-empty string
// replaces the key, null removes it, and blank/missing leaves it unchanged.
// googleMapId: blank clears it. Starts geocoding any not-yet-located
// addresses right away in case a key was added or replaced.
router.put('/maps', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const $set = {};
    const $unset = {};
    for (const field of MAPS_KEY_FIELDS) {
      const value = req.body[field];
      if (value === null) $unset[field] = '';
      else if (typeof value === 'string' && value.trim()) $set[field] = value.trim();
    }
    if ('googleMapId' in req.body) {
      const mapId = typeof req.body.googleMapId === 'string' ? req.body.googleMapId.trim() : '';
      if (mapId) $set.googleMapId = mapId;
      else $unset.googleMapId = '';
    }
    // Mongo 4.4 rejects an empty $unset, so only include it when needed.
    const update = { $set: { _id: SINGLETON_ID, ...$set } };
    if (Object.keys($unset).length) update.$unset = $unset;
    await Setting.findByIdAndUpdate(SINGLETON_ID, update, { upsert: true });
    syncGeocodes();
    res.json(await mapsSettingsResponse());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
