// Filesystem-backed storage for family/individual photos, replacing the old
// approach of embedding the raw image bytes directly in the Mongo document
// (see scripts/migratePhotosToFilesystem.js for the one-time migration).
// PHOTOS_DIR should point at a volume mounted into the backend container so
// photos survive container restarts/rebuilds.
import { promises as fs, mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

const PHOTOS_DIR = process.env.PHOTOS_DIR || path.join(process.cwd(), 'data/photos');
mkdirSync(PHOTOS_DIR, { recursive: true });

const EXTENSIONS_BY_CONTENT_TYPE = { 'image/jpeg': '.jpg', 'image/png': '.png' };

export function photoAbsolutePath(filename) {
  return path.join(PHOTOS_DIR, filename);
}

// Writes a photo to disk under a fresh, content-addressed-by-nothing (just
// random) filename and returns it. Never reuses an existing filename, so a
// replaced photo's old file can always be safely deleted afterwards without
// racing whoever might still be reading it.
export async function savePhoto(buffer, contentType) {
  const filename = `${crypto.randomUUID()}${EXTENSIONS_BY_CONTENT_TYPE[contentType] || ''}`;
  await fs.writeFile(photoAbsolutePath(filename), buffer);
  return filename;
}

export async function deletePhoto(filename) {
  if (!filename) return;
  await fs.rm(photoAbsolutePath(filename), { force: true });
}
