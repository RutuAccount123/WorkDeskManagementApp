import { fmtTime } from '@/utils/format.js';
import { FormAnswers } from '@/components/form/DynamicForm.jsx';

const STATE_LABEL = {
  done: 'Done',
  active: 'In progress',
  todo: 'Assigned',
  late: 'Overdue',
  waiting: 'Waiting for previous step',
  form: 'Fill form to start',
  stopped: 'Stopped',
};

function stateOf(step, runStatus, needsForm) {
  const t = step.task;
  if (t && needsForm && step.step === 1) return 'form';
  if (!t) return runStatus === 'STOPPED' ? 'stopped' : 'waiting';
  if (t.status === 'COMPLETED') return 'done';
  if (t.status === 'CANCELLED') return 'stopped';
  if (t.overdue) return 'late';
  return t.status === 'IN_PROGRESS' ? 'active' : 'todo';
}

/**
 * One workflow run as a chain of steps: who does what, when it's due, what's done.
 * `onOpenTask(id)` opens a step's task; `highlightTaskId` marks the step being viewed.
 */
export default function RunProgress({ run, onOpenTask, highlightTaskId, compact = false, showAnswers = true }) {
  const done = run.steps.filter((s) => s.task?.status === 'COMPLETED').length;
  return (
    <div className={`run ${compact ? 'compact' : ''}`}>
      {!compact && (
        <div className="run-head">
          <div>
            <h3>{run.name}{run.number > 1 && <span className="muted"> #{run.number}</span>}{run.label && <span className="run-label"> · {run.label}</span>}</h3>
            <p className="muted small">Starts {run.startTime}, ends by {run.endTime}</p>
          </div>
          <span className={`run-status rs-${run.needsForm ? 'form' : run.status.toLowerCase()}`}>
            {run.needsForm ? 'Waiting for form' : run.status === 'DONE' ? 'All steps done' : run.status === 'STOPPED' ? 'Stopped' : `Step ${run.currentStep} of ${run.totalSteps}`}
          </span>
        </div>
      )}
      {!compact && showAnswers && run.formData && run.formFields.length > 0 && (
        <details className="run-answers">
          <summary>Form details</summary>
          <FormAnswers fields={run.formFields} values={run.formData} />
        </details>
      )}
      <div className="run-bar" aria-hidden="true"><span style={{ width: `${(100 * done) / run.totalSteps}%` }} /></div>
      <ol className="run-steps">
        {run.steps.map((s) => {
          const state = stateOf(s, run.status, run.needsForm);
          const clickable = s.task && onOpenTask;
          const Body = clickable ? 'button' : 'div';
          return (
            <li key={s.step} className={`run-step st-${state} ${s.task && s.task.id === highlightTaskId ? 'is-current' : ''}`}>
              <span className="run-num">{state === 'done' ? '✓' : s.step}</span>
              <Body className="run-body" {...(clickable ? { onClick: () => onOpenTask(s.task.id), type: 'button' } : {})}>
                <strong>{s.title}</strong>
                <span className="run-meta">
                  <span>{s.assignee?.fullName}</span>
                  <span>{s.hours} h</span>
                  {s.task?.completedAt
                    ? <span>finished {fmtTime(s.task.completedAt)}</span>
                    : s.task?.dueAt && <span className={state === 'late' ? 'text-overdue' : ''}>due {fmtTime(s.task.dueAt)}</span>}
                </span>
              </Body>
              <span className={`run-state rst-${state}`}>{STATE_LABEL[state]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
