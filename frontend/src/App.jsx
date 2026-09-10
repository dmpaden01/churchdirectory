import { useEffect, useState } from 'react';
import DirectoryPage from './DirectoryPage';
import LoginPage from './LoginPage';
import SetPasswordPage from './SetPasswordPage';
import { getCurrentUser } from './api/auth';
import './App.css';

function getSetPasswordToken() {
  return new URLSearchParams(window.location.search).get('setPasswordToken');
}

function App() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'anonymous' | 'authenticated'
  const [user, setUser] = useState(null);
  const [setPasswordToken, setSetPasswordToken] = useState(getSetPasswordToken);

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

  const clearSetPasswordToken = () => {
    setSetPasswordToken(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  if (setPasswordToken) {
    return <SetPasswordPage token={setPasswordToken} onDone={clearSetPasswordToken} />;
  }

  if (status === 'loading') return null;

  if (status === 'anonymous') {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  return <DirectoryPage user={user} onLoggedOut={handleLoggedOut} />;
}

export default App;
