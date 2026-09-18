import { Navigate, useOutletContext } from 'react-router-dom';

// Guards an admin-only route: a regular user who navigates here directly
// (typed URL, old bookmark) is bounced back to the search page instead of
// seeing the admin screen the nav bar never showed them.
export default function RequireAdmin({ children }) {
  const { isAdmin } = useOutletContext();
  return isAdmin ? children : <Navigate to="/" replace />;
}
