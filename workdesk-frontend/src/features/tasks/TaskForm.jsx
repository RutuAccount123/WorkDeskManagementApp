import { useEffect, useState } from 'react';
import { employeeService, recurringService, taskService, workflowService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { DAYS, PRIORITIES, PRIORITY_LABEL, dayLabel, isoDay, toLocalInput } from '@/utils/format.js';
import { encodeImage } from '@/utils/image.js';
import Modal from '@/components/ui/Modal.jsx';
import EmployeePicker from '@/components/ui/EmployeePicker.jsx';
import RepeatDueFields from '@/components/form/RepeatDueFields.jsx';
import FmsPicker from '@/components/form/FmsPicker.jsx';
import { addDays, dueError, firstStartDay } from '@/utils/repeatDue.js';

const NO_REVIEW = 'none';

/**
 * Assign a task to anyone (or edit one you assigned), and choose whether it needs review.
 * Used by admins and employees alike.
 */
export default function TaskForm({ task, onClose, onSaved, defaultAssigneeId }) {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [workflowError, setWorkflowError] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [image, setImage] = useState(task?.image || '');
  const [assigneeIds, setAssigneeIds] = useState(() => {
    const id = task?.assignee.id || defaultAssigneeId;
    return id ? [String(id)] : [];
  });
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    // default reviewer: the person assigning
    reviewerId: task ? String(task.reviewer?.id || NO_REVIEW)
      : String(defaultAssigneeId || user.id) === String(user.id) ? NO_REVIEW : String(user.id),
    priority: task?.priority || 'MEDIUM',
    dueDate: toLocalInput(task?.dueAt).slice(0, 10),
    dueTime: toLocalInput(task?.dueAt).slice(11, 16) || '18:00',
    repeat: 'ONCE',
    dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() === 'SUNDAY'
      ? 'MONDAY'
      : new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
    scheduleDate: isoDay(),
    scheduleTime: '09:30',
    dueGap: 0,   // weekly / monthly / yearly: days from each start to its due date
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { employeeService.directory().then(setPeople).catch(() => {}); }, []);
  useEffect(() => {
    if (!task) workflowService.list().then(setWorkflows).catch((err) => setWorkflowError(err.message));
  }, [task]);

  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
  };

  const updateAssignees = (next) => {
    setAssigneeIds(next);
    const defaultReviewer = next.includes(String(user.id))
      ? people.find((person) => !next.includes(String(person.id)))?.id
      : user.id;
    setForm((current) => ({
      ...current,
      reviewerId: next.length === 1 && next[0] === String(user.id)
        ? NO_REVIEW
        : String(defaultReviewer ?? NO_REVIEW),
    }));
  };

  const toggleAssignee = (id) => {
    const next = assigneeIds.includes(id)
      ? assigneeIds.filter((selectedId) => selectedId !== id)
      : task ? [id] : [...assigneeIds, id];
    updateAssignees(next);
  };

  const otherAssigneeIds = people
    .filter((person) => String(person.id) !== String(user.id))
    .map((person) => String(person.id));
  const allOtherAssigneesSelected = otherAssigneeIds.length > 0
    && otherAssigneeIds.every((id) => assigneeIds.includes(id));
  const toggleAllOtherAssignees = () => {
    updateAssignees(allOtherAssigneesSelected ? [] : otherAssigneeIds);
  };

  const forMe = assigneeIds.length === 1 && assigneeIds[0] === String(user.id);
  const canRepeat = !task;
  const reviewers = people.filter((p) => !assigneeIds.includes(String(p.id)));
  const assigneeName = people.find((p) => String(p.id) === assigneeIds[0])?.fullName;

  const repeatStart = firstStartDay(form.repeat, form.dayOfWeek, form.scheduleDate);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!assigneeIds.length) throw new Error('Choose at least one person to assign this task to.');
      if (task && assigneeIds.length !== 1) throw new Error('Choose one assignee when editing a task.');
      if (!task && form.repeat !== 'ONCE') {
        const problem = dueError(form.repeat, repeatStart, form.scheduleTime, addDays(repeatStart, Number(form.dueGap) || 0), form.dueTime);
        if (problem) throw new Error(problem);
      }
      const body = {
        title: form.title, description: form.description, priority: form.priority,
        ...(form.repeat === 'ONCE' || task ? {
          dueAt: form.dueDate ? `${form.dueDate}T${form.dueTime || '18:00'}` : null,
          estimatedHours: null,
          reviewerId: form.reviewerId === NO_REVIEW ? null : Number(form.reviewerId),
          noReview: form.reviewerId === NO_REVIEW,
          image: image || null,
        } : {
          frequency: form.repeat,
          dayOfWeek: form.repeat === 'WEEKLY' ? form.dayOfWeek : null,
          startDate: form.scheduleDate,
          scheduledTime: form.scheduleTime,
          // start date + start time, due on a date and time (no minutes)
          durationMinutes: null, dueTime: form.dueTime, dueDaysAfter: Number(form.dueGap) || 0,
          estimatedHours: null,
          workflowId: workflowId ? Number(workflowId) : null,
          reviewerId: form.reviewerId === NO_REVIEW ? null : Number(form.reviewerId),
          noReview: form.reviewerId === NO_REVIEW,
          image: image || null,
        }),
      };
      const saved = task
        ? await taskService.update(task.id, { ...body, assigneeId: Number(assigneeIds[0]) })
        : form.repeat === 'ONCE'
          ? assigneeIds.length > 1
            ? await taskService.createForAssignees(assigneeIds.map(Number), {
              ...body, workflowId: workflowId ? Number(workflowId) : null,
            })
            : await taskService.create({
              ...body, assigneeId: Number(assigneeIds[0]), workflowId: workflowId ? Number(workflowId) : null,
            })
          : assigneeIds.length > 1
            ? await recurringService.createForAssignees(assigneeIds.map(Number), body)
            : await recurringService.create({ ...body, assigneeId: Number(assigneeIds[0]) });
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
        <label>Task reference image
          <input type="file" accept="image/*" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              setImage(await encodeImage(file));
              setError('');
            } catch (err) {
              setError(err.message);
            }
          }} />
        </label>
        {image && <img className="task-reference-image" src={`data:image/jpeg;base64,${image}`} alt="Task reference" />}
        <EmployeePicker
          people={people}
          selectedIds={assigneeIds}
          onToggle={(id) => toggleAssignee(String(id))}
          onSelectMany={(ids, checked) => updateAssignees(checked
            ? [...new Set([...assigneeIds, ...ids])]
            : assigneeIds.filter((id) => !ids.includes(id)))}
          currentUserId={user.id}
          multiple={!task}
          selectAll={!task ? {
            label: 'Select all employees except me',
            checked: allOtherAssigneesSelected,
            onChange: toggleAllOtherAssignees,
          } : undefined}
        />
        {assigneeIds.length > 1 && (
          <p className="hint">
            A separate task will be created for each selected person. Each person can track their own copy.
            {form.reviewerId === NO_REVIEW
              ? ' No review will be required.'
              : ` ${form.reviewerId === String(user.id) ? 'You' : people.find((person) => String(person.id) === form.reviewerId)?.fullName || 'The selected reviewer'} will review each copy.`}
          </p>
        )}
        <div className="grid-2">
          <label>Reviewed by
            <select value={form.reviewerId} onChange={set('reviewerId')} disabled={!assigneeIds.length}>
              <option value={NO_REVIEW}>
                {assigneeIds.length ? 'No review needed' : 'Select assignee first'}
              </option>
              {reviewers.map((p) => (
                <option key={p.id} value={p.id}>{p.id === user.id ? `Me (${p.fullName})` : p.fullName}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid-2">
          <label>Priority
            <select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </label>
          {canRepeat && (
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
              <label>Due date
                <input type="date" value={form.dueDate} onChange={set('dueDate')} />
              </label>
              <label>Due time
                <input type="time" value={form.dueTime} onChange={set('dueTime')} disabled={!form.dueDate} />
              </label>
            </div>
            <p className="hint">Leave the due date empty if the task has no deadline.</p>
          </>
        ) : (
          <>
            {form.repeat === 'WEEKLY' && (
              <label>Every
                <select value={form.dayOfWeek} onChange={set('dayOfWeek')}>
                  {DAYS.filter((day) => day !== 'SUNDAY').map((day) => <option key={day} value={day}>{dayLabel(day)}</option>)}
                </select>
              </label>
            )}
            <RepeatDueFields frequency={form.repeat} start={repeatStart}
              startDate={form.scheduleDate} onStartDate={(v) => setForm((f) => ({ ...f, scheduleDate: v }))}
              startTime={form.scheduleTime} onStartTime={(v) => setForm((f) => ({ ...f, scheduleTime: v }))}
              gap={form.dueGap} onGap={(v) => setForm((f) => ({ ...f, dueGap: v }))}
              dueTime={form.dueTime} onDueTime={(v) => setForm((f) => ({ ...f, dueTime: v }))} />
            <p className="hint">
              This task will appear on each scheduled working day.
              {' '}It starts at the start time and is due on the due date and time;
              {' '}you’ll be reminded at the scheduled time and notified if it becomes overdue.
              {form.reviewerId === NO_REVIEW
                ? ' No review will be required.'
                : ` ${form.reviewerId === String(user.id) ? 'You' : people.find((person) => String(person.id) === form.reviewerId)?.fullName || 'The selected reviewer'} will review each task.`}
              Sundays and office holidays are skipped; nonexistent monthly dates and February 29 in non-leap years are skipped.
            </p>
          </>
        )}
        {!task && (
          <FmsPicker workflows={workflows} value={workflowId} onChange={setWorkflowId} />
        )}
        {!task && workflowId && (
          <p className="hint">Starting this FMS from the task will save its form as a new dated entry. Completed entries stay unchanged.</p>
        )}
        {workflowError && <p className="error" role="alert">Could not load FMS list: {workflowError}</p>}
        {assigneeIds.length === 1 && (task || form.repeat === 'ONCE') && (
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
          <button className="btn primary" disabled={saving || assigneeIds.length === 0}>{saving ? 'Saving…' : task ? 'Save changes' : form.repeat === 'ONCE' ? 'Assign task' : 'Create repeating task'}</button>
        </div>
      </form>
    </Modal>
  );
}
