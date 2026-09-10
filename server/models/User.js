import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], required: true, default: 'user' },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
