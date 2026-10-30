import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeeService, taskService, reportService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { isoDay } from '@/utils/format.js';
import TaskBoard from '@/features/tasks/TaskBoard.jsx';
import TaskPanel from '@/features/tasks/TaskPanel.jsx';
import TaskForm from '@/features/tasks/TaskForm.jsx';
import Icon from '@/components/ui/Icon.jsx';
import TeamOverview from '@/features/dashboard/TeamOverview.jsx';

/** Headline number card. `tone` picks the colour: overdue, today, review, done, progress. */
function Stat({ value, label, tone, icon, to }) {
  const body = (
    <>
      <span className="stat-icon"><Icon name={icon} size={20} /></span>
      <span className="stat-text">
        <span className="stat-value">{value ?? '–'}</span>
        <span className="stat-label">{label}</span>
      </span>
    </>
  );
  const cls = `stat tone-${tone}`;
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Admin: company-wide picture. Employee: their own work. */
export default function Overview() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [people, setPeople] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const today = isoDay();
      const weekAgo = isoDay(new Date(Date.now() - 6 * 86400000));
      const reqs = [
        reportService.dashboard(),
        taskService.list({ status: isAdmin ? ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED'] : [] }),
      ];
      if (isAdmin) {
        reqs.push(reportService.employeeSummary({ from: weekAgo, to: today }));
        reqs.push(employeeService.list());
      }
      const [s, t, p, e] = await Promise.all(reqs);
      setStats(s);
      setTasks(t);
      if (isAdmin) { setPeople(p); setEmployees(e); }
    } catch (err) {
      setError(err.message);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const review = tasks?.filter((t) => t.status === 'SUBMITTED') || [];

  return (
    <div className="page">
      <header className="page-head hero">
        <div>
          <h1>{greeting}, {user.fullName.split(' ')[0]}</h1>
          <p className="muted">{isAdmin ? 'Here is where everyone’s work stands.' : 'Here is what’s on your plate.'}</p>
        </div>
        {isAdmin && <button className="btn primary" onClick={() => setEditing({})}>Assign a task</button>}
      </header>

      {error && <p className="error">{error}</p>}

      <div className="stats">
        <Stat value={stats?.overdue} label="Overdue" tone="overdue" icon="alert" to={isAdmin ? '/tasks?overdue=1' : undefined} />
        <Stat value={stats?.dueToday} label="Due today" tone="today" icon="clock" to={isAdmin ? '/tasks?dueToday=1' : undefined} />
        {isAdmin
          ? <Stat value={stats?.awaitingReview} label="Waiting for review" tone="review" icon="review" to="/tasks?status=SUBMITTED" />
          : <Stat value={stats?.inProgress} label="In progress" tone="progress" icon="tasks" />}
        <Stat value={stats?.completedThisWeek} label="Done this week" tone="done" icon="check" to={isAdmin ? '/tasks?status=COMPLETED&completedThisWeek=1' : undefined} />
      </div>

      {isAdmin && <TeamOverview refreshKey={tasks} onOpen={setOpenId} />}

      {isAdmin && review.length > 0 && (
        <section className="panel">
          <h2 className="section-title">Waiting for review</h2>
          <TaskBoard tasks={review} onOpen={setOpenId} showAssignee />
        </section>
      )}

      {isAdmin ? (
        <div className="split">
          <section className="panel">
            <h2 className="section-title">Needs attention today</h2>
            {tasks === null ? <p className="muted">Loading…</p> :
              <TaskBoard tasks={tasks.filter((t) => t.status !== 'SUBMITTED')} onOpen={setOpenId} showAssignee
                lanes={['overdue', 'today']} maxPerLane={6}
                moreLink={(lane) => (lane === 'overdue' ? '/tasks?overdue=1' : '/tasks')}
                emptyText="Nothing overdue or due today." />}
          </section>
          <section className="panel">
            <h2 className="section-title">Last 7 days</h2>
            {people.length === 0 ? <p className="muted">No employees yet. <Link to="/employees">Add your team</Link>.</p> : (
              <table className="table tight">
                <thead><tr><th>Name</th><th className="num">Open</th><th className="num">Late</th><th className="num">Done</th></tr></thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.employeeId}>
                      <td><Link to={`/employees/${p.employeeId}`}>{p.employeeName}</Link></td>
                      <td className="num">{p.openNow}</td>
                      <td className={`num ${p.overdueNow ? 'text-overdue' : ''}`}>{p.overdueNow}</td>
                      <td className="num">{p.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      ) : (
        <section className="panel">
          {tasks === null ? <p className="muted">Loading…</p> :
            <TaskBoard tasks={tasks} onOpen={setOpenId} emptyText="Nothing assigned to you right now." />}
        </section>
      )}

      <TaskPanel openId={openId} onClose={() => setOpenId(null)} />
      {editing && (
        <TaskForm task={editing.id ? editing : null} employees={employees}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
