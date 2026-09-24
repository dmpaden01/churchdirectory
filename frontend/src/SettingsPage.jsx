import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PhotoDropzone from './components/PhotoDropzone';
import {
  logoUrl, hasCustomLogo, uploadLogo, resetLogo, getChurchName, updateChurchName, getMapsSettings, updateMapsSettings,
} from './api/settings';
import { applyDynamicFavicon } from './utils/applyFavicon';
import './SettingsPage.css';

// Admin-only: site-wide settings, stored in MongoDB. Uploading a logo also
// auto-generates and stores a 50x50 favicon derived from it, served via
// /api/settings/favicon.
const EMPTY_KEYS = { googleMapsApiKey: '', googleGeocodingApiKey: '' };

// One write-only key input: the saved key is never shown, only whether one
// is set. Typing a value replaces it on Save; "Remove" clears it right away.
function MapsKeyField({ id, label, isSet, unsetPlaceholder, value, onChange, onRemove, disabled }) {
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <div className="settings-key-row">
        <input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={onChange}
          placeholder={isSet ? 'Key set - enter a new key to replace it' : unsetPlaceholder}
          disabled={disabled}
        />
        {isSet && (
          <button type="button" onClick={onRemove} disabled={disabled}>Remove</button>
        )}
      </div>
    </div>
  );
}

// Family Map (Google Maps) settings, plus a summary of how many family
// addresses have been geocoded so far - re-checked every few seconds while a
// geocoding run is in progress.
function MapsSettings() {
  const [settings, setSettings] = useState(null);
  const [keys, setKeys] = useState(EMPTY_KEYS);
  const [mapId, setMapId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const apply = (next) => {
    setSettings(next);
    setMapId(next.googleMapId);
    setKeys(EMPTY_KEYS);
  };

  useEffect(() => {
    getMapsSettings().then(apply).catch((err) => setError(err.message));
  }, []);

  const running = Boolean(settings?.geocoding.running);
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      getMapsSettings()
        .then(({ geocoding }) => setSettings((s) => ({ ...s, geocoding })))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [running]);

  const save = async (values) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      apply(await updateMapsSettings(values));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setKey = (field) => (e) => {
    setKeys((k) => ({ ...k, [field]: e.target.value }));
    setSaved(false);
  };

  const removeKey = (field, label) => {
    if (window.confirm(`Remove the ${label}?`)) save({ [field]: null });
  };

  const geocoding = settings?.geocoding;

  return (
    <section className="form-section">
      <h3>Family Map (Google Maps)</h3>
      <p className="settings-hint">
        Go to Google Cloud Platform (
        <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">console.cloud.google.com</a>
        ) and generate API keys for Google Maps Platform. Restrict the Maps key to Maps Embed and
        Maps Javascript APIs and set this site&apos;s domain as the website referrer. Geocoding runs on
        the server, so give it a key restricted to the Geocoding API and this server&apos;s IP.
      </p>
      {error && <div className="form-error">{error}</div>}
      {settings && (
        <form onSubmit={(e) => { e.preventDefault(); save({ ...keys, googleMapId: mapId }); }}>
          <MapsKeyField
            id="maps-api-key"
            label="Maps API key"
            isSet={settings.googleMapsApiKeySet}
            unsetPlaceholder="Not set"
            value={keys.googleMapsApiKey}
            onChange={setKey('googleMapsApiKey')}
            onRemove={() => removeKey('googleMapsApiKey', 'Maps API key')}
            disabled={saving}
          />
          <MapsKeyField
            id="geocoding-api-key"
            label="Geocoding API key (optional)"
            isSet={settings.googleGeocodingApiKeySet}
            unsetPlaceholder="Not set - uses the Maps key"
            value={keys.googleGeocodingApiKey}
            onChange={setKey('googleGeocodingApiKey')}
            onRemove={() => removeKey('googleGeocodingApiKey', 'Geocoding API key')}
            disabled={saving}
          />
          <div className="field-group">
            <label htmlFor="map-id">Map ID (optional)</label>
            <input
              id="map-id"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={mapId}
              onChange={(e) => { setMapId(e.target.value); setSaved(false); }}
              placeholder="Not set - uses Google's demo map ID"
              disabled={saving}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {saved && <p className="family-search-status">Saved.</p>}
        </form>
      )}
      {geocoding && (
        <div className="settings-geocoding">
          <p className="family-search-status">
            {geocoding.located} of {geocoding.withAddress} family addresses located
            {geocoding.pending > 0 && ` - ${geocoding.pending} still to go${geocoding.running ? ' (working...)' : ''}`}.
          </p>
          {geocoding.lastError && (
            <div className="form-error">Last geocoding error: {geocoding.lastError}</div>
          )}
          {geocoding.notFound.length > 0 && (
            <>
              <p className="settings-hint">Google couldn&apos;t find these addresses - check them for typos:</p>
              <ul className="settings-geocoding-missing">
                {geocoding.notFound.map((f) => (
                  <li key={f._id}><Link to={`/families/${f._id}`}>{f.familyName}</Link> - {f.address}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  const [hasCustom, setHasCustom] = useState(null); // null = still checking
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [cacheBust, setCacheBust] = useState(0);

  // null = still loading; '' means unset (the wall display falls back to
  // "Church Directory" - see WallPage.jsx). Doesn't affect the main site.
  const [churchName, setChurchName] = useState(null);
  const [churchNameSaving, setChurchNameSaving] = useState(false);
  const [churchNameError, setChurchNameError] = useState(null);
  const [churchNameSaved, setChurchNameSaved] = useState(false);

  useEffect(() => {
    hasCustomLogo().then(setHasCustom);
  }, []);

  useEffect(() => {
    getChurchName().then((name) => setChurchName(name || ''));
  }, []);

  const handleChurchNameSave = async (e) => {
    e.preventDefault();
    setChurchNameSaving(true);
    setChurchNameError(null);
    setChurchNameSaved(false);
    try {
      const saved = await updateChurchName(churchName);
      setChurchName(saved || '');
      setChurchNameSaved(true);
    } catch (err) {
      setChurchNameError(err.message);
    } finally {
      setChurchNameSaving(false);
    }
  };

  const handleChange = async (file) => {
    setSaving(true);
    setError(null);
    try {
      await uploadLogo(file);
      await applyDynamicFavicon();
      setHasCustom(true);
      setCacheBust((b) => b + 1);
    } catch (err) {
      setError(err.message);
      setResetKey((k) => k + 1); // discard the dropzone's optimistic preview
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError(null);
    try {
      await resetLogo();
      await applyDynamicFavicon();
      setHasCustom(false);
    } catch (err) {
      setError(err.message);
      setResetKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <h2>Settings</h2>
      <section className="form-section">
        <h3>Site Logo</h3>
        <p className="settings-hint">
          Drag and drop a .jpg or .png to replace it, or remove it to use the default. A 50x50
          favicon is generated from it automatically (scaled to fit without stretching) and used
          for the browser tab icon everywhere, including on the sign-in page.
        </p>
        {error && <div className="form-error">{error}</div>}
        {hasCustom !== null && (
          <PhotoDropzone
            key={resetKey}
            label="Logo"
            existingUrl={hasCustom ? `${logoUrl()}?v=${cacheBust}` : null}
            onChange={handleChange}
            onRemove={handleRemove}
          />
        )}
        {saving && <p className="family-search-status">Saving...</p>}
      </section>

      <section className="form-section">
        <h3>Wall Title/Header</h3>
        <p className="settings-hint">
          Shown at the top of the wall display (/wall) in place of the default &quot;Church
          Directory&quot; title. Leave blank to use the default. Doesn&apos;t affect the main site.
        </p>
        {churchNameError && <div className="form-error">{churchNameError}</div>}
        {churchName !== null && (
          <form className="field-group" onSubmit={handleChurchNameSave}>
            <label htmlFor="church-name">Wall Title/Header</label>
            <input
              id="church-name"
              type="text"
              value={churchName}
              onChange={(e) => {
                setChurchName(e.target.value);
                setChurchNameSaved(false);
              }}
              placeholder="Church Directory"
              disabled={churchNameSaving}
            />
            <div className="form-actions">
              <button type="submit" className="primary-btn" disabled={churchNameSaving}>
                {churchNameSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {churchNameSaved && <p className="family-search-status">Saved.</p>}
          </form>
        )}
      </section>

      <MapsSettings />
    </div>
  );
}
