import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportService } from '@/services/index.js';
import { fmtTime } from '@/utils/format.js';
import StatusChip from '@/components/ui/StatusChip.jsx';
import { personColor } from '@/utils/colors.js';

const SHOW = 5; // tasks listed per person before "+ more"

/**
 * Management view: one card per employee showing TODAY'S ACTUAL WORK —
 * counts in colour, then the task list with status. Click a task to open it.
 */
export default function TeamOverview({ refreshKey, onOpen, employees = [] }) {
  const [team, setTeam] = useState(null);
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState('today');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');

  const departments = [...new Set(
    employees
      .map((employee) => employee.department?.trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    setTeam(null);
    setError('');
    reportService.team(period).then(setTeam).catch((err) => {
      setError(err.message);
      setTeam([]);
    });
  }, [period, refreshKey]);

  if (team === null) return <section className="panel"><p className="muted">Loading team…</p></section>;
  const shown = team.filter((m) =>
    (!department || m.employee.department?.trim() === department)
      && (!q || `${m.employee.fullName} ${m.employee.department}`.toLowerCase().includes(q.toLowerCase())));
  const periodLabel = period === 'today' ? 'today' : period === 'week' ? 'this week' : 'this month';

  return (
    <section className="panel">
      <div className="perf-head">
        <div>
          <h2 className="section-title">Everyone’s work {periodLabel}</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Click a name to see their full record, or a task to open it.</p>
        </div>
        <div className="team-controls">
          <select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
            <option value="">All departments</option>
            {departments.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Work period">
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
          {team.length > 4 && (
            <input type="search" className="team-search" placeholder="Find a person" value={q}
              onChange={(e) => setQ(e.target.value)} aria-label="Find a person" />
          )}
        </div>
      </div>

      {error ? <p className="error">{error}</p> : team.length === 0 ? <p className="muted">No employees yet. <Link to="/employees">Add your team</Link>.</p> : (
        shown.length === 0 ? <p className="muted">No employees match this department or search.</p> : (
          <ul className="team">
            {shown.map(({ employee: e, range, rangeTasks, rangeOverdue, month }) => {
              const color = personColor(e.fullName);
              return (
                <li key={e.id}>
                  <div className={`member ${e.active ? '' : 'inactive'}`} style={{ '--member-color': color }}>
                    <Link to={`/employees/${e.id}`} className="member-top">
                      <span className="avatar" style={{ background: color }}>{e.fullName.charAt(0)}</span>
                      <span className="member-name">
                        <strong>{e.fullName}</strong>
                        <small>{e.designation || e.department}</small>
                      </span>
                      <span className="member-score" style={{ color }}>
                        {month.score ?? '—'}<small>this month</small>
                      </span>
                    </Link>

                    <div className="member-counts">
                      <span className="mc-todo"><b>{range.todo}</b>To do</span>
                      <span className="mc-progress"><b>{range.inProgress}</b>In progress</span>
                      <span className="mc-done"><b>{range.done}</b>Done</span>
                      <span className="mc-late"><b>{rangeOverdue}</b>Overdue</span>
                    </div>

                    {rangeTasks.length === 0 ? <p className="member-empty">No work planned for {periodLabel}.</p> : (
                      <ul className="member-work">
                        {rangeTasks.slice(0, SHOW).map((t) => (
                          <li key={t.id}>
                            <button className="link-btn mw-title" onClick={() => onOpen?.(t.id)} title={t.title}>
                              {t.title}
                            </button>
                            <span className="row" style={{ gap: 6 }}>
                              {t.dueAt && <span className="muted small">{fmtTime(t.dueAt)}</span>}
                              <StatusChip status={t.status} overdue={t.overdue} short />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {rangeTasks.length > SHOW && (
                      <Link className="member-more" to={`/employees/${e.id}`}>+ {rangeTasks.length - SHOW} more {periodLabel}</Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </section>
  );
}
