import { MAX_DUE_DAYS, addDays, daysBetween, dueSummary } from '@/utils/repeatDue.js';

/**
 * Repeating task (daily / weekly / monthly / yearly): Start date + Start time, then Due date + Due time.
 * startDate / onStartDate: the date typed in the form (monthly / yearly: the day it repeats on).
 * start = the first day it actually runs; gap = days from each start to its due date (dueDaysAfter on the server).
 * The due date shows the first time it runs; changing the start keeps the gap, so the due date moves along.
 */
export default function RepeatDueFields({
  frequency, startDate, onStartDate, start, startTime, onStartTime, gap, onGap, dueTime, onDueTime,
}) {
  const max = MAX_DUE_DAYS[frequency] ?? 0;
  const dueDate = addDays(start, Number(gap) || 0);
  return (
    <>
      <div className="grid-2">
        <label>Start date
          <input type="date" value={startDate} onChange={(e) => onStartDate(e.target.value)} required />
        </label>
        <label>Start time
          <input type="time" value={startTime} onChange={(e) => onStartTime(e.target.value)} required />
        </label>
      </div>
      <div className="grid-2">
        <label>Due date
          <input type="date" value={dueDate} min={start} max={addDays(start, max)} required disabled={max === 0}
            onChange={(e) => e.target.value && onGap(daysBetween(start, e.target.value))} />
        </label>
        <label>Due time
          <input type="time" value={dueTime} onChange={(e) => onDueTime(e.target.value)} required />
        </label>
      </div>
      <p className="muted small">{dueSummary(frequency, start, startTime, dueDate, dueTime)}</p>
    </>
  );
}
