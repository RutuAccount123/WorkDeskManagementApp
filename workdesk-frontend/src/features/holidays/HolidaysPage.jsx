import { useEffect, useState } from 'react';
import { holidayService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { isoDay } from '@/utils/format.js';
import Modal from '@/components/ui/Modal.jsx';

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthDay = new Intl.DateTimeFormat('en-IN', { day: 'numeric' });
const monthShort = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const asDate = (iso) => new Date(`${iso}T00:00`);

function HolidayForm({ holiday, onClose, onSaved }) {
  const [form, setForm] = useState({ date: holiday?.date || isoDay(), name: holiday?.name || '', note: holiday?.note || '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const saved = holiday
        ? await holidayService.update(holiday.id, form)
        : await holidayService.create(form);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal title={holiday ? 'Edit holiday' : 'Add a holiday'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="grid-2">
          <label>Date<input type="date" value={form.date} onChange={set('date')} required /></label>
          <label>Holiday name<input value={form.name} onChange={set('name')} required autoFocus placeholder="e.g. Diwali (Lakshmi Pujan)" /></label>
        </div>
        <label>Note for employees<input value={form.note} onChange={set('note')} placeholder="Optional, e.g. Office closed" /></label>
        <p className="hint">On a holiday, daily and weekly tasks are not created, and the day is marked on everyone’s calendar.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary">{holiday ? 'Save changes' : 'Add holiday'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Office holiday calendar. Admin adds/edits/deletes; employees can see it. */
export default function Holidays() {
  const { isAdmin } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = () => holidayService.list({ year }).then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [year]);

  const remove = async (h) => {
    if (!window.confirm(`Delete “${h.name}” on ${longDate.format(asDate(h.date))}? It becomes a working day again.`)) return;
    try { await holidayService.remove(h.id); load(); } catch (e) { setError(e.message); }
  };

  const today = isoDay();
  const upcoming = list?.find((h) => h.date >= today);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Holidays</h1>
          <p className="muted">{isAdmin ? 'Days the office is closed. Everyone sees these on their calendar.' : 'Days the office is closed.'}</p>
        </div>
        <div className="row">
          <div className="wv-nav">
            <button className="btn ghost small" onClick={() => setYear(year - 1)} aria-label="Previous year">‹</button>
            <span className="perf-month">{year}</span>
            <button className="btn ghost small" onClick={() => setYear(year + 1)} aria-label="Next year">›</button>
          </div>
          {isAdmin && <button className="btn primary" onClick={() => setEditing({})}>Add a holiday</button>}
        </div>
      </header>

      {upcoming && year === new Date().getFullYear() && (
        <section className="reminder holiday-next">
          <div>
            <h2 className="reminder-title">Next holiday: {upcoming.name}</h2>
            <p className="reminder-text">{longDate.format(asDate(upcoming.date))}{upcoming.note && `. ${upcoming.note}`}</p>
          </div>
        </section>
      )}

      {error && <p className="error">{error}</p>}
      {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? (
        <p className="empty">No holidays added for {year} yet.{isAdmin && ' Use “Add a holiday”.'}</p>
      ) : (
        <ul className="holiday-list">
          {list.map((h) => {
            const d = asDate(h.date);
            const past = h.date < today;
            return (
              <li key={h.id} className={past ? 'past' : ''}>
                <span className="hol-date">
                  <b>{monthDay.format(d)}</b>
                  <small>{monthShort.format(d)}</small>
                </span>
                <span className="hol-main">
                  <strong>{h.name}</strong>
                  <small className="muted">{longDate.format(d)}{h.note && ` · ${h.note}`}</small>
                </span>
                {isAdmin && (
                  <span className="row-actions">
                    <button className="link-btn" onClick={() => setEditing(h)}>Edit</button>
                    <button className="link-btn danger" onClick={() => remove(h)}>Delete</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <HolidayForm holiday={editing.id ? editing : null} onClose={() => setEditing(null)}
          onSaved={(h) => { setEditing(null); setYear(Number(h.date.slice(0, 4))); load(); }} />
      )}
    </div>
  );
}
