import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getMapConfig, getMapFamilies } from './api/map';
import { loadGoogleMaps, onGoogleMapsAuthFailure } from './utils/loadGoogleMaps';
import './FamilyMapPage.css';

// Google's shared demo map ID - fine for Advanced Markers until an admin sets
// a real one (free to create in Google Cloud Console) on the Settings page.
const DEMO_MAP_ID = 'DEMO_MAP_ID';

// Families at the exact same coordinates (e.g. two households at one address)
// share one marker, listing all of them.
function groupByLocation(families) {
  const groups = new Map();
  for (const family of families) {
    const key = `${family.lat.toFixed(6)},${family.lng.toFixed(6)}`;
    if (!groups.has(key)) groups.set(key, { position: { lat: family.lat, lng: family.lng }, families: [] });
    groups.get(key).families.push(family);
  }
  return [...groups.values()];
}

// Info window contents, built as DOM nodes (textContent only - family names
// are user-entered data). Each name links to that family's page.
function infoContent(group, onOpenFamily) {
  const root = document.createElement('div');
  root.className = 'family-map-info';
  for (const family of group.families) {
    const link = document.createElement('a');
    link.href = `/families/${family._id}`;
    link.className = 'family-map-info-name';
    link.textContent = family.familyName;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      onOpenFamily(family._id);
    });
    root.appendChild(link);
  }
  return root;
}

// All families with a located address as markers on one Google Map. Every
// visit counts as one Maps JavaScript API load; the addresses themselves are
// geocoded and cached server-side (see backend/utils/geocoder.js), so opening
// this page never triggers a geocoding request from the browser.
export default function FamilyMapPage() {
  const { isAdmin } = useOutletContext();
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const [status, setStatus] = useState('loading'); // loading | unconfigured | ready | error
  const [error, setError] = useState(null);
  const [counts, setCounts] = useState({ located: 0, pending: 0 });

  useEffect(() => {
    let cancelled = false;
    const stopAuthWatch = onGoogleMapsAuthFailure(() => {
      setStatus('error');
      setError('Google rejected the Maps API key. Check that the Maps JavaScript API is enabled for it and that this site is an allowed referrer.');
    });

    (async () => {
      const [config, data] = await Promise.all([getMapConfig(), getMapFamilies()]);
      if (cancelled) return;
      if (!config.apiKey) {
        setStatus('unconfigured');
        return;
      }
      setCounts({ located: data.families.length, pending: data.pending });

      const maps = await loadGoogleMaps(config.apiKey);
      const [{ Map, InfoWindow }, { AdvancedMarkerElement }, { LatLngBounds }] = await Promise.all([
        maps.importLibrary('maps'),
        maps.importLibrary('marker'),
        maps.importLibrary('core'),
      ]);
      if (cancelled || !containerRef.current) return;

      const map = new Map(containerRef.current, {
        mapId: config.mapId || DEMO_MAP_ID,
        center: { lat: 39.8, lng: -98.6 }, // continental US, until markers are fitted
        zoom: 4,
        clickableIcons: false,
        streetViewControl: false,
      });
      // No header row: it only holds the close button and adds a band of
      // empty space above the name. Clicking the map closes it instead.
      const infoWindow = new InfoWindow({ headerDisabled: true });
      map.addListener('click', () => infoWindow.close());
      const openFamily = (id) => navigate(`/families/${id}`);

      const groups = groupByLocation(data.families);
      const bounds = new LatLngBounds();
      for (const group of groups) {
        const marker = new AdvancedMarkerElement({
          map,
          position: group.position,
          title: group.families.map((f) => f.familyName).join(', '),
          gmpClickable: true,
        });
        marker.addEventListener('gmp-click', () => {
          infoWindow.setContent(infoContent(group, openFamily));
          infoWindow.open({ map, anchor: marker });
        });
        bounds.extend(group.position);
      }
      if (groups.length === 1) {
        map.setCenter(groups[0].position);
        map.setZoom(14);
      } else if (groups.length > 1) {
        map.fitBounds(bounds, 40);
      }
      setStatus('ready');
    })().catch((err) => {
      if (cancelled) return;
      setStatus('error');
      setError(err.message);
    });

    return () => {
      cancelled = true;
      stopAuthWatch();
    };
  }, [navigate]);

  return (
    <div className="family-map-page">
      <h2>Family Map</h2>

      {status === 'loading' && <p className="family-search-status">Loading map...</p>}
      {status === 'error' && <div className="form-error">{error}</div>}
      {status === 'unconfigured' && (
        <p className="family-search-status">
          {isAdmin
            ? 'The Family Map needs a Google Maps API key - add one on the Settings tab.'
            : "The Family Map hasn't been set up yet."}
        </p>
      )}
      {status === 'ready' && counts.pending > 0 && (
        <p className="family-search-status">
          {counts.pending} {counts.pending === 1 ? 'address is' : 'addresses are'} still being
          located - reload the page in a minute to see {counts.pending === 1 ? 'it' : 'them'}.
        </p>
      )}

      {status !== 'unconfigured' && (
        <div ref={containerRef} className="family-map" hidden={status === 'error'} />
      )}
    </div>
  );
}
