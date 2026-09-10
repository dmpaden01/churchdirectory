import bcrypt from 'bcryptjs';
import User from '../models/User.js';

// Optional first-admin bootstrap, run once at startup: if ADMIN_USERNAME/ADMIN_PASSWORD
// are set and no user with that username exists yet, create it as an admin. Idempotent
// and safe to leave set across restarts/redeploys - once the user exists this is a no-op.
// Without these vars, the manual fallback is `node scripts/createUser.js`.
export async function seedAdminUser() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return;

  const username = ADMIN_USERNAME.trim().toLowerCase();
  if (ADMIN_PASSWORD.length < 8) {
    console.error(`Skipping admin bootstrap: ADMIN_PASSWORD must be at least 8 characters ("${username}").`);
    return;
  }

  const existing = await User.findOne({ username });
  if (existing) return;

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({ username, passwordHash, role: 'admin' });
  console.log(`👤 Bootstrapped admin user "${username}" from ADMIN_USERNAME/ADMIN_PASSWORD.`);
}
