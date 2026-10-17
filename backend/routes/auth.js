import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth, requireRole, AUTH_COOKIE } from '../middleware/auth.js';
import { sendVerificationEmail, sendAdminNotificationEmail, sendPasswordResetEmail } from '../utils/mailer.js';
import { EMAIL_RE } from '../utils/email.js';

const router = express.Router();

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const PASSWORD_RESET_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const FORGOT_PASSWORD_MESSAGE = 'If the entered email is registered, a password reset email will be sent to it.';

function cookieOptions() {
  // Secure cookies require HTTPS, so default to on in production but allow an
  // explicit override for deployments running behind plain HTTP (e.g. an
  // internal network without TLS yet) - otherwise login would silently never
  // persist a cookie in the browser.
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

function statusMessage(user) {
  if (user.status === 'pending_verification') {
    return 'Please check your email and click the verification link before signing in.';
  }
  if (user.status === 'pending_approval') {
    return 'Your registration is still awaiting admin approval.';
  }
  if (user.status === 'denied') {
    return 'Your registration was not approved. Please contact the Church Office.';
  }
  if (!user.passwordHash) {
    return 'Please use the link emailed to you to set your password before signing in.';
  }
  return null;
}

function htmlPage(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#222;text-align:center;}
    h1{font-size:1.3rem;}</style></head>
    <body><h1>${title}</h1><p>${message}</p></body></html>`;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid username or password.' });

    const blocked = statusMessage(user);
    if (blocked) return res.status(403).json({ error: blocked });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });

    const token = jwt.sign(
      { sub: user._id.toString(), username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.cookie(AUTH_COOKIE, token, cookieOptions());
    res.json({ id: user._id, username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  // Username comes from the db rather than the token, since an admin can
  // change it (it's the account's email address) mid-session.
  res.json({
    id: user._id,
    username: user.username,
    role: req.user.role,
    receiveAdminNotifications: user.receiveAdminNotifications,
  });
});

// PUT /api/auth/password - change your own password (requires current password)
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/auth/notification-settings - admin opts in/out of new-registration emails
router.put('/notification-settings', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { receiveAdminNotifications } = req.body;
    if (typeof receiveAdminNotifications !== 'boolean') {
      return res.status(400).json({ error: 'receiveAdminNotifications must be a boolean.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.receiveAdminNotifications = receiveAdminNotifications;
    await user.save();
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/register - self-service account request (public)
router.post('/register', async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, first name, and last name are required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const existing = await User.findOne({ username: normalizedEmail });
    if (existing && existing.status !== 'denied') {
      return res.status(409).json({
        error: existing.status === 'active'
          ? 'An account with this email already exists.'
          : 'A registration for this email is already in progress.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);

    // Send before persisting: if the mail server rejects the message, we don't
    // want to leave behind a "pending" record the user can never retry.
    await sendVerificationEmail(normalizedEmail, firstName.trim(), token);

    if (existing) {
      existing.firstName = firstName.trim();
      existing.lastName = lastName.trim();
      existing.status = 'pending_verification';
      existing.emailVerifyToken = token;
      existing.emailVerifyTokenExpires = expires;
      existing.passwordSetupToken = undefined;
      existing.passwordSetupTokenExpires = undefined;
      await existing.save();
    } else {
      await User.create({
        username: normalizedEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: 'user',
        status: 'pending_verification',
        emailVerifyToken: token,
        emailVerifyTokenExpires: expires,
      });
    }

    res.status(201).json({ message: 'Check your email to verify your address.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/verify-email?token=... - clicked from the verification email (public)
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send(htmlPage('Invalid Link', 'This verification link is missing its token.'));

  try {
    const user = await User.findOne({ emailVerifyToken: token, status: 'pending_verification' });
    if (!user || user.emailVerifyTokenExpires < new Date()) {
      return res.status(400).send(htmlPage(
        'Link Expired',
        'This verification link is invalid or has expired. Please submit a new registration request.',
      ));
    }

    user.status = 'pending_approval';
    user.emailVerifyToken = undefined;
    user.emailVerifyTokenExpires = undefined;
    await user.save();

    // Best-effort: a failed admin notification shouldn't block the user from
    // seeing their verification succeeded, nor stop other admins being notified.
    // receiveAdminNotifications defaults to true for new admins, but Mongoose
    // defaults don't retroactively backfill existing documents - so treat a
    // missing field the same as true (only an explicit opt-out excludes them),
    // matching the "opt-out" semantics the settings UI already assumes.
    const admins = await User.find({ role: 'admin', receiveAdminNotifications: { $ne: false } });
    const adminEmails = admins.map((admin) => admin.username).filter((username) => EMAIL_RE.test(username));
    await Promise.all(
      adminEmails.map((adminEmail) =>
        sendAdminNotificationEmail(adminEmail, user).catch((err) => {
          console.error(`Failed to notify admin ${adminEmail} of new registration:`, err.message);
        }),
      ),
    );

    res.send(htmlPage(
      'Email Verified',
      'Thanks! Your email has been verified. An administrator will review your registration soon &mdash; you\'ll receive another email once a decision is made.',
    ));
  } catch (err) {
    res.status(500).send(htmlPage('Something Went Wrong', err.message));
  }
});

// POST /api/auth/forgot-password - email a password reset link (public)
// Always responds the same way, and sends in the background, so neither the
// response nor its timing reveals whether the email belongs to an account.
router.post('/forgot-password', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  res.json({ message: FORGOT_PASSWORD_MESSAGE });

  try {
    const user = await User.findOne({ username: email, status: 'active' });
    if (!user) return;
    if (user.passwordResetSentAt && Date.now() - user.passwordResetSentAt < PASSWORD_RESET_COOLDOWN_MS) return;

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordSetupToken = token;
    user.passwordSetupTokenExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    user.passwordResetSentAt = new Date();
    await user.save();
    await sendPasswordResetEmail(user.username, user.firstName, token, '1 hour');
  } catch (err) {
    console.error(`Failed to send password reset email to ${email}:`, err.message);
  }
});

// POST /api/auth/set-password - clicked from an approval or password reset email, then submits a new password (public)
router.post('/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const user = await User.findOne({ passwordSetupToken: token });
    if (!user || user.passwordSetupTokenExpires < new Date()) {
      return res.status(400).json({ error: 'This link is invalid or has expired. Please request a new password reset email, or contact an admin.' });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordSetupToken = undefined;
    user.passwordSetupTokenExpires = undefined;
    await user.save();
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
