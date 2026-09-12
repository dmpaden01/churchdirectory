import { useEffect, useRef, useState } from 'react';
import { fetchWallFamilies, wallFamilyPhotoUrl } from './api/wall';
import { getChurchName } from './api/settings';
import SiteLogo from './components/SiteLogo';
import './WallPage.css';

const DEFAULT_TITLE = 'Church Directory';

const WALL_KEY_STORAGE = 'wallKey';
const FADE_MS = 1000;
const DEFAULT_DURATION_MS = 10000;

// Reads ?key=... once and strips just that param from the address bar (same
// pattern as App.jsx's setPasswordToken), then remembers it in localStorage
// so a kiosk reload/reboot doesn't need the key back in the URL every time.
// Other params (columns/duration, below) are left alone since they aren't
// secret and are useful to see/adjust in the address bar.
function resolveKey() {
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get('key');
  if (urlKey) {
    try {
      localStorage.setItem(WALL_KEY_STORAGE, urlKey);
    } catch {
      // Storage unavailable (private browsing, etc.) - the key still works
      // for this page load, it just won't survive a reload.
    }
    params.delete('key');
    const rest = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    return urlKey;
  }
  try {
    return localStorage.getItem(WALL_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

// ?columns=N - how many columns of families to show per page (omit to fit as
// many as the window allows via the grid's responsive auto-fill sizing).
// ?duration=S - seconds each page stays fully visible before fading to the
// next one (default 10).
function readDisplayParams() {
  const params = new URLSearchParams(window.location.search);
  const columns = parseInt(params.get('columns'), 10);
  const duration = parseFloat(params.get('duration'));
  return {
    columns: Number.isFinite(columns) && columns > 0 ? columns : null,
    durationMs: Number.isFinite(duration) && duration > 0 ? duration * 1000 : DEFAULT_DURATION_MS,
  };
}

function groupIndividuals(individuals) {
  return {
    head: individuals.find((i) => i.role === 'head'),
    spouse: individuals.find((i) => i.role === 'spouse'),
    children: individuals.filter((i) => i.role === 'child'),
  };
}

function FamilyCell({ family, wallKey }) {
  const { head, spouse, children } = groupIndividuals(family.individuals);
  const adultNames = [head, spouse].filter(Boolean).map((i) => i.firstName).join(' & ');
  const childNames = children.map((c) => c.firstName).join(', ');
  const photoUrl = wallFamilyPhotoUrl(family, wallKey);
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <div className="wall-cell">
      {photoUrl && !photoFailed ? (
        <img
          src={photoUrl}
          alt=""
          className="wall-cell-photo"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        // No photo on file (or it failed to load) - a plain placeholder box
        // rather than a generic default-avatar icon, per the wall display's
        // own look.
        <div className="wall-cell-photo" />
      )}
      <div className="wall-cell-name">{family.familyName}</div>
      {adultNames && <div className="wall-cell-adults">{adultNames}</div>}
      {childNames && <div className="wall-cell-children">{childNames}</div>}
    </div>
  );
}

// There's no one to scroll this display, so instead of letting the grid grow
// past the window we need to know exactly how many families fit on one
// screen at the current window size, and split the rest into pages. Column
// width depends on the grid's sizing (either the responsive auto-fill default,
// or a fixed count from ?columns=N - see readDisplayParams), which in turn
// determines each cell's height (the photo is a 1:1 square sized off the
// column width). Both can only be found by measuring an actual rendered copy
// of the grid - see the hidden `wall-grid-measure` copy rendered by WallPage
// below, which always mirrors the visible grid's column sizing.
function measureGrid(gridEl, containerEl) {
  if (!gridEl || !containerEl || gridEl.children.length === 0) return null;
  const gridStyle = getComputedStyle(gridEl);
  const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length;
  const rowGap = parseFloat(gridStyle.rowGap) || 0;

  let cellHeight = 0;
  gridEl.querySelectorAll('.wall-cell').forEach((cell) => {
    cellHeight = Math.max(cellHeight, cell.offsetHeight);
  });
  if (columns === 0 || cellHeight === 0) return null;

  const rows = Math.max(1, Math.floor((containerEl.clientHeight + rowGap) / (cellHeight + rowGap)));
  return { columns, rows };
}

function chunk(items, size) {
  if (!size || size <= 0) return [items];
  const pages = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages.length > 0 ? pages : [[]];
}

// Public, key-gated, read-only kiosk display of every family - see
// routes/wall.js on the backend. Rendered by App.jsx in place of the normal
// login/directory flow whenever the path is /wall, with no header/nav/footer
// chrome so it can fill the entire screen. Paginates instead of scrolling
// (see measureGrid) and auto-cycles pages with a fade transition.
export default function WallPage() {
  const [wallKey, setWallKey] = useState(null);
  const [families, setFamilies] = useState([]);
  const [error, setError] = useState(false);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [layout, setLayout] = useState(null); // { columns, rows }
  const [pageIndex, setPageIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const { columns: columnsParam, durationMs } = readDisplayParams();
  const gridStyle = {
    ...(columnsParam ? { gridTemplateColumns: `repeat(${columnsParam}, 1fr)` } : {}),
    // Stretches the grid to fill the available height and spreads any
    // leftover space into the gaps between rows (rather than leaving it
    // unused below the last row) - or centers a single leftover row.
    alignContent: layout && layout.rows > 1 ? 'space-between' : 'center',
  };

  useEffect(() => {
    const resolved = resolveKey();
    // No key at all (never provided, or not remembered from a prior visit) -
    // this is just an ordinary visit to the site, not a rejected wall
    // access attempt, so send them to the normal login flow instead of
    // showing "Access denied.". A key that turns out to be wrong (handled
    // below, once fetchWallFamilies rejects) still shows that message.
    if (!resolved) {
      window.location.href = '/';
      return;
    }
    setWallKey(resolved);
  }, []);

  useEffect(() => {
    if (!wallKey) return;
    getChurchName()
      .then((name) => setTitle(name || DEFAULT_TITLE))
      .catch(() => setTitle(DEFAULT_TITLE));
  }, [wallKey]);

  useEffect(() => {
    if (!wallKey) return;
    fetchWallFamilies(wallKey)
      .then(setFamilies)
      .catch(() => {
        try {
          localStorage.removeItem(WALL_KEY_STORAGE);
        } catch {
          // Nothing to clean up if storage isn't available.
        }
        setError(true);
      });
  }, [wallKey]);

  // Re-measure whenever the family list arrives (the hidden measurement grid
  // needs content to measure) and whenever the window resizes.
  useEffect(() => {
    if (families.length === 0) return undefined;
    const recompute = () => {
      const result = measureGrid(measureRef.current, containerRef.current);
      if (result) setLayout(result);
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [families, columnsParam]);

  const itemsPerPage = layout ? layout.columns * layout.rows : null;
  const pages = itemsPerPage ? chunk(families, itemsPerPage) : [];

  // Keep the current page in range if a resize changes the page count.
  useEffect(() => {
    if (pageIndex >= pages.length && pages.length > 0) setPageIndex(0);
  }, [pages.length, pageIndex]);

  // Auto-cycle: fade the current page out, and (below) swap to the next
  // page's content and fade back in once it's fully transparent.
  useEffect(() => {
    if (pages.length <= 1) return undefined;
    const interval = setInterval(() => setVisible(false), durationMs + FADE_MS);
    return () => clearInterval(interval);
  }, [pages.length, durationMs]);

  useEffect(() => {
    if (visible) return undefined;
    const timeout = setTimeout(() => {
      setPageIndex((i) => (i + 1) % pages.length);
      setVisible(true);
    }, FADE_MS);
    return () => clearTimeout(timeout);
  }, [visible, pages.length]);

  // null: still resolving the key, or redirecting away (see above) because
  // there wasn't one - render nothing either way.
  if (wallKey === null) return null;

  if (error) {
    return (
      <div className="wall-page wall-page-denied">
        <p>Access denied.</p>
      </div>
    );
  }

  const currentPage = pages[pageIndex] || [];

  return (
    <div className="wall-page">
      <header className="wall-header">
        <h1><SiteLogo className="site-logo" />{title}</h1>
      </header>
      <div className="wall-content" ref={containerRef}>
        <div className={`wall-grid${visible ? '' : ' wall-fade-out'}`} style={gridStyle}>
          {currentPage.map((family) => (
            <FamilyCell family={family} wallKey={wallKey} key={family._id} />
          ))}
        </div>
        <div className="wall-grid wall-grid-measure" style={gridStyle} ref={measureRef} aria-hidden="true">
          {families.map((family) => (
            <FamilyCell family={family} wallKey={wallKey} key={family._id} />
          ))}
        </div>
      </div>
    </div>
  );
}
