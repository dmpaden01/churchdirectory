import { useState } from 'react';
import { updateUser } from '../api/users';
import ResetPasswordForm from './ResetPasswordForm';

// Inline panel an admin opens from "Edit User" to correct a user's email/name or reset their password.
export default function EditUserForm({ user, onSaved, onPasswordReset, onCancel }) {
  const [username, setUsername] = useState(user.username);
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateUser(user._id, { username, firstName, lastName });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="edit-user-panel">
      <form className="edit-user-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}
        <div className="field-group">
          <label>First Name *</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="field-group">
          <label>Last Name *</label>
          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <div className="field-group">
          <label>Email Address *</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="edit-user-form-actions">
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
          {!showResetPassword && (
            <button type="button" onClick={() => setShowResetPassword(true)} disabled={saving}>
              Reset Password
            </button>
          )}
        </div>
      </form>

      {showResetPassword && (
        <ResetPasswordForm
          userId={user._id}
          onCancel={() => setShowResetPassword(false)}
          onDone={onPasswordReset}
        />
      )}
    </div>
  );
}
