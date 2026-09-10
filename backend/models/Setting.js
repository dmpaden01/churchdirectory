import mongoose from 'mongoose';

const { Schema } = mongoose;

const photoSchema = new Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
  },
  { _id: false },
);

// Single document holding site-wide settings (favicon, and whatever else gets
// added later). Always read/written via the fixed "singleton" _id below.
const settingSchema = new Schema(
  {
    _id: { type: String },
    favicon: { type: photoSchema },
  },
  { timestamps: true },
);

export default mongoose.model('Setting', settingSchema);
