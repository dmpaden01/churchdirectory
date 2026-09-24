// Builds a vCard 3.0 contact card for one individual, so phones can add them
// straight to their contacts. 3.0 rather than 4.0 because it's the version
// iOS and Android contacts both import most reliably.
import { promises as fs } from 'fs';
import { photoAbsolutePath } from './photoStorage.js';

const VCARD_PHOTO_TYPES = { 'image/jpeg': 'JPEG', 'image/png': 'PNG' };

function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

// RFC 2425 line folding: content lines over 75 octets continue on the next
// line prefixed by a single space (matters mostly for the base64 photo).
function fold(line) {
  const parts = [];
  for (let i = 0; i < line.length; i += 74) parts.push(line.slice(i, i + 74));
  return parts.join('\r\n ');
}

// "MM/DD/YYYY" -> "YYYY-MM-DD". Without a year, uses Apple's omit-year
// convention (a placeholder year flagged by X-APPLE-OMIT-YEAR) since 3.0 has
// no standard year-less birthday; other clients just see the placeholder year.
function birthdayLine(birthday) {
  const match = birthday?.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return yyyy
    ? `BDAY:${yyyy}-${mm}-${dd}`
    : `BDAY;X-APPLE-OMIT-YEAR=1604:1604-${mm}-${dd}`;
}

async function photoLine(photo) {
  const type = VCARD_PHOTO_TYPES[photo?.contentType];
  if (!type) return null;
  try {
    const data = await fs.readFile(photoAbsolutePath(photo.filename));
    return `PHOTO;ENCODING=b;TYPE=${type}:${data.toString('base64')}`;
  } catch {
    return null;
  }
}

// Uses the individual's own photo, falling back to the family photo.
export async function buildVCard(family, individual) {
  const nameParts = [individual.firstName, individual.lastName, individual.suffix].filter(Boolean);
  const hasAddress = family.address || family.city || family.state || family.zipCode;
  const street = [family.address, family.aptSuite].filter(Boolean).join(', ');

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${[individual.lastName, individual.firstName, '', '', individual.suffix].map(escapeText).join(';')}`,
    `FN:${escapeText(nameParts.join(' '))}`,
    individual.cellPhone && `TEL;TYPE=CELL:${escapeText(individual.cellPhone)}`,
    family.homePhone && `TEL;TYPE=HOME:${escapeText(family.homePhone)}`,
    individual.email && `EMAIL;TYPE=INTERNET:${escapeText(individual.email)}`,
    hasAddress && `ADR;TYPE=HOME:${['', '', street, family.city, family.state, family.zipCode, ''].map(escapeText).join(';')}`,
    birthdayLine(individual.birthday),
    await photoLine(individual.photo || family.photo),
    'END:VCARD',
  ].filter(Boolean);

  return `${lines.map(fold).join('\r\n')}\r\n`;
}
