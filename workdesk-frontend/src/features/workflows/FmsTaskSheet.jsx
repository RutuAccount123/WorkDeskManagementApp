import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskService, workflowService } from '@/services/index.js';
import { addDays, fmtDateTime, isoDay, STATUS_LABEL } from '@/utils/format.js';
import { answerText, csvCell, delayText, freqText, RUN_STATUS_LABEL } from './workflowFormat.js';
import StatusChip from '@/components/ui/StatusChip.jsx';
import DynamicForm from '@/components/form/DynamicForm.jsx';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { actionsFor } from '@/features/tasks/taskActions.js';

function downloadTracker(workflow, runs, fields, from, to) {
  const frequency = freqText(workflow);
  const sheetRows = [
    ['FMS sheet', workflow.name],
    ['What', workflow.description || 'Work is started', ...workflow.steps.map((step) => step.title)],
    ['Who', `${workflow.steps[0]?.assignee?.fullName || ''} fills the form`, ...workflow.steps.map((step) => step.assignee?.fullName || '')],
    [
      'How',
      fields.map((field) => `${field.label}${field.required ? ' *' : ''}`).join('; ') || 'No form',
      ...workflow.steps.map((step) => [step.checklist?.join('; '), step.how].filter(Boolean).join('; ') || '—'),
    ],
    [
      'When',
      `${frequency}, from ${workflow.startTime}`,
      ...workflow.steps.map((step, index) => `Within ${step.hours} hrs ${index === 0 ? 'of start' : `of step ${index} done`}`),
    ],
    [],
  ];
  const headers = [
    'Run number', 'Date', 'Started at', 'Run status',
    ...fields.map((field) => field.label),
    ...workflow.steps.flatMap((step) => [
      `Step ${step.step}: ${step.title} - Planned`,
      `Step ${step.step}: ${step.title} - Actual`,
      `Step ${step.step}: ${step.title} - Status`,
      `Step ${step.step}: ${step.title} - Time delay`,
    ]),
  ];
  const rows = runs.map((run) => [
    run.number, run.date, fmtDateTime(run.startedAt), RUN_STATUS_LABEL[run.status] || run.status,
    ...fields.map((field) => answerText(field, run.formData?.[field.id])),
    ...run.steps.flatMap((step) => {
      const status = !step.task ? 'Waiting' : step.actual ? 'Done' : STATUS_LABEL[step.task.status] || step.task.status;
      const delay = step.planned && (step.actual || step.delayMinutes > 0) ? delayText(step.delayMinutes) : '';
      return [step.planned ? fmtDateTime(step.planned) : '', step.actual ? fmtDateTime(step.actual) : '', status, delay];
    }),
  ]);
  const csv = [...sheetRows, headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = workflow.name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, '-');
  link.href = url;
  link.download = `${filename || 'fms-tracker'}_${from}_to_${to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function FmsTaskSheet({ run, workflowId, showCurrentTask = true, heading }) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const currentWorkflowId = run?.workflowId || workflowId;
  const [workflow, setWorkflow] = useState(null);
  const [runs, setRuns] = useState(null);
  const [from, setFrom] = useState(() => isoDay(addDays(new Date(), -30)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [runTaskDetails, setRunTaskDetails] = useState({});
  const [loadingRunId, setLoadingRunId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [activeRun, setActiveRun] = useState(null);
  const activeTaskIdRef = useRef(null);
  const [waitingStep, setWaitingStep] = useState(null);
  const [activeTaskError, setActiveTaskError] = useState('');
  const [activeTaskBusy, setActiveTaskBusy] = useState(false);
  const [activeFormAnswers, setActiveFormAnswers] = useState({});
  const [actionComment, setActionComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setWorkflow(null);
    setRuns(null);
    setError('');
    Promise.all([
      workflowService.get(currentWorkflowId),
      workflowService.tracker(currentWorkflowId, from, to),
    ]).then(([definition, history]) => {
      if (!active) return;
      setWorkflow(definition);
      setRuns(history);
    }).catch((e) => {
      if (active) setError(e.message);
    });
    return () => { active = false; };
  }, [currentWorkflowId, from, to]);

  useEffect(() => {
    let active = true;
    const candidates = (runs || []).flatMap((entry) => entry.steps
      .filter((step) => step.task?.id && (step.assignee?.id === user.id || isAdmin))
      .map((step) => ({ entry, step })));
    const current = candidates.find(({ step }) =>
      ['TODO', 'IN_PROGRESS', 'REOPENED', 'SUBMITTED'].includes(step.task.status));
    const waiting = !current && !isAdmin
      ? (runs || []).flatMap((entry) => entry.steps.map((step, index) => {
        const previousStep = index > 0 ? entry.steps[index - 1] : null;
        return {
          entry,
          step,
          previousStep,
          index,
        };
      })).find(({ entry, step, previousStep, index }) => (
        entry.status !== 'DONE'
        && index > 0
        && step.assignee?.id === user.id
        && !step.task
        && previousStep?.task
        && previousStep.task.status !== 'COMPLETED'
      ))
      : null;

    setActiveRun(current?.entry || null);
    setWaitingStep(waiting || null);
    // same step as before (e.g. after ticking a box): keep it on screen while it refreshes, no flicker
    const sameTask = current && activeTaskIdRef.current === current.step.task.id;
    if (!sameTask) {
      setActiveTask(null);
      setActiveTaskError('');
      setActiveFormAnswers({});
      setActionComment('');
    }
    activeTaskIdRef.current = current?.step.task.id ?? null;
    if (!current) return () => { active = false; };

    taskService.get(current.step.task.id).then((task) => {
      if (active) setActiveTask(task);
    }).catch((e) => {
      if (active) setActiveTaskError(e.message);
    });
    return () => { active = false; };
  }, [runs, user.id, isAdmin]);

  const refreshActiveTask = async () => {
    if (!activeTask) return;
    setActiveTask(await taskService.get(activeTask.id));
    const refreshedRuns = await workflowService.tracker(currentWorkflowId, from, to);
    setRuns(refreshedRuns);
  };

  const updateActiveTask = async (action) => {
    if (action.needsComment && !actionComment.trim()) {
      setActiveTaskError('Add a comment before sending this task back.');
      return;
    }
    if (action.to === 'COMPLETED' && activeTask.checklist?.some((item) => !item.done)) {
      setActiveTaskError('Complete every checklist item before marking this work done.');
      return;
    }
    setActiveTaskBusy(true);
    setActiveTaskError('');
    try {
      await taskService.changeStatus(activeTask.id, action.to, actionComment.trim() || null);
      setActionComment('');
      await refreshActiveTask();
    } catch (e) {
      setActiveTaskError(e.message);
    } finally {
      setActiveTaskBusy(false);
    }
  };

  const tickActiveTask = async (index, done) => {
    setActiveTaskBusy(true);
    setActiveTaskError('');
    try {
      await taskService.tick(activeTask.id, index, done);
      await refreshActiveTask();
    } catch (e) {
      setActiveTaskError(e.message);
    } finally {
      setActiveTaskBusy(false);
    }
  };

  const submitActiveForm = async (event) => {
    event.preventDefault();
    setActiveTaskBusy(true);
    setActiveTaskError('');
    try {
      await workflowService.fillForm(activeRun.id, activeFormAnswers);
      await refreshActiveTask();
    } catch (e) {
      setActiveTaskError(e.message);
    } finally {
      setActiveTaskBusy(false);
    }
  };

  const toggleRunDetails = async (entry) => {
    if (expandedRunId === entry.id) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(entry.id);
    if (runTaskDetails[entry.id]) return;

    setLoadingRunId(entry.id);
    const taskSteps = entry.steps.filter((step) => step.task?.id);
    const results = await Promise.all(taskSteps.map(async (step) => {
      try {
        return [step.task.id, { task: await taskService.get(step.task.id) }];
      } catch (e) {
        return [step.task.id, { error: e.message }];
      }
    }));
    setRunTaskDetails((current) => ({ ...current, [entry.id]: Object.fromEntries(results) }));
    setLoadingRunId(null);
  };

  if (error) return <section className="panel"><p className="error">{error}</p></section>;
  if (!workflow || !runs) return <section className="panel"><p className="muted">Loading FMS sheet…</p></section>;

  const fields = workflow.formFields || [];
  return (
    <section className="panel fms-task-sheet">
      <div className="perf-head">
        <div>
          <h2 className="section-title">{heading || `${workflow.name} · FMS sheet`}</h2>
          <p className="muted small">{runs.length} date-wise entries in selected dates</p>
        </div>
        <div className="row">
          <div className="row tracker-range">
            <label>From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
            <label>To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          <button className="btn ghost small" onClick={() => downloadTracker(workflow, runs, fields, from, to)} disabled={!runs.length}>
            Export Excel
          </button>
        </div>
      </div>
      <div className="fms-scroll">
        <table className="fms-grid read tracker fms-combined">
          <thead>
            <tr className="fms-sheet-header">
              <th className="fms-rowhead" />
              <th colSpan={1 + fields.length} className="fms-col trigger">Start entry</th>
              {workflow.steps.map((step) => (
                <th key={step.step} colSpan={4} className="fms-col tk-group">
                  <span className="fms-colnum">{step.step}</span> {step.title}
                </th>
              ))}
            </tr>
            <tr className="fms-definition-row">
              <th className="fms-rowhead">What</th>
              <td colSpan={1 + fields.length} className="trigger">{workflow.description || 'Work is started'}</td>
              {workflow.steps.map((step) => <td key={step.step} colSpan={4}><strong>{step.title}</strong></td>)}
            </tr>
            <tr className="fms-definition-row">
              <th className="fms-rowhead">Who</th>
              <td colSpan={1 + fields.length} className="trigger">{workflow.steps[0]?.assignee?.fullName} fills the form</td>
              {workflow.steps.map((step) => <td key={step.step} colSpan={4}>{step.assignee?.fullName || '—'}</td>)}
            </tr>
            <tr className="fms-definition-row">
              <th className="fms-rowhead">How</th>
              <td colSpan={1 + fields.length} className="trigger">
                {fields.length ? <ol className="how-read">{fields.map((field) => <li key={field.id}>{field.label}{field.required && ' *'}</li>)}</ol> : 'No form'}
              </td>
              {workflow.steps.map((step) => (
                <td key={step.step} colSpan={4}>
                  {step.checklist?.length > 0 && <ol className="how-read">{step.checklist.map((item, index) => <li key={index}>{item}</li>)}</ol>}
                  {step.how && <p className="muted small how-note-read">{step.how}</p>}
                  {!step.checklist?.length && !step.how && '—'}
                </td>
              ))}
            </tr>
            <tr className="fms-definition-row">
              <th className="fms-rowhead">When</th>
              <td colSpan={1 + fields.length} className="trigger">
                {freqText(workflow)}, from {workflow.startTime}
              </td>
              {workflow.steps.map((step, index) => (
                <td key={step.step} colSpan={4}>Within {step.hours} hrs <span className="muted small">{index === 0 ? 'of start' : `of step ${index} done`}</span></td>
              ))}
            </tr>
            <tr>
              <th rowSpan={2}>Step details</th>
              <th rowSpan={2} className="tk-sticky">#</th>
              <th rowSpan={2}>Timestamp</th>
              {fields.map((field) => <th key={field.id} rowSpan={2}>{field.label}</th>)}
              {workflow.steps.map((step) => <th key={step.step} colSpan={4} className="tk-group">Step {step.step}: {step.title}</th>)}
            </tr>
            <tr>
              {workflow.steps.flatMap((step) => ['Planned', 'Actual', 'Status', 'Time delay'].map((heading) => (
                <th key={`${step.step}-${heading}`} className={`tk-sub ${heading === 'Planned' ? 'tk-first' : ''}`}>{heading}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {runs.map((entry, index) => (
              <Fragment key={entry.id}>
              <tr className={entry.status === 'STOPPED' ? 'tk-cancelled' : ''}>
                <td>
                  <button className="link-btn small" type="button" aria-expanded={expandedRunId === entry.id}
                    onClick={() => toggleRunDetails(entry)}>
                    {expandedRunId === entry.id ? 'Hide' : 'View'}
                  </button>
                </td>
                <td className="tk-sticky">{runs.length - index}</td>
                <td className="nowrap">{entry.startedAt ? fmtDateTime(entry.startedAt) : entry.date}</td>
                {fields.map((field) => <td key={field.id}>{answerText(field, entry.formData?.[field.id])}</td>)}
                {entry.steps.map((step) => {
                  const status = !step.task ? 'Waiting' : step.actual ? 'Done' : STATUS_LABEL[step.task.status] || step.task.status;
                  const stateClass = status === 'Done' ? 'ok' : status === 'Waiting' ? 'wait' : step.task?.overdue ? 'late' : 'run';
                  const openTask = () => step.task && navigate(`/tasks/${step.task.id}`);
                  const delay = step.planned && (step.actual || step.delayMinutes > 0) ? delayText(step.delayMinutes) : '';
                  return [
                    <td key="planned" className={`nowrap tk-first ${step.task ? 'tk-link' : ''}`} onClick={openTask}>{step.planned ? fmtDateTime(step.planned) : ''}</td>,
                    <td key="actual" className={`nowrap ${step.task ? 'tk-link' : ''}`} onClick={openTask}>{step.actual ? fmtDateTime(step.actual) : ''}</td>,
                    <td key="status" className={step.task ? 'tk-link' : ''} onClick={openTask}>
                      <span className={`tk-state ${stateClass}`}>{status}</span>
                    </td>,
                    <td key="delay" className={`nowrap ${step.delayMinutes > 0 ? 'tk-late' : step.delayMinutes != null && step.actual ? 'tk-early' : ''}`}>{delay}</td>,
                  ];
                })}
              </tr>
              {expandedRunId === entry.id && (
                <tr className="fms-run-details-row">
                  <td colSpan={3 + fields.length + workflow.steps.length * 4}>
                    {loadingRunId === entry.id ? <p className="muted">Loading step details…</p> : (
                      <div className="fms-run-details">
                        {entry.steps.map((step) => {
                          const detail = step.task?.id ? runTaskDetails[entry.id]?.[step.task.id] : null;
                          const task = detail?.task;
                          const checklist = task?.checklist || [];
                          const instructions = task?.description || step.how;
                          const status = task?.status || step.task?.status;
                          return (
                            <section key={step.step} className="fms-run-step">
                              <div className="fms-run-step-head">
                                <div>
                                  <strong>Step {step.step}: {step.title}</strong>
                                  <p className="muted small">{step.assignee?.fullName || 'Unassigned'}</p>
                                </div>
                                {status && <StatusChip status={status} overdue={step.task?.overdue} />}
                                {step.task?.id && (
                                  <button className="btn ghost small" type="button" onClick={() => navigate(`/tasks/${step.task.id}`)}>
                                    Open task
                                  </button>
                                )}
                              </div>
                              {(step.planned || step.actual) && (
                                <p className="muted small">
                                  {step.planned && `Planned: ${fmtDateTime(step.planned)}`}
                                  {step.actual && ` · Done: ${fmtDateTime(step.actual)}`}
                                </p>
                              )}
                              {instructions && <p className="fms-run-instructions"><strong>How to do it:</strong> {instructions}</p>}
                              {detail?.error && <p className="error small">Could not load this task’s checklist: {detail.error}</p>}
                              {checklist.length > 0 && (
                                <ul className="fms-run-checklist">
                                  {checklist.map((item, checklistIndex) => (
                                    <li key={checklistIndex} className={item.done ? 'done' : ''}>
                                      <span>{item.done ? '✓' : '○'} {item.text}</span>
                                      {item.doneAt && <small className="muted">{fmtDateTime(item.doneAt)}</small>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {runs.length === 0 && (
              <tr><td colSpan={3 + fields.length + workflow.steps.length * 4} className="empty">No entries in these dates.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {showCurrentTask && <section className="fms-current-task">
        <div className="perf-head">
          <div>
            <h2 className="section-title">How to do this work</h2>
            {activeTask && <p className="muted small">Step {activeTask.workflow.step} of {activeTask.workflow.total}: {activeTask.title}</p>}
          </div>
          {activeTask && <StatusChip status={activeTask.status} overdue={activeTask.overdue} />}
        </div>
        {activeTaskError && <p className="error" role="alert">{activeTaskError}</p>}
        {!activeTask && !waitingStep && !activeTaskError && <p className="muted">No workflow task is currently assigned to you.</p>}
        {!activeTask && waitingStep && (
          <div className="fms-waiting-step">
            <h3 className="section-title">Your next step: {waitingStep.step.title}</h3>
            <p className="muted small">
              Step {waitingStep.index + 1} is not assigned yet. It will be assigned after
              {' '}{waitingStep.previousStep.assignee?.fullName || 'the previous person'} completes
              {' '}“{waitingStep.previousStep.title}”.
            </p>
            {waitingStep.step.how && <p className="fms-current-instructions">{waitingStep.step.how}</p>}
            {waitingStep.step.checklist.length > 0 && (
              <ul className="fms-run-checklist">
                {waitingStep.step.checklist.map((item, index) => (
                  <li key={index}><span className="check"><span>{item}</span></span></li>
                ))}
              </ul>
            )}
            <p className="muted small">Done and next-step actions will appear here once this step is assigned to you.</p>
          </div>
        )}
        {activeTask && (
          <>
            {activeTask.description && <p className="fms-current-instructions">{activeTask.description}</p>}
            {(activeTask.checklist || []).length > 0 && (
              <ul className="fms-run-checklist">
                {activeTask.checklist.map((item, index) => (
                  <li key={index} className={item.done ? 'done' : ''}>
                    <label className="check">
                      <input type="checkbox" checked={item.done} disabled={activeTaskBusy || activeTask.status === 'COMPLETED' || activeTask.status === 'CANCELLED'}
                        onChange={(event) => tickActiveTask(index, event.target.checked)} />
                      <span>{item.text}</span>
                    </label>
                    {item.doneAt && <small className="muted">{fmtDateTime(item.doneAt)}</small>}
                  </li>
                ))}
              </ul>
            )}
            {activeRun?.needsForm && activeTask.workflow?.step === 1 && (
              <form className="form fms-active-form" onSubmit={submitActiveForm}>
                <h3 className="section-title">Fill the form to start</h3>
                <DynamicForm fields={activeRun.formFields} values={activeFormAnswers} onChange={setActiveFormAnswers} />
                <button className="btn primary" disabled={activeTaskBusy}>Submit form and start work</button>
              </form>
            )}
            {actionsFor(activeTask, user, isAdmin).some((action) => action.needsComment) && (
              <label className="fms-action-comment">Reason
                <textarea rows={2} value={actionComment} onChange={(event) => setActionComment(event.target.value)} />
              </label>
            )}
            {!(activeRun?.needsForm && activeTask.workflow?.step === 1) && <div className="actions task-actions">
              {actionsFor(activeTask, user, isAdmin).map((action) => (
                <button key={action.to} className={`btn ${action.kind}`} disabled={activeTaskBusy
                  || action.to === 'COMPLETED' && activeTask.checklist?.some((item) => !item.done)}
                  onClick={() => updateActiveTask(action)}>
                  {action.label}
                </button>
              ))}
              {actionsFor(activeTask, user, isAdmin).length === 0 && <span className="muted small">No task actions available.</span>}
            </div>}
          </>
        )}
      </section>}
    </section>
  );
}
