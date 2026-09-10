import { useState } from 'react';
import { register } from '../api/auth';

// Self-service account request: email, first/last name. On submit, the backend
// emails a verification link; the account then waits for admin approval.
export default function RegisterForm({ onBackToSignIn }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(email, firstName, lastName);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="login-card">
        <h1>Check Your Email</h1>
        <p className="login-subtitle">
          We sent a verification link to {email}. Click it to confirm your address &mdash;
          an admin will then review your request.
        </p>
        <button type="button" onClick={onBackToSignIn}>Back to Sign In</button>
      </div>
    );
  }

  return (
    <form className="login-card" onSubmit={handleSubmit}>
      <h1>Request an Account</h1>
      <p className="login-subtitle">Enter your info and we'll email you a verification link.</p>

      {error && <div className="form-error">{error}</div>}

      <div className="field-group">
        <label>First Name</label>
        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      </div>

      <div className="field-group">
        <label>Last Name</label>
        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      </div>

      <div className="field-group">
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>

      <button type="submit" className="primary-btn" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Request Account'}
      </button>
      <button type="button" onClick={onBackToSignIn} disabled={submitting}>
        Back to Sign In
      </button>
    </form>
  );
}
