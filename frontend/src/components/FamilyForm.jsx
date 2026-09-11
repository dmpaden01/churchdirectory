import { useState } from 'react';
import IndividualFields from './IndividualFields';
import PhotoDropzone from './PhotoDropzone';
import { createFamily, updateFamily, deleteFamily, familyPhotoUrl, individualPhotoUrl } from '../api/families';
import './FamilyForm.css';

function toDateInputValue(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

// Decodes a data: URL (e.g. a photo pulled from an imported PDF) into a real File,
// so it uploads through the normal photo field even if the admin never touches it.
function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function emptyIndividual(role) {
  return {
    role,
    firstName: '',
    lastName: '',
    roleStatus: '',
    cellPhone: '',
    email: '',
    birthday: '',
  };
}

function draftIndividualToFormState(ind) {
  return {
    role: ind.role,
    firstName: ind.firstName || '',
    lastName: ind.lastName || '',
    roleStatus: ind.roleStatus || '',
    cellPhone: ind.cellPhone || '',
    email: ind.email || '',
    birthday: toDateInputValue(ind.birthday),
  };
}

function familyToFormState(family, draft) {
  if (family) {
    // Editing an existing family. If a PDF-import draft is also given, the import
    // matched this family by address - prefill with the freshly parsed PDF data
    // (not what's currently saved) so Review & Save updates this record instead
    // of creating a duplicate. The individuals list is fully replaced by the
    // draft's in that case, so existing per-person photos aren't carried over
    // (there's no reliable way to match old people to new ones).
    const source = draft || family;
    return {
      address: source.address || '',
      aptSuite: source.aptSuite || '',
      city: source.city || '',
      state: source.state || '',
      zipCode: source.zipCode || '',
      homePhone: source.homePhone || '',
      anniversary: source.anniversary || '',
      photoPath: draft?.photoDataUrl || familyPhotoUrl(family),
      photoFile: draft?.photoDataUrl ? dataUrlToFile(draft.photoDataUrl, 'imported-family-photo.png') : undefined,
      removeFamilyPhoto: false,
      individuals: draft
        ? draft.individuals.map(draftIndividualToFormState)
        : family.individuals.map((ind, index) => ({
            role: ind.role,
            firstName: ind.firstName || '',
            lastName: ind.lastName || '',
            roleStatus: ind.roleStatus || '',
            cellPhone: ind.cellPhone || '',
            email: ind.email || '',
            birthday: toDateInputValue(ind.birthday),
            photoPath: individualPhotoUrl(family._id, index, ind),
            removePhoto: false,
          })),
    };
  }
  if (draft) {
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
      individuals: draft.individuals.map(draftIndividualToFormState),
    };
  }
  return {
    address: '',
    aptSuite: '',
    city: '',
    state: '',
    zipCode: '',
    homePhone: '',
    anniversary: '',
    photoPath: undefined,
    removeFamilyPhoto: false,
    individuals: [emptyIndividual('head')],
  };
}

// Add/edit form for a family and its member individuals.
// `draft` optionally pre-fills a new (not yet saved) family, e.g. from a PDF import.
export default function FamilyForm({ family, draft, onSaved, onDeleted, onCancel }) {
  const [form, setForm] = useState(() => familyToFormState(family, draft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = Boolean(family);
  const hasSpouse = form.individuals.some((ind) => ind.role === 'spouse');

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const updateIndividual = (index, updated) => {
    setForm((prev) => {
      const individuals = [...prev.individuals];
      individuals[index] = updated;
      return { ...prev, individuals };
    });
  };

  const addSpouse = () => {
    if (hasSpouse) return;
    setForm((prev) => {
      const individuals = [...prev.individuals];
      individuals.splice(1, 0, emptyIndividual('spouse'));
      return { ...prev, individuals };
    });
  };

  const addChild = () => {
    setForm((prev) => ({
      ...prev,
      individuals: [...prev.individuals, emptyIndividual('child')],
    }));
  };

  const removeIndividual = (index) => {
    setForm((prev) => ({
      ...prev,
      individuals: prev.individuals.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = isEditing
        ? await updateFamily(family._id, form)
        : await createFamily(form);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete the ${family.familyName} family? This cannot be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteFamily(family._id);
      onDeleted();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form className="family-form" onSubmit={handleSubmit}>
      <h2>{isEditing ? `Edit Family: ${family.familyName}` : 'Add New Family'}</h2>

      {error && <div className="form-error">{error}</div>}

      {draft?.notes?.length > 0 && (
        <div className="import-notes">
          <strong>Please double-check the following before saving:</strong>
          <ul>
            {draft.notes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </div>
      )}

      <section className="form-section">
        <h3>Family Information</h3>
        <div className="fields-with-photo">
          <PhotoDropzone
            label="Family Photo (optional)"
            existingUrl={form.removeFamilyPhoto ? null : form.photoPath}
            onChange={(file) => setForm((prev) => ({ ...prev, photoFile: file, removeFamilyPhoto: false }))}
            onRemove={() => setForm((prev) => ({ ...prev, photoFile: undefined, removeFamilyPhoto: true }))}
          />

          <div className="family-fields-grid">
            <div className="field-group">
              <label>Address *</label>
              <input type="text" value={form.address} onChange={setField('address')} required />
            </div>

            <div className="field-group">
              <label>Suite / Apt. Number</label>
              <input type="text" value={form.aptSuite} onChange={setField('aptSuite')} />
            </div>

            <div className="field-group">
              <label>City *</label>
              <input type="text" value={form.city} onChange={setField('city')} required />
            </div>

            <div className="field-group">
              <label>State *</label>
              <input type="text" value={form.state} onChange={setField('state')} required />
            </div>

            <div className="field-group">
              <label>Zip Code *</label>
              <input type="text" value={form.zipCode} onChange={setField('zipCode')} required />
            </div>

            <div className="field-group">
              <label>Home Phone Number</label>
              <input type="tel" value={form.homePhone} onChange={setField('homePhone')} />
            </div>

            <div className="field-group">
              <label>Anniversary (MM/DD)</label>
              <input
                type="text"
                placeholder="MM/DD"
                pattern="(0?[1-9]|1[0-2])/(0?[1-9]|[12]\d|3[01])"
                title="Enter the month and day, e.g. 06/14"
                value={form.anniversary}
                onChange={setField('anniversary')}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3>Family Members</h3>
        {form.individuals.map((individual, index) => (
          <IndividualFields
            key={index}
            individual={individual}
            index={index}
            onChange={updateIndividual}
            onRemove={removeIndividual}
            removable={individual.role !== 'head'}
          />
        ))}

        <div className="add-member-buttons">
          <button type="button" onClick={addSpouse} disabled={hasSpouse}>
            + Add Spouse
          </button>
          <button type="button" onClick={addChild}>
            + Add Child
          </button>
        </div>
      </section>

      <div className="form-actions">
        <button type="submit" className="primary-btn" disabled={saving}>
          {saving ? 'Saving...' : 'Save Family'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        {isEditing && (
          <button type="button" className="danger-btn" onClick={handleDelete} disabled={saving}>
            Delete Family
          </button>
        )}
      </div>
    </form>
  );
}
