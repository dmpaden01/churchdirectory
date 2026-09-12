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

const individualSchema = new Schema({
  role: {
    type: String,
    enum: ['head', 'spouse', 'child'],
    required: true,
  },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  // e.g. "Jr.", "Sr.", "III" - kept separate from lastName so the family list
  // and other displays can place it after the first name instead.
  suffix: { type: String, trim: true },
  roleStatus: { type: String, trim: true },
  cellPhone: { type: String, trim: true },
  email: { type: String, trim: true },
  // "MM/DD" or "MM/DD/YYYY" - the year isn't always known in imported source data.
  birthday: { type: String, trim: true },
  photo: { type: photoSchema },
});

const familySchema = new Schema(
  {
    familyName: { type: String, required: true, trim: true, index: true },
    address: { type: String, trim: true },
    aptSuite: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    homePhone: { type: String, trim: true },
    // "MM/DD" or "MM/DD/YYYY" - the year isn't tracked in the current source
    // data, but the field supports one in case it becomes available later.
    anniversary: { type: String, trim: true },
    photo: { type: photoSchema },
    // Set when a family is bulk-accepted from a PDF import without individual
    // review, so an admin can find and double-check it later.
    needsReview: { type: Boolean, default: false },
    // The parser's "please double-check" notes and the field-level diff
    // against the previously-saved record (see computeChangedFields on the
    // frontend), persisted only when a family is bulk-accepted so a later
    // reviewer sees the same guidance an interactive review would have shown.
    // Cleared automatically the next time this family is saved through the
    // normal edit form - see PUT /:id below.
    reviewNotes: { type: [String], default: undefined },
    reviewChangedFields: { type: Schema.Types.Mixed, default: undefined },
    individuals: {
      type: [individualSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0 && arr[0].role === 'head',
        message: 'A family must have at least one individual, and the first must be the head of household.',
      },
    },
  },
  { timestamps: true },
);

export default mongoose.model('Family', familySchema);
