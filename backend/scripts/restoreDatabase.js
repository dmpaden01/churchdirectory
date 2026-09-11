// Restores a backup created by backupDatabase.js. DESTRUCTIVE: for each
// collection found in the backup, all of that collection's current documents
// are deleted and replaced with the backed-up ones. Requires typing the
// database name to confirm before doing anything.
//
// Usage: node scripts/restoreDatabase.js <path-to-backup-dir>
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import mongoose from 'mongoose';
import { EJSON } from 'bson';

const backupDir = process.argv[2];
if (!backupDir) {
  console.error('Usage: node scripts/restoreDatabase.js <path-to-backup-dir>');
  process.exit(1);
}
if (!fs.existsSync(backupDir)) {
  console.error(`Backup directory not found: ${backupDir}`);
  process.exit(1);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('No .json files found in that backup directory.');
    process.exit(1);
  }

  console.log(`About to restore into database "${db.databaseName}" from ${backupDir}:`);
  files.forEach((f) => console.log(` - ${f.replace(/\.json$/, '')}`));
  console.log('\nThis DELETES all current documents in each of those collections first, then reinserts the backed-up ones.');

  const answer = await ask(`\nType the database name (${db.databaseName}) to confirm: `);
  if (answer.trim() !== db.databaseName) {
    console.log('Confirmation did not match - aborted, nothing was changed.');
    await mongoose.disconnect();
    process.exit(1);
  }

  for (const file of files) {
    const name = file.replace(/\.json$/, '');
    const docs = EJSON.parse(fs.readFileSync(path.join(backupDir, file), 'utf8'));
    await db.collection(name).deleteMany({});
    if (docs.length > 0) await db.collection(name).insertMany(docs);
    console.log(` - ${name}: restored ${docs.length} document(s)`);
  }

  console.log('\nRestore complete.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Restore failed:', err.message);
  process.exit(1);
});
