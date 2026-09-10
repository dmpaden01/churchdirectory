import { useEffect, useState } from 'react';
import PhotoDropzone from './components/PhotoDropzone';
import { faviconUrl, hasCustomFavicon, uploadFavicon, resetFavicon } from './api/settings';
import { applyDynamicFavicon } from './utils/applyFavicon';
import './SettingsPage.css';

// Admin-only: site-wide settings. Currently just the favicon, stored in
// MongoDB (like family/individual photos) and served via /api/settings/favicon.
export default function SettingsPage() {
  const [hasCustom, setHasCustom] = useState(null); // null = still checking
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [cacheBust, setCacheBust] = useState(0);

  useEffect(() => {
    hasCustomFavicon().then(setHasCustom);
  }, []);

  const handleChange = async (file) => {
    setSaving(true);
    setError(null);
    try {
      await uploadFavicon(file);
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
      await resetFavicon();
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
        <h3>Site Favicon</h3>
        <p className="settings-hint">
          Shown in the browser tab for everyone, including on the sign-in page. Drag and drop a
          .jpg or .png to replace it, or remove it to use the default.
        </p>
        {error && <div className="form-error">{error}</div>}
        {hasCustom !== null && (
          <PhotoDropzone
            key={resetKey}
            label="Favicon"
            existingUrl={hasCustom ? `${faviconUrl()}?v=${cacheBust}` : null}
            onChange={handleChange}
            onRemove={handleRemove}
          />
        )}
        {saving && <p className="family-search-status">Saving...</p>}
      </section>
    </div>
  );
}
