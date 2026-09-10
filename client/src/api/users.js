const BASE_URL = '/api/users';

export async function listUsers() {
  const res = await fetch(BASE_URL);
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

export async function createUser({ username, password, role }) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create user');
  }
  return res.json();
}

export async function resetUserPassword(id, newPassword) {
  const res = await fetch(`${BASE_URL}/${id}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword }),
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reset password');
  }
}

export async function deleteUser(id) {
  const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete user');
  }
}
