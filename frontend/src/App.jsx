import { useEffect, useState } from 'react';
import DirectoryPage from './DirectoryPage';
import LoginPage from './LoginPage';
import SetPasswordPage from './SetPasswordPage';
import WallPage from './WallPage';
import Footer from './components/Footer';
import { getCurrentUser } from './api/auth';
import { applyDynamicFavicon } from './utils/applyFavicon';
import './App.css';

function getSetPasswordToken() {
  return new URLSearchParams(window.location.search).get('setPasswordToken');
}

function isWallPath() {
  return window.location.pathname.replace(/\/+$/, '') === '/wall';
}

function App() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'anonymous' | 'authenticated'
  const [user, setUser] = useState(null);
  const [setPasswordToken, setSetPasswordToken] = useState(getSetPasswordToken);
  const wallMode = isWallPath();

  useEffect(() => {
    applyDynamicFavicon();
  }, []);

  useEffect(() => {
    if (wallMode) return;
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
  }, [wallMode]);

  const handleLoggedIn = (loggedInUser) => {
    setUser(loggedInUser);
    setStatus('authenticated');
  };

  const handleLoggedOut = () => {
    setUser(null);
    setStatus('anonymous');
  };

  const clearSetPasswordToken = () => {
    setSetPasswordToken(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Public, key-gated kiosk display - fills the whole window with no
  // header/nav/footer chrome and skips the normal cookie-auth flow entirely.
  if (wallMode) {
    return <WallPage />;
  }

  let content = null;
  if (setPasswordToken) {
    content = <SetPasswordPage token={setPasswordToken} onDone={clearSetPasswordToken} />;
  } else if (status === 'anonymous') {
    content = <LoginPage onLoggedIn={handleLoggedIn} />;
  } else if (status === 'authenticated') {
    content = <DirectoryPage user={user} onLoggedOut={handleLoggedOut} />;
  }

  return (
    <>
      {content}
      <Footer />
    </>
  );
}

export default App;
