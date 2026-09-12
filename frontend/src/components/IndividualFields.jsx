import PhotoDropzone from './PhotoDropzone';

const ROLE_LABELS = {
  head: 'Head of Household',
  spouse: 'Spouse',
  child: 'Child',
};

// One individual's editable fields within the family form.
// `changedFields` (optional): { firstName, lastName, suffix, roleStatus,
// cellPhone, email, birthday } booleans - which fields a PDF-import draft would change
// from what's already saved, for highlighting during review.
export default function IndividualFields({
  individual,
  index,
  onChange,
  onRemove,
  removable,
  changedFields,
}) {
  const set = (field) => (e) => onChange(index, { ...individual, [field]: e.target.value });
  const existingPhotoUrl = individual.removePhoto ? null : individual.photoPath;
  const fieldGroupClass = (name) => `field-group${changedFields?.[name] ? ' field-changed' : ''}`;
  const hasChanges = changedFields && Object.values(changedFields).some(Boolean);

  return (
    <fieldset className={`individual-fieldset${hasChanges ? ' has-changes' : ''}`}>
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
          <div className={fieldGroupClass('firstName')}>
            <label>First Name *</label>
            <input type="text" value={individual.firstName || ''} onChange={set('firstName')} required />
          </div>

          <div className={fieldGroupClass('lastName')}>
            <label>Last Name *</label>
            <input type="text" value={individual.lastName || ''} onChange={set('lastName')} required />
          </div>

          <div className={fieldGroupClass('suffix')}>
            <label>Suffix</label>
            <input
              type="text"
              placeholder="Jr., Sr., III..."
              value={individual.suffix || ''}
              onChange={set('suffix')}
            />
          </div>

          <div className={fieldGroupClass('roleStatus')}>
            <label>Role/Status</label>
            <input type="text" value={individual.roleStatus || ''} onChange={set('roleStatus')} />
          </div>

          <div className={fieldGroupClass('cellPhone')}>
            <label>Cell Phone Number</label>
            <input type="tel" value={individual.cellPhone || ''} onChange={set('cellPhone')} />
          </div>

          <div className={fieldGroupClass('email')}>
            <label>Email</label>
            <input type="email" value={individual.email || ''} onChange={set('email')} />
          </div>

          <div className={fieldGroupClass('birthday')}>
            <label>Birthday</label>
            <input
              type="text"
              placeholder="MM/DD/YYYY"
              pattern="(0?[1-9]|1[0-2])/(0?[1-9]|[12]\d|3[01])(/\d{4})?"
              title="Enter the month and day, and optionally the year, e.g. 06/14 or 06/14/1990"
              value={individual.birthday || ''}
              onChange={set('birthday')}
            />
          </div>
        </div>
      </div>
    </fieldset>
  );
}
