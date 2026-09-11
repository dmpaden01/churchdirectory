// One-time data fix: birthday and anniversary used to be stored as BSON Date
// (schema has since changed to "MM/DD"/"MM/DD/YYYY" strings), but existing
// documents saved under the old schema were never retroactively converted -
// changing a Mongoose schema type doesn't touch data already in MongoDB.
// Converts any Date-typed birthday/anniversary still in the database to the
// current string format, using UTC getters since these were stored as UTC
// midnight. Uses the raw driver (not Mongoose) so it's unaffected by whatever
// the schema currently declares. Safe to re-run - only touches Date values.
import 'dotenv/config';
import mongoose from 'mongoose';

function dateToMonthDayYear(date) {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.db.collection('families');
  const families = await collection.find({}).toArray();

  let familiesTouched = 0;
  let birthdaysFixed = 0;
  let anniversariesFixed = 0;

  for (const family of families) {
    let changed = false;
    const individuals = (family.individuals || []).map((ind) => {
      if (ind.birthday instanceof Date) {
        birthdaysFixed++;
        changed = true;
        return { ...ind, birthday: dateToMonthDayYear(ind.birthday) };
      }
      return ind;
    });

    const update = { individuals };
    if (family.anniversary instanceof Date) {
      anniversariesFixed++;
      changed = true;
      update.anniversary = dateToMonthDayYear(family.anniversary);
    }

    if (changed) {
      familiesTouched++;
      await collection.updateOne({ _id: family._id }, { $set: update });
    }
  }

  console.log(`Families touched: ${familiesTouched}`);
  console.log(`Birthdays converted: ${birthdaysFixed}`);
  console.log(`Anniversaries converted: ${anniversariesFixed}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
