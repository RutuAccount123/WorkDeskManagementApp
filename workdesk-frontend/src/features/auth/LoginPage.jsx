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
        <div className="login-brand">
          <img src="/decent-decor-login.png" alt="Decent Decor Pvt. Ltd." />
        </div>
        <div className="login-art">
          <img src="/employee-desk.svg" alt="" aria-hidden="true" />
          <span className="login-art-note">A better day at work starts here</span>
        </div>
        <div className="login-intro">
          <span className="login-eyebrow">DECENT DECOR · WORKSPACE</span>
          <h1>Your work, in good hands.</h1>
          <p>Bring your team, tasks and deadlines together in one thoughtfully organized workspace.</p>
        </div>
        <ul className="login-steps" aria-label="How work moves">
          {['TODO', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED'].map((s) => <li key={s}>{STATUS_LABEL[s]}</li>)}
        </ul>
      </div>
      <main className="login-main">
        <div className="login-form-brand">
          <img src="/decent-decor-login.png" alt="Decent Decor" />
          <span>Work Desk</span>
        </div>
        <form className="login-card form" onSubmit={submit}>
          <span className="login-welcome">WELCOME BACK</span>
          <h2>Sign in to your account</h2>
          <p className="login-subtitle">Enter your work details to continue.</p>
          <label>Work email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" placeholder="you@company.com" />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter your password" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="login-help">Forgot your password? Ask your admin to reset it.</p>
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
          <p className="login-footer">Secure team access · Decent Decor Pvt. Ltd.</p>
        </form>
      </main>
    </div>
  );
}
