import { useEffect, useState } from 'react';
import { searchFamilies } from '../api/families';
import './FamilySearch.css';

function headOf(family) {
  return family.individuals?.[0];
}

// Search-by-family-name box plus results list, and the "Add new family" entry point.
export default function FamilySearch({ onSelectFamily, onAddNew, onImport, refreshToken }) {
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
        <button type="button" className="primary-btn" onClick={onAddNew}>
          + Add a New Family
        </button>
        <button type="button" onClick={onImport}>
          Import from PDF
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <p className="family-search-status">Loading...</p>}
      {!loading && families.length === 0 && (
        <p className="family-search-status">No families found.</p>
      )}

      <ul className="family-results">
        {families.map((family) => {
          const head = headOf(family);
          return (
            <li key={family._id} onClick={() => onSelectFamily(family._id)}>
              <img
                src={family.photoPath || '/default-avatar.svg'}
                alt=""
                className="family-result-photo"
              />
              <div className="family-result-info">
                <strong>{family.familyName}</strong>
                <span>{head ? `${head.firstName} ${head.lastName}` : ''}</span>
                <span className="family-result-location">{family.city}, {family.state}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
