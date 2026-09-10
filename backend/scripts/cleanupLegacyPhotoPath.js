// Removes the stray legacy `photoPath` field left behind because Mongoose's
// strict-mode update casting silently drops $unset on fields no longer in the
// schema. Uses {strict: false} to force it through. Safe to re-run.
import 'dotenv/config';
import mongoose from 'mongoose';
import Family from '../models/Family.js';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await Family.updateMany(
    {},
    { $unset: { photoPath: '', 'individuals.$[].photoPath': '' } },
    { strict: false },
  );
  console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
