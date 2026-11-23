import { useEffect, useState } from 'react';
import { employeeService, formLinkUrl, taskService, workflowService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import Modal from '@/components/ui/Modal.jsx';
import EmployeePicker from '@/components/ui/EmployeePicker.jsx';

/** The message sent with the link (WhatsApp and the task). */
export const shareMessage = (name, url) => `Please fill this form: ${name}\n${url}`;

/** Opens WhatsApp (app on phones, WhatsApp Web on computers) with the message typed in; you pick the contact. */
export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/**
 * The FMS's shareable form link: copy it, share it on WhatsApp, or ask Work Desk members to fill it
 * (each gets a task with the link). The owner can also make a new link or turn it off.
 * Whoever opens the link fills the FMS form (no sign-in), and each entry starts a new run.
 */
export default function FormLinkDialog({ workflow, canManage, onClose, onChanged }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [people, setPeople] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('18:00');
  const [assigned, setAssigned] = useState('');
  const token = workflow.publicFormToken;
  const url = token ? formLinkUrl(token, workflow.name) : '';
  const usable = !!token && workflow.active;

  useEffect(() => { employeeService.directory().then(setPeople).catch(() => {}); }, []);

  const change = async (call) => {
    setBusy(true);
    setError('');
    setCopied(false);
    setAssigned('');
    try {
      onChanged(await call(workflow.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Could not copy. Select the link and copy it yourself.');
    }
  };

  const toggle = (id) => setChosen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  /** One task per chosen person, with the link in it. No review: they close it once the form is filled. */
  const assign = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setAssigned('');
    try {
      if (!chosen.length) throw new Error('Choose at least one person.');
      const task = {
        title: `Fill the form: ${workflow.name}`.slice(0, 200),
        description: `${shareMessage(workflow.name, url)}\n\nOpen the link, fill the form and press Submit. Then mark this task as done.`,
        priority: 'MEDIUM',
        dueAt: dueDate ? `${dueDate}T${dueTime || '18:00'}` : null,
        noReview: true,
      };
      if (chosen.length === 1) await taskService.create({ ...task, assigneeId: chosen[0] });
      else await taskService.createForAssignees(chosen, task);
      const names = people.filter((p) => chosen.includes(p.id)).map((p) => p.fullName);
      setAssigned(`Task assigned to ${names.join(', ')}.`);
      setChosen([]);
      setDueAt('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Form link" onClose={onClose}>
      <div className="form">
        <p className="muted">
          Anyone with this link can fill the form, no sign-in needed. Each time someone fills it, a new entry is added
          to “{workflow.name}” and step 1 starts straight away.
        </p>
        {token ? (
          <>
            <div className="row form-link-row">
              <input readOnly value={url} aria-label="Form link" onFocus={(e) => e.target.select()} />
              <button type="button" className="btn primary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <div className="row form-link-share">
              <a className="btn ghost whatsapp-btn" href={whatsappUrl(shareMessage(workflow.name, url))} target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
                </svg>
                Share on WhatsApp
              </a>
            </div>
          </>
        ) : (
          <p className="hint">The form link is turned off.</p>
        )}
        {token && !workflow.active && <p className="hint">This FMS is paused, so the link does not accept entries right now.</p>}

        {usable && (
          <form className="form form-link-assign" onSubmit={assign}>
            <h3 className="section-title">Ask Work Desk members to fill it</h3>
            <p className="muted small">Each person you choose gets a task with this link. They mark it done after filling the form.</p>
            <EmployeePicker people={people} selectedIds={chosen} onToggle={toggle}
              currentUserId={user?.id} disabled={busy} />
            <div className="grid-2">
              <label>Due date (optional)
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={busy} />
              </label>
              <label>Due time
                <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={busy || !dueDate} />
              </label>
            </div>
            <div className="form-actions">
              <button className="btn primary" disabled={busy || !chosen.length}>
                {chosen.length > 1 ? `Assign to ${chosen.length} people` : 'Assign task'}
              </button>
            </div>
          </form>
        )}

        {assigned && <p className="success" role="status">{assigned}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          {canManage && token && (
            <button type="button" className="btn ghost" disabled={busy} onClick={() => change(workflowService.turnOffFormLink)}>Turn off</button>
          )}
          {canManage && (
            <button type="button" className="btn ghost" disabled={busy} onClick={() => change(workflowService.newFormLink)}>
              {token ? 'Make new link' : 'Create link'}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
        </div>
        {canManage && token && <p className="hint">“Make new link” stops the old link from working.</p>}
      </div>
    </Modal>
  );
}
