import { useEffect, useState } from 'react';
import { employeeService, ticketService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import Modal from '@/components/ui/Modal.jsx';

/**
 * Raise a ticket on a task: choose who should help and say what is needed.
 * onlyAdmins: the ticket can go only to an admin (e.g. asking to stop a repeating task); preferredId is chosen first.
 */
export default function RaiseTicketDialog({
  task, onClose, onRaised, onlyAdmins = false, initialNote = '', preferredId = null, title = 'Raise a ticket', intro,
  submit: submitTicket,   // optional (assignedToId, note) => Promise, e.g. a ticket about a leave instead of a task
}) {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [assignedToId, setAssignedToId] = useState('');
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    employeeService.directory().then((list) => {
      const shown = list.filter((p) => p.id !== user.id && (!onlyAdmins || (p.role === 'ADMIN' && !p.departmentAdmin)));
      setPeople(shown);
      const first = shown.find((p) => p.id === preferredId) || (onlyAdmins && shown.length === 1 ? shown[0] : null);
      if (first) setAssignedToId(String(first.id));
    }).catch((e) => setError(e.message));
  }, [user.id, onlyAdmins, preferredId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!assignedToId || !note.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (submitTicket) await submitTicket(Number(assignedToId), note.trim());
      else await ticketService.raise(task.id, Number(assignedToId), note.trim());
      onRaised();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted small">{intro || `Need help with “${task?.title}”? The person you choose is notified, can open this task and replies to your ticket.`}</p>
        {onlyAdmins && people.length === 0 && !error && <p className="muted small">No admin is available to receive this ticket.</p>}
        <label>{onlyAdmins ? 'Send to admin' : 'Assign ticket to'}
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} required autoFocus disabled={busy}>
            <option value="">{onlyAdmins ? 'Choose an admin…' : 'Choose a person…'}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}{p.department ? ` · ${p.department}` : ''}</option>
            ))}
          </select>
        </label>
        <label>Note
          <textarea rows={4} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} required disabled={busy}
            placeholder="What is the problem, and what do you need from them?" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" disabled={busy || !assignedToId || !note.trim()}>Raise ticket</button>
        </div>
      </form>
    </Modal>
  );
}
