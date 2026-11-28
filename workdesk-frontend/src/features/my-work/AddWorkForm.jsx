import { useEffect, useState } from 'react';
import { employeeService, taskService, recurringService, workflowService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { DAYS, PRIORITIES, PRIORITY_LABEL, dayLabel, isoDay, toLocalInput } from '@/utils/format.js';
import Modal from '@/components/ui/Modal.jsx';
import RepeatDueFields from '@/components/form/RepeatDueFields.jsx';
import FmsPicker from '@/components/form/FmsPicker.jsx';
import { addDays, dueError, firstStartDay } from '@/utils/repeatDue.js';

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
    dueGap: 0,          // weekly / monthly / yearly: days from each start to its due date
    dueTime: '18:00',
    priority: task?.priority || 'MEDIUM',
    status: 'TODO',
    reviewerId: task?.reviewer ? String(task.reviewer.id) : '',
    showDaily: !!task?.showDaily,   // show in To do every day until the date
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
  const repeatStart = firstStartDay(form.repeat, form.dayOfWeek, form.date);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (repeating) {
        const problem = dueError(form.repeat, repeatStart, form.scheduledTime, addDays(repeatStart, Number(form.dueGap) || 0), form.dueTime);
        if (problem) throw new Error(problem);
      }
      let saved;
      if (repeating) {
        saved = await recurringService.create({
            title: form.title, description: form.description, priority: form.priority,
            frequency: form.repeat,
            dayOfWeek: form.repeat === 'WEEKLY' ? form.dayOfWeek : null,
            startDate: form.date,
            scheduledTime: form.scheduledTime,
            // daily: due some minutes after the start; weekly / monthly / yearly: due on a date and time
            durationMinutes: null, dueTime: form.dueTime, dueDaysAfter: Number(form.dueGap) || 0,
            workflowId: workflowId ? Number(workflowId) : null,
        });
      } else {
        const body = {
          title: form.title, description: form.description, priority: form.priority,
          dueAt: form.date ? `${form.date}T${form.time || '18:00'}` : null,
          showDaily: !!form.date && form.showDaily,
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
          <FmsPicker workflows={workflows} value={workflowId} onChange={setWorkflowId} />
        )}
        {!task && workflowId && (
          <p className="hint">Starting this FMS from the task will save its form as a new dated entry. Completed entries stay unchanged.</p>
        )}
        {workflowError && <p className="error" role="alert">Could not load FMS list: {workflowError}</p>}

        <div className="grid-3">
          {!repeating && <label>Date<input type="date" value={form.date} onChange={set('date')} required /></label>}
          {!repeating && (
            <label>Due by<input type="time" value={form.time} onChange={set('time')} required /></label>
          )}
          {repeating && form.repeat === 'WEEKLY' && (
            <label>Every
              <select value={form.dayOfWeek} onChange={set('dayOfWeek')}>
                {DAYS.filter((d) => d !== 'SUNDAY').map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
              </select>
            </label>
          )}
          <label>Priority
            <select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </label>
        </div>

        {!repeating && (
          <label className="check">
            <input type="checkbox" checked={form.showDaily} onChange={(e) => setForm((f) => ({ ...f, showDaily: e.target.checked }))} />
            Show in To do every day until the date
          </label>
        )}
        {!repeating && form.showDaily && (
          <p className="hint">It shows in To do from today until its date, not only on that day, so it is not forgotten.</p>
        )}

        {repeating && (
          <RepeatDueFields frequency={form.repeat} start={repeatStart}
            startDate={form.date} onStartDate={(v) => setForm((f) => ({ ...f, date: v }))}
            startTime={form.scheduledTime} onStartTime={(v) => setForm((f) => ({ ...f, scheduledTime: v }))}
            gap={form.dueGap} onGap={(v) => setForm((f) => ({ ...f, dueGap: v }))}
            dueTime={form.dueTime} onDueTime={(v) => setForm((f) => ({ ...f, dueTime: v }))} />
        )}
        {repeating ? (
          <p className="hint">
            {form.repeat === 'DAILY'
              ? `This task will be added every working day from ${form.date}.`
              : form.repeat === 'WEEKLY'
                ? `This task will be added every ${dayLabel(form.dayOfWeek)}, starting ${form.date}.`
                : form.repeat === 'MONTHLY'
                  ? `This task will be added monthly on day ${Number(form.date.slice(-2))}, starting ${form.date}. Months without that day are skipped.`
                  : `This task will be added every year on ${form.date.slice(5)}, starting ${form.date}. Non-leap years skip February 29.`}
            {' '}It starts at the start time and is due on the due date and time.
            {' '}Sundays and office holidays are skipped. You can pause or delete it any time from “Repeating tasks”.
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
