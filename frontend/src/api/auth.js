const BASE_URL = '/api/auth';

// Returns the current user ({ username, role }) or null if not signed in.
export async function getCurrentUser() {
  const res = await fetch(`${BASE_URL}/me`);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to check session');
  return res.json();
}

export async function login(username, password) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Login failed');
  }
  return res.json();
}

export async function logout() {
  await fetch(`${BASE_URL}/logout`, { method: 'POST' });
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${BASE_URL}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to change password');
  }
}

export async function register(email, firstName, lastName) {
  const res = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, firstName, lastName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Registration failed');
  }
  return res.json();
}

export async function setPassword(token, password) {
  const res = await fetch(`${BASE_URL}/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to set password');
  }
}
