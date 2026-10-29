import { STATUS_LABEL } from '@/utils/format.js';

// The real lifecycle of a task, shown as a 4-step strip.
const STEPS = ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED'];

export default function StatusSteps({ status, compact = false }) {
  if (status === 'CANCELLED') return <span className="pill pill-cancel">Cancelled</span>;
  const reopened = status === 'REOPENED';
  const reached = reopened ? 0 : STEPS.indexOf(status);

  return (
    <div className={`steps ${compact ? 'compact' : ''} ${reopened ? 'reopened' : ''}`}
      role="img" aria-label={`Status: ${STATUS_LABEL[status]}`}>
      {STEPS.map((s, i) => (
        <span key={s} className={`step ${i <= reached ? 'on' : ''} ${i === reached ? 'current' : ''}`}>
          {!compact && <span className="step-label">{i === 0 && reopened ? 'Sent back' : STATUS_LABEL[s]}</span>}
        </span>
      ))}
    </div>
  );
}
