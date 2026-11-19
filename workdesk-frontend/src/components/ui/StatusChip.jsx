import { STATUS_LABEL } from '@/utils/format.js';

// One coloured label per status. The words come from STATUS_LABEL so every screen says the same thing.
// Open work with an open ticket shows as "Pending"; overdue open work shows as "Overdue".
const CLASS = {
  TODO: 'chip-todo', IN_PROGRESS: 'chip-progress', SUBMITTED: 'chip-review',
  COMPLETED: 'chip-done', REOPENED: 'chip-back', CANCELLED: 'chip-cancel',
};

export default function StatusChip({ status, overdue = false, pending = false, onLeave = false, short = false }) {
  const closed = status === 'COMPLETED' || status === 'CANCELLED';
  if (pending && !closed) {
    return <span className="chip chip-pending" title="Waiting on a ticket raised to someone">Pending</span>;
  }
  if (onLeave && !closed) {
    return <span className="chip chip-leave" title="Due on a leave day: the person chooses to do it later or skip it">On leave</span>;
  }
  if (overdue && status !== 'COMPLETED' && status !== 'CANCELLED') {
    return <span className="chip chip-late">Overdue</span>;
  }
  const cls = CLASS[status] || 'chip-cancel';
  const label = STATUS_LABEL[status] || status;
  return <span className={`chip ${cls}`}>{short && status === 'SUBMITTED' ? 'For review' : label}</span>;
}
