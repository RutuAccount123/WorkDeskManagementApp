import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskService, holidayService, reportService, workflowService } from '@/services/index.js';
import StatusChip from '@/components/ui/StatusChip.jsx';
import {
  GROUPS, PRIORITY_LABEL, STATUS_LABEL, addDays, fmtDayLong, fmtMonth, fmtMonthShort, fmtTime, fromMonthKey,
  isoDay, sameDay, startOfDay, startOfMonth, startOfWeek, statusGroup, workDate,
} from '@/utils/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { groupFmsTasks } from '@/features/tasks/taskGroups.js';
import { scheduledFmsForWeek } from './scheduledFms.js';

const VIEWS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
      <span className="wi-title">{t.repeat && <span className="wi-repeat" title={t.repeat === 'DAILY' ? 'Daily task' : 'Weekly task'}>↻ </span>}{title}</span>
      {showTime && t.dueAt && <span className="wi-time">{fmtTime(t.dueAt)}</span>}
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

function Counts({ list }) {
  const done = list.filter((t) => statusGroup(t) === 'done').length;
  return <span className="muted small">{done}/{list.length} done</span>;
}

// ------------------------------------------------------------------ views

function DayView({ tasks, onOpen, holiday, isSunday }) {
  return (
    <>
    {holiday && <p className="holiday-banner">🎉 Office holiday: <strong>{holiday.name}</strong>{holiday.note && ` — ${holiday.note}`}</p>}
    {!holiday && isSunday && <p className="holiday-banner off">Sunday, weekly off</p>}
    <div className="day-cols">
      {GROUPS.map((g) => {
        const list = tasks.filter((t) => statusGroup(t) === g.key);
        return (
          <section key={g.key} className={`day-col dc-${g.key}`}>
            <h4>{g.title} <span className="count">{list.length}</span></h4>
            {list.length === 0 ? <p className="muted small">Nothing here.</p> : list.map((t) => (
              <button key={t.id} className="day-card" onClick={() => onOpen(t.id)}>
                <span className="day-card-title">{t.title}</span>
                <span className="task-meta">
                  {t.dueAt && <span className={t.overdue ? 'text-overdue' : ''}>{t.overdue ? 'Overdue, was due ' : 'Due '}{fmtTime(t.dueAt)}</span>}
                  <span>{PRIORITY_LABEL[t.priority]}</span>
                  {t.repeat && <span className={`repeat-badge ${t.repeat === 'DAILY' ? 'rb-daily' : 'rb-weekly'}`}>{t.repeat === 'DAILY' ? 'Daily' : 'Weekly'}</span>}
                  {t.workflow && <span className="repeat-badge rb-flow">FMS {t.workflow.date} · run #{t.workflow.number} · step {t.workflow.step}/{t.workflow.total}: {t.workflowStageTitle}</span>}
                  {t.selfAdded && !t.repeat && <span className="tag">Added by me</span>}
                  {(t.status === 'SUBMITTED' || t.status === 'REOPENED' || t.overdue) && <StatusChip status={t.status} overdue={t.overdue} />}
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

function WeekView({ tasks, scheduled, from, onOpen, onOpenWorkflow, onPickDay, holidays }) {
  return (
    <div className="week-grid">
      {WEEKDAYS.map((name, i) => {
        const day = addDays(from, i);
        const list = [
          ...tasks.filter((t) => sameDay(workDate(t), day)),
          ...scheduled.filter((t) => t.workflow.date === isoDay(day)),
        ].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
        const today = sameDay(day, new Date());
        const hol = holidays[isoDay(day)];
        return (
          <section key={name} className={`week-day ${today ? 'is-today' : ''} ${hol ? 'is-holiday' : ''} ${i === 6 ? 'is-off' : ''}`}>
            <button className="week-head" onClick={() => onPickDay(day)}>
              <span><strong>{name}</strong> {day.getDate()}</span>
              {list.length > 0 && <Counts list={list} />}
              {hol && <span className="hol-tag">🎉 {hol.name}</span>}
              {!hol && i === 6 && list.length === 0 && <span className="muted small">Weekly off</span>}
            </button>
            <div className="week-items">
              {list.length === 0 ? <span className="muted small">—</span>
                : list.map((t) => t.scheduled
                  ? <ScheduledFmsItem key={t.id} item={t} onOpen={onOpenWorkflow} />
                  : <WorkItem key={t.id} t={t} onOpen={onOpen} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MonthView({ tasks, from, onPickDay, holidays }) {
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
          const list = inMonth ? tasks.filter((t) => sameDay(workDate(t), day)) : [];
          const done = list.filter((t) => statusGroup(t) === 'done').length;
          const late = list.filter((t) => t.overdue).length;
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
export default function WorkCalendar({ employeeId, onOpen, refreshKey, initialView = 'week' }) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [view, setView] = useState(initialView);
  const [anchor, setAnchor] = useState(() => new Date());
  const [tasks, setTasks] = useState(null);
  const [year, setYear] = useState(null);
  const [error, setError] = useState('');
  const [holidays, setHolidays] = useState({});
  const [workflows, setWorkflows] = useState([]);

  const [from, to] = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  useEffect(() => {
    let alive = true;
    setError('');
    const load = view === 'year'
      ? reportService.yearly({ employeeId, year: anchor.getFullYear() }).then((d) => alive && setYear(d))
      : taskService.list({ assigneeId: employeeId, workFrom: isoDay(from), workTo: isoDay(addDays(to, -1)) })
        .then((list) => alive && setTasks(groupFmsTasks(list.filter((t) => t.status !== 'CANCELLED'))
          .sort((a, b) => workDate(a) - workDate(b))));
    load.catch((e) => alive && setError(e.message));
    if (view !== 'year') {
      holidayService.list({ from: isoDay(from), to: isoDay(addDays(to, -1)) })
        .then((list) => alive && setHolidays(Object.fromEntries(list.map((h) => [h.date, h]))))
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [view, from, to, employeeId, refreshKey, anchor]);

  useEffect(() => {
    if (view !== 'week') return undefined;
    let alive = true;
    workflowService.list()
      .then((list) => alive && setWorkflows(list))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [view, employeeId, refreshKey]);

  const pickDay = (d) => { setAnchor(d); setView('day'); };
  const pickMonth = (d) => { setAnchor(d); setView('month'); };
  const onOpenWorkflow = (workflowId) => navigate(`/workflows/${workflowId}/sheet`);
  const isCurrent = view === 'year' ? anchor.getFullYear() === new Date().getFullYear() : new Date() >= from && new Date() < to;
  const scheduleEmployeeId = employeeId ?? (isAdmin ? null : user?.id);
  const scheduled = view === 'week' && tasks
    ? scheduledFmsForWeek(workflows, tasks, from, holidays, scheduleEmployeeId)
    : [];

  const summary = tasks && view !== 'year' && (() => {
    const c = { todo: 0, progress: 0, done: 0 };
    tasks.forEach((t) => { c[statusGroup(t)] += 1; });
    const late = tasks.filter((t) => t.overdue).length;
    return `${tasks.length} task${tasks.length === 1 ? '' : 's'}: ${c.done} done, ${c.progress} in progress, ${c.todo} to do${late ? `, ${late} overdue` : ''}`;
  })();

  return (
    <section className="panel work-views">
      <div className="wv-toolbar">
        <div className="segmented" role="tablist" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.key} role="tab" aria-selected={view === v.key} className={view === v.key ? 'on' : ''}
              onClick={() => setView(v.key)}>{v.label}</button>
          ))}
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
          <span className="ck-repeat"><b>↻</b> Daily / weekly task</span>
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {view === 'year' ? <YearView data={year} onPickMonth={pickMonth} />
        : tasks === null ? <p className="muted">Loading…</p>
          : view === 'day' ? <DayView tasks={tasks} onOpen={onOpen} holiday={holidays[isoDay(anchor)]} isSunday={anchor.getDay() === 0} />
            : view === 'week' ? <WeekView tasks={tasks} scheduled={scheduled} from={from} onOpen={onOpen}
                onOpenWorkflow={onOpenWorkflow} onPickDay={pickDay} holidays={holidays} />
              : <MonthView tasks={tasks} from={from} onPickDay={pickDay} holidays={holidays} />}
    </section>
  );
}
