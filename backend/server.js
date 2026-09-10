import './utils/domPolyfill.js';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import familiesRouter from './routes/families.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import settingsRouter from './routes/settings.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON payloads
app.use(express.json());
app.use(cookieParser());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🍃 MongoDB Connected Successfully'))
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
