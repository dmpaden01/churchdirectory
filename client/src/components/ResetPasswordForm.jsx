import { useState } from 'react';
import { resetUserPassword } from '../api/users';

// Inline form an admin uses to set another user's password directly (no current password needed).
export default function ResetPasswordForm({ userId, onDone, onCancel }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await resetUserPassword(userId, newPassword);
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form className="reset-password-form" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="field-group">
        <label>New Password *</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          autoFocus
          required
        />
      </div>
      <div className="field-group">
        <label>Confirm Password *</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div className="reset-password-form-actions">
        <button type="submit" className="primary-btn" disabled={saving}>
          {saving ? 'Saving...' : 'Set Password'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}
