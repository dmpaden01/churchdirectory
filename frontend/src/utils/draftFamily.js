// Shared helpers for turning a parsed PDF-import draft into FamilyForm's form
// state, used both by the one-at-a-time "Review & Save" flow (FamilyForm) and
// the "Accept All Changes" bulk-import flow (DirectoryPage), so the two stay
// in sync instead of maintaining two separate mappings.

// Decodes a data: URL (e.g. a photo pulled from an imported PDF) into a real File,
// so it uploads through the normal photo field even if the admin never touches it.
export function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export function draftIndividualToFormState(ind) {
  return {
    role: ind.role,
    firstName: ind.firstName || '',
    lastName: ind.lastName || '',
    roleStatus: ind.roleStatus || '',
    cellPhone: ind.cellPhone || '',
    email: ind.email || '',
    birthday: ind.birthday || '',
  };
}

export function draftToFormState(draft, { needsReview = false } = {}) {
  return {
    address: draft.address || '',
    aptSuite: draft.aptSuite || '',
    city: draft.city || '',
    state: draft.state || '',
    zipCode: draft.zipCode || '',
    homePhone: draft.homePhone || '',
    anniversary: draft.anniversary || '',
    photoPath: draft.photoDataUrl || undefined,
    photoFile: draft.photoDataUrl ? dataUrlToFile(draft.photoDataUrl, 'imported-family-photo.png') : undefined,
    removeFamilyPhoto: false,
    needsReview,
    individuals: draft.individuals.map(draftIndividualToFormState),
  };
}

const FAMILY_COMPARE_FIELDS = ['address', 'aptSuite', 'city', 'state', 'zipCode', 'homePhone', 'anniversary'];
const INDIVIDUAL_COMPARE_FIELDS = ['firstName', 'lastName', 'roleStatus', 'cellPhone', 'email', 'birthday'];

function normalizeForCompare(value) {
  return (value || '').toString().trim().toLowerCase();
}

function fieldsDiffer(a, b) {
  return normalizeForCompare(a) !== normalizeForCompare(b);
}

// Compares a PDF-import draft against the existing family it matched, field by
// field, so the review form can highlight exactly what the PDF would change.
// Individuals are compared by position - the common case for a re-imported
// family is the same people in the same order. A person with no counterpart
// in the existing record (the draft has more people than the family does) has
// every non-empty field flagged, since that's new information to review too.
// Returns null when there's nothing to compare against (no match, or no draft).
export function computeChangedFields(family, draft) {
  if (!family || !draft) return null;

  const familyChanges = {};
  FAMILY_COMPARE_FIELDS.forEach((field) => {
    familyChanges[field] = fieldsDiffer(family[field], draft[field]);
  });

  const individualChanges = draft.individuals.map((draftInd, index) => {
    const existingInd = family.individuals?.[index];
    const changes = {};
    INDIVIDUAL_COMPARE_FIELDS.forEach((field) => {
      changes[field] = existingInd
        ? fieldsDiffer(existingInd[field], draftInd[field])
        : Boolean(normalizeForCompare(draftInd[field]));
    });
    return changes;
  });

  return { ...familyChanges, individuals: individualChanges };
}
