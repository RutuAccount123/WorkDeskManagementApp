// Display helpers. Times are shown in the browser's local time zone (India for this team).

/** The ONE set of status words used everywhere: chips, steps, history, calendar, exports. */
export const STATUS_LABEL = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Waiting for review',
  COMPLETED: 'Done',
  REOPENED: 'Sent back',
  CANCELLED: 'Cancelled',
};

export const PRIORITY_LABEL = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
export const dayLabel = (d) => (typeof d === 'string' && d.trim()
  ? d.charAt(0) + d.slice(1).toLowerCase()
  : '—');

const dtFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const fmtDateTime = (iso) => (iso ? dtFmt.format(new Date(iso)) : '—');
export const fmtDate = (iso) => (iso ? dFmt.format(new Date(iso)) : '—');

export function relativeDue(iso) {
  if (!iso) return 'No due date';
  const diffMin = Math.round((new Date(iso) - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  const unit = abs < 60 ? `${abs} min` : abs < 48 * 60 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} days`;
  return diffMin < 0 ? `${unit} late` : `in ${unit}`;
}

/** yyyy-mm-dd for <input type="date"> in local time. */
export function isoDay(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

/** Converts an API Instant to the "yyyy-mm-ddThh:mm" value a datetime-local input needs. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16);
}

/** Sorts tasks into deadline lanes. */
export function laneOf(task) {
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return 'closed';
  if (!task.dueAt) return 'nodate';
  if (task.overdue) return 'overdue';
  const due = new Date(task.dueAt);
  const now = new Date();
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const endWeek = new Date(endToday.getTime() + 6 * 86400000);
  if (due < endToday) return 'today';
  if (due < endWeek) return 'week';
  return 'later';
}

export const LANES = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'today', title: 'Due today' },
  { key: 'week', title: 'Next 7 days' },
  { key: 'later', title: 'Later' },
  { key: 'nodate', title: 'No due date' },
  { key: 'closed', title: 'Done and cancelled' },
];

// ---------- calendar helpers (local time) ----------
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
/** Monday of the week containing d. */
export const startOfWeek = (d) => { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); };
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const sameDay = (a, b) => isoDay(a) === isoDay(b);
export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const fromMonthKey = (k) => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1); };

const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const monthShortFmt = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
export const fmtMonth = (d) => monthFmt.format(d);
export const fmtMonthShort = (d) => monthShortFmt.format(d);
export const fmtDayLong = (d) => dayFmt.format(d);
export const fmtTime = (iso) => (iso ? timeFmt.format(new Date(iso)) : '');

/** The day a piece of work belongs to: its due date, or the day it was added. */
export const workDate = (t) => new Date(t.dueAt || t.createdAt);

/** Groups used on the Day view and in counts. */
export function statusGroup(t) {
  if (t.status === 'COMPLETED') return 'done';
  if (t.status === 'IN_PROGRESS' || t.status === 'SUBMITTED') return 'progress';
  if (t.status === 'CANCELLED') return 'cancelled';
  return 'todo';
}
export const GROUPS = [
  { key: 'todo', title: 'To do' },
  { key: 'progress', title: 'In progress' },
  { key: 'done', title: 'Done' },
];
