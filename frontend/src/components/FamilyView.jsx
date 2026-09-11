import { familyPhotoUrl } from '../api/families';
import './FamilyView.css';

// Head/spouse are easily inferred from context (first two adults listed), so
// only children get an explicit tag in the read-only view.
const ROLE_LABELS = {
  child: 'Child',
};

// One person, condensed onto a single line: name, role tag, then whatever
// details are actually present, separated by dots.
function MemberLine({ individual }) {
  const details = [
    individual.roleStatus,
    individual.cellPhone,
    individual.email,
    individual.birthday,
  ].filter(Boolean);

  return (
    <p className="family-member-line">
      <strong>{individual.firstName} {individual.lastName}</strong>
      {ROLE_LABELS[individual.role] && (
        <span className="member-role-tag">{ROLE_LABELS[individual.role]}</span>
      )}
      {details.length > 0 && <span className="member-details">{details.join(' · ')}</span>}
    </p>
  );
}

// Read-only display of a family, visible to any signed-in user. Laid out as a
// single compact card: photo on the left, member lines and mailing-style
// address on the right.
export default function FamilyView({ family, isAdmin, onEdit, onBack }) {
  const streetLine = [family.address, family.aptSuite].filter(Boolean).join(', ');
  const cityStateZip = [
    [family.city, family.state].filter(Boolean).join(', '),
    family.zipCode,
  ].filter(Boolean).join(' ');
  const fullAddress = [streetLine, cityStateZip].filter(Boolean).join(', ');
  const mapsUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null;

  // Belt-and-suspenders: href + target="_blank" alone is sometimes overridden by
  // browser settings/extensions, so force a genuine new-tab/window open on click too.
  const openMaps = (e) => {
    e.preventDefault();
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

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

      <div className="family-card">
        <img
          src={familyPhotoUrl(family) || '/default-avatar.svg'}
          alt=""
          className="family-card-photo"
        />

        <div className="family-card-body">
          <div className="family-card-members">
            {family.individuals.map((individual, index) => (
              <MemberLine individual={individual} key={individual._id || index} />
            ))}
          </div>

          <address className="family-card-address">
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openMaps}
                className="family-card-address-link"
              >
                {streetLine && <div>{streetLine}</div>}
                {cityStateZip && <div>{cityStateZip}</div>}
              </a>
            ) : (
              <>
                {streetLine && <div>{streetLine}</div>}
                {cityStateZip && <div>{cityStateZip}</div>}
              </>
            )}
            {family.homePhone && <div className="family-card-extra">{family.homePhone}</div>}
            {family.anniversary && (
              <div className="family-card-extra">Anniversary: {family.anniversary}</div>
            )}
          </address>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onBack}>Back to Search</button>
      </div>
    </div>
  );
}
