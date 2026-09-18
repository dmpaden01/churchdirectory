import { useEffect, useState } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import FamilyView from '../components/FamilyView';
import { getFamily } from '../api/families';

// /families/:id - fetches the family named in the URL so the page is a real
// deep link (a shared/bookmarked/back-navigated URL works even on a fresh
// page load), rather than relying on state handed down from the search list.
export default function FamilyViewRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, bumpRefresh } = useOutletContext();
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFamily(id)
      .then((f) => { if (!cancelled) setFamily(f); })
      .catch((err) => {
        if (cancelled) return;
        alert(err.message);
        navigate('/');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <p className="family-search-status">Loading family...</p>;
  if (!family) return null;

  return (
    <FamilyView
      family={family}
      isAdmin={isAdmin}
      onEdit={() => navigate(`/families/${id}/edit`, { state: { canGoBack: true } })}
      onBack={() => { bumpRefresh(); navigate('/'); }}
      onReviewCompleted={(updated) => { setFamily(updated); bumpRefresh(); }}
    />
  );
}
