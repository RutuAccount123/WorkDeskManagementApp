import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskService, holidayService, leaveService, reportService, workflowService, recurringService } from '@/services/index.js';
import StatusChip from '@/components/ui/StatusChip.jsx';
import {
  GROUPS, PRIORITY_LABEL, STATUS_LABEL, addDays, fmtDate, fmtDateTime, fmtDayLong, fmtMonth, fmtMonthShort, fmtTime, fromMonthKey,
  isoDay, sameDay, startOfDay, startOfMonth, startOfWeek, statusGroup, workDate,
} from '@/utils/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { groupFmsTasks } from '@/features/tasks/taskGroups.js';
import { scheduledFmsForWeek } from './scheduledFms.js';
import { REPEAT_LABEL, upcomingRepeats } from './scheduledRepeats.js';
import TaskPdfExport from '@/components/TaskPdfExport.jsx';

const VIEWS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const OPEN = ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED'];

/** The day a task is shown on: unfinished work from earlier days is carried over to today. */
const shownDate = (t) => (t.carriedOver ? startOfDay(new Date()) : workDate(t));
/** The day a task was scheduled for (its due date, or the day it was added). */
const plannedDate = (t) => new Date(t.dueAt || t.createdAt);

/** Date range [from, to) shown for a view. */
function rangeFor(view, anchor) {
  if (view === 'day') return [startOfDay(anchor), addDays(startOfDay(anchor), 1)];
  if (view === 'week') { const s = startOfWeek(anchor); return [s, addDays(s, 7)]; }
  if (view === 'month') {
    const s = startOfMonth(anchor);
    return [s, new Date(s.getFullYear(), s.getMonth() + 1, 1)];
  }
  return [new Date(anchor.getFullYear(), 0, 1), new Date(anchor.getFullYear() + 1, 0, 1)];
}

function titleFor(view, anchor) {
  if (view === 'day') return sameDay(anchor, new Date()) ? `Today, ${fmtDayLong(anchor)}` : fmtDayLong(anchor);
  if (view === 'week') {
    const s = startOfWeek(anchor);
    const e = addDays(s, 6);
    return `${s.getDate()} ${fmtMonthShort(s)} – ${e.getDate()} ${fmtMonthShort(e)} ${e.getFullYear()}`;
  }
  if (view === 'month') return fmtMonth(anchor);
  return String(anchor.getFullYear());
}

function move(view, anchor, dir) {
  if (view === 'day') return addDays(anchor, dir);
  if (view === 'week') return addDays(anchor, 7 * dir);
  if (view === 'month') return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  return new Date(anchor.getFullYear() + dir, 0, 1);
}

/** Small clickable line for one task. */
function WorkItem({ t, onOpen, showTime = true }) {
  const g = statusGroup(t);
  const title = t.workflow?.name || t.title;
  return (
    <button className={`work-item wi-${g} ${t.overdue ? 'wi-late' : ''}`} onClick={() => onOpen(t.id)}
      title={`${title} — ${STATUS_LABEL[t.status]}${t.overdue ? ', overdue' : ''}`}>
      <span className="wi-dot" aria-hidden="true" />
      <span className="wi-title">{t.repeat && <span className="wi-repeat" title={`${REPEAT_LABEL[t.repeat] || 'Repeating'} task`}>↻ </span>}{title}</span>
      {showTime && g === 'done' && t.completedAt
        ? <span className="wi-time" title="Done at">✓ {fmtTime(t.completedAt)}</span>
        : showTime && g === 'progress' && t.startedAt
          ? <span className="wi-time" title={`Started at${t.dueAt ? `, due ${fmtDateTime(t.dueAt)}` : ''}`}>▶ {fmtTime(t.startedAt)}</span>
          : showTime && t.dueAt && <span className="wi-time">{fmtTime(t.dueAt)}</span>}
      {t.overdue && <span className="sr-only">overdue</span>}
    </button>
  );
}

function ScheduledFmsItem({ item, onOpen }) {
  return (
    <button className="work-item wi-scheduled" onClick={() => onOpen(item.workflow.id)}
      title={`${item.title} — open FMS sheet`}>
      <span className="wi-dot" aria-hidden="true" />
      <span className="wi-title">{item.title}</span>
      <span className="wi-time">Scheduled · {fmtTime(item.dueAt)}</span>
    </button>
  );
}

/** A repeating task's future copy that the server has not created yet (it makes copies 7 days ahead). */
function UpcomingRepeatItem({ item, onOpen }) {
  const label = REPEAT_LABEL[item.repeat] || 'Repeating';
  return (
    <button className="work-item wi-scheduled wi-upcoming" onClick={() => onOpen(item)}
      title={`${item.title}: ${label.toLowerCase()} task. Click to open it.`}>
      <span className="wi-dot" aria-hidden="true" />
      <span className="wi-title"><span className="wi-repeat">↻ </span>{item.title}</span>
      <span className="wi-time">{label} · {fmtTime(item.dueAt)}</span>
    </button>
  );
}

/** When the work really happened, for a task shown on its scheduled day but done / started on another. */
function actualLabel(t) {
  if (statusGroup(t) === 'done' && t.completedAt) return `Done ${fmtDateTime(t.completedAt)}`;
  if (t.startedAt) return `Started ${fmtDateTime(t.startedAt)}`;
  return STATUS_LABEL[t.status];
}

/** A task on its scheduled day, when it was started or finished on another day. Opens the real task. */
function PlannedItem({ t, onOpen }) {
  const title = t.workflow?.name || t.title;
  return (
    <button className={`work-item wi-${statusGroup(t)} wi-planned`} onClick={() => onOpen(t.taskId)}
      title={`${title}: scheduled for this day — ${STATUS_LABEL[t.status]}, ${actualLabel(t).toLowerCase()}`}>
      <span className="wi-dot" aria-hidden="true" />
      <span className="wi-title">{t.repeat && <span className="wi-repeat">↻ </span>}{title}</span>
      <span className="wi-time">{statusGroup(t) === 'done' ? '✓' : '▶'} {actualLabel(t).replace(/^(Done|Started) /, '')}</span>
    </button>
  );
}

function Counts({ list }) {
  list = list.filter((t) => !t.plannedCopy && !t.upcoming && !t.scheduled);
  if (!list.length) return null;
  const done = list.filter((t) => statusGroup(t) === 'done').length;
  return <span className="muted small">{done}/{list.length} done</span>;
}

// ------------------------------------------------------------------ views

/** The leave covering this day, if any. */
const leaveOn = (leaves, day) => {
  const d = isoDay(day);
  return leaves.find((l) => l.startDate <= d && l.endDate >= d) || null;
};

function DayView({ tasks, planned = [], upcoming = [], onOpen, onOpenUpcoming, holiday, isSunday, leave }) {
  return (
    <>
    {leave && <p className="holiday-banner leave">🌴 On leave{leave.reason && `: ${leave.reason}`}. No repeating tasks are created on this day.</p>}
    {holiday && <p className="holiday-banner">🎉 Office holiday: <strong>{holiday.name}</strong>{holiday.note && ` — ${holiday.note}`}</p>}
    {!holiday && isSunday && <p className="holiday-banner off">Sunday, weekly off</p>}
    <div className="day-cols">
      {GROUPS.map((g) => {
        const list = tasks.filter((t) => statusGroup(t) === g.key);
        const later = g.key === 'todo' ? upcoming : [];
        const moved = planned.filter((t) => statusGroup(t) === g.key);
        return (
          <section key={g.key} className={`day-col dc-${g.key}`}>
            <h4>{g.title} <span className="count">{list.length + later.length}</span></h4>
            {moved.map((t) => (
              <button key={t.id} className="day-card wi-planned" onClick={() => onOpen(t.taskId)}>
                <span className="day-card-title">{t.title}</span>
                <span className="task-meta">
                  <span>Scheduled for this day</span>
                  <span>{actualLabel(t)}</span>
                  {t.repeat && <span className={`repeat-badge ${t.repeat === 'DAILY' ? 'rb-daily' : 'rb-weekly'}`}>{REPEAT_LABEL[t.repeat] || 'Repeats'}</span>}
                  <StatusChip status={t.status} />
                </span>
              </button>
            ))}
            {later.map((t) => (
              <button key={t.id} className="day-card wi-scheduled wi-upcoming" onClick={() => onOpenUpcoming(t)}>
                <span className="day-card-title">{t.title}</span>
                <span className="task-meta">
                  <span>Due {fmtTime(t.dueAt)}</span>
                  <span className={`repeat-badge ${t.repeat === 'DAILY' ? 'rb-daily' : 'rb-weekly'}`}>{REPEAT_LABEL[t.repeat]}</span>
                  <span className="muted">Upcoming</span>
                </span>
              </button>
            ))}
            {list.length === 0 && later.length === 0 && moved.length === 0 ? <p className="muted small">Nothing here.</p> : list.map((t) => (
              <button key={t.id} className="day-card" onClick={() => onOpen(t.id)}>
                <span className="day-card-title">{t.title}</span>
                <span className="task-meta">
                  {t.carriedOver && <span className="tag" title="Not finished on its own day, so it carries over to today">from {fmtDate(workDate(t))}</span>}
                  {statusGroup(t) === 'done' && t.completedAt ? (
                    <>
                      <span>Done {sameDay(new Date(t.completedAt), new Date()) ? fmtTime(t.completedAt) : fmtDateTime(t.completedAt)}</span>
                      {t.dueAt && !sameDay(new Date(t.dueAt), new Date(t.completedAt)) && <span className="muted">was due {fmtDateTime(t.dueAt)}</span>}
                    </>
                  ) : (
                    <>
                      {statusGroup(t) === 'progress' && t.startedAt && (
                        <span>Started {sameDay(new Date(t.startedAt), new Date()) ? fmtTime(t.startedAt) : fmtDateTime(t.startedAt)}</span>
                      )}
                      {t.dueAt && <span className={t.overdue ? 'text-overdue' : ''}>{t.overdue ? 'Overdue, was due ' : 'Due '}
                        {sameDay(new Date(t.dueAt), workDate(t)) ? fmtTime(t.dueAt) : fmtDateTime(t.dueAt)}</span>}
                    </>
                  )}
                  <span>{PRIORITY_LABEL[t.priority]}</span>
                  {t.repeat && <span className={`repeat-badge ${t.repeat === 'DAILY' ? 'rb-daily' : 'rb-weekly'}`}>{REPEAT_LABEL[t.repeat] || 'Repeats'}</span>}
                  {t.workflow && <span className="repeat-badge rb-flow">FMS {t.workflow.date} · run #{t.workflow.number} · step {t.workflow.step}/{t.workflow.total}: {t.workflowStageTitle}</span>}
                  {t.selfAdded && !t.repeat && <span className="tag">Added by me</span>}
                  {(t.status === 'SUBMITTED' || t.status === 'REOPENED' || t.overdue || t.pending || t.onLeave) && <StatusChip status={t.status} overdue={t.overdue} pending={t.pending} onLeave={t.onLeave} />}
                </span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
    </>
  );
}

/** One week-day's items, in To do / In progress / Done groups (FMS scheduled runs go with To do). */
function WeekDayItems({ list, onOpen, onOpenWorkflow, onOpenUpcoming }) {
  if (list.length === 0) return <span className="muted small">—</span>;
  return GROUPS.map((g) => {
    const items = list.filter((t) => (t.scheduled || t.upcoming ? 'todo' : statusGroup(t)) === g.key);
    if (!items.length) return null;
    return (
      <div key={g.key} className={`week-group wg-${g.key}`}>
        <span className="week-group-title">{g.title} <span className="count">{items.length}</span></span>
        {items.map((t) => (t.plannedCopy ? <PlannedItem key={t.id} t={t} onOpen={onOpen} />
          : t.upcoming ? <UpcomingRepeatItem key={t.id} item={t} onOpen={onOpenUpcoming} />
          : t.scheduled ? <ScheduledFmsItem key={t.id} item={t} onOpen={onOpenWorkflow} />
            : <WorkItem key={t.id} t={t} onOpen={onOpen} />))}
      </div>
    );
  });
}

function WeekView({ tasks, planned, scheduled, upcoming, from, onOpen, onOpenWorkflow, onOpenUpcoming, onPickDay, holidays, leaves }) {
  return (
    <div className="week-grid">
      {WEEKDAYS.map((name, i) => {
        const day = addDays(from, i);
        const list = [
          ...tasks.filter((t) => sameDay(shownDate(t), day)),
          ...planned.filter((t) => sameDay(plannedDate(t), day)),
          ...scheduled.filter((t) => t.workflow.date === isoDay(day)),
          ...upcoming.filter((t) => sameDay(new Date(t.dueAt), day)),
        ].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
        const today = sameDay(day, new Date());
        const hol = holidays[isoDay(day)];
        return (
          <section key={name} className={`week-day ${today ? 'is-today' : ''} ${hol ? 'is-holiday' : ''} ${i === 6 ? 'is-off' : ''}`}>
            <button className="week-head" onClick={() => onPickDay(day)}>
              <span><strong>{name}</strong> {day.getDate()}</span>
              {list.length > 0 && <Counts list={list} />}
              {hol && <span className="hol-tag">🎉 {hol.name}</span>}
              {leaveOn(leaves, day) && <span className="leave-tag">🌴 On leave</span>}
              {!hol && i === 6 && list.length === 0 && <span className="muted small">Weekly off</span>}
            </button>
            <div className="week-items">
              <WeekDayItems list={list} onOpen={onOpen} onOpenWorkflow={onOpenWorkflow} onOpenUpcoming={onOpenUpcoming} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MonthView({ tasks, planned, upcoming, from, onPickDay, holidays }) {
  // Full weeks from the Monday before the 1st to the Sunday after the last day.
  const first = startOfWeek(from);
  const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0);
  const end = addDays(startOfWeek(lastDay), 7);
  const cells = [];
  for (let d = first; d < end; d = addDays(d, 1)) cells.push(d);
  return (
    <div className="month-wrap">
      <div className="month-grid month-head">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="month-grid">
        {cells.map((day) => {
          const inMonth = day.getMonth() === from.getMonth();
          const list = inMonth ? [
            ...tasks.filter((t) => sameDay(shownDate(t), day)),
            ...upcoming.filter((t) => sameDay(new Date(t.dueAt), day)),
          ] : [];
          const done = list.filter((t) => statusGroup(t) === 'done').length;
          const late = list.filter((t) => t.overdue).length;
          const moved = inMonth ? planned.filter((t) => sameDay(plannedDate(t), day)).length : 0;
          const hol = inMonth ? holidays[isoDay(day)] : null;
          return (
            <button key={isoDay(day)} disabled={!inMonth}
              className={`month-cell ${inMonth ? '' : 'out'} ${sameDay(day, new Date()) ? 'is-today' : ''} ${hol ? 'is-holiday' : ''}`}
              onClick={() => onPickDay(day)}
              aria-label={`${fmtDayLong(day)}: ${list.length} tasks, ${done} done${late ? `, ${late} overdue` : ''}`}>
              <span className="mc-date">{day.getDate()}</span>
              {hol && <span className="mc-holiday" title={hol.name}>🎉 {hol.name}</span>}
              {list.length > 0 && (
                <>
                  <span className="mc-bar"><span style={{ width: `${(100 * done) / list.length}%` }} /></span>
                  <span className="mc-count">{done}/{list.length}{late > 0 && <em> · {late} late</em>}</span>
                </>
              )}
              {moved > 0 && <span className="mc-count muted" title="Scheduled for this day, but started or done on another day">{moved} done/started on another day</span>}
            </button>
          );
        })}
      </div>
      <p className="muted small">Each day shows work done out of work planned. Click a day to see its list.</p>
    </div>
  );
}

function YearView({ data, onPickMonth }) {
  if (!data) return <p className="muted">Loading…</p>;
  const max = Math.max(1, ...data.months.map((m) => m.total));
  return (
    <div className="year-view">
      <div className="year-totals">
        <span><strong>{data.total}</strong> tasks</span>
        <span><strong>{data.completed}</strong> done</span>
        <span><strong>{data.onTimeRate ?? '—'}{data.onTimeRate != null && '%'}</strong> on time</span>
        <span><strong>{data.score ?? '—'}</strong> year score</span>
      </div>
      <table className="table tight">
        <thead><tr><th>Month</th><th className="num">Tasks</th><th className="num">Done</th><th className="num">On time</th><th className="num">Score</th><th className="bar-col"><span className="sr-only">Chart</span></th></tr></thead>
        <tbody>
          {data.months.map((m) => {
            const d = fromMonthKey(m.month);
            return (
              <tr key={m.month} className={m.total ? 'clickable' : 'inactive'} onClick={() => m.total && onPickMonth(d)}>
                <td>{fmtMonthShort(d)}</td>
                <td className="num">{m.total || '—'}</td>
                <td className="num">{m.total ? m.completed : '—'}</td>
                <td className="num">{m.onTimeRate == null ? '—' : `${m.onTimeRate}%`}</td>
                <td className={`num score-${scoreTone(m.score)}`}>{m.score ?? '—'}</td>
                <td className="bar-col">
                  {m.total > 0 && (
                    <span className="daybar" aria-hidden="true">
                      <span className="db-ontime" style={{ width: `${(m.completedOnTime / max) * 100}%` }} />
                      <span className="db-late" style={{ width: `${(m.completedLate / max) * 100}%` }} />
                      <span className="db-open" style={{ width: `${((m.total - m.completed) / max) * 100}%` }} />
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">
        <span className="legend"><span className="db-ontime" /> done on time <span className="db-late" /> done late <span className="db-open" /> not done</span>
      </p>
    </div>
  );
}

export function scoreTone(score) {
  if (score == null) return 'none';
  if (score >= 85) return 'high';
  if (score >= 70) return 'good';
  if (score >= 50) return 'mid';
  return 'low';
}

// ------------------------------------------------------------------ main

/**
 * Day / Week / Month / Year view of one person's work.
 * employeeId: whose work to show (admins). Omit for "my own work".
 * refreshKey: change it to reload after edits.
 */
export default function WorkCalendar({ employeeId, employeeName, onOpen, refreshKey, initialView = 'week' }) {
  const navigate = useNavigate();
  const { user, isAdmin, isDepartmentAdmin } = useAuth();
  const [view, setView] = useState(initialView);
  const [anchor, setAnchor] = useState(() => new Date());
  const [tasks, setTasks] = useState(null);
  const [planned, setPlanned] = useState([]);   // on their scheduled day, when started / done on another day
  const [year, setYear] = useState(null);
  const [error, setError] = useState('');
  const [holidays, setHolidays] = useState({});
  const [leaves, setLeaves] = useState([]);   // this person's leave in the range
  const [workflows, setWorkflows] = useState([]);
  const [templates, setTemplates] = useState([]);   // repeating tasks, to show copies not created yet

  const [from, to] = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  useEffect(() => {
    let alive = true;
    setError('');
    const now = new Date();
    // only today's Day view carries over unfinished work; Week / Month show each task on its own day
    const includesToday = view === 'day' && now >= from && now < to;
    const load = view === 'year'
      ? reportService.yearly({ employeeId, year: anchor.getFullYear() }).then((d) => alive && setYear(d))
      : Promise.all([
        // withPlanned: also work scheduled in this range but started / finished on another day
        taskService.list({ assigneeId: employeeId, workFrom: isoDay(from), workTo: isoDay(addDays(to, -1)), withPlanned: true }),
        // Today's Day view also carries over unfinished work from earlier days:
        // not started → To do, started → In progress
        includesToday
          ? taskService.list({ assigneeId: employeeId, status: OPEN, workTo: isoDay(addDays(from, -1)) })
          : Promise.resolve([]),
      ]).then(([list, earlier]) => {
        const seen = new Set(list.map((t) => t.id));
        const todayStart = startOfDay(new Date());
        const all = groupFmsTasks([...earlier.filter((t) => !seen.has(t.id)), ...list].filter((t) => t.status !== 'CANCELLED'))
          .map((t) => (includesToday && OPEN.includes(t.status) && workDate(t) < todayStart ? { ...t, carriedOver: true } : t));
        const inRange = (d) => d >= from && d < to;
        // each task once on the day it really belongs to (started / done / due) ...
        const shown = all.filter((t) => inRange(shownDate(t)));
        // ... and again on its scheduled day when that is another day, with its status and real dates
        const moved = all
          .filter((t) => !t.carriedOver && inRange(plannedDate(t)) && !sameDay(plannedDate(t), shownDate(t)))
          .map((t) => ({ ...t, id: `planned-${t.id}`, taskId: t.id, plannedCopy: true }));
        if (alive) {
          setTasks(shown.sort((a, b) => shownDate(a) - shownDate(b)));
          setPlanned(moved);
        }
      });
    load.catch((e) => alive && setError(e.message));
    if (view !== 'year') {
      holidayService.list({ from: isoDay(from), to: isoDay(addDays(to, -1)) })
        .then((list) => alive && setHolidays(Object.fromEntries(list.map((h) => [h.date, h]))))
        .catch(() => {});
      // whose leave: the person shown (admins), or my own
      if (isAdmin && employeeId == null) setLeaves([]);
      else {
        leaveService.list({ employeeId: isAdmin ? employeeId : undefined, from: isoDay(from), to: isoDay(addDays(to, -1)) })
          .then((list) => alive && setLeaves(list))
          .catch(() => alive && setLeaves([]));
      }
    }
    return () => { alive = false; };
  }, [view, from, to, employeeId, refreshKey, anchor]);

  useEffect(() => {
    if (view !== 'week') return undefined;
    if (isDepartmentAdmin) {
      setWorkflows([]);
      return undefined;
    }
    let alive = true;
    workflowService.list()
      .then((list) => alive && setWorkflows(list))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [view, employeeId, isDepartmentAdmin, refreshKey]);

  useEffect(() => {
    if (isDepartmentAdmin) { setTemplates([]); return undefined; }
    let alive = true;
    recurringService.list()
      .then((list) => alive && setTemplates(list))
      .catch(() => alive && setTemplates([]));
    return () => { alive = false; };
  }, [isDepartmentAdmin, refreshKey]);

  const pickDay = (d) => { setAnchor(d); setView('day'); };
  const pickMonth = (d) => { setAnchor(d); setView('month'); };
  const onOpenWorkflow = (workflowId) => navigate(`/workflows/${workflowId}/sheet`);
  /** An upcoming repeating task has no task yet: make that day's task now, then open it. */
  const onOpenUpcoming = async (item) => {
    setError('');
    try {
      const { taskId } = await recurringService.copyFor(item.templateId, item.startDate);
      if (onOpen) onOpen(taskId); else navigate(`/tasks/${taskId}`);
    } catch (e) {
      setError(e.message);
    }
  };
  const isCurrent = view === 'year' ? anchor.getFullYear() === new Date().getFullYear() : new Date() >= from && new Date() < to;
  const scheduleEmployeeId = employeeId ?? (isAdmin ? null : user?.id);
  const scheduled = view === 'week' && tasks
    ? scheduledFmsForWeek(workflows, tasks, from, holidays, scheduleEmployeeId)
    : [];
  const upcoming = useMemo(() => (view !== 'year' && tasks
    ? upcomingRepeats(templates, [...tasks, ...planned], from, to, { holidays, leaves, employeeId: scheduleEmployeeId })
    : []), [view, tasks, planned, templates, from, to, holidays, leaves, scheduleEmployeeId]);

  const summary = tasks && view !== 'year' && (() => {
    const c = { todo: 0, progress: 0, done: 0 };
    tasks.forEach((t) => { c[statusGroup(t)] += 1; });
    const late = tasks.filter((t) => t.overdue).length;
    return `${tasks.length} task${tasks.length === 1 ? '' : 's'}: ${c.done} done, ${c.progress} in progress, ${c.todo} to do${late ? `, ${late} overdue` : ''}`
      + (upcoming.length ? ` · ${upcoming.length} upcoming repeating` : '');
  })();

  return (
    <section className="panel work-views">
      <div className="wv-toolbar">
        <div className="wv-view-actions">
          <div className="segmented" role="tablist" aria-label="View">
            {VIEWS.map((v) => (
              <button key={v.key} role="tab" aria-selected={view === v.key} className={view === v.key ? 'on' : ''}
                onClick={() => setView(v.key)}>{v.label}</button>
            ))}
          </div>
          <TaskPdfExport employeeId={employeeId} employeeName={employeeName} user={user} view={view} anchor={anchor} />
        </div>
        <div className="wv-nav">
          <button className="btn ghost small" onClick={() => setAnchor(move(view, anchor, -1))} aria-label="Previous">‹</button>
          <button className="btn ghost small" onClick={() => setAnchor(new Date())} disabled={isCurrent}>Today</button>
          <button className="btn ghost small" onClick={() => setAnchor(move(view, anchor, 1))} aria-label="Next">›</button>
        </div>
      </div>
      <h3 className="wv-title">{titleFor(view, anchor)}</h3>
      {summary && <p className="muted small wv-summary">{summary}</p>}
      {view === 'week' && (
        <p className="color-key small" aria-hidden="true">
          <span className="ck ck-todo">To do</span><span className="ck ck-progress">In progress</span>
          <span className="ck ck-done">Done</span><span className="ck ck-late">Overdue</span>
          <span className="ck-repeat"><b>↻</b> Repeating task (daily / weekly / monthly / yearly)</span>
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {view === 'year' ? <YearView data={year} onPickMonth={pickMonth} />
        : tasks === null ? <p className="muted">Loading…</p>
          : view === 'day' ? <DayView tasks={tasks} planned={planned} upcoming={upcoming} onOpen={onOpen} onOpenUpcoming={onOpenUpcoming} holiday={holidays[isoDay(anchor)]} isSunday={anchor.getDay() === 0}
            leave={leaveOn(leaves, anchor)} />
            : view === 'week' ? <WeekView tasks={tasks} planned={planned} scheduled={scheduled} upcoming={upcoming} from={from} onOpen={onOpen}
                onOpenWorkflow={onOpenWorkflow} onOpenUpcoming={onOpenUpcoming} onPickDay={pickDay} holidays={holidays} leaves={leaves} />
              : <MonthView tasks={tasks} planned={planned} upcoming={upcoming} from={from} onPickDay={pickDay} holidays={holidays} />}
    </section>
  );
}
