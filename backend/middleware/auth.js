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

// Gates the public /wall kiosk display (see routes/wall.js) - a shared secret
// passed as ?key=... instead of a per-user login, since the display has no
// signed-in user of its own. Not a substitute for real auth on its own; it's
// meant to be paired with network-level restrictions on who can reach /wall.
export function requireWallKey(req, res, next) {
  const expected = process.env.WALL_API_KEY;
  if (!expected || req.query.key !== expected) {
    return res.status(401).json({ error: 'Invalid or missing key.' });
  }
  next();
}
