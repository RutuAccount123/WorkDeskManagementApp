import { useEffect, useState } from 'react';
import { employeeService, recurringService, taskService, workflowService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { DAYS, PRIORITIES, PRIORITY_LABEL, dayLabel, isoDay, toLocalInput } from '@/utils/format.js';
import Modal from '@/components/ui/Modal.jsx';

const NO_REVIEW = 'none';

/**
 * Assign a task to anyone (or edit one you assigned), and choose who reviews it.
 * Used by admins and employees alike.
 */
export default function TaskForm({ task, onClose, onSaved, defaultAssigneeId }) {
  const { user, isAdmin } = useAuth();
  const [people, setPeople] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [workflowError, setWorkflowError] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigneeId: String(task?.assignee.id || defaultAssigneeId || ''),
    // default reviewer: the person assigning
    reviewerId: task ? String(task.reviewer?.id || NO_REVIEW) : String(user.id),
    priority: task?.priority || 'MEDIUM',
    dueAt: toLocalInput(task?.dueAt),
    estimatedHours: task?.estimatedHours == null ? '' : String(task.estimatedHours),
    repeat: 'ONCE',
    dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() === 'SUNDAY'
      ? 'MONDAY'
      : new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
    scheduleDate: isoDay(),
    scheduleTime: '09:30',
    durationMinutes: '20',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { employeeService.directory().then(setPeople).catch(() => {}); }, []);
  useEffect(() => {
    if (!task) workflowService.list().then(setWorkflows).catch((err) => setWorkflowError(err.message));
  }, [task]);

  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: value };
      if (k === 'assigneeId') {
        const me = String(user.id);
        if (!isAdmin && value !== me) next.repeat = 'ONCE';
        // the person doing the work can't review it
        if (next.reviewerId === value) next.reviewerId = value === me ? NO_REVIEW : me;
        // "No review needed" only exists for your own work; for someone else, you review it by default
        if (next.reviewerId === NO_REVIEW && value !== me) next.reviewerId = me;
      }
      return next;
    });
  };

  const forMe = form.assigneeId === String(user.id);
  const canRepeat = isAdmin || forMe;
  const reviewers = people.filter((p) => String(p.id) !== form.assigneeId);
  const assigneeName = people.find((p) => String(p.id) === form.assigneeId)?.fullName;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        title: form.title, description: form.description, priority: form.priority,
        assigneeId: Number(form.assigneeId),
        ...(form.repeat === 'ONCE' || task ? {
          dueAt: form.dueAt || null,
          estimatedHours: form.estimatedHours === '' ? null : Number(form.estimatedHours),
          reviewerId: form.reviewerId === NO_REVIEW ? null : Number(form.reviewerId),
        } : {
          frequency: form.repeat,
          dayOfWeek: form.repeat === 'WEEKLY' ? form.dayOfWeek : null,
          startDate: form.scheduleDate,
          scheduledTime: form.scheduleTime,
          durationMinutes: Number(form.durationMinutes),
          estimatedHours: null,
          workflowId: workflowId ? Number(workflowId) : null,
        }),
      };
      const saved = task
        ? await taskService.update(task.id, body)
        : form.repeat === 'ONCE'
          ? await taskService.create({ ...body, workflowId: workflowId ? Number(workflowId) : null })
          : await recurringService.create(body);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={task ? 'Edit task' : 'Assign a task'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>Title
          <input value={form.title} onChange={set('title')} required maxLength={200} autoFocus
            placeholder="e.g. Collect 3 quotations for plywood" />
        </label>
        <label>Details
          <textarea value={form.description} onChange={set('description')} rows={3}
            placeholder="What needs to be done, and what counts as finished" />
        </label>
        <div className="grid-2">
          <label>Assign to
            <select value={form.assigneeId} onChange={set('assigneeId')} required>
              <option value="">Choose a person</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === user.id ? `Me (${p.fullName})` : p.fullName}{p.department ? `, ${p.department}` : ''}
                </option>
              ))}
            </select>
          </label>
          {(task || form.repeat === 'ONCE') && (
            <label>Reviewed by
              <select value={form.reviewerId} onChange={set('reviewerId')}>
                {forMe && <option value={NO_REVIEW}>No review needed</option>}
                {reviewers.map((p) => (
                  <option key={p.id} value={p.id}>{p.id === user.id ? `Me (${p.fullName})` : p.fullName}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="grid-2">
          <label>Priority
            <select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </label>
          {!task && canRepeat && (
            <label>Repeat
              <select value={form.repeat} onChange={set('repeat')}>
                <option value="ONCE">One time</option>
                <option value="DAILY">Every working day</option>
                <option value="WEEKLY">Every week</option>
                <option value="MONTHLY">Every month</option>
                <option value="YEARLY">Every year</option>
              </select>
            </label>
          )}
        </div>
        {(task || form.repeat === 'ONCE') ? (
          <>
            <div className="grid-2">
              <label>{form.estimatedHours ? 'Manual due (unused with an estimate)' : 'Due'}
                <input type="datetime-local" value={form.dueAt} onChange={set('dueAt')} disabled={form.estimatedHours !== ''} />
              </label>
              <label>Estimated effort (hours)
                <input type="number" min="0.25" max="24" step="0.25" value={form.estimatedHours}
                  onChange={set('estimatedHours')} placeholder="Optional" />
              </label>
            </div>
            <p className="hint">
              When an estimate is set, the due time is calculated from when work starts using 10:00–18:00 working hours.
              Remaining effort continues on the next working day; Sundays and office holidays are skipped. Without an estimate, the Due field is used.
            </p>
          </>
        ) : (
          <>
            <div className="grid-3">
              {form.repeat === 'WEEKLY' ? (
                <label>Every
                  <select value={form.dayOfWeek} onChange={set('dayOfWeek')}>
                    {DAYS.filter((day) => day !== 'SUNDAY').map((day) => <option key={day} value={day}>{dayLabel(day)}</option>)}
                  </select>
                </label>
              ) : form.repeat === 'MONTHLY' || form.repeat === 'YEARLY' ? (
                <label>Repeat on
                  <input type="date" value={form.scheduleDate} onChange={set('scheduleDate')} required />
                </label>
              ) : (
                <label>Starts from
                  <input type="date" value={form.scheduleDate} onChange={set('scheduleDate')} required />
                </label>
              )}
              <label>Scheduled start
                <input type="time" value={form.scheduleTime} onChange={set('scheduleTime')} required />
              </label>
              <label>Duration (minutes)
                <input type="number" min="1" max="1439" value={form.durationMinutes} onChange={set('durationMinutes')} required />
              </label>
            </div>
            <p className="hint">
              This task will appear on each scheduled working day. The due time is {form.durationMinutes || 0} minutes after its start;
              you’ll be reminded at the scheduled time and notified if it becomes overdue. The assigning admin reviews tasks assigned to others.
              Sundays and office holidays are skipped; nonexistent monthly dates and February 29 in non-leap years are skipped.
            </p>
          </>
        )}
        {!task && (
          <label>Save form data in existing FMS
            <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
              <option value="">No FMS — regular task</option>
              {workflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}{workflow.active ? '' : ' (Paused)'}
                </option>
              ))}
            </select>
          </label>
        )}
        {!task && workflowId && (
          <p className="hint">Starting this FMS from the task will save its form as a new dated entry. Completed entries stay unchanged.</p>
        )}
        {workflowError && <p className="error" role="alert">Could not load FMS list: {workflowError}</p>}
        {form.assigneeId && (task || form.repeat === 'ONCE') && (
          <p className="hint">
            {form.reviewerId === NO_REVIEW
              ? 'You can mark this done yourself. No one needs to check it.'
              : `${forMe ? 'You' : assigneeName || 'The assignee'} will submit the work, and ${
                form.reviewerId === String(user.id) ? 'you' : people.find((p) => String(p.id) === form.reviewerId)?.fullName || 'the reviewer'
              } will approve it or send it back.`}
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : task ? 'Save changes' : form.repeat === 'ONCE' ? 'Assign task' : 'Create repeating task'}</button>
        </div>
      </form>
    </Modal>
  );
}
