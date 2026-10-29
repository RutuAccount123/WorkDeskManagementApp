import { useEffect, useState } from 'react';
import { employeeService, taskService, recurringService, workflowService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { DAYS, PRIORITIES, PRIORITY_LABEL, dayLabel, isoDay, toLocalInput } from '@/utils/format.js';
import Modal from '@/components/ui/Modal.jsx';

const REPEATS = [
  ['ONCE', 'One time'],
  ['DAILY', 'Every day'],
  ['WEEKLY', 'Every week'],
];

/**
 * Employee adds (or edits) their own work.
 * One time → a single task on a date.  Every day / Every week → a repeating task that is
 * created automatically for each working day (skipping Sundays and office holidays).
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
            frequency: form.repeat, dayOfWeek: form.repeat === 'WEEKLY' ? form.dayOfWeek : null, dueTime: form.time || '18:00',
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
          ) : (
            <label>Days<input value="Monday to Saturday" disabled /></label>
          )}
          <label>By time<input type="time" value={form.time} onChange={set('time')} /></label>
          <label>Priority
            <select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </label>
        </div>

        {repeating ? (
          <p className="hint">
            {form.repeat === 'DAILY'
              ? 'This task will be added to every working day, starting today. Sundays and office holidays are skipped.'
              : `This task will be added every ${dayLabel(form.dayOfWeek)}, starting this week. Office holidays are skipped.`}
            {' '}You can pause or delete it any time from “My daily & weekly tasks”.
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
            {task ? 'Save changes' : form.repeat === 'DAILY' ? 'Add daily task' : form.repeat === 'WEEKLY' ? 'Add weekly task' : 'Add work'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
