const BASE_URL = '/api/wall';

// The wall display has no signed-in user, so every request carries the
// shared key as a query param instead of relying on the auth cookie.
export function wallFamilyPhotoUrl(family, key) {
  return family?.photo?.contentType
    ? `${BASE_URL}/families/${family._id}/photo?key=${encodeURIComponent(key)}`
    : undefined;
}

export async function fetchWallFamilies(key) {
  const res = await fetch(`${BASE_URL}/families?key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error('Failed to load families');
  return res.json();
}
