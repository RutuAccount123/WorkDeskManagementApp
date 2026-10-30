import { useEffect, useState } from 'react';
import { employeeService, taskService, recurringService, workflowService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { DAYS, PRIORITIES, PRIORITY_LABEL, dayLabel, isoDay, toLocalInput } from '@/utils/format.js';
import Modal from '@/components/ui/Modal.jsx';

const REPEATS = [
  ['ONCE', 'One time'],
  ['DAILY', 'Every working day'],
  ['WEEKLY', 'Every week'],
  ['MONTHLY', 'Every month'],
  ['YEARLY', 'Every year'],
];

/**
 * Employee adds (or edits) their own work.
 * One time → a single task on a date. Repeating work is created automatically on its
 * selected working-day schedule, with a scheduled start and deadline.
 */
export default function AddWorkForm({ task, defaultDate, onClose, onSaved }) {
  const existing = toLocalInput(task?.dueAt);
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    repeat: 'ONCE',
    dayOfWeek: todayName === 'SUNDAY' ? 'MONDAY' : todayName,
    date: existing ? existing.slice(0, 10) : isoDay(defaultDate || new Date()),
    time: existing ? existing.slice(11, 16) : '18:00',
    scheduledTime: '09:30',
    durationMinutes: '20',
    priority: task?.priority || 'MEDIUM',
    status: 'TODO',
    reviewerId: task?.reviewer ? String(task.reviewer.id) : '',
  });
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  useEffect(() => { employeeService.directory().then(setPeople).catch(() => {}); }, []);
  const [workflows, setWorkflows] = useState([]);
  const [workflowError, setWorkflowError] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  useEffect(() => {
    if (!task) workflowService.list().then(setWorkflows).catch((err) => setWorkflowError(err.message));
  }, [task]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const repeating = !task && form.repeat !== 'ONCE';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let saved;
      if (repeating) {
        saved = await recurringService.create({
            title: form.title, description: form.description, priority: form.priority,
            frequency: form.repeat,
            dayOfWeek: form.repeat === 'WEEKLY' ? form.dayOfWeek : null,
            startDate: form.date,
            scheduledTime: form.scheduledTime,
            durationMinutes: Number(form.durationMinutes),
            workflowId: workflowId ? Number(workflowId) : null,
        });
      } else {
        const body = {
          title: form.title, description: form.description, priority: form.priority,
          dueAt: form.date ? `${form.date}T${form.time || '18:00'}` : null,
          reviewerId: form.reviewerId ? Number(form.reviewerId) : null,
        };
        saved = task
          ? await taskService.update(task.id, { ...body, assigneeId: task.assignee.id })
          : await taskService.create({ ...body, status: form.status, workflowId: workflowId ? Number(workflowId) : null });
      }
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={task ? 'Edit my work' : 'Add my work'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>What is the work?
          <input value={form.title} onChange={set('title')} required maxLength={200} autoFocus
            placeholder="e.g. Visit Kharadi site and check tiles" />
        </label>
        <label>Details
          <textarea rows={2} value={form.description} onChange={set('description')} placeholder="Optional" />
        </label>

        {!task && (
          <fieldset className="choice">
            <legend>How often?</legend>
            {REPEATS.map(([v, l]) => (
              <label key={v} className={form.repeat === v ? 'on' : ''}>
                <input type="radio" name="repeat" value={v} checked={form.repeat === v} onChange={set('repeat')} />{l}
              </label>
            ))}
          </fieldset>
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

        <div className="grid-3">
          {form.repeat === 'ONCE' || task ? (
            <label>Date<input type="date" value={form.date} onChange={set('date')} required /></label>
          ) : form.repeat === 'WEEKLY' ? (
            <label>Every
              <select value={form.dayOfWeek} onChange={set('dayOfWeek')}>
                {DAYS.filter((d) => d !== 'SUNDAY').map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
              </select>
            </label>
          ) : form.repeat === 'MONTHLY' || form.repeat === 'YEARLY' ? (
            <label>{form.repeat === 'YEARLY' ? 'Repeat every year on' : 'Repeat on'}
              <input type="date" value={form.date} onChange={set('date')} required />
            </label>
          ) : (
            <label>Starts from<input type="date" value={form.date} onChange={set('date')} required /></label>
          )}
          <label>{repeating ? 'Scheduled start' : 'Due by'}
            <input type="time" value={repeating ? form.scheduledTime : form.time}
              onChange={set(repeating ? 'scheduledTime' : 'time')} required />
          </label>
          {repeating && (
            <label>Duration (minutes)
              <input type="number" min="1" max="1439" value={form.durationMinutes} onChange={set('durationMinutes')} required />
            </label>
          )}
          <label>Priority
            <select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </label>
        </div>

        {repeating ? (
          <p className="hint">
            {form.repeat === 'DAILY'
              ? `This task will be added every working day from ${form.date}.`
              : form.repeat === 'WEEKLY'
                ? `This task will be added every ${dayLabel(form.dayOfWeek)}, starting ${form.date}.`
                : form.repeat === 'MONTHLY'
                  ? `This task will be added monthly on day ${Number(form.date.slice(-2))}, starting ${form.date}. Months without that day are skipped.`
                  : `This task will be added every year on ${form.date.slice(5)}, starting ${form.date}. Non-leap years skip February 29.`}
            {' '}It starts at {form.scheduledTime} and is due {form.durationMinutes || 20} minutes later. Sundays and office holidays are skipped. You can pause or delete it any time from “Repeating tasks”.
          </p>
        ) : (
          <label>Review by
            <select value={form.reviewerId} onChange={(e) => setForm({ ...form, reviewerId: e.target.value, status: e.target.value && form.status === 'COMPLETED' ? 'TODO' : form.status })}>
              <option value="">No review needed</option>
              {people.filter((p) => p.id !== user.id).map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </label>
        )}
        {!repeating && !task && (
          <fieldset className="choice">
            <legend>Status</legend>
            {[['TODO', 'To do'], ['IN_PROGRESS', 'In progress'], ...(form.reviewerId ? [] : [['COMPLETED', 'Already done']])].map(([v, l]) => (
              <label key={v} className={form.status === v ? 'on' : ''}>
                <input type="radio" name="status" value={v} checked={form.status === v} onChange={set('status')} />{l}
              </label>
            ))}
          </fieldset>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>
            {task ? 'Save changes' : form.repeat === 'DAILY' ? 'Add daily task' : form.repeat === 'WEEKLY' ? 'Add weekly task' : form.repeat === 'MONTHLY' ? 'Add monthly task' : form.repeat === 'YEARLY' ? 'Add yearly task' : 'Add work'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
