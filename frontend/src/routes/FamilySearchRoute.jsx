import { Navigate, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import FamilySearch from '../components/FamilySearch';

export default function FamilySearchRoute() {
  const navigate = useNavigate();
  const { isAdmin, refreshToken } = useOutletContext();
  const [searchParams] = useSearchParams();

  // Back-compat for admin-notification emails sent before routing switched
  // from ?view=users to a real /users URL (see backend/utils/mailer.js).
  if (searchParams.get('view') === 'users' && isAdmin) {
    return <Navigate to="/users" replace />;
  }

  return (
    <FamilySearch
      onSelectFamily={(id) => navigate(`/families/${id}`)}
      onAddNew={() => navigate('/families/new', { state: { canGoBack: true } })}
      onImport={() => navigate('/import')}
      onReviewFamily={(id) => navigate(`/families/${id}`)}
      refreshToken={refreshToken}
      isAdmin={isAdmin}
    />
  );
}
