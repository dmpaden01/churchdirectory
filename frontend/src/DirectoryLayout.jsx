import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import SiteLogo from './components/SiteLogo';
import { logout } from './api/auth';
import './DirectoryLayout.css';

// Header/nav chrome shared by every authenticated screen, plus state that
// needs to survive navigating between routes: refreshToken (bumped after a
// family is saved/deleted so FamilySearch's list re-fetches) and the
// in-progress PDF import batch (parsed client-side and never persisted, so
// it has to live above whichever /import route is currently mounted).
export default function DirectoryLayout() {
  const { user, onLoggedOut } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user.role === 'admin';

  const [refreshToken, setRefreshToken] = useState(0);
  const bumpRefresh = () => setRefreshToken((t) => t + 1);

  const [parsedFamilies, setParsedFamilies] = useState([]);
  const [totalParsedCount, setTotalParsedCount] = useState(null);
  const [bulkAccepting, setBulkAccepting] = useState(false);

  const handleLogout = async () => {
    await logout();
    onLoggedOut();
  };

  // The Families tab covers search, viewing/editing a family, and the whole
  // PDF import flow.
  const familiesActive = location.pathname === '/'
    || location.pathname.startsWith('/families')
    || location.pathname.startsWith('/import');

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1><SiteLogo className="site-logo" />Church Directory</h1>
        <button type="button" className="admin-header-signout" onClick={handleLogout}>
          Sign Out
        </button>
      </header>

      <nav className="admin-nav">
        <div className="admin-nav-tabs">
          <button
            type="button"
            className={familiesActive ? 'active' : ''}
            onClick={() => navigate('/')}
          >
            Families
          </button>
          {isAdmin && (
            <button
              type="button"
              className={location.pathname === '/users' ? 'active' : ''}
              onClick={() => navigate('/users')}
            >
              Users
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={location.pathname === '/settings' ? 'active' : ''}
              onClick={() => navigate('/settings')}
            >
              Settings
            </button>
          )}
          <button
            type="button"
            className={location.pathname === '/account' ? 'active' : ''}
            onClick={() => navigate('/account')}
          >
            Account
          </button>
        </div>
        <button type="button" className="admin-nav-signout" onClick={handleLogout}>
          Sign Out
        </button>
      </nav>

      <Outlet
        context={{
          user,
          isAdmin,
          refreshToken,
          bumpRefresh,
          parsedFamilies,
          setParsedFamilies,
          totalParsedCount,
          setTotalParsedCount,
          bulkAccepting,
          setBulkAccepting,
        }}
      />
    </div>
  );
}
