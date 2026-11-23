import { isoDay } from '@/utils/format.js';

/** The server makes real copies of a repeating task this many days ahead (RecurringGenerator.DAYS_AHEAD). */
export const DAYS_AHEAD = 7;

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
export const REPEAT_LABEL = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' };

const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const atTime = (d, hhmm) => {
  const [h, m] = (hhmm || '18:00').split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m || 0, 0, 0);
};

/** Same rule as the server's WorkingDays.runsOn: does this repeating task start on this day? */
export function runsOn(tpl, day, holidays = {}) {
  const date = isoDay(day);
  if (tpl.startDate && date < tpl.startDate) return false;
  if (day.getDay() === 0 || holidays[date]) return false;
  switch (tpl.frequency) {
    case 'DAILY': return true;
    case 'WEEKLY': return tpl.dayOfWeek === DAY_NAMES[day.getDay()];
    case 'MONTHLY': return !!tpl.startDate && day.getDate() === parse(tpl.startDate).getDate();
    case 'YEARLY': {
      if (!tpl.startDate) return false;
      const s = parse(tpl.startDate);
      return day.getDate() === s.getDate() && day.getMonth() === s.getMonth();
    }
    default: return false;
  }
}

/** When the copy starting on `day` is due (same as RecurringGenerator.makeCopy). */
function dueFor(tpl, day) {
  if (tpl.scheduledTime && tpl.durationMinutes) {
    return new Date(atTime(day, tpl.scheduledTime).getTime() + tpl.durationMinutes * 60000);
  }
  return atTime(plus(day, tpl.dueDaysAfter || 0), tpl.dueTime);
}

/**
 * Calendar-only entries for repeating tasks (daily / weekly / monthly / yearly) whose real copy
 * does not exist yet because it is further ahead than the server creates copies.
 * Each entry is placed on its due date, like real tasks. Range is [from, to).
 */
export function upcomingRepeats(templates, tasks, from, to, { holidays = {}, leaves = [], employeeId = null, today = new Date() } = {}) {
  const made = new Set(tasks
    .filter((t) => t.recurringTemplateId != null && t.dueAt)
    .map((t) => `${t.recurringTemplateId}|${isoDay(new Date(t.dueAt))}`));
  const onLeave = (date) => leaves.some((l) => l.startDate <= date && l.endDate >= date);
  // copies already exist (or were skipped on purpose) for days the server has filled
  const firstOpen = isoDay(plus(today, DAYS_AHEAD));
  const entries = [];

  for (const tpl of templates) {
    if (!tpl.active) continue;
    if (employeeId != null && tpl.assignee?.id !== employeeId) continue;
    const gap = tpl.scheduledTime && tpl.durationMinutes ? 1 : (tpl.dueDaysAfter || 0);
    // a copy starting a few days before the range can still be due inside it
    for (let day = plus(from, -gap); day < to; day = plus(day, 1)) {
      const start = isoDay(day);
      // (lastGeneratedOn is not used: opening a far-off day makes its copy early and moves it ahead)
      if (start < firstOpen) continue;
      if (!runsOn(tpl, day, holidays) || onLeave(start)) continue;
      const due = dueFor(tpl, day);
      if (due < from || due >= to) continue;
      const dueDay = isoDay(due);
      if (made.has(`${tpl.id}|${dueDay}`)) continue;
      entries.push({
        id: `upcoming-repeat-${tpl.id}-${start}`,
        title: tpl.title,
        status: 'TODO',
        dueAt: due.toISOString(),
        startDate: start,
        repeat: tpl.frequency,
        templateId: tpl.id,
        upcoming: true,
      });
    }
  }
  return entries.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}
