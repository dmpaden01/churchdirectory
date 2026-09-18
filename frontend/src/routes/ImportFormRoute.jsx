import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useOutletContext } from 'react-router-dom';
import FamilyForm from '../components/FamilyForm';
import { getFamily } from '../api/families';

// /import/:draftKey - review-and-save one parsed draft from the pending
// batch held in DirectoryLayout. The batch is client-only and never
// persisted, so this route can't be deep-linked from a fresh page load -
// if the draft isn't found (e.g. it was already saved, or the batch never
// existed in this tab), bounce back to the import list instead of crashing.
export default function ImportFormRoute() {
  const { draftKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { parsedFamilies, setParsedFamilies, bumpRefresh } = useOutletContext();
  const draft = parsedFamilies.find((f) => f._key === draftKey) || null;

  const [matchedFamily, setMatchedFamily] = useState(null);
  const [loading, setLoading] = useState(Boolean(draft?.existingFamilyId));

  useEffect(() => {
    if (!draft?.existingFamilyId) {
      setMatchedFamily(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getFamily(draft.existingFamilyId)
      .then((f) => { if (!cancelled) setMatchedFamily(f); })
      .catch(() => { if (!cancelled) setMatchedFamily(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [draft?.existingFamilyId]);

  if (!draft) return <Navigate to="/import" replace />;
  if (loading) return <p className="family-search-status">Loading family...</p>;

  const draftSaved = () => {
    setParsedFamilies((prev) => prev.filter((f) => f._key !== draftKey));
    bumpRefresh();
    navigate('/import');
  };

  return (
    <FamilyForm
      family={matchedFamily}
      draft={draft}
      onSaved={draftSaved}
      onDeleted={draftSaved}
      onCancel={() => {
        // See FamilyFormRoute's handleCancel for why this pops rather than pushes.
        if (location.state?.canGoBack) navigate(-1);
        else navigate('/import', { replace: true });
      }}
    />
  );
}
