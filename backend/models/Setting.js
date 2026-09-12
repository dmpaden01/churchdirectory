import mongoose from 'mongoose';

const { Schema } = mongoose;

// Photos live on disk (see utils/photoStorage.js) - only the generated
// filename and content type are stored on the document.
const photoSchema = new Schema(
  {
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
  },
  { _id: false },
);

// Single document holding site-wide settings, always read/written via the
// fixed "singleton" _id below.
// - logo: the original full-size image an admin uploads.
// - favicon: a 50x50 version auto-generated from it for the browser tab icon.
// - churchName: shown at the top of the wall display in place of the default
//   "Church Directory" title when set.
const settingSchema = new Schema(
  {
    _id: { type: String },
    logo: { type: photoSchema },
    favicon: { type: photoSchema },
    churchName: { type: String, trim: true },
  },
  { timestamps: true },
);

export default mongoose.model('Setting', settingSchema);
