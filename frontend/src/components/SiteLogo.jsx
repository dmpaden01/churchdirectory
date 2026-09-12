import { useState } from 'react';
import { logoUrl } from '../api/settings';

// Shown to the left of the "Church Directory" title wherever it appears, once
// an admin has uploaded one via Settings. Requests the logo directly rather
// than checking for one first, so it loads in one round-trip instead of two
// (and can be served from the <link rel="preload"> in index.html) - hidden
// on a failed/404 load instead, so it still renders nothing when unset.
export default function SiteLogo({ className }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;
  return <img src={logoUrl()} alt="" className={className} onError={() => setFailed(true)} />;
}
