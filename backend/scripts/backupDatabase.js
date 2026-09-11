// Dumps every collection in the connected MongoDB database to local JSON files
// (one per collection) under backend/backups/<timestamp>/, using BSON's
// Extended JSON so ObjectIds, Dates, and binary photo data round-trip losslessly.
// Never committed - see .gitignore. Restore with restoreDatabase.js.
//
// Usage: node scripts/backupDatabase.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { EJSON } from 'bson';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve('backups', timestamp);
  fs.mkdirSync(outDir, { recursive: true });

  const collections = await db.listCollections().toArray();
  console.log(`Backing up ${collections.length} collection(s) from ${db.databaseName} to ${outDir}\n`);

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    const json = EJSON.stringify(docs, { relaxed: false });
    fs.writeFileSync(path.join(outDir, `${name}.json`), json);
    console.log(` - ${name}: ${docs.length} document(s), ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
  }

  console.log(`\nDone. To restore this backup later:\n  node scripts/restoreDatabase.js "${outDir}"`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
