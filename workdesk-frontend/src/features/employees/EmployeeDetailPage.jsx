import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { employeeService, taskService } from '@/services/index.js';
import { isoDay, sameDay, statusGroup, workDate } from '@/utils/format.js';
import EmployeeProfileCard from '@/features/dashboard/EmployeeProfileCard.jsx';
import PerformanceCard from '@/features/performance/PerformanceCard.jsx';
import { groupFmsTasks } from '@/features/tasks/taskGroups.js';
import TaskForm from '@/features/tasks/TaskForm.jsx';
import TaskPanel from '@/features/tasks/TaskPanel.jsx';
import WorkCalendar from '@/features/calendar/WorkCalendar.jsx';

/** Admin: everything about one employee — profile, performance, and their work by day/week/month/year. */
export default function EmployeeDetail() {
  const { id } = useParams();
  const empId = Number(id);
  const [emp, setEmp] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [today, setToday] = useState(null);
  const [todayError, setTodayError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const bump = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setError('');
    employeeService.get(empId).then((employee) => {
      if (active) setEmp(employee);
    }).catch((e) => {
      if (active) setError(e.message);
    });
    employeeService.list().then(setEmployees).catch(() => {});
    const date = new Date();
    const day = isoDay(date);
    taskService.list({ assigneeId: empId, workFrom: day, workTo: day })
      .then((tasks) => {
        if (!active) return;
        const work = groupFmsTasks(tasks.filter((task) => task.status !== 'CANCELLED' && sameDay(workDate(task), date)));
        const counts = { todo: 0, progress: 0, done: 0 };
        work.forEach((task) => { counts[statusGroup(task)] += 1; });
        setToday(counts);
      })
      .catch((e) => {
        if (active) setTodayError(e.message);
      });
    return () => { active = false; };
  }, [empId]);

  if (error) return <div className="page"><p className="error">{error}</p><Link to="/employees" className="back-link">‹ All employees</Link></div>;
  if (!emp) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <Link to="/employees" className="back-link">‹ All employees</Link>
      <header className="page-head">
        <div className="profile">
          <div>
            <h1>Employee dashboard</h1>
            <p className="muted">
              {[emp.fullName, emp.designation, emp.department].filter(Boolean).join(' · ')}
              {!emp.active && <strong> (inactive)</strong>}
            </p>
          </div>
        </div>
        <div className="row">
          <Link className="btn ghost" to={`/tasks?assigneeId=${emp.id}&status=all`}>All their tasks</Link>
          {emp.active && <button className="btn primary" onClick={() => setAssigning(true)}>Assign a task</button>}
        </div>
      </header>

      <EmployeeProfileCard user={emp} employeeId={empId} today={today} todayError={todayError} refreshKey={refresh} />
      <PerformanceCard employeeId={empId} refreshKey={refresh} />
      <WorkCalendar employeeId={empId} employeeName={emp.fullName} onOpen={setOpenId} refreshKey={refresh} initialView="day" />

      <TaskPanel openId={openId} onClose={() => setOpenId(null)} onChanged={bump} />
      {assigning && (
        <TaskForm task={null} employees={employees} defaultAssigneeId={emp.id}
          onClose={() => setAssigning(false)} onSaved={() => { setAssigning(false); bump(); }} />
      )}
    </div>
  );
}
