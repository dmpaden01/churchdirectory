import { useEffect, useState } from 'react';
import { logoUrl, hasCustomLogo } from '../api/settings';

// Shown to the left of the "Church Directory" title wherever it appears, once
// an admin has uploaded one via Settings. Renders nothing until then, so the
// title looks exactly as it did before this feature existed.
export default function SiteLogo({ className }) {
  const [hasCustom, setHasCustom] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hasCustomLogo().then((exists) => {
      if (!cancelled) setHasCustom(exists);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasCustom) return null;
  return <img src={logoUrl()} alt="" className={className} />;
}
