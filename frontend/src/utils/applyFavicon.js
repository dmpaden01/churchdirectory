import { faviconUrl } from '../api/settings';

// Swaps the browser tab icon to the custom one stored on disk, if an admin
// has set one; otherwise leaves the static default (frontend/public/favicon.svg)
// already linked in index.html alone. Safe to call anytime - on app load
// (before login, since the favicon endpoint is public) and right after an
// admin uploads/removes one, so the change is visible without a page reload.
//
// Sets the href directly rather than checking for one first, so it loads in
// one round-trip instead of two (and can be served from the <link
// rel="preload"> in index.html - which only works because this uses the
// same bare URL, with no cache-busting query string). Falls back to the
// static default on a failed/404 load.
export function applyDynamicFavicon() {
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  link.onerror = () => {
    link.onerror = null;
    link.href = '/favicon.svg';
  };
  link.href = faviconUrl();
}
