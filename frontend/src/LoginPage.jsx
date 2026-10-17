import { useState } from 'react';
import { login, requestPasswordReset } from './api/auth';
import RegisterForm from './components/RegisterForm';
import SiteLogo from './components/SiteLogo';
import './LoginPage.css';

export default function LoginPage({ onLoggedIn }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Offered once a sign-in attempt fails, for whatever email was entered.
  const [showForgot, setShowForgot] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);
  const [sendingReset, setSendingReset] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResetMessage(null);
    try {
      const user = await login(username, password);
      onLoggedIn(user);
    } catch (err) {
      setError(err.message);
      setShowForgot(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setSendingReset(true);
    setError(null);
    try {
      setResetMessage(await requestPasswordReset(username));
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingReset(false);
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
        {resetMessage && <div className="form-success">{resetMessage}</div>}

        <div className="field-group">
          <label>Email</label>
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
        {showForgot && !resetMessage && (
          <button type="button" className="login-forgot-link" onClick={handleForgotPassword} disabled={sendingReset}>
            {sendingReset ? 'Sending...' : 'Forgot your password? Email me a reset link'}
          </button>
        )}
        <button type="button" onClick={() => setMode('register')}>
          Request an Account
        </button>
      </form>
    </div>
  );
}
