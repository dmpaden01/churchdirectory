import { useEffect, useState } from 'react';
import { listUsers, createUser, deleteUser, approveUser, denyUser, updateUserRole } from '../api/users';
import EditUserForm from './EditUserForm';
import './UserManagement.css';

const emptyForm = { username: '', password: '', role: 'user', firstName: '', lastName: '' };

const SORT_STORAGE_KEY = 'users.sortByLastName';

function loadSortByLastName() {
  try {
    return localStorage.getItem(SORT_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// "First Last", or "Last, First" when sorting by last name. Accounts with no
// name on file (e.g. the seeded admin) fall back to their username.
function displayName(user, byLastName) {
  const first = user.firstName || '';
  const last = user.lastName || '';
  if (!first && !last) return user.username;
  if (byLastName) return first && last ? `${last}, ${first}` : last || first;
  return `${first} ${last}`.trim();
}

function sortUsers(users, byLastName) {
  return [...users].sort((a, b) =>
    displayName(a, byLastName).localeCompare(displayName(b, byLastName), undefined, { sensitivity: 'base' }),
  );
}

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
  const [editTargetId, setEditTargetId] = useState(null);
  const [editMessage, setEditMessage] = useState(null);
  const [decidingId, setDecidingId] = useState(null);
  const [decisionError, setDecisionError] = useState(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);
  const [roleError, setRoleError] = useState(null);
  const [sortByLastName, setSortByLastName] = useState(loadSortByLastName);

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

  const handleRoleToggle = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setRoleUpdatingId(user._id);
    setRoleError(null);
    try {
      await updateUserRole(user._id, newRole);
      loadUsers();
    } catch (err) {
      setRoleError(err.message);
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleSortToggle = () => {
    const next = !sortByLastName;
    setSortByLastName(next);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, String(next));
    } catch {
      // Just won't be remembered next visit.
    }
  };

  const sorted = sortUsers(users, sortByLastName);
  const pending = sorted.filter((u) => u.status === 'pending_approval');
  const others = sorted.filter((u) => u.status !== 'pending_approval');

  return (
    <div className="user-management">
      <div className="user-management-header">
        <h2>Users</h2>
        <button
          type="button"
          className="primary-btn"
          onClick={() => { setShowForm((s) => !s); setEditTargetId(null); }}
        >
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      <label className="toggle-switch user-sort-toggle">
        <input type="checkbox" checked={sortByLastName} onChange={handleSortToggle} />
        <span className="toggle-switch-track">
          <span className="toggle-switch-thumb" />
        </span>
        <span className="user-sort-toggle-text">Sort by last name</span>
      </label>

      {showForm && (
        <form className="user-form" onSubmit={handleCreate}>
          {formError && <div className="form-error">{formError}</div>}
          <div className="field-group">
            <label>First Name *</label>
            <input type="text" value={form.firstName} onChange={setField('firstName')} required />
          </div>
          <div className="field-group">
            <label>Last Name *</label>
            <input type="text" value={form.lastName} onChange={setField('lastName')} required />
          </div>
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
                    <strong>{displayName(user, sortByLastName)}</strong>
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

      {!loading && roleError && <div className="form-error">{roleError}</div>}

      {!loading && (
        <ul className="user-list">
          {others.map((user) => (
            <li key={user._id} className="user-list-item">
              <div className="user-list-row">
                <div className="user-list-info">
                  <strong>{displayName(user, sortByLastName)}</strong>
                  {(user.firstName || user.lastName) && (
                    <span className="pending-email">{user.username}</span>
                  )}
                  <label
                    className="toggle-switch"
                    title={
                      user._id === currentUser.id
                        ? 'You cannot change your own role'
                        : `Switch to ${user.role === 'admin' ? 'User' : 'Admin'}`
                    }
                  >
                    <input
                      type="checkbox"
                      checked={user.role === 'admin'}
                      disabled={user._id === currentUser.id || roleUpdatingId === user._id}
                      onChange={() => handleRoleToggle(user)}
                    />
                    <span className="toggle-switch-track">
                      <span className="toggle-switch-thumb" />
                    </span>
                    <span className="toggle-switch-text">{user.role === 'admin' ? 'Admin' : 'User'}</span>
                  </label>
                  {STATUS_LABELS[user.status] && (
                    <span className="status-badge">{STATUS_LABELS[user.status]}</span>
                  )}
                </div>
                <div className="user-list-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTargetId(editTargetId === user._id ? null : user._id);
                      setEditMessage(null);
                      setShowForm(false);
                    }}
                  >
                    Edit User
                  </button>
                  {user._id !== currentUser.id && (
                    <button type="button" className="danger-btn-outline" onClick={() => handleDelete(user)}>Delete</button>
                  )}
                </div>
              </div>

              {editMessage?.userId === user._id && (
                <div className="form-success">{editMessage.text}</div>
              )}

              {editTargetId === user._id && (
                <EditUserForm
                  user={user}
                  onCancel={() => setEditTargetId(null)}
                  onSaved={() => {
                    setEditTargetId(null);
                    setEditMessage({ userId: user._id, text: 'User details updated.' });
                    loadUsers();
                  }}
                  onResetEmailSent={() => {
                    setEditTargetId(null);
                    setEditMessage({ userId: user._id, text: `Password reset email sent to "${user.username}".` });
                  }}
                  onPasswordReset={() => {
                    setEditTargetId(null);
                    setEditMessage({ userId: user._id, text: `Password updated for "${user.username}".` });
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
