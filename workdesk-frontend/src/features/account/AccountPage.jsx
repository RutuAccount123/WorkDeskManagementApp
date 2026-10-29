import { useState } from 'react';
import { USE_MOCK } from '@/config/env.js';
import { authService } from '@/services/index.js';
import { resetMockData } from '@/mock/mockServer.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';

export default function Account() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (form.newPassword !== form.confirm) { setError('The new passwords don’t match.'); return; }
    try {
      await authService.changePassword(form.currentPassword, form.newPassword);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg('Password changed.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page narrow-page">
      <header className="page-head"><div><h1>My account</h1><p className="muted">Your details and password.</p></div></header>
      <section className="panel">
        <dl className="facts">
          <div><dt>Name</dt><dd>{user.fullName}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Department</dt><dd>{user.department || '—'}</dd></div>
          <div><dt>Access</dt><dd>{user.role === 'ADMIN' ? 'Admin' : 'Employee'}</dd></div>
        </dl>
      </section>
      <section className="panel">
        <h2 className="section-title">Change password</h2>
        <form className="form" onSubmit={submit}>
          <label>Current password<input type="password" value={form.currentPassword} onChange={set('currentPassword')} required autoComplete="current-password" /></label>
          <label>New password<input type="password" value={form.newPassword} onChange={set('newPassword')} required minLength={8} autoComplete="new-password" /></label>
          <label>Repeat new password<input type="password" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" /></label>
          {msg && <p className="notice" role="status">{msg}</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="form-actions"><button className="btn primary">Change password</button></div>
        </form>
      </section>
      {USE_MOCK && (
        <section className="panel">
          <h2 className="section-title">Demo data</h2>
          <p className="muted small">You are using built-in sample data. Your changes are saved in this browser only.</p>
          <button className="btn ghost" onClick={() => {
            if (!window.confirm('Put all sample data back to the original? Your changes will be lost.')) return;
            resetMockData();
            logout();
          }}>Reset demo data</button>
        </section>
      )}
      <button className="btn ghost mobile-only" onClick={logout}>Sign out</button>
    </div>
  );
}
