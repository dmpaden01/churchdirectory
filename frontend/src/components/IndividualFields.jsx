import PhotoDropzone from './PhotoDropzone';

const ROLE_LABELS = {
  head: 'Head of Household',
  spouse: 'Spouse',
  child: 'Child',
};

// One individual's editable fields within the family form.
export default function IndividualFields({
  individual,
  index,
  onChange,
  onRemove,
  removable,
}) {
  const set = (field) => (e) => onChange(index, { ...individual, [field]: e.target.value });
  const existingPhotoUrl = individual.removePhoto ? null : individual.photoPath;

  return (
    <fieldset className="individual-fieldset">
      <legend>
        {ROLE_LABELS[individual.role]}
        {removable && (
          <button
            type="button"
            className="remove-individual-btn"
            onClick={() => onRemove(index)}
          >
            Remove
          </button>
        )}
      </legend>

      <div className="fields-with-photo">
        <PhotoDropzone
          label="Photo (optional)"
          existingUrl={existingPhotoUrl}
          onChange={(file) => onChange(index, { ...individual, _photoFile: file, removePhoto: false })}
          onRemove={() => onChange(index, { ...individual, _photoFile: undefined, removePhoto: true })}
        />

        <div className="individual-fields-grid">
          <div className="field-group">
            <label>First Name *</label>
            <input type="text" value={individual.firstName || ''} onChange={set('firstName')} required />
          </div>

          <div className="field-group">
            <label>Last Name *</label>
            <input type="text" value={individual.lastName || ''} onChange={set('lastName')} required />
          </div>

          <div className="field-group">
            <label>Role/Status</label>
            <input type="text" value={individual.roleStatus || ''} onChange={set('roleStatus')} />
          </div>

          <div className="field-group">
            <label>Cell Phone Number</label>
            <input type="tel" value={individual.cellPhone || ''} onChange={set('cellPhone')} />
          </div>

          <div className="field-group">
            <label>Email</label>
            <input type="email" value={individual.email || ''} onChange={set('email')} />
          </div>

          <div className="field-group">
            <label>Birthday</label>
            <input type="date" value={individual.birthday || ''} onChange={set('birthday')} />
          </div>
        </div>
      </div>
    </fieldset>
  );
}
