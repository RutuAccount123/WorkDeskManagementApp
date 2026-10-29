import { useEffect, useState } from 'react';
import { recurringService } from '@/services/index.js';
import { dayLabel, fmtDate } from '@/utils/format.js';

/** Employee: their daily and weekly tasks (their own, and the ones admin set up for them). */
export default function RepeatingTaskList({ refreshKey, onChanged }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  const load = () => recurringService.list().then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [refreshKey]);

  const act = async (fn) => {
    setError('');
    try { await fn(); await load(); onChanged?.(); } catch (e) { setError(e.message); }
  };

  if (list === null) return null;

  return (
    <section className="panel">
      <h2 className="section-title">My daily &amp; weekly tasks</h2>
      {error && <p className="error">{error}</p>}
      {list.length === 0 ? (
        <p className="muted">None yet. Use <strong>Add my work</strong> and choose “Every day” or “Every week”.</p>
      ) : (
        <ul className="repeat-list">
          {list.map((t) => (
            <li key={t.id} className={t.active ? '' : 'paused'}>
              <span className={`repeat-badge ${t.frequency === 'DAILY' ? 'rb-daily' : 'rb-weekly'}`}>
                {t.frequency === 'DAILY' ? 'Daily' : 'Weekly'}
              </span>
              <span className="repeat-main">
                <strong>{t.title}</strong>
                <small className="muted">
                  {t.frequency === 'DAILY' ? 'Mon–Sat' : `Every ${dayLabel(t.dayOfWeek)}`}, by {t.dueTime.slice(0, 5)}
                  {t.estimatedHours != null && ` · ${t.estimatedHours} estimated hours`}
                  {' · '}{t.selfOwned ? 'set by you' : `set by ${t.createdBy?.fullName || 'admin'}`}
                  {!t.active && ' · paused'}
                  {t.lastGeneratedOn && t.active && ` · next copies up to ${fmtDate(t.lastGeneratedOn)}`}
                </small>
              </span>
              {t.selfOwned && (
                <span className="row-actions">
                  <button className="link-btn" onClick={() => act(() => recurringService.setActive(t.id, !t.active))}>
                    {t.active ? 'Pause' : 'Resume'}
                  </button>
                  <button className="link-btn danger" onClick={() => window.confirm(`Stop “${t.title}”? Past tasks stay in your record.`)
                    && act(() => recurringService.remove(t.id))}>Delete</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
