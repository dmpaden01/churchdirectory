import { useEffect, useState } from 'react';
import PhotoDropzone from './components/PhotoDropzone';
import { logoUrl, hasCustomLogo, uploadLogo, resetLogo } from './api/settings';
import { applyDynamicFavicon } from './utils/applyFavicon';
import './SettingsPage.css';

// Admin-only: site-wide settings. Currently just the site logo, stored in
// MongoDB (like family/individual photos). Uploading it also auto-generates
// and stores a 50x50 favicon derived from it, served via /api/settings/favicon.
export default function SettingsPage() {
  const [hasCustom, setHasCustom] = useState(null); // null = still checking
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [cacheBust, setCacheBust] = useState(0);

  useEffect(() => {
    hasCustomLogo().then(setHasCustom);
  }, []);

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
    </div>
  );
}
