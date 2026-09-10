const BASE_URL = '/api/settings';

export function faviconUrl() {
  return `${BASE_URL}/favicon`;
}

// No custom favicon set is a normal, expected state (falls back to the
// built-in default) - a HEAD request lets us check without an error.
export async function hasCustomFavicon() {
  try {
    const res = await fetch(faviconUrl(), { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadFavicon(file) {
  const formData = new FormData();
  formData.append('favicon', file);
  const res = await fetch(faviconUrl(), { method: 'PUT', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update favicon');
  }
}

export async function resetFavicon() {
  const res = await fetch(faviconUrl(), { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reset favicon');
  }
}
