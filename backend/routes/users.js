import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendApprovalEmail, sendDenialEmail } from '../utils/mailer.js';

const router = express.Router();

const PASSWORD_SETUP_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const USER_FIELDS = 'username role status firstName lastName createdAt';

router.use(requireAuth, requireRole('admin'));

// GET /api/users - list all users, including pending registrations (admin only)
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, USER_FIELDS).sort({ username: 1 }).lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users - create a new user directly (admin only)
router.post('/', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "admin" or "user".' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) return res.status(409).json({ error: 'That username is already taken.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username: normalizedUsername, passwordHash, role, status: 'active' });
    res.status(201).json({ _id: user._id, username: user.username, role: user.role, createdAt: user.createdAt });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/users/:id/approve - approve a pending registration (admin only)
router.post('/:id/approve', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Only registrations awaiting approval can be approved.' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    // Send first: if it fails, leave the user in pending_approval rather than
    // silently marking them active with a setup link they never received.
    await sendApprovalEmail(user.username, user.firstName || '', token);

    user.status = 'active';
    user.passwordSetupToken = token;
    user.passwordSetupTokenExpires = new Date(Date.now() + PASSWORD_SETUP_TTL_MS);
    await user.save();
    res.json({ _id: user._id, username: user.username, status: user.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/users/:id/deny - deny a pending registration (admin only)
router.post('/:id/deny', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Only registrations awaiting approval can be denied.' });
    }

    // Send first, same reasoning as approve: don't mark denied if they'll never know why.
    await sendDenialEmail(user.username, user.firstName || '');

    user.status = 'denied';
    user.emailVerifyToken = undefined;
    user.emailVerifyTokenExpires = undefined;
    await user.save();
    res.json({ _id: user._id, username: user.username, status: user.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/users/:id/password - reset another user's password (admin only, no current password needed)
router.put('/:id/password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/users/:id - remove a user (admin only, cannot delete yourself)
router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account while signed in as it.' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
