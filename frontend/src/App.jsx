import { useEffect, useState } from 'react';
import DirectoryPage from './DirectoryPage';
import LoginPage from './LoginPage';
import { getCurrentUser } from './api/auth';
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

  return <DirectoryPage user={user} onLoggedOut={handleLoggedOut} />;
}

export default App;
