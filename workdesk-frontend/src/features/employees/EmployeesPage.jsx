import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeeService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import Modal from '@/components/ui/Modal.jsx';

const EMPTY = { employeeCode: '', fullName: '', email: '', password: '', role: 'EMPLOYEE', department: '', designation: '', phone: '' };

function EmployeeForm({ employee, onClose, onSaved }) {
  const [form, setForm] = useState(employee ? { ...EMPTY, ...employee, password: '' } : EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = employee
        ? await employeeService.update(employee.id, form)
        : await employeeService.create(form);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={employee ? `Edit ${employee.fullName}` : 'Add employee'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="grid-2">
          <label>Full name<input value={form.fullName} onChange={set('fullName')} required autoFocus /></label>
          <label>Employee code<input value={form.employeeCode || ''} onChange={set('employeeCode')} placeholder="Optional" /></label>
        </div>
        <div className="grid-2">
          <label>Work email<input type="email" value={form.email} onChange={set('email')} required /></label>
          <label>Phone<input value={form.phone || ''} onChange={set('phone')} /></label>
        </div>
        <div className="grid-2">
          <label>Department<input value={form.department || ''} onChange={set('department')} placeholder="e.g. Purchase" /></label>
          <label>Designation<input value={form.designation || ''} onChange={set('designation')} /></label>
        </div>
        <div className="grid-2">
          <label>Access
            <select value={form.role} onChange={set('role')}>
              <option value="EMPLOYEE">Employee: sees own tasks</option>
              <option value="ADMIN">Admin: manages everyone</option>
            </select>
          </label>
          {!employee && (
            <label>First password
              <input type="text" value={form.password} onChange={set('password')} required minLength={8}
                placeholder="At least 8 characters" />
            </label>
          )}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{employee ? 'Save changes' : 'Add employee'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Employees() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = () => { setError(''); return employeeService.list().then(setList).catch((e) => setError(e.message)); };
  useEffect(() => { load(); }, []);

  const toggle = async (e) => {
    if (e.active && !window.confirm(`Deactivate ${e.fullName}? They will no longer be able to sign in or receive new work.`)) return;
    try {
      await employeeService.setActive(e.id, !e.active);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetPassword = async (e) => {
    const pwd = window.prompt(`New password for ${e.fullName} (at least 8 characters):`);
    if (!pwd) return;
    try {
      await employeeService.resetPassword(e.id, pwd);
      window.alert('Password reset. Share it with them privately.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Employees</h1>
          <p className="muted">{list ? `${list.filter((e) => e.active).length} active` : ' '}</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>Add employee</button>
      </header>
      {error && <p className="error">{error}</p>}
      {list === null ? <p className="muted">Loading…</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Department</th><th>Email</th><th>Access</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className={e.active ? '' : 'inactive'}>
                  <td>
                    <Link to={`/employees/${e.id}`}><strong>{e.fullName}</strong></Link>
                    <small className="block muted">{[e.employeeCode, e.designation].filter(Boolean).join(', ')}</small>
                  </td>
                  <td>{e.department || '—'}</td>
                  <td>{e.email}</td>
                  <td>{e.role === 'ADMIN' ? 'Admin' : 'Employee'}</td>
                  <td>{e.active ? 'Active' : 'Inactive'}</td>
                  <td className="row-actions">
                    <button className="link-btn" onClick={() => setEditing(e)}>Edit</button>
                    <button className="link-btn" onClick={() => resetPassword(e)}>Reset password</button>
                    {e.id !== user.id && (
                      <button className="link-btn" onClick={() => toggle(e)}>{e.active ? 'Deactivate' : 'Reactivate'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EmployeeForm employee={editing.id ? editing : null} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
