import { useState } from 'react';
import IndividualFields from './IndividualFields';
import PhotoDropzone from './PhotoDropzone';
import { createFamily, updateFamily, deleteFamily, familyPhotoUrl, individualPhotoUrl } from '../api/families';
import { draftToFormState, computeChangedFields } from '../utils/draftFamily';
import './FamilyForm.css';

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

function familyToFormState(family, draft) {
  if (family) {
    // Editing an existing family. If a PDF-import draft is also given, the import
    // matched this family by address - prefill with the freshly parsed PDF data
    // (not what's currently saved) so Review & Save updates this record instead
    // of creating a duplicate. The individuals list is fully replaced by the
    // draft's in that case, so existing per-person photos aren't carried over
    // (there's no reliable way to match old people to new ones). Reviewing here
    // (either way) resolves any pending needs-review flag.
    if (draft) return draftToFormState(draft, { needsReview: false });
    return {
      address: family.address || '',
      aptSuite: family.aptSuite || '',
      city: family.city || '',
      state: family.state || '',
      zipCode: family.zipCode || '',
      homePhone: family.homePhone || '',
      anniversary: family.anniversary || '',
      photoPath: familyPhotoUrl(family),
      removeFamilyPhoto: false,
      needsReview: family.needsReview || false,
      individuals: family.individuals.map((ind, index) => ({
        role: ind.role,
        firstName: ind.firstName || '',
        lastName: ind.lastName || '',
        roleStatus: ind.roleStatus || '',
        cellPhone: ind.cellPhone || '',
        email: ind.email || '',
        birthday: ind.birthday || '',
        photoPath: individualPhotoUrl(family._id, index, ind),
        removePhoto: false,
      })),
    };
  }
  if (draft) return draftToFormState(draft, { needsReview: false });
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
    needsReview: false,
    individuals: [emptyIndividual('head')],
  };
}

// Add/edit form for a family and its member individuals.
// `draft` optionally pre-fills a new (not yet saved) family, e.g. from a PDF import.
export default function FamilyForm({ family, draft, onSaved, onDeleted, onCancel }) {
  const [form, setForm] = useState(() => familyToFormState(family, draft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Snapshot of which fields differ from what's already saved, for
  // highlighting - computed once from the original props, not from the live
  // (editable) form state, so it doesn't disappear as the admin types. A live
  // PDF-import draft takes priority; otherwise fall back to whatever was
  // persisted from an earlier bulk import (see reviewChangedFields).
  const [changedFields] = useState(() => (
    draft ? computeChangedFields(family, draft) : (family?.reviewChangedFields || null)
  ));
  const reviewNotes = draft?.notes?.length > 0 ? draft.notes : (family?.reviewNotes || []);

  const isEditing = Boolean(family);
  const hasSpouse = form.individuals.some((ind) => ind.role === 'spouse');

  const fieldGroupClass = (name) => `field-group${changedFields?.[name] ? ' field-changed' : ''}`;

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

      <label className={`needs-review-toggle${form.needsReview ? ' active' : ''}`}>
        <input
          type="checkbox"
          checked={form.needsReview}
          onChange={(e) => setForm((prev) => ({ ...prev, needsReview: e.target.checked }))}
        />
        Review
        <span className="needs-review-hint">
          {form.needsReview
            ? 'Flagged for a follow-up check - uncheck once you’ve verified this family’s information.'
            : 'Flag this family for another admin to double-check later.'}
        </span>
      </label>

      {reviewNotes.length > 0 && (
        <div className="import-notes">
          <strong>Please double-check the following before saving:</strong>
          <ul>
            {reviewNotes.map((note, i) => <li key={i}>{note}</li>)}
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
            <div className={fieldGroupClass('address')}>
              <label>Address</label>
              <input type="text" value={form.address} onChange={setField('address')} />
            </div>

            <div className={fieldGroupClass('aptSuite')}>
              <label>Suite / Apt. Number</label>
              <input type="text" value={form.aptSuite} onChange={setField('aptSuite')} />
            </div>

            <div className={fieldGroupClass('city')}>
              <label>City</label>
              <input type="text" value={form.city} onChange={setField('city')} />
            </div>

            <div className={fieldGroupClass('state')}>
              <label>State</label>
              <input type="text" value={form.state} onChange={setField('state')} />
            </div>

            <div className={fieldGroupClass('zipCode')}>
              <label>Zip Code</label>
              <input type="text" value={form.zipCode} onChange={setField('zipCode')} />
            </div>

            <div className={fieldGroupClass('homePhone')}>
              <label>Home Phone Number</label>
              <input type="tel" value={form.homePhone} onChange={setField('homePhone')} />
            </div>

            <div className={fieldGroupClass('anniversary')}>
              <label>Anniversary</label>
              <input
                type="text"
                placeholder="MM/DD/YYYY"
                pattern="(0?[1-9]|1[0-2])/(0?[1-9]|[12]\d|3[01])(/\d{4})?"
                title="Enter the month and day, and optionally the year, e.g. 06/14 or 06/14/1990"
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
            changedFields={changedFields?.individuals?.[index]}
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
