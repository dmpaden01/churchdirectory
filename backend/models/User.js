import mongoose from 'mongoose';

const { Schema } = mongoose;

// active: normal usable account (admin-created, or self-registered + approved + password set)
// pending_verification: self-registered, hasn't clicked the email verification link yet
// pending_approval: email verified, waiting on an admin to approve or deny
// denied: an admin denied the registration
const STATUSES = ['active', 'pending_verification', 'pending_approval', 'denied'];

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String },
    role: { type: String, enum: ['admin', 'user'], required: true, default: 'user' },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    status: { type: String, enum: STATUSES, required: true, default: 'active' },
    emailVerifyToken: { type: String },
    emailVerifyTokenExpires: { type: Date },
    passwordSetupToken: { type: String },
    passwordSetupTokenExpires: { type: Date },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
