import { useEffect, useState } from 'react';
import AdminPage from './AdminPage';
import LoginPage from './LoginPage';
import ChangePasswordForm from './components/ChangePasswordForm';
import { getCurrentUser, logout } from './api/auth';
import './App.css';

function App() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'anonymous' | 'authenticated'
  const [user, setUser] = useState(null);

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

  if (status === 'loading') return null;

  if (status === 'anonymous') {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  if (user.role === 'admin') {
    return <AdminPage user={user} onLoggedOut={handleLoggedOut} />;
  }

  return (
    <div className="login-page">
      <div className="no-access-stack">
        <div className="login-card">
          <h1>Church Directory</h1>
          <p className="login-subtitle">Signed in as {user.username}. There's nothing here for you yet.</p>
          <button
            type="button"
            className="primary-btn"
            onClick={async () => { await logout(); handleLoggedOut(); }}
          >
            Sign Out
          </button>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}

export default App;
