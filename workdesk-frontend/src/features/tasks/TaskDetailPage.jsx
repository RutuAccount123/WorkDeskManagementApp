import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { taskService, workflowService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { PRIORITY_LABEL, STATUS_LABEL, fmtDateTime, relativeDue } from '@/utils/format.js';
import StatusSteps from '@/components/ui/StatusSteps.jsx';
import StatusChip from '@/components/ui/StatusChip.jsx';
import DynamicForm from '@/components/form/DynamicForm.jsx';
import RunProgress from '@/features/workflows/RunProgress.jsx';
import StartRunDialog from '@/features/workflows/StartRunDialog.jsx';
import { freqText } from '@/features/workflows/workflowFormat.js';
import FmsTaskSheet from '@/features/workflows/FmsTaskSheet.jsx';
import AddWorkForm from '@/features/my-work/AddWorkForm.jsx';
import TaskForm from './TaskForm.jsx';
import { ACTION_TEXT, actionsFor, yourTurn } from './taskActions.js';

/**
 * Full page for one task. For a workflow (FMS) step it also shows the run's form
 * (to fill, or the filled answers), the How instructions with checklist, and every step's progress.
 */
export default function TaskDetailPage() {
  const { id } = useParams();
  const taskId = Number(id);
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [task, setTask] = useState(null);
  const [history, setHistory] = useState([]);
  const [run, setRun] = useState(null);
  const [answers, setAnswers] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [linked, setLinked] = useState([]);
  const [linkedRuns, setLinkedRuns] = useState([]);
  const [starting, setStarting] = useState(null);

  const load = useCallback(async () => {
    try {
      const [t, h] = await Promise.all([taskService.get(taskId), taskService.activity(taskId)]);
      setTask(t);
      setHistory(h);
      setRun(t.workflow ? await workflowService.run(t.workflow.runId) : null);
      if (!t.workflow) {
        const [wfs, rs] = await Promise.all([workflowService.list(taskId), workflowService.runsForTask(taskId)]);
        setLinked(wfs);
        setLinkedRuns(rs);
      } else { setLinked([]); setLinkedRuns([]); }
    } catch (e) {
      setError(e.message);
    }
  }, [taskId]);

  useEffect(() => { setTask(null); setRun(null); setError(''); load(); }, [load]);

  const guard = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const move = (action) => {
    if (action.needsComment && !note.trim()) {
      setError('Add a note in the box below saying what needs to change, then press the button again.');
      return;
    }
    if (action.to === 'CANCELLED' && !window.confirm('Cancel this task? It will be removed from the to-do lists.')) return;
    guard(async () => { await taskService.changeStatus(taskId, action.to, note.trim() || null); setNote(''); });
  };
  const addComment = (e) => {
    e.preventDefault();
    if (note.trim()) guard(async () => { await taskService.addComment(taskId, note.trim()); setNote(''); });
  };
  const tick = (index, done) => guard(() => taskService.tick(taskId, index, done));
  const submitForm = (e) => { e.preventDefault(); guard(() => workflowService.fillForm(run.id, answers)); };
  const remove = async () => {
    if (!window.confirm('Delete this task and its history permanently?')) return;
    try { await taskService.remove(taskId); navigate(-1); } catch (e) { setError(e.message); }
  };

  if (!task) {
    return (
      <div className="page">
        <button className="link-btn back-link" onClick={() => navigate(-1)}>‹ Back</button>
        <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>
      </div>
    );
  }

  const mine = task.assignee.id === user.id;
  const canEdit = isAdmin || task.createdBy?.id === user.id;
  const turn = yourTurn(task, user, run);
  const actions = actionsFor(task, user, isAdmin);
  const isFlow = !!task.workflow;
  const formGate = isFlow && run?.needsForm && task.workflow.step === 1;
  const canFillForm = formGate && (mine || isAdmin || task.createdBy?.id === user.id);
  const checks = task.checklist || [];
  const checksDone = checks.filter((c) => c.done).length;
  const open = ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED'].includes(task.status);
  const canTick = (mine || isAdmin) && open && !formGate;

  return (
    <div className="page task-page">
      <button className="link-btn back-link" onClick={() => navigate(-1)}>‹ Back</button>

      <header className="task-page-head">
        <div>
          <p className="muted small">
            Task #{task.id}
            {isFlow && <> · {task.workflow.name} · {task.workflow.date} · run #{task.workflow.number}{run?.label && ` · ${run.label}`} · step {task.workflow.step} of {task.workflow.total}</>}
          </p>
          <h1>{task.title}</h1>
          <div className="row task-chips">
            <StatusChip status={task.status} overdue={task.overdue} />
            <span className={`prio-chip prio-chip-${task.priority.toLowerCase()}`}>{PRIORITY_LABEL[task.priority]} priority</span>
            {isFlow && <span className="repeat-badge rb-flow">FMS {task.workflow.date} · run #{task.workflow.number} · step {task.workflow.step}/{task.workflow.total}</span>}
            {task.repeat && <span className={`repeat-badge ${task.repeat === 'DAILY' ? 'rb-daily' : 'rb-weekly'}`}>{task.repeat === 'DAILY' ? 'Daily' : 'Weekly'}</span>}
          </div>
        </div>
        {!isFlow && (
          <div className="row">
            {canEdit && <button className="btn ghost small" onClick={() => setEditing(true)}>Edit</button>}
            {canEdit && <button className="btn danger-ghost small" onClick={remove}>Delete</button>}
          </div>
        )}
      </header>

      {turn && <p className="hint big-hint">{turn}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {isFlow && run?.workflowId && <FmsTaskSheet run={run} showCurrentTask={false} />}

      <div className={`task-layout ${isFlow ? 'workflow-task-layout' : ''}`}>
        {/* ---------------- main column ---------------- */}
        <div className="task-main-col">
          {(checks.length > 0 || isFlow) && (
            <section className="panel">
              <div className="perf-head">
                <h2 className="section-title">How to do it</h2>
                {checks.length > 0 && <span className={`cl-count ${checksDone === checks.length ? 'all' : ''}`}>{checksDone} of {checks.length} steps done</span>}
              </div>
              {checks.length > 0 && (
                <>
                  <div className="run-bar" aria-hidden="true"><span style={{ width: `${(100 * checksDone) / checks.length}%` }} /></div>
                  <ol className="how-list">
                    {checks.map((c, i) => (
                      <li key={i} className={c.done ? 'done' : ''}>
                        <span className="how-badge">{c.done ? '✓' : i + 1}</span>
                        <label className="how-text">
                          <input type="checkbox" checked={c.done} disabled={!canTick || busy} onChange={(e) => tick(i, e.target.checked)}
                            aria-label={`Step ${i + 1} done`} />
                          <span>{c.text}</span>
                        </label>
                        {c.doneAt && <small className="muted">{fmtDateTime(c.doneAt)}</small>}
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {task.description && <p className="how-note-box"><strong>Note:</strong> {task.description}</p>}
              {formGate && (
                <div className="workflow-form-inline">
                  <h3 className="section-title">Fill the form to start</h3>
                  <p className="muted small">This work starts after the form is filled. Every step of “{run.name}” will see these answers.</p>
                  {canFillForm ? (
                    <form className="form" onSubmit={submitForm}>
                      <DynamicForm fields={run.formFields} values={answers} onChange={setAnswers} />
                      <div className="form-actions"><button className="btn primary" disabled={busy}>Submit form and start work</button></div>
                    </form>
                  ) : <p className="muted">Waiting for {run.steps[0].assignee?.fullName} to fill the form.</p>}
                </div>
              )}
              {mine && open && checksDone < checks.length && <p className="muted small">Tick every step before marking this work done.</p>}
            </section>
          )}

          {!isFlow && task.description && checks.length === 0 && (
            <section className="panel">
              <h2 className="section-title">Details</h2>
              <p className="description">{task.description}</p>
            </section>
          )}

          {!isFlow && (
            <section className="panel">
              <div className="perf-head">
                <div>
                  <h2 className="section-title">FMS for this task</h2>
                  {linked.length === 0 && linkedRuns.length === 0 ? (
                    <p className="muted small">FMS not created for this task yet.</p>
                  ) : (
                    <p className="muted small">Open a linked FMS sheet or start a new run.</p>
                  )}
                </div>
                {linked.length === 0 && linkedRuns.length === 0 && (
                  <button className="btn primary small" onClick={() => navigate(`/workflows/new?fromTask=${task.id}`)}>
                    + Create FMS
                  </button>
                )}
              </div>
              {linked.length > 0 && (
                <ul className="linked-fms">
                  {linked.map((wf) => (
                    <li key={wf.id}>
                      <div>
                        <Link to={`/workflows/${wf.id}`} className="wf-name">{wf.name}</Link>
                        <p className="muted small">{freqText(wf)} · {wf.steps.length} steps · {wf.totalHours} h · {wf.steps.map((st) => st.assignee?.fullName).join(' → ')}</p>
                      </div>
                      <span className="row">
                        <button className="btn ghost small" onClick={() => navigate(`/workflows/${wf.id}`)}>Open sheet</button>
                        {wf.active && <button className="btn primary small" onClick={() => setStarting(wf)}>Start new</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {linkedRuns.length > 0 && (
                <div className="runs">
                  {linkedRuns.map((r) => <RunProgress key={r.id} run={r} onOpenTask={(tid) => navigate(`/tasks/${tid}`)} />)}
                </div>
              )}
            </section>
          )}

          <section className={`panel ${isFlow ? 'workflow-action-card' : ''}`}>
            {isFlow && <h2 className="section-title">Update task</h2>}
            {!isFlow && <StatusSteps status={task.status} />}
            {actions.length > 0 && (
              <div className="actions task-actions">
                {actions.map((a) => (
                  <button key={a.to + a.label} className={`btn ${a.kind}`} disabled={busy} onClick={() => move(a)}>{a.label}</button>
                ))}
              </div>
            )}
            {isFlow && actions.length === 0 && <p className="muted">This workflow step is already complete.</p>}
            {!isFlow && <form onSubmit={addComment} className="comment-box">
              <label htmlFor="note" className="section-title note-label">Notes</label>
              <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note or update. Also used as the reason when sending work back." />
              <button className="btn ghost small" disabled={busy || !note.trim()}>Add note</button>
            </form>}
          </section>

          {!isFlow && <section className="panel">
            <h2 className="section-title">History</h2>
            <ol className="timeline">
              {[...history].reverse().map((h) => (
                <li key={h.id} className={`tl tl-${h.action.toLowerCase()}`}>
                  <div>
                    <strong>{h.actorName}</strong>{' '}
                    {h.action === 'STATUS_CHANGED'
                      ? <>moved it from {STATUS_LABEL[h.fromStatus]} to <strong>{STATUS_LABEL[h.toStatus]}</strong></>
                      : ACTION_TEXT[h.action]}
                  </div>
                  {h.comment && <p className="tl-comment">{h.comment}</p>}
                  <time>{fmtDateTime(h.createdAt)}</time>
                </li>
              ))}
            </ol>
          </section>}
        </div>

        {/* ---------------- side column ---------------- */}
        {!isFlow && <aside className="task-side-col">
          <section className="panel">
            <h2 className="section-title">Details</h2>
            <dl className="facts side-facts">
              <div><dt>Assigned to</dt><dd>{mine ? 'You' : task.assignee.fullName}</dd></div>
              <div><dt>Due</dt><dd className={task.overdue ? 'text-overdue' : ''}>
                {fmtDateTime(task.dueAt)}{task.dueAt && open && ` (${relativeDue(task.dueAt)})`}</dd></div>
              {task.estimatedHours != null && <div><dt>Estimated effort</dt><dd>{task.estimatedHours} hours</dd></div>}
              <div><dt>{task.selfAdded ? 'Added by' : 'Assigned by'}</dt><dd>{task.createdBy.id === user.id ? 'You' : task.createdBy.fullName}</dd></div>
              <div><dt>Reviewed by</dt><dd>{task.reviewer ? (task.reviewer.id === user.id ? 'You' : task.reviewer.fullName) : 'No review needed'}</dd></div>
              <div><dt>Created</dt><dd>{fmtDateTime(task.createdAt)}</dd></div>
              {task.startedAt && <div><dt>Started</dt><dd>{fmtDateTime(task.startedAt)}</dd></div>}
              {task.completedAt && <div><dt>Completed</dt><dd>{fmtDateTime(task.completedAt)}</dd></div>}
            </dl>
          </section>

          {run && (
            <section className="panel">
              <h2 className="section-title">Workflow progress</h2>
              <p className="muted small run-side-sub">{run.name}{run.label && ` · ${run.label}`}</p>
              <RunProgress run={run} compact highlightTaskId={task.id} onOpenTask={(tid) => tid !== task.id && navigate(`/tasks/${tid}`)} />
            </section>
          )}
        </aside>}
      </div>

      {starting && (
        <StartRunDialog workflow={starting} sourceTaskId={task.id} onClose={() => setStarting(null)}
          onStarted={() => { setStarting(null); load(); }} />
      )}
      {editing && (task.selfAdded && !task.recurring
        ? <AddWorkForm task={task} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
        : <TaskForm task={task} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />)}
    </div>
  );
}
