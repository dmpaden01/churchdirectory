const BASE_URL = '/api/families';

// Photos are served from dedicated binary endpoints rather than embedded in the
// JSON responses; these just build the <img src> for a family that has one saved.
export function familyPhotoUrl(family) {
  return family?.photo?.contentType ? `${BASE_URL}/${family._id}/photo` : undefined;
}

export function individualPhotoUrl(familyId, index, individual) {
  return individual?.photo?.contentType ? `${BASE_URL}/${familyId}/individuals/${index}/photo` : undefined;
}

export async function searchFamilies(search) {
  const url = search ? `${BASE_URL}?search=${encodeURIComponent(search)}` : BASE_URL;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load families');
  return res.json();
}

export async function getFamily(id) {
  const res = await fetch(`${BASE_URL}/${id}`);
  if (!res.ok) throw new Error('Failed to load family');
  return res.json();
}

// Dismisses needsReview and any import-review notes/highlights without
// editing the family - lets an admin confirm a flagged family looks fine
// as-is straight from the read-only view.
export async function completeReview(id) {
  const res = await fetch(`${BASE_URL}/${id}/complete-review`, { method: 'PATCH' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to complete review');
  }
  return res.json();
}

// Flags a family as needing a follow-up check, with an optional note - lets
// an admin note something noticed in passing straight from the read-only
// view, without a full edit-and-save round trip.
export async function flagReview(id, note) {
  const res = await fetch(`${BASE_URL}/${id}/flag-review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to flag review');
  }
  return res.json();
}

// Builds a multipart/form-data request from the family form state.
// formState: family fields + `photoFile` (File|undefined) + `removeFamilyPhoto` (bool)
//   + individuals: [{ ...fields, _photoFile: File|undefined, removePhoto: bool }]
function buildFormData(formState) {
  const { photoFile, individuals, ...familyFields } = formState;
  const formData = new FormData();

  const payload = {
    ...familyFields,
    individuals: individuals.map((ind, index) => {
      const { _photoFile, ...rest } = ind;
      if (_photoFile) rest._photoField = `individualPhoto_${index}`;
      return rest;
    }),
  };
  if (photoFile) payload._photoField = 'familyPhoto';

  formData.append('data', JSON.stringify(payload));
  if (photoFile) formData.append('familyPhoto', photoFile);
  individuals.forEach((ind, index) => {
    if (ind._photoFile) formData.append(`individualPhoto_${index}`, ind._photoFile);
  });

  return formData;
}

export async function createFamily(formState) {
  const formData = buildFormData(formState);
  const res = await fetch(BASE_URL, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create family');
  }
  return res.json();
}

export async function updateFamily(id, formState) {
  const formData = buildFormData(formState);
  const res = await fetch(`${BASE_URL}/${id}`, { method: 'PUT', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update family');
  }
  return res.json();
}

export async function parseDirectoryPdf(file) {
  const formData = new FormData();
  formData.append('pdf', file);
  const res = await fetch(`${BASE_URL}/parse-pdf`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to parse PDF');
  }
  return res.json();
}

export async function deleteFamily(id) {
  const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete family');
  }
}
