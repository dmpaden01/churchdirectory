import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useOutletContext } from 'react-router-dom';
import FamilyForm from '../components/FamilyForm';
import { getFamily } from '../api/families';

// /families/new (no :id - add a family) and /families/:id/edit (edit an
// existing one).
export default function FamilyFormRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { bumpRefresh } = useOutletContext();
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) {
      setFamily(null);
      setLoading(false);
      return;
    }
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

  const backToSearch = () => {
    bumpRefresh();
    navigate('/');
  };

  // Cancel undoes the navigation that opened this form (Add New / Edit),
  // rather than than pushing a fresh entry that duplicates wherever we came
  // from - otherwise a single Back press after Cancel would just land back
  // on this same form instead of skipping past it. Falls back to a plain
  // (replace) navigation when there's nothing in-app to go back to, e.g. a
  // hard refresh or a direct link straight to this URL.
  const handleCancel = () => {
    if (location.state?.canGoBack) {
      navigate(-1);
    } else if (id) {
      navigate(`/families/${id}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  if (loading) return <p className="family-search-status">Loading family...</p>;

  return (
    <FamilyForm
      family={family}
      onSaved={backToSearch}
      onDeleted={backToSearch}
      onCancel={handleCancel}
    />
  );
}
