import { useState } from 'react';
import { changePassword } from '../api/auth';
import './ChangePasswordForm.css';

// Self-service password change for the currently signed-in user.
export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="change-password-form" onSubmit={handleSubmit}>
      <h3>Change Password</h3>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">Password updated.</div>}

      <div className="field-group">
        <label>Current Password *</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>

      <div className="field-group">
        <label>New Password *</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>

      <div className="field-group">
        <label>Confirm New Password *</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>

      <button type="submit" className="primary-btn" disabled={saving}>
        {saving ? 'Saving...' : 'Change Password'}
      </button>
    </form>
  );
}
