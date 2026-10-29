import { STATUS_LABEL } from '@/utils/format.js';

// One coloured label per status. The words come from STATUS_LABEL so every screen says the same thing.
// Overdue open work shows as "Overdue".
const CLASS = {
  TODO: 'chip-todo', IN_PROGRESS: 'chip-progress', SUBMITTED: 'chip-review',
  COMPLETED: 'chip-done', REOPENED: 'chip-back', CANCELLED: 'chip-cancel',
};

export default function StatusChip({ status, overdue = false, short = false }) {
  if (overdue && status !== 'COMPLETED' && status !== 'CANCELLED') {
    return <span className="chip chip-late">Overdue</span>;
  }
  const cls = CLASS[status] || 'chip-cancel';
  const label = STATUS_LABEL[status] || status;
  return <span className={`chip ${cls}`}>{short && status === 'SUBMITTED' ? 'For review' : label}</span>;
}
