import { useCallback, useEffect, useState } from 'react';
import { taskService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { isoDay, statusGroup, workDate, sameDay } from '@/utils/format.js';
import { desktopEnabled, desktopSupported, enableDesktop } from '@/features/notifications/desktopNotify.js';
import AddWorkForm from '@/features/my-work/AddWorkForm.jsx';
import PerformanceCard from '@/features/performance/PerformanceCard.jsx';
import TaskPanel from '@/features/tasks/TaskPanel.jsx';
import WorkCalendar from '@/features/calendar/WorkCalendar.jsx';
import RepeatingTaskList from '@/features/my-work/RepeatingTaskList.jsx';
import TaskForm from '@/features/tasks/TaskForm.jsx';
import TaskBoard from '@/features/tasks/TaskBoard.jsx';
import { groupFmsTasks } from '@/features/tasks/taskGroups.js';
import { Link } from 'react-router-dom';

/** Employee home: today's reminder, add own work, day/week/month/year views, monthly performance. */
export default function MyWork() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [late, setLate] = useState(0);
  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [toReview, setToReview] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [desktop, setDesktop] = useState(desktopEnabled());
  const bump = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {
    const d = isoDay(new Date());
    Promise.all([
      taskService.list({ workFrom: d, workTo: d }),
      taskService.list({ overdue: 'true' }),
    ]).then(([list, overdue]) => {
      const mine = groupFmsTasks(list.filter((t) => t.status !== 'CANCELLED' && sameDay(workDate(t), new Date())));
      const c = { todo: 0, progress: 0, done: 0 };
      mine.forEach((t) => { c[statusGroup(t)] += 1; });
      setToday({ total: mine.length, ...c, next: mine.find((t) => statusGroup(t) !== 'done') });
      setLate(overdue.length);
    }).catch(() => {});
    taskService.list({ scope: 'review', status: ['SUBMITTED'] }).then(setToReview).catch(() => {});
  }, [refresh]);

  const turnOnDesktop = async () => {
    const r = await enableDesktop();
    setDesktop(r === 'granted');
    if (r === 'denied') window.alert('Notifications are blocked for this site. Allow them from the lock icon next to the address bar.');
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <header className="page-head hero">
        <div>
          <h1>{greeting}, {user.fullName.split(' ')[0]}</h1>
          <p className="muted">Your work, day by day.</p>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => setAssigning(true)}>Assign a task</button>
          <button className="btn primary" onClick={() => setAdding(true)}>Add my work</button>
        </div>
      </header>

      {today && (
        <section className={`reminder ${late ? 'has-late' : ''}`} aria-live="polite">
          <div>
            <h2 className="reminder-title">
              {today.total === 0 ? 'Nothing planned for today yet'
                : today.done === today.total ? 'All of today’s work is done'
                  : `${today.total - today.done} of ${today.total} tasks left for today`}
            </h2>
            <p className="reminder-text">
              {today.total > 0 && <>{today.todo} to do, {today.progress} in progress, {today.done} done. </>}
              {late > 0 && <strong className="text-overdue">{late} overdue. </strong>}
              {today.next && <>Next up: <button className="link-btn" onClick={() => setOpenId(today.next.id)}>{today.next.title}</button></>}
              {today.total === 0 && 'Add what you plan to do so it shows in your record.'}
            </p>
          </div>
          {desktopSupported() && !desktop && (
            <button className="btn ghost small" onClick={turnOnDesktop}>Turn on desktop reminders</button>
          )}
          {desktop && <span className="muted small">Desktop reminders on</span>}
        </section>
      )}

      {toReview.length > 0 && (
        <section className="panel">
          <div className="perf-head">
            <h2 className="section-title">Waiting for my review <span className="count">{toReview.length}</span></h2>
            <Link to="/tasks?scope=review&status=SUBMITTED" className="small">See all</Link>
          </div>
          <TaskBoard tasks={toReview} onOpen={setOpenId} showAssignee />
        </section>
      )}

      <WorkCalendar onOpen={setOpenId} refreshKey={refresh} initialView="week" />
      <RepeatingTaskList refreshKey={refresh} onChanged={bump} />
      <PerformanceCard refreshKey={refresh} />

      <TaskPanel openId={openId} onClose={() => setOpenId(null)} onChanged={bump} />
      {assigning && (
        <TaskForm onClose={() => setAssigning(false)} onSaved={() => { setAssigning(false); bump(); }} />
      )}
      {adding && (
        <AddWorkForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); bump(); }} />
      )}
    </div>
  );
}
