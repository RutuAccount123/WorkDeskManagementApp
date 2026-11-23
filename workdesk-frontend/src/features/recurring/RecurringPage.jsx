import { useEffect, useState } from 'react';
import { employeeService, recurringService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { DAYS, PRIORITIES, PRIORITY_LABEL, dayLabel, fmtDate, isoDay } from '@/utils/format.js';
import { encodeImage } from '@/utils/image.js';
import Modal from '@/components/ui/Modal.jsx';
import RepeatDueFields from '@/components/form/RepeatDueFields.jsx';
import { addDays, dueError, firstStartDay } from '@/utils/repeatDue.js';

/** "starts 09:30, due 2 days later at 17:00" / "starts 09:30 for 20 min (due 09:50)" / "due 18:00". */
const repeatTimeText = (t) => {
  const due = t.dueTime.slice(0, 5);
  if (!t.scheduledTime) return ` due ${due}`;
  const start = t.scheduledTime.slice(0, 5);
  if (t.durationMinutes != null) return ` starts ${start} for ${t.durationMinutes} min (due ${due})`;
  const gap = t.dueDaysAfter || 0;
  return ` starts ${start}, due ${gap === 0 ? 'same day' : `${gap} day${gap === 1 ? '' : 's'} later`} at ${due}`;
};

const EMPTY = {
  title: '', description: '', assigneeId: '', priority: 'MEDIUM', frequency: 'DAILY', dayOfWeek: 'MONDAY',
  dueTime: '18:00', startDate: isoDay(), scheduledTime: '09:30',
  dueGap: 0,   // weekly / monthly / yearly: days from each start to its due date
};

function TemplateForm({ template, employees, onClose, onSaved }) {
  const { user } = useAuth();
  const [image, setImage] = useState(template?.image || '');
  const [form, setForm] = useState(template
    ? {
      ...EMPTY, ...template, assigneeId: template.assignee.id, dayOfWeek: template.dayOfWeek || 'MONDAY',
      reviewerId: template.reviewer?.id ? String(template.reviewer.id)
        : template.assignee.id === user.id ? 'none' : String(template.createdBy?.id || user.id),
      startDate: template.startDate || isoDay(),
      // older tasks saved without a start time get 09:30; ones saved with minutes keep their due time, same day
      scheduledTime: template.scheduledTime ? template.scheduledTime.slice(0, 5) : '09:30',
      dueTime: template.dueTime.slice(0, 5),
      dueGap: template.dueDaysAfter || 0,
    }
    : { ...EMPTY, reviewerId: String(user.id) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const repeatStart = firstStartDay(form.frequency, form.dayOfWeek, form.startDate);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const problem = dueError(form.frequency, repeatStart, form.scheduledTime, addDays(repeatStart, Number(form.dueGap) || 0), form.dueTime);
    if (problem) { setError(problem); return; }
    setBusy(true);
    const body = {
      title: form.title, description: form.description, assigneeId: Number(form.assigneeId), priority: form.priority,
      frequency: form.frequency,
      dayOfWeek: form.frequency === 'WEEKLY' ? form.dayOfWeek : null,
      startDate: form.startDate,
      dueTime: form.dueTime,
      // start date + start time, due on a date and time (no minutes)
      scheduledTime: form.scheduledTime,
      durationMinutes: null,
      dueDaysAfter: Number(form.dueGap) || 0,
      estimatedHours: null,
      reviewerId: form.reviewerId === 'none' ? null : Number(form.reviewerId),
      image: image || null,
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
    <Modal title={template ? 'Edit repeating task' : 'Add repeating task'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Title<input value={form.title} onChange={set('title')} required autoFocus placeholder="e.g. Daily site progress report" /></label>
        <label>Details<textarea rows={3} value={form.description || ''} onChange={set('description')} /></label>
        <div className="grid-2">
          <label>Assign to
            <select value={form.assigneeId} onChange={(e) => setForm({
              ...form, assigneeId: e.target.value,
              reviewerId: e.target.value === String(user.id) ? 'none'
                : String(form.reviewerId) === e.target.value ? String(user.id) : form.reviewerId,
            })} required>
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
        <div className="grid-2">
          <label>Reviewed by
            <select value={form.reviewerId} onChange={set('reviewerId')}>
              {String(form.assigneeId) === String(user.id) && <option value="none">No review needed</option>}
              {employees.filter((e) => e.active && String(e.id) !== String(form.assigneeId))
                .map((e) => <option key={e.id} value={e.id}>{e.id === user.id ? `Me (${e.fullName})` : e.fullName}</option>)}
            </select>
          </label>
          <label>Task reference image
            <input type="file" accept="image/*" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try { setImage(await encodeImage(file)); setError(''); }
              catch (err) { setError(err.message); }
            }} />
          </label>
        </div>
        {image && <img className="task-reference-image" src={`data:image/jpeg;base64,${image}`} alt="Task reference" />}
        <div className="grid-2">
          <label>Repeats
            <select value={form.frequency} onChange={set('frequency')}>
              <option value="DAILY">Every day (Mon–Sat)</option>
              <option value="WEEKLY">Every week</option>
              <option value="MONTHLY">Every month</option>
              <option value="YEARLY">Every year</option>
            </select>
          </label>
          {form.frequency === 'WEEKLY' && (
            <label>On
              <select value={form.dayOfWeek} onChange={set('dayOfWeek')}>
                {DAYS.filter((d) => d !== 'SUNDAY').map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
              </select>
            </label>
          )}
        </div>
        <RepeatDueFields frequency={form.frequency} start={repeatStart}
          startDate={form.startDate} onStartDate={(v) => setForm((f) => ({ ...f, startDate: v }))}
          startTime={form.scheduledTime} onStartTime={(v) => setForm((f) => ({ ...f, scheduledTime: v }))}
          gap={form.dueGap} onGap={(v) => setForm((f) => ({ ...f, dueGap: v }))}
          dueTime={form.dueTime} onDueTime={(v) => setForm((f) => ({ ...f, dueTime: v }))} />
        <p className="hint">Tasks are created for the next 7 days. Monthly dates that do not exist in a month, and February 29 in non-leap years, are skipped. Sundays and office holidays are skipped.</p>
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
  useEffect(() => { load(); employeeService.directory().then(setEmployees).catch(() => {}); }, []);

  const act = async (fn, okText) => {
    setError(''); setMessage('');
    try { await fn(); if (okText) setMessage(okText); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Repeating tasks</h1>
          <p className="muted">Daily, weekly, or monthly work is created automatically for the next 7 days. Scheduled reminders and overdue notifications are sent automatically.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>Add repeating task</button>
      </header>
      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="error">{error}</p>}
      {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? (
        <p className="empty">No schedules yet. Add a task that repeats every day, week, or month.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Task</th><th>Assigned to</th><th>Schedule</th><th>Created up to</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className={t.active ? '' : 'inactive'}>
                  <td><strong>{t.title}</strong><small className="block muted">{PRIORITY_LABEL[t.priority]} priority</small></td>
                  <td>{t.assignee.fullName}{t.selfOwned && <small className="block muted">set up by employee</small>}</td>
                  <td>{t.frequency === 'DAILY' ? 'Every day' : t.frequency === 'WEEKLY' ? `Every ${dayLabel(t.dayOfWeek)}` : t.frequency === 'MONTHLY' ? `Monthly on day ${Number(t.startDate?.slice(-2))}` : `Yearly on ${t.startDate}`},
                    {repeatTimeText(t)}</td>
                  <td>{t.lastGeneratedOn ? fmtDate(t.lastGeneratedOn) : 'Not yet'}</td>
                  <td>{t.active ? 'Running' : 'Stopped'}</td>
                  <td className="row-actions">
                    <button className="link-btn" onClick={() => setEditing(t)}>Edit</button>
                    <button className="link-btn" onClick={() => act(() => recurringService.generateNow(t.id), `Created today's "${t.title}" task.`)}>Create today’s task</button>
                    <button className="link-btn" onClick={() => (t.active
                      ? window.confirm(`Stop repeating "${t.title}"? Upcoming copies nobody has started are removed. You can start it again later.`)
                      : true) && act(() => recurringService.setActive(t.id, !t.active))}>{t.active ? 'Stop repeating' : 'Start again'}</button>
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
