import mongoose from 'mongoose';

const { Schema } = mongoose;

const photoSchema = new Schema(
  {
    data: { type: Buffer, required: true },
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
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true,
  },
  cellPhone: { type: String, trim: true },
  email: { type: String, trim: true },
  birthday: { type: Date },
  photo: { type: photoSchema },
});

const familySchema = new Schema(
  {
    familyName: { type: String, required: true, trim: true, index: true },
    address: { type: String, required: true, trim: true },
    aptSuite: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zipCode: { type: String, required: true, trim: true },
    homePhone: { type: String, trim: true },
    anniversary: { type: Date },
    photo: { type: photoSchema },
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
