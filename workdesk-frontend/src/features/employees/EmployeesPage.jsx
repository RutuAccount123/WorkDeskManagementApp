import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeeService, profilePhotoService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import Modal from '@/components/ui/Modal.jsx';
import { encodeImage } from '@/utils/image.js';
import { personColor } from '@/utils/colors.js';
import { matchesPerson } from '@/utils/personSearch.js';

const EMPTY = { employeeCode: '', fullName: '', email: '', password: '', role: 'EMPLOYEE', departmentAdmin: false, accessibleDepartments: [], department: '', designation: '', phone: '' };

function EmployeeForm({ employee, departments, onClose, onSaved }) {
  const [form, setForm] = useState(employee ? {
    ...EMPTY,
    ...employee,
    accessibleDepartments: employee.accessibleDepartments || (employee.departmentAdmin ? [employee.department].filter(Boolean) : []),
    password: '',
  } : EMPTY);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const photoInputRef = useRef(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setAccess = (event) => {
    const access = event.target.value;
    setForm({
      ...form,
      role: access === 'EMPLOYEE' ? 'EMPLOYEE' : 'ADMIN',
      departmentAdmin: access === 'DEPARTMENT_ADMIN',
      accessibleDepartments: access === 'DEPARTMENT_ADMIN' && form.departmentAdmin ? form.accessibleDepartments : [],
    });
  };
  const toggleAccessibleDepartment = (department) => (event) => {
    const selected = new Set(form.accessibleDepartments || []);
    if (event.target.checked) selected.add(department);
    else selected.delete(department);
    setForm({ ...form, accessibleDepartments: [...selected] });
  };

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const submit = async (e) => {
    e.preventDefault();
    if (form.departmentAdmin && form.accessibleDepartments.length === 0) {
      setError('Choose at least one department this admin can access.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const photoData = !employee && photoFile ? await encodeImage(photoFile) : null;
      const saved = employee
        ? await employeeService.update(employee.id, form)
        : await employeeService.create(form);
      if (photoData) {
        try {
          await profilePhotoService.save(photoData, saved.id);
        } catch (photoError) {
          onSaved(saved, `Employee was created, but the profile photo could not be uploaded: ${photoError.message}`);
          return;
        }
      }
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={employee ? `Edit ${employee.fullName}` : 'Add employee'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {!employee && (
          <div className="employee-photo-picker-wrap">
            <button type="button" className="employee-profile-photo employee-form-photo"
              style={{ background: personColor(form.fullName) }}
              onClick={() => photoInputRef.current?.click()}
              aria-label="Choose profile photo">
              {photoPreview
                ? <img src={photoPreview} alt="Selected employee profile" />
                : <span aria-hidden="true">{form.fullName.trim().charAt(0).toUpperCase() || '?'}</span>}
            </button>
            <button type="button" className="link-btn"
              onClick={() => photoFile ? setPhotoActionsOpen((open) => !open) : photoInputRef.current?.click()}>
              {photoFile ? 'Change image' : 'Add image'}
            </button>
            {photoFile && photoActionsOpen && (
              <div className="employee-photo-options" aria-label="Profile image actions">
                <button type="button" className="link-btn" onClick={() => {
                  setPhotoActionsOpen(false);
                  photoInputRef.current?.click();
                }}>Select new image</button>
                <button type="button" className="link-btn danger" onClick={() => {
                  setPhotoFile(null);
                  setPhotoActionsOpen(false);
                }}>Remove image</button>
              </div>
            )}
            <input ref={photoInputRef} className="sr-only" type="file" accept="image/*"
              aria-label="Choose profile photo"
              onChange={(event) => {
                setPhotoFile(event.target.files?.[0] || null);
                setPhotoActionsOpen(false);
                event.target.value = '';
              }} />
          </div>
        )}
        <div className="grid-2">
          <label>Full name<input value={form.fullName} onChange={set('fullName')} required autoFocus /></label>
          <label>Employee code<input value={form.employeeCode || ''} onChange={set('employeeCode')} placeholder="Optional" /></label>
        </div>
        <div className="grid-2">
          <label>Work email<input type="email" value={form.email} onChange={set('email')} required /></label>
          <label>Phone<input value={form.phone || ''} onChange={set('phone')} /></label>
        </div>
        <div className="grid-2">
          <label>Department
            <input value={form.department || ''} onChange={set('department')} placeholder="e.g. Purchase"
              required={form.departmentAdmin} />
            {form.departmentAdmin && <small className="muted">This is the admin’s own department, not their access limit.</small>}
          </label>
          <label>Designation<input value={form.designation || ''} onChange={set('designation')} /></label>
        </div>
        {form.departmentAdmin && (
          <fieldset className="department-access-list">
            <legend>Departments this admin can access (select at least one)</legend>
            {departments.map((name) => (
              <label key={name}>
                <input type="checkbox" checked={(form.accessibleDepartments || []).includes(name)}
                  onChange={toggleAccessibleDepartment(name)} />
                {name}
              </label>
            ))}
          </fieldset>
        )}
        <div className="grid-2">
          <label>Access
            <select value={form.role === 'EMPLOYEE' ? 'EMPLOYEE' : form.departmentAdmin ? 'DEPARTMENT_ADMIN' : 'ADMIN'} onChange={setAccess}>
              <option value="EMPLOYEE">Employee: sees own tasks</option>
              <option value="DEPARTMENT_ADMIN">Department admin: view selected departments</option>
              <option value="ADMIN">Admin: manages all departments</option>
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
  const { user, isFullAdmin } = useAuth();
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const shown = (list || []).filter((e) => matchesPerson(e, q));

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
        {isFullAdmin && <button className="btn primary" onClick={() => setEditing({})}>Add employee</button>}
      </header>
      {error && <p className="error">{error}</p>}
      {list !== null && list.length > 0 && (
        <div className="employee-search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees"
            placeholder="Search by name, code, department, designation or email" />
          {q && <span className="muted small" role="status">{shown.length} of {list.length} employees</span>}
        </div>
      )}
      {list === null ? <p className="muted">Loading…</p> : q && shown.length === 0 ? (
        <p className="muted">No employee matches “{q}”. <button className="link-btn" onClick={() => setQ('')}>Clear search</button></p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Department</th><th>Email</th><th>Access</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className={e.active ? '' : 'inactive'}>
                  <td>
                    <Link to={`/employees/${e.id}`}><strong>{e.fullName}</strong></Link>
                    <small className="block muted">{[e.employeeCode, e.designation].filter(Boolean).join(', ')}</small>
                  </td>
                  <td>{e.department || '—'}</td>
                  <td>{e.email}</td>
                  <td>{e.departmentAdmin
                    ? `Department admin (manages: ${(e.accessibleDepartments?.length ? e.accessibleDepartments : [e.department].filter(Boolean)).join(', ')})`
                    : e.role === 'ADMIN' ? 'Admin' : 'Employee'}</td>
                  <td>{e.active ? 'Active' : 'Inactive'}</td>
                  {isFullAdmin ? (
                    <td className="row-actions">
                      <button className="link-btn" onClick={() => setEditing(e)}>Edit</button>
                      <button className="link-btn" onClick={() => resetPassword(e)}>Reset password</button>
                      {e.id !== user.id && (
                        <button className="link-btn" onClick={() => toggle(e)}>{e.active ? 'Deactivate' : 'Reactivate'}</button>
                      )}
                    </td>
                  ) : <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EmployeeForm employee={editing.id ? editing : null}
          departments={[...new Set((list || []).map((e) => e.department?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))}
          onClose={() => setEditing(null)}
          onSaved={(_saved, photoError) => {
            setEditing(null);
            load();
            if (photoError) setError(photoError);
          }} />
      )}
    </div>
  );
}
