// Bootstraps a user account directly in the database. Needed for the very first
// admin account, since the in-app "create user" flow requires already being signed
// in as an admin. Usage:
//   node scripts/createUser.js <username> <password> [admin|user]
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const [, , username, password, roleArg] = process.argv;
const role = roleArg || 'admin';

if (!username || !password) {
  console.error('Usage: node scripts/createUser.js <username> <password> [admin|user]');
  process.exit(1);
}
if (!['admin', 'user'].includes(role)) {
  console.error('Role must be "admin" or "user".');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const normalizedUsername = username.trim().toLowerCase();
  const existing = await User.findOne({ username: normalizedUsername });
  if (existing) {
    console.error(`A user named "${normalizedUsername}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ username: normalizedUsername, passwordHash, role });
  console.log(`Created ${role} user "${normalizedUsername}".`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
