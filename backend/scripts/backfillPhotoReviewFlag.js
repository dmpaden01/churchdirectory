// One-time data fix: the "highlight the photo when it needs review" feature
// (reviewChangedFields.photo) was added after the real bulk PDF import had
// already run, so families saved by that import have a photo and a "please
// verify this photo" note, but never got the flag that actually shows the
// amber border in the read-only view. Backfills it wherever that gap exists,
// merging into any existing reviewChangedFields rather than replacing it.
// Safe to re-run - only touches families matching all three conditions below.
import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.db.collection('families');

  const candidates = await collection.find(
    { needsReview: true, 'photo.data': { $exists: true } },
    { projection: { reviewNotes: 1, reviewChangedFields: 1 } },
  ).toArray();

  let updated = 0;
  for (const f of candidates) {
    const mentionsPhoto = (f.reviewNotes || []).some((n) => /photo/i.test(n));
    if (!mentionsPhoto || f.reviewChangedFields?.photo === true) continue;

    await collection.updateOne(
      { _id: f._id },
      { $set: { reviewChangedFields: { ...(f.reviewChangedFields || {}), photo: true } } },
    );
    updated++;
  }

  console.log(`Families updated: ${updated}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
