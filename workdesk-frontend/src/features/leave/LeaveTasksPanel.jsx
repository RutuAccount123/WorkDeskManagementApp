import { useCallback, useEffect, useState } from 'react';
import { leaveService, taskService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { fmtDate, fmtDateTime, isoDay } from '@/utils/format.js';
import RaiseTicketDialog from '@/features/tickets/RaiseTicketDialog.jsx';

const dayText = (l) => (l.startDate === l.endDate ? fmtDate(l.startDate) : `${fmtDate(l.startDate)} – ${fmtDate(l.endDate)}`);

/** First day from today that is not a leave day, as "yyyy-mm-dd". */
function firstWorkingDay(leaves) {
  const d = new Date();
  for (let i = 0; i < 400; i++) {
    const day = isoDay(d);
    if (d.getDay() !== 0 && !leaves.some((l) => l.startDate <= day && l.endDate >= day)) return day;
    d.setDate(d.getDate() + 1);
  }
  return isoDay(new Date());
}

/** One task that fell on a leave day: Allow (pick a new due date) or Deny (skip it). */
function LeaveTask({ task, defaultDay, onDone }) {
  const [day, setDay] = useState(defaultDay);
  const [time, setTime] = useState(task.dueAt ? new Date(task.dueAt).toTimeString().slice(0, 5) : '18:00');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const decide = async (decision) => {
    if (decision === 'DENY' && !window.confirm(`Skip “${task.title}”? It will be cancelled and ${task.createdBy?.fullName || 'whoever assigned it'} is told.`)) return;
    setBusy(true);
    setError('');
    try {
      await taskService.leaveDecision(task.id, decision, decision === 'ALLOW' ? `${day}T${time || '18:00'}` : null, note.trim() || null);
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <li className="leave-task">
      <div>
        <strong>{task.title}</strong>
        <p className="muted small">
          Was due {fmtDateTime(task.dueAt)} (on your leave)
          {task.createdBy && !task.selfAdded && <> · assigned by {task.createdBy.fullName}</>}
        </p>
      </div>
      <div className="leave-task-actions">
        <label>New due date<input type="date" value={day} min={isoDay(new Date())} onChange={(e) => setDay(e.target.value)} disabled={busy} /></label>
        <label>Time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={busy} /></label>
        <label className="leave-note">Note (optional)<input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} disabled={busy} /></label>
        <div className="row">
          <button className="btn primary small" disabled={busy || !day} onClick={() => decide('ALLOW')}>Allow</button>
          {!task.workflow && <button className="btn danger-ghost small" disabled={busy} onClick={() => decide('DENY')}>Deny</button>}
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </li>
  );
}

/** Add my own leave (today or later). */
function AddLeaveForm({ userId, onAdded }) {
  const today = isoDay(new Date());
  const [form, setForm] = useState({ startDate: today, endDate: today, reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'startDate' && e.target.value > f.endDate ? { endDate: e.target.value } : {}) }));
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await leaveService.create({ employeeId: userId, ...form, reason: form.reason.trim() });
      setForm({ startDate: today, endDate: today, reason: '' });
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="form leave-form" onSubmit={add}>
      <div className="grid-2">
        <label>First day<input type="date" value={form.startDate} min={today} onChange={set('startDate')} required disabled={busy} /></label>
        <label>Last day<input type="date" value={form.endDate} min={form.startDate} onChange={set('endDate')} required disabled={busy} /></label>
      </div>
      <label>Reason (optional)<input value={form.reason} maxLength={300} onChange={set('reason')} disabled={busy} placeholder="e.g. Family function" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions"><button className="btn primary" disabled={busy}>Add leave</button></div>
    </form>
  );
}

/**
 * On My work: my leave (add it; only an admin changes or removes it, so "Ask admin to change" raises a ticket),
 * and the tasks that fell on my leave days. Those tasks are not overdue; for each one: Allow (do it on a new day)
 * or Deny (skip it).
 */
export default function LeaveTasksPanel({ refreshKey, onChanged }) {
  const { user, isAdmin } = useAuth();
  const [leaves, setLeaves] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState(null);   // the leave to ask about
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    Promise.all([
      leaveService.list({ from: isoDay(new Date(Date.now() - 60 * 86400000)) }),
      taskService.list({ scope: 'assigned', status: ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED'] }),
    ]).then(([ls, ts]) => {
      setLeaves(ls);
      setTasks(ts.filter((t) => t.onLeave).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)));
    }).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const today = isoDay(new Date());
  const upcoming = (leaves || []).filter((l) => l.endDate >= today);
  if (leaves === null) return null;
  const onLeaveNow = upcoming.find((l) => l.startDate <= today);

  return (
    <section className="panel leave-panel">
      <div className="perf-head">
        <div>
          <h2 className="section-title">My leave</h2>
          <p className="muted small">
            {onLeaveNow ? <strong>You are on leave today. </strong> : null}
            No repeating tasks are created for you on leave days.{!isAdmin && ' Only an admin can change or remove a leave.'}
          </p>
        </div>
        {!adding && <button className="btn ghost small" onClick={() => setAdding(true)}>+ Add leave</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}
      {adding && (
        <AddLeaveForm userId={user.id} onAdded={() => { setAdding(false); setMessage('Leave added.'); load(); onChanged?.(); }} />
      )}
      {upcoming.length > 0 && (
        <ul className="leave-list">
          {upcoming.map((l) => (
            <li key={l.id}>
              <span><strong>{dayText(l)}</strong>{l.reason && <span className="muted"> · {l.reason}</span>}</span>
              {!isAdmin && <button className="link-btn" onClick={() => { setMessage(''); setAsking(l); }}>Ask admin to change</button>}
            </li>
          ))}
        </ul>
      )}
      {upcoming.length === 0 && !adding && <p className="muted small">No leave coming up.</p>}
      {asking && (
        <RaiseTicketDialog onlyAdmins title="Ask an admin to change this leave"
          intro={`Only an admin can change or remove a leave. The admin you choose gets a ticket about your leave ${dayText(asking)}.`}
          initialNote={`Please change my leave ${dayText(asking)} to: `}
          submit={(adminId, note) => leaveService.raiseTicket(asking.id, adminId, note)}
          onClose={() => setAsking(null)}
          onRaised={() => { setAsking(null); setMessage('Ticket sent to the admin. You can follow it on the Tickets page.'); }} />
      )}
      {tasks.length > 0 && (
        <>
          <h3 className="section-title leave-sub">Work from your leave days <span className="count">{tasks.length}</span></h3>
          <p className="muted small">These were due while you were on leave, so they are not overdue. Allow: do it on a new day. Deny: skip it.</p>
          <ul className="leave-tasks">
            {tasks.map((t) => (
              <LeaveTask key={t.id} task={t} defaultDay={firstWorkingDay(leaves)} onDone={() => { load(); onChanged?.(); }} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
