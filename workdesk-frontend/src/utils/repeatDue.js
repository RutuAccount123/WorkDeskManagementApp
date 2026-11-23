// Repeating tasks (daily, weekly, monthly, yearly): start date + start time, due on a chosen date and time.
// The server stores the gap as dueDaysAfter (days after each start day); the forms show a real due date
// for the first time the task runs, and the same gap is used every week / month / year.
import { DAYS, isoDay } from './format.js';

/** Longest gap allowed, so a copy is due before the next one starts. */
export const MAX_DUE_DAYS = { DAILY: 0, WEEKLY: 6, MONTHLY: 27, YEARLY: 364 };

/** true when this repeat uses a due date (not minutes). */
export const usesDueDate = (frequency) => frequency in MAX_DUE_DAYS;

const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

export const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return isoDay(d); };

export const daysBetween = (fromIso, toIso) => Math.round((parse(toIso) - parse(fromIso)) / 86400000);

/** The first day the task runs: weekly = next chosen weekday from today (or the start date); else the start date. */
export function firstStartDay(frequency, dayOfWeek, startDate) {
  const from = startDate && startDate > isoDay() ? startDate : isoDay();
  if (frequency === 'DAILY') return from;
  if (frequency !== 'WEEKLY') return startDate || from;
  const want = DAYS.indexOf(dayOfWeek);                 // 0 = Monday
  const have = (parse(from).getDay() + 6) % 7;          // JS: 0 = Sunday → 0 = Monday
  return addDays(from, (want - have + 7) % 7);
}

const dayName = (iso) => parse(iso).toLocaleDateString('en-IN', { weekday: 'long' });
const dateName = (iso) => parse(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** One line for the form: "Every week it starts Monday 09:30 and is due Wednesday 17:00." */
export function dueSummary(frequency, start, startTime, dueDate, dueTime) {
  if (!start || !dueDate) return '';
  if (frequency === 'DAILY') return `Every working day it starts at ${startTime} and is due at ${dueTime} the same day.`;
  if (frequency === 'WEEKLY') {
    return `Every week it starts ${dayName(start)} ${startTime} and is due ${dayName(dueDate)} ${dueTime}.`;
  }
  const gap = daysBetween(start, dueDate);
  const when = gap === 0 ? 'the same day' : `${gap} day${gap === 1 ? '' : 's'} later`;
  return `Every ${frequency === 'MONTHLY' ? 'month' : 'year'} it starts ${dateName(start)} ${startTime} and is due ${when} at ${dueTime} (first time: ${dateName(dueDate)}).`;
}

/** Checks the chosen due date; returns an error message or ''. */
export function dueError(frequency, start, startTime, dueDate, dueTime) {
  if (!dueDate) return 'Choose the due date.';
  const gap = daysBetween(start, dueDate);
  if (gap < 0) return 'The due date cannot be before the start date.';
  if (gap > MAX_DUE_DAYS[frequency]) {
    if (frequency === 'DAILY') return 'A daily task is due on the same day it starts.';
    return `The due date must be before the next ${frequency === 'WEEKLY' ? 'week' : frequency === 'MONTHLY' ? 'month' : 'year'} starts.`;
  }
  if (gap === 0 && dueTime <= startTime) return 'The due time must be after the start time.';
  return '';
}
