import { useEffect, useState } from 'react';
import { employeeService, recurringService } from '@/services/index.js';
import { DAYS, PRIORITIES, PRIORITY_LABEL, dayLabel, fmtDate } from '@/utils/format.js';
import Modal from '@/components/ui/Modal.jsx';

const EMPTY = { title: '', description: '', assigneeId: '', priority: 'MEDIUM', frequency: 'DAILY', dayOfWeek: 'MONDAY', dueTime: '18:00', estimatedHours: '' };

function TemplateForm({ template, employees, onClose, onSaved }) {
  const [form, setForm] = useState(template
    ? { ...EMPTY, ...template, assigneeId: template.assignee.id, dayOfWeek: template.dayOfWeek || 'MONDAY', dueTime: template.dueTime.slice(0, 5), estimatedHours: template.estimatedHours == null ? '' : String(template.estimatedHours) }
    : EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const body = {
      title: form.title, description: form.description, assigneeId: Number(form.assigneeId), priority: form.priority,
      frequency: form.frequency, dayOfWeek: form.frequency === 'WEEKLY' ? form.dayOfWeek : null, dueTime: form.dueTime,
      estimatedHours: form.estimatedHours === '' ? null : Number(form.estimatedHours),
    };
    try {
      const saved = template
        ? await recurringService.update(template.id, body)
        : await recurringService.create(body);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={template ? 'Edit daily / weekly task' : 'Add daily / weekly task'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Title<input value={form.title} onChange={set('title')} required autoFocus placeholder="e.g. Daily site progress report" /></label>
        <label>Details<textarea rows={3} value={form.description || ''} onChange={set('description')} /></label>
        <div className="grid-2">
          <label>Assign to
            <select value={form.assigneeId} onChange={set('assigneeId')} required>
              <option value="">Choose a person</option>
              {employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          </label>
          <label>Priority
            <select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </label>
        </div>
        <div className="grid-3">
          <label>Repeats
            <select value={form.frequency} onChange={set('frequency')}>
              <option value="DAILY">Every day (Mon–Sat)</option>
              <option value="WEEKLY">Every week</option>
            </select>
          </label>
          {form.frequency === 'WEEKLY' && (
            <label>On
              <select value={form.dayOfWeek} onChange={set('dayOfWeek')}>
                {DAYS.filter((d) => d !== 'SUNDAY').map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
              </select>
            </label>
          )}
          <label>Due by<input type="time" value={form.dueTime} onChange={set('dueTime')} required /></label>
        </div>
        <label>Estimated effort (hours)
          <input type="number" min="0.25" max="24" step="0.25" value={form.estimatedHours}
            onChange={set('estimatedHours')} placeholder="Optional" />
        </label>
        <p className="hint">With an estimate, each copy’s due time is calculated when work starts within 10:00–18:00 working hours. Without one, the scheduled Due by time applies. Sundays and office holidays are skipped.</p>
        <p className="hint">Tasks are created for the next 7 days so they show in the week and month views. Sundays and office holidays are skipped.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : template ? 'Save changes' : 'Add task'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Recurring() {
  const [list, setList] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => recurringService.list().then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); employeeService.list().then(setEmployees).catch(() => {}); }, []);

  const act = async (fn, okText) => {
    setError(''); setMessage('');
    try { await fn(); if (okText) setMessage(okText); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Daily &amp; weekly tasks</h1>
          <p className="muted">Daily and weekly work, created automatically for the next 7 days. Sundays and office holidays are skipped.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>Add daily / weekly task</button>
      </header>
      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="error">{error}</p>}
      {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? (
        <p className="empty">No schedules yet. Create one for reports or checks that happen every day or week.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Task</th><th>Assigned to</th><th>Schedule</th><th>Created up to</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className={t.active ? '' : 'inactive'}>
                  <td><strong>{t.title}</strong><small className="block muted">{PRIORITY_LABEL[t.priority]} priority</small></td>
                  <td>{t.assignee.fullName}{t.selfOwned && <small className="block muted">set up by employee</small>}</td>
                  <td>{t.frequency === 'DAILY' ? 'Every day' : `Every ${dayLabel(t.dayOfWeek)}`}, due {t.dueTime.slice(0, 5)}
                    {t.estimatedHours != null && <small className="block muted">{t.estimatedHours} estimated hours</small>}</td>
                  <td>{t.lastGeneratedOn ? fmtDate(t.lastGeneratedOn) : 'Not yet'}</td>
                  <td>{t.active ? 'Running' : 'Paused'}</td>
                  <td className="row-actions">
                    <button className="link-btn" onClick={() => setEditing(t)}>Edit</button>
                    <button className="link-btn" onClick={() => act(() => recurringService.generateNow(t.id), `Created today's "${t.title}" task.`)}>Create today’s task</button>
                    <button className="link-btn" onClick={() => act(() => recurringService.setActive(t.id, !t.active))}>{t.active ? 'Pause' : 'Resume'}</button>
                    <button className="link-btn danger" onClick={() => window.confirm(`Delete the "${t.title}" schedule? Tasks already created stay.`) &&
                      act(() => recurringService.remove(t.id))}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <TemplateForm template={editing.id ? editing : null} employees={employees}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
