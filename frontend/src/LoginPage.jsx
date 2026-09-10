import { useState } from 'react';
import { login } from './api/auth';
import RegisterForm from './components/RegisterForm';
import SiteLogo from './components/SiteLogo';
import './LoginPage.css';

export default function LoginPage({ onLoggedIn }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(username, password);
      onLoggedIn(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'register') {
    return (
      <div className="login-page">
        <RegisterForm onBackToSignIn={() => setMode('signin')} />
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1><SiteLogo className="site-logo" />Church Directory</h1>
        <p className="login-subtitle">Sign in to continue</p>

        {error && <div className="form-error">{error}</div>}

        <div className="field-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="field-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="primary-btn" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
        <button type="button" onClick={() => setMode('register')}>
          Request an Account
        </button>
      </form>
    </div>
  );
}
