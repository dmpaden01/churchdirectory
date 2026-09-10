import jwt from 'jsonwebtoken';

export const AUTH_COOKIE = 'directory_token';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}
