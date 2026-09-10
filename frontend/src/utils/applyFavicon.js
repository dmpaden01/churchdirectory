import { faviconUrl, hasCustomFavicon } from '../api/settings';

// Swaps the browser tab icon to the custom one stored in MongoDB, if an admin
// has set one; otherwise leaves the static default (frontend/public/favicon.svg)
// already linked in index.html alone. Safe to call anytime - on app load
// (before login, since the favicon endpoint is public) and right after an
// admin uploads/removes one, so the change is visible without a page reload.
export async function applyDynamicFavicon() {
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  const exists = await hasCustomFavicon();
  link.href = exists ? `${faviconUrl()}?v=${Date.now()}` : '/favicon.svg';
}
