// One-time migration: moves photos referenced by the old `photoPath` (a URL to a
// file under backend/uploads/) into the new `photo: { data, contentType }` field
// stored directly on the family/individual document. Run once after deploying the
// blob-storage schema change; safe to re-run (skips families with no legacy path).
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Family from '../models/Family.js';

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return null;
}

function readPhoto(photoPath) {
  if (!photoPath) return undefined;
  const contentType = contentTypeFor(photoPath);
  if (!contentType) {
    console.warn(`  Skipping unrecognized file type: ${photoPath}`);
    return undefined;
  }
  const absolute = path.join(process.cwd(), photoPath.replace(/^\//, ''));
  if (!fs.existsSync(absolute)) {
    console.warn(`  File not found on disk, skipping: ${absolute}`);
    return undefined;
  }
  return { data: fs.readFileSync(absolute), contentType };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const families = await Family.find({}).lean();
  let migratedPhotos = 0;
  let familiesTouched = 0;

  for (const family of families) {
    let changed = false;

    const familyPhoto = readPhoto(family.photoPath);
    if (familyPhoto) {
      changed = true;
      migratedPhotos++;
    }

    const individuals = (family.individuals || []).map((ind) => {
      const photo = readPhoto(ind.photoPath);
      if (photo) {
        changed = true;
        migratedPhotos++;
      }
      const { photoPath, ...rest } = ind;
      return photo ? { ...rest, photo } : rest;
    });

    if (!changed) continue;

    console.log(`Migrating "${family.familyName}" (${family._id})...`);
    await Family.updateOne(
      { _id: family._id },
      {
        $set: { individuals, ...(familyPhoto ? { photo: familyPhoto } : {}) },
        $unset: { photoPath: '' },
      },
    );
    familiesTouched++;
  }

  console.log(`Done. Migrated ${migratedPhotos} photo(s) across ${familiesTouched} famil${familiesTouched === 1 ? 'y' : 'ies'}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
