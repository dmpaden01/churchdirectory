import express from 'express';
import Family from '../models/Family.js';
import Setting from '../models/Setting.js';
import { currentLocation, needsGeocode, syncGeocodes } from '../utils/geocoder.js';

const router = express.Router();

// GET /api/map/config - what the browser needs to load the Family Map. The
// Maps JavaScript API key is necessarily visible to anyone who can load the
// map, so it should be restricted to this site's URL in Google Cloud Console.
// The separate server-side Geocoding key (if any) is never included.
router.get('/config', async (req, res) => {
  try {
    const settings = await Setting.findById('singleton').select('googleMapsApiKey googleMapId');
    res.json({ apiKey: settings?.googleMapsApiKey || null, mapId: settings?.googleMapId || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/map/families - one entry per family with a located address.
// Served entirely from the cached coordinates; if some addresses still need
// geocoding, that's kicked off in the background and `pending` tells the
// page to mention it rather than making the viewer wait.
router.get('/families', async (req, res) => {
  try {
    const families = await Family.find()
      .sort({ familyName: 1 })
      .select('familyName address city state zipCode geo')
      .lean();

    const located = [];
    let pending = 0;
    for (const family of families) {
      const location = currentLocation(family);
      if (location) {
        located.push({ _id: family._id, familyName: family.familyName, ...location });
      } else if (needsGeocode(family)) {
        pending += 1;
      }
    }

    if (pending > 0) syncGeocodes();
    res.json({ families: located, pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
