import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { USE_MOCK } from '@/config/env.js';
import { STATUS_LABEL } from '@/utils/format.js';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@company.com', password: 'Admin@123' },
  { label: 'Employee: Rahul (Purchase)', email: 'rahul@company.com', password: 'Employee@123' },
  { label: 'Employee: Priya (Accounts)', email: 'priya@company.com', password: 'Employee@123' },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-side">
        <h1>Work Desk</h1>
        <p>Assign work, track deadlines and see who finished what, in one place.</p>
        <ul className="login-steps" aria-label="How work moves">
          {['TODO', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED'].map((s) => <li key={s}>{STATUS_LABEL[s]}</li>)}
        </ul>
      </div>
      <form className="login-card form" onSubmit={submit}>
        <h2>Sign in</h2>
        <label>Work email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small">Forgot your password? Ask your admin to reset it.</p>
        {USE_MOCK && (
          <div className="demo-box">
            <p className="small"><strong>Demo mode.</strong> No backend needed. Pick an account:</p>
            {DEMO_ACCOUNTS.map((a) => (
              <button type="button" key={a.email} className="link-btn block-btn"
                onClick={() => { setEmail(a.email); setPassword(a.password); }}>
                {a.label} <span className="muted">({a.email})</span>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
