const BASE_URL = '/api/settings';

export function logoUrl() {
  return `${BASE_URL}/logo`;
}

export function faviconUrl() {
  return `${BASE_URL}/favicon`;
}

// No custom logo/favicon set is a normal, expected state (falls back to the
// built-in default) - a HEAD request lets us check without an error.
async function exists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

export const hasCustomLogo = () => exists(logoUrl());

// Uploads the full-size logo; the backend derives and stores the 50x50
// favicon from it in the same request.
export async function uploadLogo(file) {
  const formData = new FormData();
  formData.append('logo', file);
  const res = await fetch(logoUrl(), { method: 'PUT', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update the site logo');
  }
}

export async function resetLogo() {
  const res = await fetch(logoUrl(), { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reset the site logo');
  }
}

// Shown at the top of the /wall kiosk display in place of the default
// "Church Directory" title when set (see WallPage.jsx). `null` means unset.
export async function getChurchName() {
  const res = await fetch(`${BASE_URL}/church-name`);
  if (!res.ok) throw new Error('Failed to load the church name');
  const { churchName } = await res.json();
  return churchName;
}

export async function updateChurchName(churchName) {
  const res = await fetch(`${BASE_URL}/church-name`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ churchName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update the church name');
  }
  return (await res.json()).churchName;
}
