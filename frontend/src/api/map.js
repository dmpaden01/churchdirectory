const BASE_URL = '/api/map';

// { apiKey, mapId } for loading Google Maps - apiKey is null until an admin
// sets one on the Settings page.
export async function getMapConfig() {
  const res = await fetch(`${BASE_URL}/config`);
  if (!res.ok) throw new Error('Failed to load the map settings');
  return res.json();
}

// { families: [{ _id, familyName, lat, lng }], pending } - served
// from cached coordinates; `pending` counts addresses still being located.
export async function getMapFamilies() {
  const res = await fetch(`${BASE_URL}/families`);
  if (!res.ok) throw new Error('Failed to load family locations');
  return res.json();
}
