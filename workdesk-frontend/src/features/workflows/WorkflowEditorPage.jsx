import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { employeeService, taskService, workflowService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { DAYS, dayLabel } from '@/utils/format.js';

const FIELD_TYPES = [
  ['text', 'Short text'],
  ['textarea', 'Long text'],
  ['number', 'Number'],
  ['date', 'Date'],
  ['select', 'Dropdown'],
  ['checkbox', 'Yes / No'],
];
const ROWS = ['What', 'Who', 'How', 'When'];

const blankStep = (assigneeId) => ({ title: '', assigneeId: assigneeId ? String(assigneeId) : '', hours: 2, howSteps: [''], note: '' });
const blankField = () => ({ label: '', type: 'text', required: false, options: '' });

/**
 * Create / edit an FMS laid out like the FMS Excel sheet:
 * one column per step (plus the trigger column), rows What · Who · How · When.
 * "How" is written as numbered steps; the person doing the step ticks them off.
 * Can be linked to an existing task (?fromTask=ID opens it pre-linked).
 */
export default function WorkflowEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromTask = Number(params.get('fromTask')) || null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', trigger: '', frequency: fromTask ? 'ON_DEMAND' : 'DAILY', dayOfWeek: 'MONDAY',
    startTime: '10:00', endTime: '18:00', sourceTaskId: fromTask ? String(fromTask) : '', startNow: !!fromTask,
    formFields: [{ label: '', type: 'text', required: true, options: '' }],
    steps: [blankStep(user.id), blankStep(user.id), blankStep(user.id)],
  });

  useEffect(() => {
    employeeService.directory().then(setPeople).catch(() => {});
    taskService.list({ scope: 'all' }).then(setTasks).catch(() => {});
    if (id) {
      workflowService.get(id).then((wf) => {
        setForm({
          name: wf.name, trigger: wf.description || '', frequency: wf.frequency, dayOfWeek: wf.dayOfWeek || 'MONDAY',
          startTime: wf.startTime, endTime: wf.endTime, sourceTaskId: wf.sourceTask ? String(wf.sourceTask.id) : '', startNow: false,
          formFields: wf.formFields.map((f) => ({ ...f, options: (f.options || []).join(', ') })),
          steps: wf.steps.map((s) => ({
            title: s.title, assigneeId: String(s.assignee.id), hours: s.hours, note: s.how || '',
            howSteps: s.checklist.length ? [...s.checklist] : [''],
          })),
        });
        setLoaded(true);
      }).catch((e) => setError(e.message));
    }
  }, [id, fromTask]);

  // When opened from a task, use the task's title as a starting name.
  useEffect(() => {
    if (!fromTask || id || form.name) return;
    const t = tasks.find((x) => x.id === fromTask);
    if (t) setForm((f) => ({ ...f, name: `${t.title} FMS`, trigger: `Task “${t.title}” needs to be done` }));
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setField = (i, k, v) => setForm({ ...form, formFields: form.formFields.map((f, j) => (j === i ? { ...f, [k]: v } : f)) });
  const setStep = (i, k, v) => setForm({ ...form, steps: form.steps.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const moveStep = (i, dir) => {
    const steps = [...form.steps];
    [steps[i], steps[i + dir]] = [steps[i + dir], steps[i]];
    setForm({ ...form, steps });
  };
  const setHow = (i, k, v) => setStep(i, 'howSteps', form.steps[i].howSteps.map((x, n) => (n === k ? v : x)));

  const planned = useMemo(() => {
    const [h, m] = form.startTime.split(':').map(Number);
    let minutes = h * 60 + m;
    return form.steps.map((s) => {
      minutes += Math.round(Number(s.hours || 0) * 60);
      return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    });
  }, [form.steps, form.startTime]);
  const totalHours = form.steps.reduce((sum, s) => sum + Number(s.hours || 0), 0);
  // open, regular tasks — plus the one already linked, so it still shows when editing
  const taskChoices = tasks.filter((t) => (!t.workflow && !['COMPLETED', 'CANCELLED'].includes(t.status))
    || t.id === fromTask || String(t.id) === form.sourceTaskId);
  const linkedTask = tasks.find((t) => String(t.id) === form.sourceTaskId);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        name: form.name, description: form.trigger, frequency: form.frequency,
        dayOfWeek: form.frequency === 'WEEKLY' ? form.dayOfWeek : null,
        startTime: form.startTime, endTime: form.endTime,
        sourceTaskId: form.sourceTaskId ? Number(form.sourceTaskId) : null,
        startNow: !!(form.startNow && form.sourceTaskId && !id),
        formFields: form.formFields.map((f) => ({ ...f, options: f.type === 'select' ? f.options : '' })),
        steps: form.steps.map((s) => ({
          title: s.title, assigneeId: Number(s.assigneeId), hours: Number(s.hours), how: s.note,
          checklist: s.howSteps.filter((x) => x.trim()),
        })),
      };
      const saved = id ? await workflowService.update(id, body) : await workflowService.create(body);
      if (body.startNow && fromTask) navigate(`/tasks/${fromTask}`, { replace: true });
      else navigate(`/workflows/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (!loaded) return <div className="page"><p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p></div>;

  return (
    <form className="page fms-editor" onSubmit={submit}>
      <button type="button" className="link-btn back-link" onClick={() => navigate(-1)}>‹ Back</button>
      <header className="page-head">
        <div>
          <h1>{id ? 'Edit FMS' : 'New FMS'}</h1>
          <p className="muted">Fill it like your FMS sheet: one column per step, and What · Who · How · When for each.</p>
        </div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn primary" disabled={busy}>{id ? 'Save FMS' : 'Create FMS'}</button>
        </div>
      </header>

      {/* ---------- basics ---------- */}
      <section className="panel fms-basics">
        <label className="fms-name">FMS name
          <input value={form.name} onChange={set('name')} required placeholder="e.g. Daily purchase cycle" />
        </label>
        <label>Linked task (optional)
          <select value={form.sourceTaskId} onChange={set('sourceTaskId')}>
            <option value="">Not linked to a task</option>
            {taskChoices.map((t) => (
              <option key={t.id} value={t.id}>#{t.id} {t.title}{t.assignee ? ` (${t.assignee.fullName})` : ''}</option>
            ))}
          </select>
        </label>
        {form.sourceTaskId && !id && (
          <label className="check fms-startnow">
            <input type="checkbox" checked={form.startNow} onChange={set('startNow')} />
            Start this FMS now for “{linkedTask?.title || 'the task'}”
          </label>
        )}
      </section>

      {/* ---------- the sheet ---------- */}
      <section className="panel fms-sheet-wrap">
        <div className="perf-head">
          <h2 className="section-title">FMS sheet</h2>
          <span className="muted small">Total {totalHours} h · last step planned by {planned.at(-1)} (day ends {form.endTime})</span>
        </div>
        <div className="fms-scroll">
          <table className="fms-grid">
            <thead>
              <tr>
                <th className="fms-rowhead" />
                <th className="fms-col trigger">
                  <span className="fms-colnum">0</span> Trigger / Entry form
                </th>
                {form.steps.map((s, i) => (
                  <th key={i} className="fms-col">
                    <span className="fms-colnum">{i + 1}</span> Step {i + 1}
                    <span className="fms-colactions">
                      <button type="button" className="icon-btn small-icon" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} left`}>←</button>
                      <button type="button" className="icon-btn small-icon" onClick={() => moveStep(i, 1)} disabled={i === form.steps.length - 1} aria-label={`Move step ${i + 1} right`}>→</button>
                      <button type="button" className="icon-btn small-icon" onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}
                        disabled={form.steps.length <= 2} aria-label={`Remove step ${i + 1}`}>×</button>
                    </span>
                  </th>
                ))}
                <th className="fms-add">
                  <button type="button" className="btn ghost small" onClick={() => setForm({ ...form, steps: [...form.steps, blankStep(form.steps.at(-1)?.assigneeId)] })}>+ Add step</button>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* WHAT */}
              <tr>
                <th className="fms-rowhead">{ROWS[0]}</th>
                <td className="trigger">
                  <textarea rows={2} value={form.trigger} onChange={set('trigger')} placeholder="What starts this work? e.g. Material requirement received from site" aria-label="Trigger: what" />
                </td>
                {form.steps.map((s, i) => (
                  <td key={i}>
                    <textarea rows={2} value={s.title} onChange={(e) => setStep(i, 'title', e.target.value)} required={i < 2}
                      placeholder={`Step ${i + 1} work`} aria-label={`Step ${i + 1}: what`} />
                  </td>
                ))}
                <td />
              </tr>
              {/* WHO */}
              <tr>
                <th className="fms-rowhead">{ROWS[1]}</th>
                <td className="trigger muted small">Whoever starts it, or step 1’s person for scheduled runs</td>
                {form.steps.map((s, i) => (
                  <td key={i}>
                    <select value={s.assigneeId} onChange={(e) => setStep(i, 'assigneeId', e.target.value)} required={!!s.title} aria-label={`Step ${i + 1}: who`}>
                      <option value="">Choose a person</option>
                      {people.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                    </select>
                  </td>
                ))}
                <td />
              </tr>
              {/* HOW */}
              <tr>
                <th className="fms-rowhead">{ROWS[2]}</th>
                <td className="trigger">
                  <p className="fms-cell-title">Entry form questions</p>
                  {form.formFields.map((f, i) => (
                    <div key={i} className="fms-field">
                      <div className="fms-field-row">
                        <input value={f.label} onChange={(e) => setField(i, 'label', e.target.value)} placeholder={`Question ${i + 1}`} aria-label={`Question ${i + 1}`} />
                        <button type="button" className="icon-btn small-icon" onClick={() => setForm({ ...form, formFields: form.formFields.filter((_, j) => j !== i) })} aria-label="Remove question">×</button>
                      </div>
                      <div className="fms-field-row">
                        <select value={f.type} onChange={(e) => setField(i, 'type', e.target.value)} aria-label={`Question ${i + 1} type`}>
                          {FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <label className="check"><input type="checkbox" checked={f.required} onChange={(e) => setField(i, 'required', e.target.checked)} /> Required</label>
                      </div>
                      {f.type === 'select' && (
                        <input value={f.options} onChange={(e) => setField(i, 'options', e.target.value)} placeholder="Options: A, B, C" aria-label={`Question ${i + 1} options`} />
                      )}
                    </div>
                  ))}
                  <button type="button" className="link-btn small" onClick={() => setForm({ ...form, formFields: [...form.formFields, blankField()] })}>+ Add question</button>
                </td>
                {form.steps.map((s, i) => (
                  <td key={i}>
                    <ol className="how-steps">
                      {s.howSteps.map((h, k) => (
                        <li key={k}>
                          <span className="how-num">{k + 1}.</span>
                          <input value={h} onChange={(e) => setHow(i, k, e.target.value)} placeholder="How step" aria-label={`Step ${i + 1}, how ${k + 1}`} />
                          <button type="button" className="icon-btn small-icon" onClick={() => setStep(i, 'howSteps', s.howSteps.filter((_, n) => n !== k))} aria-label="Remove how step">×</button>
                        </li>
                      ))}
                    </ol>
                    <button type="button" className="link-btn small" onClick={() => setStep(i, 'howSteps', [...s.howSteps, ''])}>+ Add how step</button>
                    <textarea rows={2} className="how-note" value={s.note} onChange={(e) => setStep(i, 'note', e.target.value)} placeholder="Note (optional)" aria-label={`Step ${i + 1} note`} />
                  </td>
                ))}
                <td />
              </tr>
              {/* WHEN */}
              <tr>
                <th className="fms-rowhead">{ROWS[3]}</th>
                <td className="trigger">
                  <select value={form.frequency} onChange={set('frequency')} aria-label="How often">
                    <option value="DAILY">Every working day (Mon–Sat)</option>
                    <option value="WEEKLY">Once a week</option>
                    <option value="ON_DEMAND">Only when started (Start new / from a task)</option>
                  </select>
                  {form.frequency === 'WEEKLY' && (
                    <select value={form.dayOfWeek} onChange={set('dayOfWeek')} aria-label="Day">
                      {DAYS.filter((d) => d !== 'SUNDAY').map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
                    </select>
                  )}
                  <div className="fms-times">
                    <label>Starts<input type="time" value={form.startTime} onChange={set('startTime')} required /></label>
                    <label>Day ends<input type="time" value={form.endTime} onChange={set('endTime')} required /></label>
                  </div>
                </td>
                {form.steps.map((s, i) => (
                  <td key={i}>
                    <div className="fms-when">
                      <span>within</span>
                      <input type="number" min="0.25" max="24" step="0.25" value={s.hours} onChange={(e) => setStep(i, 'hours', e.target.value)} required aria-label={`Step ${i + 1} hours`} />
                      <span>hrs</span>
                    </div>
                    <p className={`small ${planned[i] > form.endTime ? 'text-overdue' : 'muted'}`}>
                      {i === 0 ? 'after the form is filled' : `after step ${i} is done`}; planned by {planned[i]}
                    </p>
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">Each next step is assigned only when the previous step is done. Its deadline is counted from that moment. The person must tick every How step before marking the step done.</p>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={() => navigate(-1)}>Cancel</button>
        <button className="btn primary" disabled={busy}>{id ? 'Save FMS' : 'Create FMS'}</button>
      </div>
    </form>
  );
}
