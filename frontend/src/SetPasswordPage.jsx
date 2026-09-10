import { useState } from 'react';
import { setPassword } from './api/auth';
import './LoginPage.css';

// Landed on via the "Set Password" link in the approval email (?setPasswordToken=...).
export default function SetPasswordPage({ token, onDone }) {
  const [password, setPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await setPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Password Set</h1>
          <p className="login-subtitle">Your password has been set. You can now sign in.</p>
          <button type="button" className="primary-btn" onClick={onDone}>Go to Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Set Your Password</h1>
        <p className="login-subtitle">Choose a password to finish setting up your account.</p>

        {error && <div className="form-error">{error}</div>}

        <div className="field-group">
          <label>New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            minLength={8}
            autoFocus
            required
          />
        </div>

        <div className="field-group">
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        <button type="submit" className="primary-btn" disabled={submitting}>
          {submitting ? 'Saving...' : 'Set Password'}
        </button>
      </form>
    </div>
  );
}
