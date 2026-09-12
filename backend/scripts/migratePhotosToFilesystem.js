// One-time migration: moves photos stored as `photo: { data: <Buffer>, contentType }`
// directly on Family/individual documents, and the Setting singleton's logo/favicon,
// onto the filesystem (PHOTOS_DIR - see utils/photoStorage.js), replacing the embedded
// bytes with `{ filename, contentType }`. Run once after deploying the filesystem photo
// storage change. Safe to re-run - only touches photos still in the old {data, contentType} shape.
import 'dotenv/config';
import Family from '../models/Family.js';
import Setting from '../models/Setting.js';
import { savePhoto } from '../utils/photoStorage.js';
import mongoose from 'mongoose';

function isLegacyBlobPhoto(photo) {
  return Boolean(photo?.data);
}

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data?.buffer) return Buffer.from(data.buffer);
  return Buffer.from(data);
}

async function migratePhoto(photo) {
  const filename = await savePhoto(toBuffer(photo.data), photo.contentType);
  return { filename, contentType: photo.contentType };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  // .lean() so families not yet migrated still come back with the
  // now-schema-less `photo.data` field intact.
  const families = await Family.find({}).lean();
  let migratedPhotos = 0;
  let familiesTouched = 0;

  for (const family of families) {
    let changed = false;

    let familyPhoto = family.photo;
    if (isLegacyBlobPhoto(familyPhoto)) {
      familyPhoto = await migratePhoto(familyPhoto);
      changed = true;
      migratedPhotos++;
    }

    const individuals = await Promise.all((family.individuals || []).map(async (ind) => {
      if (!isLegacyBlobPhoto(ind.photo)) return ind;
      changed = true;
      migratedPhotos++;
      return { ...ind, photo: await migratePhoto(ind.photo) };
    }));

    if (!changed) continue;

    console.log(`Migrating "${family.familyName}" (${family._id})...`);
    // $set replaces the whole `photo`/`individuals` value, which drops the
    // old `data` field along with it - no separate $unset needed.
    await Family.updateOne(
      { _id: family._id },
      { $set: { individuals, photo: familyPhoto } },
    );
    familiesTouched++;
  }

  console.log(`Done. Migrated ${migratedPhotos} photo(s) across ${familiesTouched} famil${familiesTouched === 1 ? 'y' : 'ies'}.`);

  const settings = await Setting.findById('singleton').lean();
  if (settings) {
    const update = {};
    if (isLegacyBlobPhoto(settings.logo)) {
      update.logo = await migratePhoto(settings.logo);
      console.log('Migrating site logo...');
    }
    if (isLegacyBlobPhoto(settings.favicon)) {
      update.favicon = await migratePhoto(settings.favicon);
      console.log('Migrating site favicon...');
    }
    if (Object.keys(update).length > 0) {
      await Setting.updateOne({ _id: 'singleton' }, { $set: update });
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
