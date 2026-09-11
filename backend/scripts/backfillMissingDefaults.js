// One-time data fix: some fields were added to the schema with a `default`
// after documents already existed in the database. Mongoose defaults only
// apply when a document is created - they never retroactively backfill
// existing ones, so those documents simply have the field missing entirely.
// That's usually harmless (JS truthy checks treat missing the same as the
// default), but it's a trap for any future strict query filter (exactly the
// bug already hit once with User.receiveAdminNotifications). This explicitly
// sets each field to its schema default wherever it's missing. Safe to
// re-run - only touches documents that don't already have the field.
import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const familiesResult = await db.collection('families').updateMany(
    { needsReview: { $exists: false } },
    { $set: { needsReview: false } },
  );
  console.log(`families: set needsReview=false on ${familiesResult.modifiedCount} document(s)`);

  const usersResult = await db.collection('users').updateMany(
    { receiveAdminNotifications: { $exists: false } },
    { $set: { receiveAdminNotifications: true } },
  );
  console.log(`users: set receiveAdminNotifications=true on ${usersResult.modifiedCount} document(s)`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
