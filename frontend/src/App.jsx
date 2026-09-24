import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';
import SetPasswordPage from './SetPasswordPage';
import WallPage from './WallPage';
import DirectoryLayout from './DirectoryLayout';
import FamilySearchRoute from './routes/FamilySearchRoute';
import FamilyViewRoute from './routes/FamilyViewRoute';
import FamilyFormRoute from './routes/FamilyFormRoute';
import ImportRoute from './routes/ImportRoute';
import ImportFormRoute from './routes/ImportFormRoute';
import UsersRoute from './routes/UsersRoute';
import SettingsRoute from './routes/SettingsRoute';
import FamilyMapPage from './FamilyMapPage';
import AccountRoute from './routes/AccountRoute';
import Footer from './components/Footer';
import { getCurrentUser } from './api/auth';
import { applyDynamicFavicon } from './utils/applyFavicon';
import './App.css';

function useSetPasswordToken() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get('setPasswordToken'));
  const clear = () => {
    setToken(null);
    window.history.replaceState({}, '', window.location.pathname);
  };
  return [token, clear];
}

// Gates every route below it on the signed-in session: shows the "set
// password" flow if that token is in the URL, the login form if signed out,
// and otherwise renders whatever route was actually requested via <Outlet/>
// - so a deep link opened while logged out resolves to that same URL once
// signed in, instead of always bouncing to the search page. The Footer lives
// here (rather than in individual pages) since every one of these states
// shows it - only /wall (handled above this, in App) doesn't.
function AuthGate() {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [setPasswordToken, clearSetPasswordToken] = useSetPasswordToken();

  useEffect(() => {
    getCurrentUser()
      .then((current) => {
        if (current) {
          setUser(current);
          setStatus('authenticated');
        } else {
          setStatus('anonymous');
        }
      })
      .catch(() => setStatus('anonymous'));
  }, []);

  const handleLoggedIn = (loggedInUser) => {
    setUser(loggedInUser);
    setStatus('authenticated');
  };

  const handleLoggedOut = () => {
    setUser(null);
    setStatus('anonymous');
  };

  let inner = null;
  if (setPasswordToken) {
    inner = <SetPasswordPage token={setPasswordToken} onDone={clearSetPasswordToken} />;
  } else if (status === 'anonymous') {
    inner = <LoginPage onLoggedIn={handleLoggedIn} />;
  } else if (status === 'authenticated') {
    inner = <Outlet context={{ user, onLoggedOut: handleLoggedOut }} />;
  }

  return (
    <>
      {inner}
      <Footer />
    </>
  );
}

function App() {
  useEffect(() => {
    applyDynamicFavicon();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public, key-gated kiosk display - fills the whole window with no
            header/nav/footer chrome and skips the normal cookie-auth flow entirely. */}
        <Route path="/wall" element={<WallPage />} />

        <Route element={<AuthGate />}>
          <Route element={<DirectoryLayout />}>
            <Route index element={<FamilySearchRoute />} />
            <Route path="families/new" element={<FamilyFormRoute />} />
            <Route path="families/:id" element={<FamilyViewRoute />} />
            <Route path="families/:id/edit" element={<FamilyFormRoute />} />
            <Route path="map" element={<FamilyMapPage />} />
            <Route path="import" element={<ImportRoute />} />
            <Route path="import/:draftKey" element={<ImportFormRoute />} />
            <Route path="users" element={<UsersRoute />} />
            <Route path="settings" element={<SettingsRoute />} />
            <Route path="account" element={<AccountRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
