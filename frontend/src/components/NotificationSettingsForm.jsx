import { useState } from 'react';
import { updateNotificationSettings } from '../api/auth';
import './NotificationSettingsForm.css';

// Lets an admin opt out of "new registration awaiting approval" emails.
export default function NotificationSettingsForm({ user }) {
  const [checked, setChecked] = useState(user.receiveAdminNotifications !== false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = async (e) => {
    const next = e.target.checked;
    const previous = checked;
    setChecked(next);
    setError(null);
    setSaving(true);
    try {
      await updateNotificationSettings(next);
    } catch (err) {
      setChecked(previous);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="notification-settings-form">
      <h3>Notifications</h3>

      {error && <div className="form-error">{error}</div>}

      <label className="checkbox-field">
        <input type="checkbox" checked={checked} onChange={handleChange} disabled={saving} />
        Receive server notifications
      </label>
      <p className="field-hint">
        Get an email whenever a new user registration is awaiting your approval.
      </p>
    </div>
  );
}
