// Best-effort parser for the legacy "Church Directory" PDF export format.
// The source text is semi-structured and inconsistent (wrapped lines, missing
// zip/state, nicknames in parens, deceased flags), so this produces draft
// family records for a human to review and complete in the admin UI rather
// than records that get saved directly.

import { normalizeMonthDayYear } from './monthDayYear.js';

const NOISE_LINE_PATTERNS = [
  /^Church Directory$/,
  /^Church Directory Page \d+ of \d+$/,
  /^\d{2}\/\d{2}\/\d{4}$/,
  /^-- \d+ of \d+ --$/,
  /^Powered by TCPDF/,
];

const HEADER_START = /^([A-Z][A-Za-z'.\-]+(?: [A-Z][A-Za-z'.\-]+)?),\s*(.+)$/;
const DETAIL_KEYWORD = /\b(BIRTHDAY|CELL|WORK)\b/;
const ADDRESS_LINE = /,\s*(?:[A-Z]{2}|None)(?:\s+\d{5})?\s*$/;

function cleanLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !NOISE_LINE_PATTERNS.some((re) => re.test(l)));
}

// Groups cleaned lines into one block per family, using paren-balance to avoid
// mistaking a wrapped children list ("Albie, and Ari) cell ...") for a new record.
function segmentFamilies(lines) {
  const blocks = [];
  let current = null;
  let parenDepth = 0;
  for (const line of lines) {
    if (parenDepth === 0 && HEADER_START.test(line)) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
    const opens = (line.match(/\(/g) || []).length;
    const closes = (line.match(/\)/g) || []).length;
    parenDepth = Math.max(0, parenDepth + opens - closes);
  }
  if (current) blocks.push(current);
  return blocks;
}

function parseAddressLine(line) {
  const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { address: line, city: '', state: '', zipCode: '' };
  const last = parts[parts.length - 1];
  const city = parts[parts.length - 2];
  const address = parts.slice(0, parts.length - 2).join(', ');
  const match = last.match(/^([A-Za-z]+)\s*(\d{5})?$/);
  const state = match && match[1] !== 'None' ? match[1] : '';
  const zipCode = (match && match[2]) || '';
  return { address, city, state, zipCode };
}

// Normalizes a matched "M/D", "M/D/YY", or "M/D/YYYY" source value to "MM/DD"
// or "MM/DD/YYYY". Falls back to dropping a non-4-digit year (rare in this
// source format) rather than losing the whole value.
function normalizeDateMatch(raw) {
  if (!raw) return '';
  const direct = normalizeMonthDayYear(raw);
  if (direct) return direct;
  const [mm, dd] = raw.split('/');
  return normalizeMonthDayYear(`${mm}/${dd}`) || '';
}

// forcedLastName: when given (the head of household), the header's surname is
// authoritative, so all name tokens stay in firstName instead of being split off
// as a last name (avoids e.g. "Tina R" being read as first name "Tina", last name "R").
function splitName(rawName, forcedLastName) {
  let name = rawName.trim();
  let nickname = '';
  name = name.replace(/\(([^)]+)\)/, (m) => {
    nickname = m;
    return '';
  }).replace(/\s+/g, ' ').trim();

  let suffix = '';
  const suffixMatch = name.match(/,?\s*(Sr\.?|Jr\.?|II|III|IV)$/i);
  if (suffixMatch) {
    suffix = suffixMatch[1];
    name = name.slice(0, suffixMatch.index).trim();
  }
  name = name.replace(/,\s*$/, '').trim();

  const tokens = name.split(/\s+/).filter(Boolean);
  let firstName = '';
  let lastName = '';
  if (forcedLastName !== undefined) {
    firstName = tokens.join(' ');
    lastName = forcedLastName;
  } else if (tokens.length === 1) {
    firstName = tokens[0];
  } else if (tokens.length > 1) {
    firstName = tokens[0];
    lastName = tokens.slice(1).join(' ');
  }
  if (nickname) firstName = `${firstName} ${nickname}`.trim();
  if (suffix) lastName = lastName ? `${lastName}, ${suffix}` : suffix;
  return { firstName, lastName };
}

function parseFamilyBlock(lines) {
  const notes = [];
  let i = 0;

  const headerLines = [];
  while (i < lines.length && !DETAIL_KEYWORD.test(lines[i]) && !ADDRESS_LINE.test(lines[i]) && lines[i] !== 'COMMENTS') {
    headerLines.push(lines[i]);
    i++;
  }
  const headerText = headerLines.join(' ').replace(/\s+/g, ' ');
  const headerMatch = headerText.match(HEADER_START);
  const familyLastName = headerMatch ? headerMatch[1] : '';
  const hasSpouse = / & /.test(headerMatch ? headerMatch[2].split('(')[0] : '');
  const homePhoneMatch = headerText.match(/\bhome\s+(\(\d{3}\)\s*\d{3}-\d{4})/i);
  const homePhone = homePhoneMatch ? homePhoneMatch[1] : '';

  let address = '';
  let city = '';
  let state = '';
  let zipCode = '';
  if (i < lines.length && ADDRESS_LINE.test(lines[i]) && !DETAIL_KEYWORD.test(lines[i])) {
    ({ address, city, state, zipCode } = parseAddressLine(lines[i]));
    i++;
  } else {
    notes.push('No address found in source.');
  }

  const personChunks = [];
  const commentsLines = [];
  let inComments = false;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line === 'COMMENTS') { inComments = true; continue; }
    if (inComments) { commentsLines.push(line); continue; }
    if (/^(EMAIL|ANNIVERSARY)\b/.test(line) && personChunks.length > 0) {
      personChunks[personChunks.length - 1] += ` ${line}`;
    } else {
      personChunks.push(line);
    }
  }
  if (commentsLines.length) notes.push(`Source comments: ${commentsLines.join(' ')}`);

  let anniversary = '';
  const individuals = personChunks.map((chunk, index) => {
    const deceased = /\(Deceased\)/i.test(chunk);
    const text = chunk.replace(/\(Deceased\)/i, '');

    const birthdayMatch = text.match(/BIRTHDAY\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    const cellMatch = text.match(/CELL\s+(\(\d{3}\)\s*\d{3}-\d{4})/);
    const emailMatch = text.match(/EMAIL\s+(\S+@\S+?)(?=\s+[A-Z]+\s|\s*$)/);
    const annivMatch = text.match(/ANNIVERSARY\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);

    const namePart = text.split(/BIRTHDAY|CELL|EMAIL|ANNIVERSARY/)[0].trim();
    const { firstName, lastName } = splitName(namePart, index === 0 ? familyLastName : undefined);
    const displayName = `${firstName} ${lastName}`.trim() || `Person ${index + 1}`;

    if (annivMatch && !anniversary) {
      anniversary = normalizeDateMatch(annivMatch[1]);
    }
    if (deceased) notes.push(`${displayName} is marked as deceased in the source data.`);

    let role = 'child';
    if (index === 0) role = 'head';
    else if (index === 1 && hasSpouse) role = 'spouse';

    return {
      role,
      firstName: firstName || `Person ${index + 1}`,
      lastName: lastName || familyLastName,
      roleStatus: deceased ? 'Deceased' : '',
      cellPhone: cellMatch ? cellMatch[1] : '',
      email: emailMatch ? emailMatch[1].replace(/[.,]$/, '') : '',
      birthday: normalizeDateMatch(birthdayMatch?.[1]),
    };
  });

  if (individuals.length === 0) {
    individuals.push({ role: 'head', firstName: '', lastName: familyLastName, cellPhone: '', email: '', birthday: '' });
    notes.push('No family member details were found in the source for this entry.');
  }

  return {
    address,
    aptSuite: '',
    city,
    state,
    zipCode,
    homePhone,
    anniversary,
    individuals,
    notes,
    _headerPrefix: familyLastName ? `${familyLastName},` : null,
  };
}

// Loose match key: lowercase, strip punctuation, so "10 Chris Ct." and "10 chris ct" line up.
function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// `pages` (optional): pdf-parse's per-page text ([{ num, text }]), used only to figure out
// which page each family starts on, for photo matching. Text-parsing itself doesn't need it.
export function parseDirectoryPdf(rawText, pages = []) {
  const lines = cleanLines(rawText);
  const blocks = segmentFamilies(lines);
  const families = blocks.map((block) => {
    const family = parseFamilyBlock(block);
    const page = pages.find((p) => p.text.includes(block[0]));
    family._pageNum = page ? page.num : null;
    return family;
  });

  families.forEach((family, index) => {
    const key = `${normalize(family.individuals[0].lastName)}|${normalize(family.address)}`;
    const isDuplicate = families.some((other, otherIndex) => {
      if (otherIndex >= index) return false;
      return `${normalize(other.individuals[0].lastName)}|${normalize(other.address)}` === key;
    });
    if (isDuplicate && key !== '|') {
      family.notes.push('Possible duplicate of an earlier entry in this import (same name & address).');
    }
  });

  return families;
}

// Flags drafts that look like they match a family already saved in the directory,
// so re-running an import doesn't silently create duplicates. `existingFamilies` is
// a lean list of { familyName, address } from the database.
export function flagExistingMatches(families, existingFamilies) {
  return families.map((family) => {
    const lastName = family.individuals[0].lastName;
    const nameKey = normalize(lastName);
    const addressKey = normalize(family.address);

    const addressMatch = addressKey && existingFamilies.find(
      (existing) => normalize(existing.familyName) === nameKey && normalize(existing.address) === addressKey,
    );
    const nameMatch = !addressMatch && existingFamilies.some(
      (existing) => normalize(existing.familyName) === nameKey,
    );

    let existingMatch = null;
    let existingFamilyId = null;
    if (addressMatch) {
      existingMatch = 'address';
      existingFamilyId = String(addressMatch._id);
      family.notes.push(`A "${lastName}" family already exists in your directory at this address — saving this will update that family instead of creating a new one.`);
    } else if (nameMatch) {
      existingMatch = 'name';
      family.notes.push(`A family named "${lastName}" already exists in your directory. Double-check this isn't the same family before saving.`);
    }

    return { ...family, existingMatch, existingFamilyId };
  });
}

// Builds the {index, pageNum, prefix} list matchImagesToFamilies() needs to locate each
// family's header line among a page's raw text runs.
export function buildPhotoMatchEntries(families) {
  return families.map((family, index) => ({
    index,
    pageNum: family._pageNum,
    prefix: family._headerPrefix,
  }));
}

// Applies a Map<imageName, familyIndex> (from matchImagesToFamilies) plus the actual
// decoded images (keyed by name) onto the family drafts as `photoDataUrl`.
export function attachPhotos(families, imageNameToFamilyIndex, imagesByName) {
  imageNameToFamilyIndex.forEach((familyIndex, imageName) => {
    const img = imagesByName.get(imageName);
    if (!img) return;
    families[familyIndex].photoDataUrl = img.dataUrl;
    families[familyIndex].notes.push('Family photo imported from the source PDF — please verify it matches this family.');
  });
  return families;
}

// Drops fields used only internally during parsing/matching, before sending drafts to the client.
export function stripInternalFields(families) {
  return families.map(({ _headerPrefix, _pageNum, ...rest }) => rest);
}

const FAMILY_COMPARE_FIELDS = ['address', 'aptSuite', 'city', 'state', 'zipCode', 'homePhone', 'anniversary'];
const INDIVIDUAL_COMPARE_FIELDS = ['firstName', 'lastName', 'roleStatus', 'cellPhone', 'email', 'birthday'];

function normalizeForCompare(value) {
  return (value || '').toString().trim().toLowerCase();
}

function fieldsDiffer(a, b) {
  return normalizeForCompare(a) !== normalizeForCompare(b);
}

function toBuffer(data) {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data.buffer) return Buffer.from(data.buffer);
  return Buffer.from(data);
}

function photoDataUrlToBuffer(dataUrl) {
  return Buffer.from(dataUrl.split(',')[1] || '', 'base64');
}

// True if saving this draft over the matched existing family would change
// nothing at all - same address-block fields, same individuals in the same
// order, and the same photo. A draft with no photo extracted from the PDF
// counts as "no photo difference" too, since saving leaves an existing photo
// untouched when the draft doesn't supply a new one.
export function isDraftIdenticalToFamily(draft, family) {
  const fieldsMatch = FAMILY_COMPARE_FIELDS.every((f) => !fieldsDiffer(family[f], draft[f]));
  if (!fieldsMatch) return false;

  if (draft.individuals.length !== family.individuals.length) return false;
  const individualsMatch = draft.individuals.every((draftInd, index) => {
    const existingInd = family.individuals[index];
    return INDIVIDUAL_COMPARE_FIELDS.every((f) => !fieldsDiffer(existingInd?.[f], draftInd[f]));
  });
  if (!individualsMatch) return false;

  if (draft.photoDataUrl) {
    const existingPhoto = toBuffer(family.photo?.data);
    if (!existingPhoto || !photoDataUrlToBuffer(draft.photoDataUrl).equals(existingPhoto)) return false;
  }

  return true;
}
