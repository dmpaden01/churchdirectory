// Geocodes family addresses for the Family Map and caches the results on each
// Family (the `geo` field), so the Geocoding API is only called when an
// address is new or has changed - not every time someone opens the map.
//
// Google's terms only allow caching geocoded coordinates for 30 days, so
// otherwise-unchanged addresses are also re-geocoded once they're that old.
// For a directory this size that's roughly one request per family per month.
import Family from '../models/Family.js';
import Setting from '../models/Setting.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_AFTER_MS = 30 * DAY_MS;
// A transient failure (network, Google hiccup) gets retried sooner.
const RETRY_ERROR_AFTER_MS = DAY_MS;
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// Last failure that stopped a sync (e.g. a rejected key), shown to admins on
// the Settings page. Cleared by the next sync that gets through cleanly.
let lastError = null;
let running = null;

// The string sent to Google. Apt/suite is left out - it doesn't change where
// the marker goes, so editing it shouldn't cost a new geocode.
export function geocodeAddress(family) {
  const cityStateZip = [family.city, family.state, family.zipCode].filter(Boolean).join(' ');
  if (!family.address || !cityStateZip) return null;
  return `${family.address}, ${cityStateZip}`;
}

export function needsGeocode(family, now = Date.now()) {
  const address = geocodeAddress(family);
  if (!address) return Boolean(family.geo);
  const { geo } = family;
  if (!geo || geo.address !== address) return true;
  const maxAge = geo.status === 'error' ? RETRY_ERROR_AFTER_MS : REFRESH_AFTER_MS;
  return now - new Date(geo.geocodedAt).getTime() > maxAge;
}

// Fresh, usable coordinates for the family's current address, or null.
export function currentLocation(family) {
  const { geo } = family;
  if (geo?.status !== 'ok' || geo.address !== geocodeAddress(family)) return null;
  return { lat: geo.lat, lng: geo.lng };
}

class FatalGeocodeError extends Error {}

async function geocode(address, key) {
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data = await res.json();
  switch (data.status) {
    case 'OK': {
      const { lat, lng } = data.results[0].geometry.location;
      return { status: 'ok', lat, lng };
    }
    case 'ZERO_RESULTS':
      return { status: 'not_found' };
    // Key/billing/quota problems - every other address would fail the same
    // way, so stop the run instead of burning through the whole list.
    case 'REQUEST_DENIED':
    case 'OVER_DAILY_LIMIT':
    case 'OVER_QUERY_LIMIT':
      throw new FatalGeocodeError(`${data.status}: ${data.error_message || 'Google rejected the request.'}`);
    default:
      throw new Error(`${data.status}: ${data.error_message || 'Geocoding failed.'}`);
  }
}

async function geocodingKey() {
  const settings = await Setting.findById('singleton').select('googleMapsApiKey googleGeocodingApiKey');
  return settings?.googleGeocodingApiKey || settings?.googleMapsApiKey || null;
}

async function run() {
  const key = await geocodingKey();
  if (!key) return;

  const families = await Family.find().select('address city state zipCode geo');
  const now = Date.now();
  let hadError = false;

  for (const family of families) {
    if (!needsGeocode(family, now)) continue;
    const address = geocodeAddress(family);
    // timestamps: false - a cache refresh isn't an edit to the family.
    const save = (update) => Family.updateOne({ _id: family._id }, update, { timestamps: false });

    if (!address) {
      await save({ $unset: { geo: '' } });
      continue;
    }

    let result;
    try {
      result = await geocode(address, key);
    } catch (err) {
      hadError = true;
      lastError = err.message;
      if (err instanceof FatalGeocodeError) break;
      result = { status: 'error' };
    }
    await save({ $set: { geo: { address, ...result, geocodedAt: new Date() } } });
  }

  if (!hadError) lastError = null;
}

// Geocodes whatever is new/changed/stale. Safe to call often (after every
// family save, on a timer, when the map is opened) - it's a no-op when
// nothing needs doing, and concurrent calls share the one run in progress.
export function syncGeocodes() {
  if (!running) {
    running = run()
      .catch((err) => {
        lastError = err.message;
        console.error('Geocoding sync failed:', err);
      })
      .finally(() => { running = null; });
  }
  return running;
}

export function startGeocodeSchedule() {
  syncGeocodes();
  setInterval(syncGeocodes, DAY_MS).unref();
}

// Summary for the admin Settings page.
export async function geocodeStatus() {
  const families = await Family.find().select('familyName address city state zipCode geo').lean();
  const withAddress = families.filter((f) => geocodeAddress(f));
  const notFound = withAddress.filter((f) => f.geo?.status === 'not_found' && !needsGeocode(f));
  return {
    withAddress: withAddress.length,
    located: withAddress.filter((f) => currentLocation(f)).length,
    pending: withAddress.filter((f) => needsGeocode(f) && !currentLocation(f)).length,
    notFound: notFound.map((f) => ({ _id: f._id, familyName: f.familyName, address: geocodeAddress(f) })),
    running: Boolean(running),
    lastError,
  };
}
