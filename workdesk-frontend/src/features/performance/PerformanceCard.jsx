import { useEffect, useState } from 'react';
import { reportService } from '@/services/index.js';
import { fmtMonth, fmtMonthShort, fromMonthKey, monthKey } from '@/utils/format.js';
import { scoreTone } from '@/features/calendar/WorkCalendar.jsx';

/** Monthly performance: score, what it's made of, and the last 6 months. */
export default function PerformanceCard({ employeeId, refreshKey, title = 'Monthly performance' }) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    reportService.performance({ employeeId, month })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [employeeId, month, refreshKey]);

  const shift = (n) => { const d = fromMonthKey(month); setMonth(monthKey(new Date(d.getFullYear(), d.getMonth() + n, 1))); };
  const isThisMonth = month === monthKey(new Date());
  const tone = scoreTone(data?.score);

  return (
    <section className="panel perf">
      <div className="perf-head">
        <h2 className="section-title">{title}</h2>
        <div className="wv-nav">
          <button className="btn ghost small" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <span className="perf-month">{fmtMonth(fromMonthKey(month))}</span>
          <button className="btn ghost small" onClick={() => shift(1)} disabled={isThisMonth} aria-label="Next month">›</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {!data ? <p className="muted">Loading…</p> : (
        <div className="perf-body">
          <div className={`perf-score score-${tone}`}>
            <span className="perf-num">{data.score ?? '—'}</span>
            <span className="perf-out">/ 100</span>
            <span className="perf-rating">{data.rating}</span>
          </div>

          <dl className="perf-facts">
            <div><dt>Work done</dt><dd>{data.completed} of {data.total}</dd><Meter value={data.completionRate} /></div>
            <div><dt>Done on time</dt><dd>{data.onTimeRate == null ? '—' : `${data.onTimeRate}%`}</dd><Meter value={data.onTimeRate} /></div>
            <div><dt>Done late</dt><dd>{data.completedLate}</dd></div>
            <div><dt>Overdue now</dt><dd className={data.overdue ? 'text-overdue' : ''}>{data.overdue}</dd></div>
            <div><dt>Added own work</dt><dd>{data.selfAdded}</dd></div>
            <div><dt>Avg time to finish</dt><dd>{data.avgCompletionHours == null ? '—' : `${data.avgCompletionHours} h`}</dd></div>
          </dl>

          <div className="trend" aria-label="Score, last 6 months">
            {data.trend.map((t) => (
              <button key={t.month} className={`trend-bar ${t.month === month ? 'on' : ''}`} onClick={() => setMonth(t.month)}
                title={`${fmtMonth(fromMonthKey(t.month))}: ${t.score ?? 'no work'}`}>
                <span className="trend-track"><span className={`trend-fill score-bg-${scoreTone(t.score)}`} style={{ height: `${t.score ?? 0}%` }} /></span>
                <span className="trend-val">{t.score ?? '—'}</span>
                <span className="trend-label">{fmtMonthShort(fromMonthKey(t.month))}</span>
              </button>
            ))}
          </div>
          <p className="muted small perf-note">
            Score = 60% work done + 40% done on time. Only work due so far this month is counted.
          </p>
        </div>
      )}
    </section>
  );
}

function Meter({ value }) {
  return <span className="meter" aria-hidden="true"><span style={{ width: `${value ?? 0}%` }} /></span>;
}
