import { useState } from 'react';
import { familyPhotoUrl, completeReview, flagReview } from '../api/families';
import './FamilyView.css';

// Head/spouse are easily inferred from context (first two adults listed), so
// only children get an explicit tag in the read-only view.
const ROLE_LABELS = {
  child: 'Child',
};

function changedCls(isChanged) {
  return isChanged ? 'review-changed-text' : undefined;
}

// One person: name, role tag, then whatever details are actually present -
// dot-separated inline on wider screens, one per line on narrow ones (see
// .member-details in FamilyView.css). `changedFields` (optional) highlights
// exactly which of this person's fields an import review flagged.
function MemberLine({ individual, changedFields }) {
  const details = [
    { key: 'roleStatus', value: individual.roleStatus },
    { key: 'cellPhone', value: individual.cellPhone },
    { key: 'email', value: individual.email },
    { key: 'birthday', value: individual.birthday },
  ].filter((d) => d.value);

  return (
    <p className="family-member-line">
      <strong className={changedCls(changedFields?.firstName || changedFields?.lastName || changedFields?.suffix)}>
        {individual.firstName} {individual.lastName}{individual.suffix ? ` ${individual.suffix}` : ''}
      </strong>
      {ROLE_LABELS[individual.role] && (
        <span className="member-role-tag">{ROLE_LABELS[individual.role]}</span>
      )}
      {details.length > 0 && (
        <span className="member-details">
          {details.map((d) => (
            <span key={d.key} className={['member-detail', changedCls(changedFields?.[d.key])].filter(Boolean).join(' ')}>
              {d.value}
            </span>
          ))}
        </span>
      )}
    </p>
  );
}

// Read-only display of a family, visible to any signed-in user. Laid out as a
// single compact card: photo on the left, member lines and mailing-style
// address on the right. `onReviewCompleted` (admin only): called with the
// updated family after dismissing a pending review, so the parent can update
// its copy without navigating away from this page.
export default function FamilyView({ family, isAdmin, onEdit, onBack, onReviewCompleted }) {
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagNote, setFlagNote] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [flagError, setFlagError] = useState(null);

  const streetLine = [family.address, family.aptSuite].filter(Boolean).join(', ');
  const cityStateZip = [
    [family.city, family.state].filter(Boolean).join(', '),
    family.zipCode,
  ].filter(Boolean).join(' ');
  const fullAddress = [streetLine, cityStateZip].filter(Boolean).join(', ');
  const mapsUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null;
  // Import-review highlighting is an admin workflow aid - a non-admin viewer
  // would see oddly-colored text with no banner/button to explain it.
  const changed = isAdmin ? family.reviewChangedFields : null;

  // Belt-and-suspenders: href + target="_blank" alone is sometimes overridden by
  // browser settings/extensions, so force a genuine new-tab/window open on click too.
  const openMaps = (e) => {
    e.preventDefault();
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCompleteReview = async () => {
    setCompleting(true);
    setCompleteError(null);
    try {
      const updated = await completeReview(family._id);
      onReviewCompleted(updated);
    } catch (err) {
      setCompleteError(err.message);
    } finally {
      setCompleting(false);
    }
  };

  const handleFlagReview = async (e) => {
    e.preventDefault();
    setFlagging(true);
    setFlagError(null);
    try {
      const updated = await flagReview(family._id, flagNote.trim());
      onReviewCompleted(updated);
      setFlagOpen(false);
      setFlagNote('');
    } catch (err) {
      setFlagError(err.message);
    } finally {
      setFlagging(false);
    }
  };

  return (
    <div className="family-view">
      <div className="family-view-header">
        <h2>{family.familyName} Family</h2>
        <div className="family-view-header-actions">
          {isAdmin && !family.needsReview && !flagOpen && (
            <button type="button" className="flag-review-btn" onClick={() => setFlagOpen(true)}>
              Flag for Review
            </button>
          )}
          {isAdmin && (
            <button type="button" className="primary-btn" onClick={onEdit}>
              Edit Family
            </button>
          )}
        </div>
      </div>

      {isAdmin && flagOpen && (
        <form className="flag-review-form" onSubmit={handleFlagReview}>
          <label htmlFor="flag-review-note">
            What needs a second look? <span className="flag-review-hint">(optional)</span>
          </label>
          <input
            id="flag-review-note"
            type="text"
            value={flagNote}
            onChange={(e) => setFlagNote(e.target.value)}
            placeholder="e.g. They are moving"
            autoFocus
          />
          <div className="flag-review-form-actions">
            <button type="submit" disabled={flagging}>
              {flagging ? 'Flagging...' : 'Flag for Review'}
            </button>
            <button
              type="button"
              onClick={() => { setFlagOpen(false); setFlagNote(''); setFlagError(null); }}
              disabled={flagging}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {flagError && <div className="form-error">{flagError}</div>}

      {isAdmin && family.needsReview && (
        <div className="needs-review-banner">
          <span>
            Review
            {family.reviewNotes?.length > 0
              ? ` (${family.reviewNotes.length} item${family.reviewNotes.length === 1 ? '' : 's'} to double-check)`
              : ''}
          </span>
          <button type="button" onClick={handleCompleteReview} disabled={completing}>
            {completing ? 'Completing...' : 'Accept As-Is'}
          </button>
          <p className="needs-review-hint-text">
            Click &quot;Edit Family&quot; to fix manually or &quot;Accept As-Is&quot; to complete review.
          </p>
        </div>
      )}
      {completeError && <div className="form-error">{completeError}</div>}

      <div className="family-card">
        <img
          src={familyPhotoUrl(family) || '/default-avatar.svg'}
          alt=""
          className={`family-card-photo${changed?.photo ? ' photo-changed' : ''}`}
        />

        <div className="family-card-body">
          <div className="family-card-members">
            {family.individuals.map((individual, index) => (
              <MemberLine
                individual={individual}
                key={individual._id || index}
                changedFields={changed?.individuals?.[index]}
              />
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
                {streetLine && <div className={changedCls(changed?.address || changed?.aptSuite)}>{streetLine}</div>}
                {cityStateZip && (
                  <div className={changedCls(changed?.city || changed?.state || changed?.zipCode)}>{cityStateZip}</div>
                )}
              </a>
            ) : (
              <>
                {streetLine && <div className={changedCls(changed?.address || changed?.aptSuite)}>{streetLine}</div>}
                {cityStateZip && (
                  <div className={changedCls(changed?.city || changed?.state || changed?.zipCode)}>{cityStateZip}</div>
                )}
              </>
            )}
            {family.homePhone && (
              <div className={`family-card-extra ${changedCls(changed?.homePhone) || ''}`}>{family.homePhone}</div>
            )}
            {family.anniversary && (
              <div className={`family-card-extra ${changedCls(changed?.anniversary) || ''}`}>
                Anniversary: {family.anniversary}
              </div>
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
