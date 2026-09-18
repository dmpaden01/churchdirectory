import { useEffect, useState } from 'react';
import { getVersionInfo } from '../api/settings';
import './Footer.css';

// Shown at the bottom of every page (see App.jsx) - sticks to the bottom of
// the viewport on short pages via the margin-top: auto trick in Footer.css,
// and simply follows the content on pages long enough to scroll.
// undefined: not loaded yet (nothing shown, avoids a flash before the
// request resolves) - a resolved value is always an object (branch/tag/
// commit each null if unavailable), whether the fetch actually succeeded or
// not, since the fallback below treats the two cases the same way.
const NOT_LOADED = undefined;

export default function Footer() {
  const [version, setVersion] = useState(NOT_LOADED);

  useEffect(() => {
    getVersionInfo()
      .then(setVersion)
      .catch(() => setVersion({ branch: null, tag: null, commit: null }));
  }, []);

  // Prefer the tag (a real release) over the branch name, paired with the
  // short commit hash. Falls back to "unversioned" once loaded with neither
  // available - e.g. the .git bind mount (see docker-compose.yml) is missing
  // because this was deployed from a downloaded source zip rather than an
  // actual git checkout (see backend/utils/gitVersion.js).
  const versionLabel = version && (version.tag || version.branch || 'unversioned');

  return (
    <footer className="app-footer">
      {versionLabel && (
        <p className="app-footer-version">
          {versionLabel}
          {version.commit && ` (${version.commit})`}
        </p>
      )}
      <p>&copy; 2026 Centerville Church of Christ</p>
      <p>All Rights Reserved</p>
    </footer>
  );
}
