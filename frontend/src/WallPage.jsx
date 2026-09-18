import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchWallFamilies, wallFamilyPhotoUrl, wallIndividualPhotoUrl } from './api/wall';
import { getChurchName } from './api/settings';
import SiteLogo from './components/SiteLogo';
import './WallPage.css';

const DEFAULT_TITLE = 'Church Directory';

const WALL_KEY_STORAGE = 'wallKey';
const FADE_MS = 1000;
const DEFAULT_DURATION_MS = 10000;

// This runs unattended as a kiosk display for long stretches, so it needs to
// pick up database changes (a family/individual added, edited, or removed;
// a Role/Status added; branding changed) on its own - see refreshData below.
// 5 minutes is a hard ceiling on staleness for a single-page directory (which
// never completes a "cycle" to piggyback the refresh on); a multi-page
// directory usually refreshes sooner than this anyway, right as it loops
// back to the first page.
const STALE_REFRESH_MS = 5 * 60 * 1000;

// Fixed, tight gap between a roster section's header and its own first row
// of photos - deliberately much smaller than the space between different
// sections (which gets whatever's left over, evenly distributed - see
// gridStyle/the roster page's justifyContent), so a header reads as
// belonging to the photos right below it rather than floating in its own row.
const HEADER_GAP = 20;

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

function PersonCell({ person, wallKey, style }) {
  const photoUrl = wallIndividualPhotoUrl(person.familyId, person.index, person, wallKey);
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <div className="wall-cell" style={style}>
      {photoUrl && !photoFailed ? (
        <img
          src={photoUrl}
          alt=""
          className="wall-cell-photo"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <div className="wall-cell-photo" />
      )}
      <div className="wall-cell-name">{person.firstName} {person.lastName}</div>
      {person.roleLabel && <div className="wall-cell-role">{person.roleLabel}</div>}
    </div>
  );
}

const ROSTER_CATEGORIES = [
  { key: 'staff', title: 'Staff' },
  { key: 'elder', title: 'Elders' },
  { key: 'deacon', title: 'Deacons' },
];

// Splits a Role/Status string like "Deacon - IT, Audio Visual" into a
// category (matched by the word before the first " - ", case-insensitively
// and ignoring a trailing "s" - so "Elders"/"Deacons" also match) and the
// remainder to show as that person's role label. Anything that doesn't start
// with "Staff"/"Elder"/"Deacon" isn't part of this roster at all (e.g. a
// blank field, or some other one-off status) - only those three headers
// belong on the Wall's roster page. Elders show no role label, since their
// whole Role/Status IS their role.
function parseRoleStatus(roleStatus) {
  if (!roleStatus?.trim()) return null;
  const match = roleStatus.match(/^(\S+)\s*-\s*(.*)$/);
  const prefix = match ? match[1] : roleStatus.trim();
  const rest = match ? match[2].trim() : '';
  const stem = prefix.toLowerCase().replace(/s$/, '');
  const category = ROSTER_CATEGORIES.find((c) => c.key === stem);
  if (!category) return null;
  return { category: category.key, roleLabel: category.key === 'elder' ? '' : rest };
}

// Flattens every individual with a recognized Role/Status into the roster
// sections (in Staff/Elders/Deacons order), sorted by last then first name.
// Sections with no one in them are omitted entirely.
function buildRoster(families) {
  const byCategory = { staff: [], elder: [], deacon: [] };
  families.forEach((family) => {
    family.individuals.forEach((individual, index) => {
      const parsed = parseRoleStatus(individual.roleStatus);
      if (!parsed) return;
      byCategory[parsed.category].push({
        familyId: family._id,
        index,
        firstName: individual.firstName,
        lastName: individual.lastName,
        roleLabel: parsed.roleLabel,
        photo: individual.photo,
      });
    });
  });
  Object.values(byCategory).forEach((people) => people.sort((a, b) => (
    (a.lastName || '').localeCompare(b.lastName || '') || a.firstName.localeCompare(b.firstName)
  )));
  return ROSTER_CATEGORIES
    .map(({ key, title }) => ({ key, title, people: byCategory[key] }))
    .filter((section) => section.people.length > 0);
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
  let cellWidth = 0;
  gridEl.querySelectorAll('.wall-cell').forEach((cell) => {
    cellHeight = Math.max(cellHeight, cell.offsetHeight);
    // getBoundingClientRect (sub-pixel) rather than offsetWidth (rounded to
    // a whole pixel) - cellWidth is reused as a fixed per-cell width across
    // several cells in a flex row on the roster page (see rosterCellWidth),
    // where rounding compounds enough across ~7 cells to overflow the row by
    // a couple of px and trigger an unwanted flex-wrap (see wall-roster-row).
    cellWidth = Math.max(cellWidth, cell.getBoundingClientRect().width);
  });
  if (columns === 0 || cellHeight === 0) return null;

  const containerHeight = containerEl.clientHeight;
  const rows = Math.max(1, Math.floor((containerHeight + rowGap) / (cellHeight + rowGap)));
  return { columns, rows, rowGap, containerHeight, cellWidth, cellHeight };
}

// Measures the roster page's own per-item heights (a section header, and one
// full row of person cells) from the hidden probe rendered below - these
// differ from the family grid's (fewer text lines per cell, plus the header)
// so they can't be derived from measureGrid's result.
function measureRosterMetrics(headerEl, rowEl) {
  if (!headerEl || !rowEl) return null;
  const headerStyle = getComputedStyle(headerEl);
  const headerHeight = headerEl.offsetHeight
    + (parseFloat(headerStyle.marginTop) || 0)
    + (parseFloat(headerStyle.marginBottom) || 0);

  let rowHeight = 0;
  rowEl.querySelectorAll('.wall-cell').forEach((cell) => {
    rowHeight = Math.max(rowHeight, cell.offsetHeight);
  });
  if (!headerHeight || !rowHeight) return null;
  return { headerHeight, rowHeight };
}

function chunk(items, size) {
  if (!size || size <= 0) return [items];
  const pages = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages.length > 0 ? pages : [[]];
}

// The vertical space a section takes up entirely on its own: its header
// (tight HEADER_GAP below it), plus each row of person cells (chunked to
// `columns` per row) with the normal rowGap between multiple rows.
function sectionHeight(rowCount, { rowGap, headerHeight, rowHeight }) {
  return headerHeight + HEADER_GAP + rowCount * rowHeight + Math.max(0, rowCount - 1) * rowGap;
}

// Lays out the Staff/Elders/Deacons roster into pages, under the same size
// constraints as the family pages (same container height, same column
// count), keeping each section's rows together on one page wherever
// possible: a section is moved to start a fresh page rather than splitting
// its rows across two pages, unless it's too big to fit on any single page
// at all - in which case it spans as many dedicated pages as it takes, with
// its header repeated (marked "(cont.)") on each one after the first.
function buildRosterPages(sections, metrics) {
  const { columns, rowGap, headerHeight, rowHeight, containerHeight } = metrics;
  if (!columns || !rowHeight || !headerHeight || !containerHeight) return [];

  const pages = [];
  let current = [];
  let currentHeight = 0;

  const flush = () => {
    if (current.length > 0) pages.push({ type: 'roster', blocks: current });
    current = [];
    currentHeight = 0;
  };

  const appendSection = (title, rows) => {
    if (current.length > 0) currentHeight += rowGap;
    current.push({ type: 'group', title, rows });
    currentHeight += sectionHeight(rows.length, { rowGap, headerHeight, rowHeight });
  };

  sections.forEach((section) => {
    const rows = chunk(section.people, columns);
    const wholeHeight = sectionHeight(rows.length, { rowGap, headerHeight, rowHeight });
    const additional = (currentHeight > 0 ? rowGap : 0) + wholeHeight;

    if (currentHeight + additional <= containerHeight) {
      appendSection(section.title, rows);
      return;
    }

    flush();

    if (wholeHeight <= containerHeight) {
      appendSection(section.title, rows);
      return;
    }

    // Too big for even one whole page on its own - split across as many
    // dedicated pages as it takes.
    const available = containerHeight - headerHeight - HEADER_GAP;
    const rowsPerPage = Math.max(1, Math.floor((available + rowGap) / (rowHeight + rowGap)));
    let i = 0;
    let continued = false;
    while (i < rows.length) {
      const pageRows = rows.slice(i, i + rowsPerPage);
      appendSection(continued ? `${section.title} (cont.)` : section.title, pageRows);
      flush();
      i += rowsPerPage;
      continued = true;
    }
  });

  flush();
  return pages;
}

// Public, key-gated, read-only kiosk display of every family - see
// routes/wall.js on the backend. Rendered by App.jsx in place of the normal
// login/directory flow whenever the path is /wall, with no header/nav/footer
// chrome so it can fill the entire screen. Paginates instead of scrolling
// (see measureGrid) and auto-cycles pages with a fade transition. The
// Staff/Elders/Deacons roster (see buildRoster/buildRosterPages) is prepended
// as its own page(s) ahead of the family pages. Meant to run unattended for
// long stretches, so it re-fetches on its own (see refreshData) rather than
// needing a manual browser reload to pick up database changes.
export default function WallPage() {
  const [wallKey, setWallKey] = useState(null);
  const [families, setFamilies] = useState([]);
  const [error, setError] = useState(false);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [layout, setLayout] = useState(null); // { columns, rows, rowGap, containerHeight, cellWidth, cellHeight }
  const [rosterMetrics, setRosterMetrics] = useState(null); // { headerHeight, rowHeight }
  const [pageIndex, setPageIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const rosterHeaderProbeRef = useRef(null);
  const rosterRowProbeRef = useRef(null);
  const { columns: columnsParam, durationMs } = readDisplayParams();
  // The hidden measurement grid (see measureGrid/measureRef below) must always
  // use the stylesheet's fixed gap, never the evenGap override computed below
  // - it's what measureGrid reads back as `rowGap` to work out how many rows
  // fit at all, so feeding it a dynamic, already-computed value would make
  // each recompute (e.g. on resize) build on the previous one's cosmetic
  // result rather than a stable baseline, and drift.
  const measureGridStyle = columnsParam ? { gridTemplateColumns: `repeat(${columnsParam}, 1fr)` } : {};

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

  // Pulls the latest families/roster and branding - used for the initial
  // load and every later refresh (see the effects below). A failure here is
  // treated the same as an initial bad key: a kiosk that can no longer load
  // is more useful showing "Access denied" (prompting someone to notice and
  // investigate) than silently freezing on old data indefinitely.
  const refreshData = useCallback(() => {
    if (!wallKey) return;
    getChurchName()
      .then((name) => setTitle(name || DEFAULT_TITLE))
      .catch(() => setTitle(DEFAULT_TITLE));
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

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Safety-net refresh for a single-page directory, which never completes a
  // "cycle" to trigger the refresh below on its own.
  useEffect(() => {
    if (!wallKey) return undefined;
    const interval = setInterval(refreshData, STALE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [wallKey, refreshData]);

  const roster = useMemo(() => buildRoster(families), [families]);

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

  // Re-measure the roster probe whenever the roster or the column layout
  // changes (the probe's row is rendered at layout.columns wide).
  useEffect(() => {
    if (!layout || roster.length === 0) {
      setRosterMetrics(null);
      return;
    }
    const result = measureRosterMetrics(rosterHeaderProbeRef.current, rosterRowProbeRef.current);
    if (result) setRosterMetrics(result);
  }, [layout, roster]);

  const itemsPerPage = layout ? layout.columns * layout.rows : null;
  const familyPages = itemsPerPage
    ? chunk(families, itemsPerPage).map((items) => ({ type: 'family', items }))
    : [];
  const rosterPages = (layout && rosterMetrics)
    ? buildRosterPages(roster, {
        columns: layout.columns,
        rowGap: layout.rowGap,
        headerHeight: rosterMetrics.headerHeight,
        rowHeight: rosterMetrics.rowHeight,
        containerHeight: layout.containerHeight,
      })
    : [];
  const rosterCellWidth = layout ? layout.cellWidth : 0;
  const pages = [...rosterPages, ...familyPages];

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
      // Refresh right as we loop back to the first page - the display is
      // already fully faded out at this instant, so new data (or a changed
      // page count) can't cause a visible jump the way refreshing mid-cycle
      // might.
      const completingACycle = pages.length > 0 && pageIndex + 1 >= pages.length;
      setPageIndex((i) => (i + 1) % pages.length);
      setVisible(true);
      if (completingACycle) refreshData();
    }, FADE_MS);
    return () => clearTimeout(timeout);
  }, [visible, pages.length, pageIndex, refreshData]);

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

  const currentPage = pages[pageIndex] || { type: 'family', items: [] };
  const probePeople = roster.flatMap((section) => section.people).slice(0, layout?.columns || 0);

  // Distribute all leftover vertical space evenly above, below, and between
  // every row, so the whole space from the header down to the bottom of the
  // page reads as consistently spaced rather than one oversized gap
  // sandwiched between rows that hug the header/bottom. rowGap:0 matters here
  // - align-content's distribution is otherwise layered ON TOP of the
  // stylesheet's fixed row gap, which would still make the between-rows gap
  // bigger than the edges. This also naturally centers a single row (2 equal
  // gaps, above and below, is just centering), so no row-count check is
  // needed - and it's computed by the browser from each row's own actual
  // rendered height, not an estimate, so it stays correct even though rows on
  // a given page can be shorter than the tallest family elsewhere in the
  // directory (which is what the measurement grid's cellHeight reflects).
  const gridStyle = {
    ...measureGridStyle,
    rowGap: 0,
    alignContent: 'space-evenly',
  };

  return (
    <div className="wall-page">
      <header className="wall-header">
        <h1><SiteLogo className="site-logo" />{title}</h1>
      </header>
      <div className="wall-content" ref={containerRef}>
        {currentPage.type === 'family' ? (
          <div className={`wall-grid${visible ? '' : ' wall-fade-out'}`} style={gridStyle}>
            {currentPage.items.map((family) => (
              <FamilyCell family={family} wallKey={wallKey} key={family._id} />
            ))}
          </div>
        ) : (
          <div
            className={`wall-roster-page${visible ? '' : ' wall-fade-out'}`}
            style={{ gap: 0, justifyContent: 'space-evenly' }}
          >
            {currentPage.blocks.map((block) => (
              <div className="wall-roster-section" key={block.title}>
                <h2 className="wall-section-header">{block.title}</h2>
                {block.rows.map((rowPeople, i) => (
                  <div
                    className="wall-roster-row"
                    style={{ gap: layout.rowGap, marginTop: i === 0 ? HEADER_GAP : layout.rowGap }}
                    key={`${rowPeople[0]?.familyId}-${rowPeople[0]?.index}`}
                  >
                    {rowPeople.map((person) => (
                      <PersonCell
                        person={person}
                        wallKey={wallKey}
                        style={{ width: rosterCellWidth }}
                        key={`${person.familyId}-${person.index}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="wall-grid wall-grid-measure" style={measureGridStyle} ref={measureRef} aria-hidden="true">
          {families.map((family) => (
            <FamilyCell family={family} wallKey={wallKey} key={family._id} />
          ))}
        </div>

        {layout && roster.length > 0 && (
          <div className="wall-roster-probe" aria-hidden="true">
            <h2 className="wall-section-header" ref={rosterHeaderProbeRef}>{roster[0].title}</h2>
            <div className="wall-roster-row" style={{ gap: layout.rowGap }} ref={rosterRowProbeRef}>
              {probePeople.map((person) => (
                <PersonCell
                  person={person}
                  wallKey={wallKey}
                  style={{ width: rosterCellWidth }}
                  key={`${person.familyId}-${person.index}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
