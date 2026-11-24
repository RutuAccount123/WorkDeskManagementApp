import { useEffect, useState } from 'react';
import { recurringService, taskService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { dayLabel, fmtDate } from '@/utils/format.js';
import RaiseTicketDialog from '@/features/tickets/RaiseTicketDialog.jsx';

const OPEN = ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED'];

function scheduleLabel(task) {
  if (task.frequency === 'DAILY') return 'Mon–Sat';
  if (task.frequency === 'WEEKLY') return `Every ${dayLabel(task.dayOfWeek)}`;
  if (task.frequency === 'MONTHLY') {
    return task.startDate ? `Monthly on day ${Number(task.startDate.slice(-2))}` : 'Monthly';
  }
  if (task.frequency === 'YEARLY') return task.startDate ? `Yearly on ${task.startDate}` : 'Yearly';
  return 'Schedule unavailable';
}

/**
 * Repeating tasks: the ones you do, and the ones you set up for others.
 * Employees only see them; an admin stops, starts again or deletes them.
 * To have one stopped, an employee raises a ticket to an admin (on the nearest open copy of it).
 */
export default function RepeatingTaskList({ refreshKey, onChanged, employeeId }) {
  const { user, isAdmin } = useAuth() || {};
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [asking, setAsking] = useState(null);   // { template, copy }

  const load = () => recurringService.list()
    .then((tasks) => setList(employeeId == null ? tasks : tasks.filter((task) =>
      task.assignee?.id === employeeId || task.createdBy?.id === employeeId)))
    .catch((e) => setError(e.message));
  useEffect(() => { load(); }, [refreshKey]);

  const act = async (fn) => {
    setError('');
    try { await fn(); await load(); onChanged?.(); } catch (e) { setError(e.message); }
  };

  /** Tickets belong to a task, so the request goes on the nearest open copy of this repeating task. */
  const askToStop = async (template) => {
    setError('');
    setMessage('');
    try {
      const [mine, given] = await Promise.all([taskService.list({ scope: 'assigned' }), taskService.list({ scope: 'created' })]);
      const copy = [...mine, ...given]
        .filter((c) => c.recurringTemplateId === template.id && OPEN.includes(c.status))
        .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0))[0];
      if (!copy) { setError(`“${template.title}” has no open task right now to raise the ticket on. Try again when the next one is created.`); return; }
      setAsking({ template, copy });
    } catch (e) {
      setError(e.message);
    }
  };

  if (list === null) return null;

  return (
    <section className="panel">
      <h2 className="section-title">My repeating tasks</h2>
      {error && <p className="error">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}
      {!isAdmin && list.length > 0 && <p className="muted small">Only an admin can stop or change a repeating task. Use “Ask admin to stop” to raise a ticket.</p>}
      {list.length === 0 ? (
        <p className="muted">No repeating tasks yet.</p>
      ) : (
        <ul className="repeat-list">
          {list.map((t) => (
            <li key={t.id} className={t.active ? '' : 'paused'}>
              <span className={`repeat-badge ${t.frequency === 'DAILY' ? 'rb-daily' : 'rb-weekly'}`}>
                {{ DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' }[t.frequency] || 'Repeats'}
              </span>
              <span className="repeat-main">
                <strong>{t.title}</strong>
                <small className="muted">
                  {scheduleLabel(t)}, by {t.dueTime.slice(0, 5)}
                  {' · '}{t.selfOwned ? 'set by you'
                    : t.createdBy?.id === user?.id ? `for ${t.assignee?.fullName}, set by you`
                      : `set by ${t.createdBy?.fullName || 'admin'}`}
                  {!t.active && ' · stopped'}
                  {t.lastGeneratedOn && t.active && ` · next copies up to ${fmtDate(t.lastGeneratedOn)}`}
                </small>
              </span>
              {isAdmin && (
                <span className="row-actions">
                  <button className="link-btn" onClick={() => (t.active
                    ? window.confirm(`Stop repeating “${t.title}”? No new copies are made and upcoming copies nobody has started are removed. You can start it again later.`)
                    : true) && act(() => recurringService.setActive(t.id, !t.active))}>
                    {t.active ? 'Stop repeating' : 'Start again'}
                  </button>
                  <button className="link-btn danger" onClick={() => window.confirm(`Delete the “${t.title}” schedule for good? Past tasks stay in the record.`)
                    && act(() => recurringService.remove(t.id))}>Delete</button>
                </span>
              )}
              {!isAdmin && t.active && (
                <span className="row-actions">
                  <button className="link-btn" onClick={() => askToStop(t)}>Ask admin to stop</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {asking && (
        <RaiseTicketDialog task={asking.copy} onlyAdmins preferredId={asking.template.createdBy?.id}
          title="Ask an admin to stop this repeating task"
          intro={`The admin you choose gets a ticket on “${asking.copy.title}” and can stop it repeating. You are told when they answer.`}
          initialNote={`Please stop the repeating task “${asking.template.title}” (${scheduleLabel(asking.template)}, by ${asking.template.dueTime.slice(0, 5)}). Reason: `}
          onClose={() => setAsking(null)}
          onRaised={() => {
            setMessage(`Ticket sent. An admin will stop “${asking.template.title}” or reply to you. You can follow it on the Tickets page.`);
            setAsking(null);
            onChanged?.();
          }} />
      )}
    </section>
  );
}
