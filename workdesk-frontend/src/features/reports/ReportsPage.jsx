import { useCallback, useEffect, useState } from 'react';
import { employeeService, reportService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { isoDay } from '@/utils/format.js';

const dShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });

/** Simple bar for the daily table — completed on time vs late, out of the busiest day. */
function DayBar({ row, max }) {
  if (!max) return null;
  const late = row.completed - row.completedOnTime;
  return (
    <span className="daybar" aria-hidden="true">
      <span className="db-ontime" style={{ width: `${(row.completedOnTime / max) * 100}%` }} />
      <span className="db-late" style={{ width: `${(late / max) * 100}%` }} />
    </span>
  );
}

export default function Reports() {
  const { isAdmin } = useAuth();
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(isoDay());
  const [employeeId, setEmployeeId] = useState('');
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [d, s] = await Promise.all([
        reportService.daily({ from, to, employeeId }),
        isAdmin ? reportService.employeeSummary({ from, to }) : Promise.resolve(null),
      ]);
      setDaily(d);
      setSummary(s);
    } catch (e) {
      setError(e.message);
    }
  }, [from, to, employeeId, isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isAdmin) employeeService.list().then(setEmployees).catch(() => {}); }, [isAdmin]);

  const downloadCsv = async () => {
    try {
      const res = await reportService.employeeSummaryCsv({ from, to });
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `employee-summary_${from}_to_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  const max = daily ? Math.max(0, ...daily.map((r) => r.completed)) : 0;
  const totals = daily?.reduce((t, r) => ({ created: t.created + r.created, completed: t.completed + r.completed, onTime: t.onTime + r.completedOnTime }),
    { created: 0, completed: 0, onTime: 0 });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{isAdmin ? 'Reports' : 'My summary'}</h1>
          <p className="muted">Work assigned and finished between two dates.</p>
        </div>
        {isAdmin && <button className="btn ghost" onClick={downloadCsv}>Download for Excel</button>}
      </header>

      <div className="filters">
        <label className="inline">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="inline">To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        {isAdmin && (
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} aria-label="Daily view for">
            <option value="">Daily view: everyone</option>
            {employees.map((e) => <option key={e.id} value={e.id}>Daily view: {e.fullName}</option>)}
          </select>
        )}
      </div>
      {error && <p className="error">{error}</p>}

      {isAdmin && summary && (
        <section className="panel">
          <h2 className="section-title">By employee</h2>
          {summary.length === 0 ? <p className="muted">No work in this period.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th><th className="num">Assigned</th><th className="num">Done</th><th className="num">On time</th>
                    <th className="num">Late</th><th className="num">Open now</th><th className="num">Overdue now</th>
                    <th className="num">On-time rate</th><th className="num">Avg hours to finish</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((r) => (
                    <tr key={r.employeeId}>
                      <td><strong>{r.employeeName}</strong><small className="block muted">{r.department || ''}</small></td>
                      <td className="num">{r.assigned}</td>
                      <td className="num">{r.completed}</td>
                      <td className="num">{r.completedOnTime}</td>
                      <td className="num">{r.completedLate}</td>
                      <td className="num">{r.openNow}</td>
                      <td className={`num ${r.overdueNow ? 'text-overdue' : ''}`}>{r.overdueNow}</td>
                      <td className="num">{r.onTimeRate == null ? '—' : `${r.onTimeRate}%`}</td>
                      <td className="num">{r.avgCompletionHours ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {daily && (
        <section className="panel">
          <h2 className="section-title">Day by day</h2>
          <p className="muted small">
            {totals.created} assigned, {totals.completed} done
            {totals.completed > 0 && `, ${Math.round((100 * totals.onTime) / totals.completed)}% on time`}.
            <span className="legend"><span className="db-ontime" /> on time <span className="db-late" /> late</span>
          </p>
          <div className="table-wrap">
            <table className="table tight">
              <thead><tr><th>Date</th><th className="num">Assigned</th><th className="num">Due</th><th className="num">Done</th><th className="bar-col"><span className="sr-only">Chart</span></th></tr></thead>
              <tbody>
                {[...daily].reverse().map((r) => (
                  <tr key={r.date}>
                    <td>{dShort.format(new Date(r.date + 'T00:00'))}</td>
                    <td className="num">{r.created}</td>
                    <td className="num">{r.due}</td>
                    <td className="num">{r.completed}</td>
                    <td className="bar-col"><DayBar row={r} max={max} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
