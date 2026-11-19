import { useCallback, useEffect, useState } from 'react';
import { leaveService } from '@/services/index.js';
import { fmtDate, isoDay } from '@/utils/format.js';

const dayText = (l) => (l.startDate === l.endDate ? fmtDate(l.startDate) : `${fmtDate(l.startDate)} – ${fmtDate(l.endDate)}`);

/**
 * Admin, on an employee's page: add, edit and remove their personal leave (employees can only add their own).
 * On leave days no repeating copies are made for them, and tasks due then wait for them to decide.
 */
export default function EmployeeLeavePanel({ employeeId, employeeName, onChanged }) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ startDate: isoDay(new Date()), endDate: isoDay(new Date()), reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);   // { id, startDate, endDate, reason }

  const load = useCallback(() => {
    leaveService.list({ employeeId }).then(setList).catch((e) => setError(e.message));
  }, [employeeId]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'startDate' && e.target.value > f.endDate ? { endDate: e.target.value } : {}) }));
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); load(); onChanged?.(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const add = (e) => {
    e.preventDefault();
    run(async () => {
      await leaveService.create({ employeeId, ...form, reason: form.reason.trim() });
      setForm((f) => ({ ...f, reason: '' }));
    });
  };
  const today = isoDay(new Date());
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      await leaveService.update(editing.id, { employeeId, startDate: editing.startDate, endDate: editing.endDate, reason: editing.reason.trim() });
      setEditing(null);
    });
  };

  return (
    <section className="panel">
      <h2 className="section-title">Leave</h2>
      <p className="muted small">
        On leave days no repeating tasks are created for {employeeName}. Tasks due on those days are not counted as overdue;
        {` ${employeeName}`} chooses to do them later or skip them.
      </p>
      <form className="form leave-form" onSubmit={add}>
        <div className="grid-2">
          <label>First day<input type="date" value={form.startDate} onChange={set('startDate')} required disabled={busy} /></label>
          <label>Last day<input type="date" value={form.endDate} min={form.startDate} onChange={set('endDate')} required disabled={busy} /></label>
        </div>
        <label>Reason (optional)<input value={form.reason} maxLength={300} onChange={set('reason')} disabled={busy} placeholder="e.g. Family function" /></label>
        <div className="form-actions"><button className="btn primary" disabled={busy}>Add leave</button></div>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {list && list.length > 0 && (
        <ul className="leave-list">
          {list.slice().reverse().map((l) => (
            <li key={l.id} className={l.endDate < today ? 'past' : ''}>
              {editing?.id === l.id ? (
                <form className="leave-edit" onSubmit={save}>
                  <input type="date" aria-label="First day" value={editing.startDate} disabled={busy}
                    onChange={(e) => setEditing((x) => ({ ...x, startDate: e.target.value, endDate: e.target.value > x.endDate ? e.target.value : x.endDate }))} />
                  <input type="date" aria-label="Last day" value={editing.endDate} min={editing.startDate} disabled={busy}
                    onChange={(e) => setEditing((x) => ({ ...x, endDate: e.target.value }))} />
                  <input aria-label="Reason" value={editing.reason} maxLength={300} disabled={busy}
                    onChange={(e) => setEditing((x) => ({ ...x, reason: e.target.value }))} />
                  <button className="btn primary small" disabled={busy}>Save</button>
                  <button type="button" className="btn ghost small" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <span>
                  <strong>{dayText(l)}</strong>
                  {l.reason && <span className="muted"> · {l.reason}</span>}
                  {l.createdBy && l.createdBy.id === l.employee?.id && <span className="muted"> · added by {employeeName}</span>}
                  {l.endDate < today && <span className="muted"> · past</span>}
                </span>
              )}
              {editing?.id !== l.id && (
                <span className="row-actions">
                  <button className="link-btn" disabled={busy}
                    onClick={() => setEditing({ id: l.id, startDate: l.startDate, endDate: l.endDate, reason: l.reason || '' })}>Edit</button>
                  <button className="link-btn danger" disabled={busy}
                onClick={() => window.confirm(`Remove the leave ${dayText(l)}? Repeating tasks will be created again for those days.`)
                  && run(() => leaveService.remove(l.id))}>Remove</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {list && list.length === 0 && <p className="muted small">No leave added.</p>}
    </section>
  );
}
