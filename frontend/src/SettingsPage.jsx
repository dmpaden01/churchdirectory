import { useEffect, useState } from 'react';
import PhotoDropzone from './components/PhotoDropzone';
import { logoUrl, hasCustomLogo, uploadLogo, resetLogo, getChurchName, updateChurchName } from './api/settings';
import { applyDynamicFavicon } from './utils/applyFavicon';
import './SettingsPage.css';

// Admin-only: site-wide settings, stored in MongoDB. Uploading a logo also
// auto-generates and stores a 50x50 favicon derived from it, served via
// /api/settings/favicon.
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
    </div>
  );
}
