import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { STATUS_LABEL, fmtDateTime } from '@/utils/format.js';
import LinkedText from '@/components/ui/LinkedText.jsx';

const nameOf = (person, user) => (person?.id === user.id ? 'You' : person?.fullName || 'Someone');
const OPEN_TASK = ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED'];

/**
 * One ticket.
 * The person it is assigned to has two choices, both with a reply:
 *   Resolve        → the ticket closes and the task goes back to its assignee
 *   Mark task done → they finish the task themselves; it moves to them and is done
 * The person who raised it, or a full admin, can close (resolve) it.
 * showTask: also link to the task (on the Tickets page).
 * focus: the ticket the person came to work on: highlighted, scrolled to, and its reply box open.
 */
export default function TicketCard({ ticket, showTask = false, onChanged, focus = false }) {
  const { user, isAdmin } = useAuth();
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = ticket.status === 'OPEN';
  const mine = ticket.assignedTo?.id === user.id;
  const canResolve = open && (mine || ticket.raisedBy?.id === user.id || isAdmin);   // the server checks the department
  const aboutLeave = !ticket.task && !!ticket.subject;
  const canFinish = open && mine && !aboutLeave && (!ticket.taskStatus || OPEN_TASK.includes(ticket.taskStatus));
  const ref = useRef(null);

  useEffect(() => {
    if (!focus) return;
    ref.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    if (canResolve && mine) setReplying(true);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action) => {
    if (!reply.trim()) return;
    if (action === 'done' && !window.confirm('Mark this task done yourself? It will move to you and will not go back to the person who raised the ticket.')) return;
    setBusy(true);
    setError('');
    try {
      if (action === 'done') await ticketService.markTaskDone(ticket.id, reply.trim());
      else await ticketService.resolve(ticket.id, reply.trim());
      setReply('');
      setReplying(false);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li ref={ref} className={`ticket ${open ? 'ticket-open' : 'ticket-resolved'} ${focus ? 'ticket-focus' : ''}`}
      aria-current={focus ? 'true' : undefined}>
      <div className="ticket-head">
        <span className={`chip ${open ? 'chip-todo' : 'chip-done'}`}>{open ? 'Open' : ticket.taskDone ? 'Task done' : 'Resolved'}</span>
        <span className="ticket-who">
          <strong>{nameOf(ticket.raisedBy, user)}</strong> → <strong>{nameOf(ticket.assignedTo, user)}</strong>
        </span>
        <time className="muted small">{fmtDateTime(ticket.createdAt)}</time>
      </div>
      {aboutLeave && (
        <p className="ticket-task small">
          About: <strong>{ticket.subject}</strong>
          {isAdmin && ticket.raisedBy && <> · <Link to={`/employees/${ticket.raisedBy.id}`}>open {ticket.raisedBy.fullName}’s leave</Link></>}
          {!ticket.leaveId && <span className="muted"> · this leave has been removed</span>}
        </p>
      )}
      {showTask && ticket.task && (
        <p className="ticket-task small">
          Task: <Link to={`/tasks/${ticket.task.id}`}>{ticket.task.title}</Link>
          {ticket.taskStatus && <span className="muted"> · {STATUS_LABEL[ticket.taskStatus] || ticket.taskStatus}</span>}
        </p>
      )}
      <p className="ticket-note"><LinkedText text={ticket.note} /></p>
      {!open && ticket.reply && (
        <div className="ticket-reply">
          <p className="muted small">
            {ticket.taskDone
              ? `${nameOf(ticket.resolvedBy, user)} finished the task`
              : aboutLeave ? `Reply from ${nameOf(ticket.resolvedBy, user)}`
                : `Reply from ${nameOf(ticket.resolvedBy, user)}, task sent back to its assignee`} · {fmtDateTime(ticket.resolvedAt)}
          </p>
          <p><LinkedText text={ticket.reply} /></p>
        </div>
      )}
      {canResolve && !replying && (
        <button className="btn ghost small" onClick={() => setReplying(true)}>{mine ? 'Work on this ticket' : 'Close ticket'}</button>
      )}
      {canResolve && replying && (
        <form className="ticket-resolve" onSubmit={(e) => { e.preventDefault(); act('resolve'); }}>
          <label className="sr-only" htmlFor={`reply-${ticket.id}`}>Reply</label>
          <textarea id={`reply-${ticket.id}`} rows={3} maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder="What did you do, or what is the answer?" autoFocus disabled={busy} />
          {mine && (
            <p className="muted small">
              {aboutLeave ? <><strong>Resolve</strong>: reply once the leave is changed or removed.</>
                : <><strong>Resolve</strong>: the task goes back to the person doing it, to carry on.</>}
              {canFinish && <> <strong>Mark task done</strong>: you finish it yourself, it moves to you and is done.</>}
            </p>
          )}
          <div className="row">
            <button type="button" className="btn ghost small" onClick={() => { setReplying(false); setReply(''); }} disabled={busy}>Cancel</button>
            <button className="btn primary small" disabled={busy || !reply.trim()}>{mine ? 'Resolve' : 'Close ticket'}</button>
            {canFinish && (
              <button type="button" className="btn primary small" disabled={busy || !reply.trim()} onClick={() => act('done')}>Mark task done</button>
            )}
          </div>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </li>
  );
}
