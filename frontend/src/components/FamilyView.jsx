import { familyPhotoUrl, individualPhotoUrl } from '../api/families';
import './FamilyView.css';

const ROLE_LABELS = {
  head: 'Head of Household',
  spouse: 'Spouse',
  child: 'Child',
};

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="view-field">
      <span className="view-field-label">{label}</span>
      <span className="view-field-value">{value}</span>
    </div>
  );
}

// Read-only display of a family, visible to any signed-in user.
export default function FamilyView({ family, isAdmin, onEdit, onBack }) {
  const address = [family.address, family.aptSuite].filter(Boolean).join(', ');
  const cityStateZip = [
    [family.city, family.state].filter(Boolean).join(', '),
    family.zipCode,
  ].filter(Boolean).join(' ');

  return (
    <div className="family-view">
      <div className="family-view-header">
        <h2>{family.familyName} Family</h2>
        {isAdmin && (
          <button type="button" className="primary-btn" onClick={onEdit}>
            Edit Family
          </button>
        )}
      </div>

      <section className="form-section">
        <div className="family-view-info">
          <img
            src={familyPhotoUrl(family) || '/default-avatar.svg'}
            alt=""
            className="family-view-photo"
          />
          <div className="view-fields-grid">
            <Field label="Address" value={address} />
            <Field label="City / State / Zip" value={cityStateZip} />
            <Field label="Home Phone" value={family.homePhone} />
            <Field label="Anniversary" value={formatDate(family.anniversary)} />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3>Family Members</h3>
        {family.individuals.map((individual, index) => (
          <div className="family-view-individual" key={individual._id || index}>
            <img
              src={individualPhotoUrl(family._id, index, individual) || '/default-avatar.svg'}
              alt=""
              className="family-view-photo family-view-photo-small"
            />
            <div className="view-fields-grid">
              <Field label={ROLE_LABELS[individual.role]} value={`${individual.firstName} ${individual.lastName}`} />
              <Field label="Gender" value={individual.gender} />
              <Field label="Cell Phone" value={individual.cellPhone} />
              <Field label="Email" value={individual.email} />
              <Field label="Birthday" value={formatDate(individual.birthday)} />
            </div>
          </div>
        ))}
      </section>

      <div className="form-actions">
        <button type="button" onClick={onBack}>Back to Search</button>
      </div>
    </div>
  );
}
