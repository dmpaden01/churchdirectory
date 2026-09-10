import { useEffect, useState } from 'react';
import { listUsers, createUser, deleteUser, approveUser, denyUser } from '../api/users';
import ResetPasswordForm from './ResetPasswordForm';
import './UserManagement.css';

const emptyForm = { username: '', password: '', role: 'user' };

const STATUS_LABELS = {
  pending_verification: 'Awaiting Email Verification',
  denied: 'Denied',
};

// Admin-only screen for viewing accounts, approving/denying registrations, and creating new ones.
export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [resetTargetId, setResetTargetId] = useState(null);
  const [resetMessage, setResetMessage] = useState(null);
  const [decidingId, setDecidingId] = useState(null);
  const [decisionError, setDecisionError] = useState(null);

  const loadUsers = () => {
    setLoading(true);
    listUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadUsers, []);

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await createUser(form);
      setForm(emptyForm);
      setShowForm(false);
      loadUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete the user "${user.username}"? This cannot be undone.`)) return;
    try {
      await deleteUser(user._id);
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApprove = async (user) => {
    setDecidingId(user._id);
    setDecisionError(null);
    try {
      await approveUser(user._id);
      loadUsers();
    } catch (err) {
      setDecisionError(err.message);
    } finally {
      setDecidingId(null);
    }
  };

  const handleDeny = async (user) => {
    if (!window.confirm(`Deny the registration request from ${user.firstName} ${user.lastName}?`)) return;
    setDecidingId(user._id);
    setDecisionError(null);
    try {
      await denyUser(user._id);
      loadUsers();
    } catch (err) {
      setDecisionError(err.message);
    } finally {
      setDecidingId(null);
    }
  };

  const pending = users.filter((u) => u.status === 'pending_approval');
  const others = users.filter((u) => u.status !== 'pending_approval');

  return (
    <div className="user-management">
      <div className="user-management-header">
        <h2>Users</h2>
        <button
          type="button"
          className="primary-btn"
          onClick={() => { setShowForm((s) => !s); setResetTargetId(null); }}
        >
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <form className="user-form" onSubmit={handleCreate}>
          {formError && <div className="form-error">{formError}</div>}
          <div className="field-group">
            <label>Username *</label>
            <input type="text" value={form.username} onChange={setField('username')} required />
          </div>
          <div className="field-group">
            <label>Password *</label>
            <input
              type="password"
              value={form.password}
              onChange={setField('password')}
              minLength={8}
              required
            />
          </div>
          <div className="field-group">
            <label>Role *</label>
            <select value={form.role} onChange={setField('role')}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </form>
      )}

      {error && <div className="form-error">{error}</div>}
      {loading && <p className="family-search-status">Loading...</p>}

      {!loading && pending.length > 0 && (
        <div className="pending-approval-section">
          <h3>Pending Approval</h3>
          {decisionError && <div className="form-error">{decisionError}</div>}
          <ul className="user-list">
            {pending.map((user) => (
              <li key={user._id} className="user-list-item">
                <div className="user-list-row">
                  <div className="user-list-info">
                    <strong>{user.firstName} {user.lastName}</strong>
                    <span className="pending-email">{user.username}</span>
                  </div>
                  <div className="user-list-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => handleApprove(user)}
                      disabled={decidingId === user._id}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="danger-btn-outline"
                      onClick={() => handleDeny(user)}
                      disabled={decidingId === user._id}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && (
        <ul className="user-list">
          {others.map((user) => (
            <li key={user._id} className="user-list-item">
              <div className="user-list-row">
                <div className="user-list-info">
                  <strong>{user.firstName || user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.username}</strong>
                  <span className={`role-badge role-${user.role}`}>{user.role}</span>
                  {STATUS_LABELS[user.status] && (
                    <span className="status-badge">{STATUS_LABELS[user.status]}</span>
                  )}
                </div>
                <div className="user-list-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setResetTargetId(resetTargetId === user._id ? null : user._id);
                      setResetMessage(null);
                      setShowForm(false);
                    }}
                  >
                    Reset Password
                  </button>
                  {user.username !== currentUser.username && (
                    <button type="button" className="danger-btn-outline" onClick={() => handleDelete(user)}>Delete</button>
                  )}
                </div>
              </div>

              {resetMessage?.userId === user._id && (
                <div className="form-success">Password updated for "{user.username}".</div>
              )}

              {resetTargetId === user._id && (
                <ResetPasswordForm
                  userId={user._id}
                  onCancel={() => setResetTargetId(null)}
                  onDone={() => {
                    setResetTargetId(null);
                    setResetMessage({ userId: user._id });
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
