import './utils/domPolyfill.js';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import familiesRouter from './routes/families.js';
import wallRouter from './routes/wall.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import settingsRouter from './routes/settings.js';
import { requireAuth } from './middleware/auth.js';
import { seedAdminUser } from './utils/seedAdmin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON payloads
app.use(express.json());
app.use(cookieParser());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('🍃 MongoDB Connected Successfully');
    await seedAdminUser();
  })
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Test API Route
app.get('/api/test', (req, res) => {
  res.json({ message: "Hello from the Node.js backend!" });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
// Not gated by requireAuth at the mount level - the favicon GET must be
// public (needed before login); the write routes self-protect inside.
app.use('/api/settings', settingsRouter);
// Read access (search/view/photos) is open to any signed-in user; write routes
// (create/update/delete/import) enforce admin themselves within familiesRouter.
app.use('/api/families', requireAuth, familiesRouter);
// Public read-only wall kiosk display - gated by a shared key (see
// middleware/auth.js requireWallKey) instead of a signed-in user.
app.use('/api/wall', wallRouter);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
