// One-time data fix: some individuals have a name suffix (e.g. "Jr.", "Sr.")
// folded into their lastName field (e.g. "Jordan, Sr."), left over from
// before the dedicated suffix field existed - this broke the family list's
// "same last name" shorthand display. Moves the suffix into the new suffix
// field and strips any trailing ", " (or plain trailing space) from
// lastName. Safe to re-run - only touches individuals whose lastName still
// matches the pattern below.
import 'dotenv/config';
import mongoose from 'mongoose';
import Family from '../models/Family.js';

const SUFFIX_PATTERN = /,?\s*(Sr\.?|Jr\.?|II|III|IV)$/i;

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const families = await Family.find({ 'individuals.lastName': SUFFIX_PATTERN });

  let familiesUpdated = 0;
  let individualsUpdated = 0;
  let skipped = 0;
  for (const family of families) {
    let changed = false;
    for (const individual of family.individuals) {
      const match = individual.lastName?.match(SUFFIX_PATTERN);
      if (!match) continue;

      const strippedLastName = individual.lastName.slice(0, match.index).trim();
      if (!strippedLastName) {
        // The whole lastName was just the suffix (e.g. an import with no real
        // last name) - leave it alone rather than violate the required field.
        console.warn(`Skipping ${individual.firstName} in "${family.familyName}": lastName is only a suffix ("${individual.lastName}").`);
        skipped++;
        continue;
      }

      individual.suffix = match[1];
      individual.lastName = strippedLastName;
      changed = true;
      individualsUpdated++;
    }
    if (changed) {
      await family.save();
      familiesUpdated++;
    }
  }

  console.log(`Families updated: ${familiesUpdated}, individuals updated: ${individualsUpdated}, skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
