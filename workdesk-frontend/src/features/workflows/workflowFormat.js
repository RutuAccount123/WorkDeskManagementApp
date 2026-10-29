// Small display helpers shared by every FMS screen, so they all read the same way.
import { dayLabel, fmtDate } from '@/utils/format.js';

/** "Every working day" / "Every Monday" / "Only when started". */
export const freqText = (wf) =>
  wf.frequency === 'DAILY' ? 'Every working day' : wf.frequency === 'WEEKLY' ? `Every ${dayLabel(wf.dayOfWeek)}` : 'Only when started';

/** "+1h 20m" late / "−35m" early / "0m" on time. */
export function delayText(min) {
  if (min == null) return '';
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${min > 0 ? '+' : min < 0 ? '−' : ''}${h ? `${h}h ` : ''}${m}m`;
}

/** A form answer as text: Yes/No for tick boxes, dates like "27 Oct 2026", blank when empty. */
export const answerText = (field, value) => {
  if (field.type === 'checkbox') return value ? 'Yes' : 'No';
  if (value == null || value === '') return '';
  if (field.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return fmtDate(`${value}T00:00`);
  return String(value);
};

/** One CSV cell, quoted, and safe to open in Excel (no formula injection). */
export const csvCell = (value) => {
  const text = value == null ? '' : String(value);
  const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

/** Run status in plain words. */
export const RUN_STATUS_LABEL = { RUNNING: 'Running', DONE: 'All steps done', STOPPED: 'Stopped' };
