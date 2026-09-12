import { useEffect, useState } from 'react';
import { searchFamilies, familyPhotoUrl } from '../api/families';
import './FamilySearch.css';

function headOf(family) {
  return family.individuals?.[0];
}

// First name with suffix (e.g. "Thomas Sr."), for display wherever the last
// name is omitted as redundant.
function firstNameWithSuffix(individual) {
  return individual.suffix ? `${individual.firstName} ${individual.suffix}` : individual.firstName;
}

// Full name with suffix (e.g. "Thomas Jordan Sr."), for display when the last
// name needs to be shown.
function fullNameWithSuffix(individual) {
  return individual.suffix
    ? `${individual.firstName} ${individual.lastName} ${individual.suffix}`
    : `${individual.firstName} ${individual.lastName}`;
}

// Search-by-family-name box plus results list, and the "Add new family" entry point.
export default function FamilySearch({ onSelectFamily, onAddNew, onImport, onReviewFamily, refreshToken, isAdmin }) {
  const [query, setQuery] = useState('');
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchFamilies(query)
      .then((results) => { if (!cancelled) setFamilies(results); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, refreshToken]);

  return (
    <div className="family-search">
      <div className="family-search-header">
        <input
          type="text"
          placeholder="Search by family (last) name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isAdmin && (
          <div className="family-search-actions">
            <button type="button" className="primary-btn" onClick={onAddNew}>
              + Add a New Family
            </button>
            <button type="button" onClick={onImport}>
              Import from PDF
            </button>
          </div>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <p className="family-search-status">Loading...</p>}
      {!loading && families.length === 0 && (
        <p className="family-search-status">No families found.</p>
      )}

      <ul className="family-results">
        {families.map((family) => {
          const head = headOf(family);
          const spouse = family.individuals?.find((i) => i.role === 'spouse');
          const children = family.individuals?.filter((i) => i.role === 'child') || [];
          // The family (last) name is already shown in bold above, so it's
          // redundant here unless the spouse has a different one - in which
          // case show both full names to make the difference clear.
          const sameLastName = !spouse || head?.lastName === spouse.lastName;
          const namesLine = !head
            ? ''
            : sameLastName
              ? `${firstNameWithSuffix(head)}${spouse ? ` & ${firstNameWithSuffix(spouse)}` : ''}`
              : `${fullNameWithSuffix(head)} & ${fullNameWithSuffix(spouse)}`;
          return (
            <li key={family._id} onClick={() => onSelectFamily(family._id)}>
              <img
                src={familyPhotoUrl(family) || '/default-avatar.svg'}
                alt=""
                className="family-result-photo"
              />
              <div className="family-result-info">
                <strong>{family.familyName}</strong>
                <span>{namesLine}</span>
                {children.length > 0 && (
                  <span className="family-result-children">
                    <em>{children.map(firstNameWithSuffix).join(', ')}</em>
                  </span>
                )}
              </div>
              {isAdmin && family.needsReview && (
                <button
                  type="button"
                  className="family-result-review-btn"
                  onClick={(e) => { e.stopPropagation(); onReviewFamily(family._id); }}
                >
                  Review{family.reviewNotes?.length > 0 ? ` (${family.reviewNotes.length})` : ''}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
