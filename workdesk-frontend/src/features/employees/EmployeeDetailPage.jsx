import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { employeeService } from '@/services/index.js';
import { fmtDate } from '@/utils/format.js';
import { personColor } from '@/utils/colors.js';
import PerformanceCard from '@/features/performance/PerformanceCard.jsx';
import TaskForm from '@/features/tasks/TaskForm.jsx';
import TaskPanel from '@/features/tasks/TaskPanel.jsx';
import WorkCalendar from '@/features/calendar/WorkCalendar.jsx';

/** Admin: everything about one employee — profile, performance, and their work by day/week/month/year. */
export default function EmployeeDetail() {
  const { id } = useParams();
  const empId = Number(id);
  const [emp, setEmp] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const bump = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {
    employeeService.get(empId).then(setEmp).catch((e) => setError(e.message));
    employeeService.list().then(setEmployees).catch(() => {});
  }, [empId]);

  if (error) return <div className="page"><p className="error">{error}</p><Link to="/employees" className="back-link">‹ All employees</Link></div>;
  if (!emp) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <Link to="/employees" className="back-link">‹ All employees</Link>
      <header className="page-head">
        <div className="profile">
          <span className="avatar big" style={{ background: personColor(emp.fullName) }}>{emp.fullName.charAt(0)}</span>
          <div>
            <h1>{emp.fullName}</h1>
            <p className="muted">
              {[emp.designation, emp.department].filter(Boolean).join(', ')}
              {!emp.active && <strong> (inactive)</strong>}
            </p>
          </div>
        </div>
        <div className="row">
          <Link className="btn ghost" to={`/tasks?assigneeId=${emp.id}&status=all`}>All their tasks</Link>
          {emp.active && <button className="btn primary" onClick={() => setAssigning(true)}>Assign a task</button>}
        </div>
      </header>

      <section className="panel">
        <dl className="facts facts-4">
          <div><dt>Employee code</dt><dd>{emp.employeeCode || '—'}</dd></div>
          <div><dt>Email</dt><dd>{emp.email}</dd></div>
          <div><dt>Phone</dt><dd>{emp.phone || '—'}</dd></div>
          <div><dt>Joined</dt><dd>{fmtDate(emp.createdAt)}</dd></div>
        </dl>
      </section>

      <PerformanceCard employeeId={empId} refreshKey={refresh} />
      <WorkCalendar employeeId={empId} employeeName={emp.fullName} onOpen={setOpenId} refreshKey={refresh} initialView="week" />

      <TaskPanel openId={openId} onClose={() => setOpenId(null)} onChanged={bump} />
      {assigning && (
        <TaskForm task={null} employees={employees} defaultAssigneeId={emp.id}
          onClose={() => setAssigning(false)} onSaved={() => { setAssigning(false); bump(); }} />
      )}
    </div>
  );
}
