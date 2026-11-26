import { useEffect, useState } from 'react';
import { employeeService, instrumentService } from '@/services/index.js';
import Modal from '@/components/ui/Modal.jsx';
import Pagination, { pageCount, pageSlice } from '@/components/ui/Pagination.jsx';
import { fmtDate, fmtDateTime } from '@/utils/format.js';
import { personColor } from '@/utils/colors.js';
import { matchesPerson } from '@/utils/personSearch.js';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
/** Instruments shown on each page. */
export const PAGE_SIZE = 5;

/** Info cell: make (company), then the info cut to 2 lines; "More" opens the full text in the row. */
function InfoCell({ make, info }) {
  const [open, setOpen] = useState(false);
  const long = !!info && (info.length > 70 || info.includes('\n'));
  return (
    <div className="inst-info">
      {make && <span className="inst-clip" title={make}>Make: <strong>{make}</strong></span>}
      {info && <span className={`muted inst-info-text${open ? ' is-open' : ''}`} title={open ? undefined : info}>{info}</span>}
      {long && (
        <button type="button" className="link-btn small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Less' : 'More'}
        </button>
      )}
      {!make && !info && <span className="muted">—</span>}
    </div>
  );
}

const money = (v) => (v == null || v === '' ? null : `₹${Number(v).toLocaleString('en-IN')}`);
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

/** The status chip of an instrument. */
function InstrumentStatus({ status }) {
  if (status === 'FREE') return <span className="chip chip-done">Free</span>;
  if (status === 'IN_USE') return <span className="chip chip-progress">In use at site</span>;
  if (status === 'REPAIR') return <span className="chip chip-late">Under repair</span>;
  return <span className="chip chip-cancel">Removed</span>;
}

/** How long someone had it: "3 days", "5 hours", "20 minutes". */
export function durationText(from, to) {
  const ms = Math.max(0, new Date(to || Date.now()) - new Date(from));
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** Choose a person from the employee list, grouped by department. */
function PersonSelect({ people, value, onChange, label, emptyLabel, required = false, excludeId }) {
  const shown = people.filter((p) => String(p.id) !== String(excludeId));
  const departments = [...new Set(shown.map((p) => p.department?.trim() || ''))].sort((a, b) => (a || '~').localeCompare(b || '~'));
  return (
    <label>{label}
      <select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
        <option value="">{emptyLabel}</option>
        {departments.map((d) => (
          <optgroup key={d || 'none'} label={d || 'No department'}>
            {shown.filter((p) => (p.department?.trim() || '') === d).map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Add instrument: its details, and optionally the person who takes it now. */
function AddInstrumentForm({ people, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', make: '', info: '', holderId: '', location: '', project: '', note: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await instrumentService.add({
        name: form.name.trim(), make: form.make.trim(), info: form.info.trim(),
        holderId: form.holderId ? Number(form.holderId) : null,
        location: form.holderId ? form.location.trim() : null, project: form.holderId ? form.project.trim() : null,
        note: form.holderId ? form.note.trim() : null,
      });
      onSaved(`“${form.name.trim()}” added${form.holderId ? ` and given to ${people.find((p) => String(p.id) === form.holderId)?.fullName}` : ' to the office store'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add instrument" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Instrument name<input value={form.name} onChange={set('name')} required autoFocus maxLength={120}
          placeholder="e.g. Moisture meter" /></label>
        <div className="grid-2">
          <label>Make (company)<input value={form.make} onChange={set('make')} maxLength={120}
            placeholder="e.g. Bosch" /></label>
          <PersonSelect people={people} value={form.holderId} onChange={(v) => setForm((f) => ({ ...f, holderId: v }))}
            label="Give it to" emptyLabel="Nobody yet — keep in office store" />
        </div>
        <label>Instrument info<textarea rows={2} value={form.info} onChange={set('info')} maxLength={1000}
          placeholder="e.g. Pin + pinless, for wall / slab dampness before waterproofing" /></label>
        {form.holderId && (
          <>
            <div className="grid-2">
              <label>Site location<input value={form.location} onChange={set('location')} required maxLength={160} placeholder="e.g. Kharadi" /></label>
              <label>Project<input value={form.project} onChange={set('project')} maxLength={160} placeholder="e.g. AIGP Washroom – Block 2" /></label>
            </div>
            <label>Note<input value={form.note} onChange={set('note')} maxLength={500} placeholder="Optional" /></label>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={saving}>Add instrument</button>
        </div>
      </form>
    </Modal>
  );
}

/** Edit details: name, make (company) and info. Who has it does not change here. */
function EditInstrumentForm({ instrument, onClose, onSaved }) {
  const [form, setForm] = useState({ name: instrument.name, make: instrument.make || '', info: instrument.info || '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await instrumentService.update(instrument.id, { name: form.name.trim(), make: form.make.trim(), info: form.info.trim() });
      onSaved(`“${form.name.trim()}” saved.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Edit ${instrument.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Instrument name<input value={form.name} onChange={set('name')} required maxLength={120} /></label>
        <label>Make (company)<input value={form.make} onChange={set('make')} maxLength={120} autoFocus placeholder="e.g. Bosch" /></label>
        <label>Instrument info<textarea rows={3} value={form.info} onChange={set('info')} maxLength={1000} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={saving}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

/** Give a free instrument to a person, or shift it from its holder to another person. */
function GiveForm({ instrument, people, onClose, onSaved }) {
  const shifting = instrument.status === 'IN_USE';
  const [form, setForm] = useState({
    holderId: '', location: shifting ? instrument.location : '', project: shifting ? instrument.project : '', note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await instrumentService.give(instrument.id, {
        holderId: Number(form.holderId), location: form.location.trim(), project: form.project.trim(), note: form.note.trim(),
      });
      const name = people.find((p) => String(p.id) === form.holderId)?.fullName;
      onSaved(`“${instrument.name}” ${shifting ? 'shifted' : 'given'} to ${name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={shifting ? `Shift ${instrument.name}` : `Give ${instrument.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {shifting
          ? <p className="hint">Now with <strong>{instrument.holder?.fullName}</strong> at {instrument.location}{instrument.project && ` · ${instrument.project}`}. The person you choose becomes the owner.</p>
          : <p className="hint">Now free in the office store.</p>}
        <PersonSelect people={people} value={form.holderId} onChange={(v) => setForm((f) => ({ ...f, holderId: v }))}
          label={shifting ? 'Shift to' : 'Give to'} emptyLabel="Choose a person…" required
          excludeId={shifting ? instrument.holder?.id : undefined} />
        <div className="grid-2">
          <label>Site location<input value={form.location} onChange={set('location')} required maxLength={160} placeholder="e.g. Hinjewadi" /></label>
          <label>Project<input value={form.project} onChange={set('project')} maxLength={160} placeholder="e.g. Infosys Phase-II SDB 7" /></label>
        </div>
        <label>Note<input value={form.note} onChange={set('note')} maxLength={500} placeholder="Optional, e.g. needed for slab test" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={saving}>{shifting ? 'Shift instrument' : 'Give instrument'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Submit: back to the office store, free again. */
function SubmitForm({ instrument, onClose, onSaved }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await instrumentService.submit(instrument.id, note.trim());
      onSaved(`“${instrument.name}” submitted to the office store.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Submit ${instrument.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="hint"><strong>{instrument.holder?.fullName}</strong> returns it to the office store. It becomes free for the next person.</p>
        <label>Condition / note<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus
          placeholder="Optional, e.g. working fine, battery low" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={saving}>Submit to office store</button>
        </div>
      </form>
    </Modal>
  );
}

/** Runs a save, shows its error, and tells the page what happened. */
function useSave(onSaved) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const run = async (e, action, message) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await action();
      onSaved(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return { error, saving, run };
}

/** Repair form: what is wrong, where it goes, when it should be back and the estimated cost. */
function RepairForm({ instrument, onClose, onSaved }) {
  const [form, setForm] = useState({ problem: '', repairShop: '', expectedBack: '', estimatedCost: '', note: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const { error, saving, run } = useSave(onSaved);
  const submit = (e) => run(e, () => instrumentService.repair(instrument.id, {
    problem: form.problem.trim(), repairShop: form.repairShop.trim(), expectedBack: form.expectedBack || null,
    estimatedCost: numOrNull(form.estimatedCost), note: form.note.trim(),
  }), `“${instrument.name}” sent for repair to ${form.repairShop.trim()}.`);

  return (
    <Modal title={`Repair ${instrument.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {instrument.status === 'IN_USE'
          ? <p className="hint">Now with <strong>{instrument.holder?.fullName}</strong> at {instrument.location}. Sending it for repair takes it back from them; it shows “Under repair” until it is back.</p>
          : <p className="hint">Now free in the office store. It shows “Under repair” until it is back.</p>}
        <label>What is wrong<textarea rows={2} value={form.problem} onChange={set('problem')} required autoFocus maxLength={500}
          placeholder="e.g. Motor sparking, display not working" /></label>
        <label>Repair shop / service centre<input value={form.repairShop} onChange={set('repairShop')} required maxLength={160}
          placeholder="e.g. Bosch service centre, Pimpri" /></label>
        <div className="grid-2">
          <label>Expected back on<input type="date" value={form.expectedBack} onChange={set('expectedBack')} /></label>
          <label>Estimated cost (₹)<input type="number" min="0" step="1" value={form.estimatedCost} onChange={set('estimatedCost')}
            placeholder="Optional" /></label>
        </div>
        <label>Note<input value={form.note} onChange={set('note')} maxLength={500} placeholder="Optional, e.g. ask for the bill" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={saving}>Send for repair</button>
        </div>
      </form>
    </Modal>
  );
}

/** Back from repair: what it cost and what was done. Free in the office store again. */
function RepairDoneForm({ instrument, onClose, onSaved }) {
  const [form, setForm] = useState({ repairCost: '', note: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const { error, saving, run } = useSave(onSaved);
  const r = instrument.repair;
  const submit = (e) => run(e, () => instrumentService.repairDone(instrument.id, {
    repairCost: numOrNull(form.repairCost), note: form.note.trim(),
  }), `“${instrument.name}” is back from repair, free in the office store.`);

  return (
    <Modal title={`${instrument.name} back from repair`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {r && <p className="hint">At <strong>{r.repairShop}</strong> since {fmtDate(r.sentAt)}: {r.problem}
          {money(r.estimatedCost) && ` · estimated ${money(r.estimatedCost)}`}</p>}
        <label>Repair cost (₹)<input type="number" min="0" step="1" value={form.repairCost} onChange={set('repairCost')} autoFocus
          placeholder="Optional" /></label>
        <label>What was done<input value={form.note} onChange={set('note')} maxLength={500} placeholder="Optional, e.g. motor brushes changed" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={saving}>Back in office store</button>
        </div>
      </form>
    </Modal>
  );
}

/** Remove from the list, with the reason. Who removed it is saved; the history stays. */
function RemoveForm({ instrument, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const { error, saving, run } = useSave(onSaved);
  const submit = (e) => run(e, () => instrumentService.remove(instrument.id, reason.trim()),
    `“${instrument.name}” removed from the list.`);
  return (
    <Modal title={`Remove ${instrument.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="hint">It leaves the Instruments list.
          {instrument.status === 'IN_USE' && <> <strong>{instrument.holder?.fullName}</strong> will no longer have it.</>}
          {' '}Your name, the date and the reason are saved, and you can still see it under “Removed”.</p>
        <label>Why is it removed<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus
          maxLength={500} placeholder="e.g. Damaged beyond repair, lost at site, sold" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn danger" disabled={saving || !reason.trim()}>Remove instrument</button>
        </div>
      </form>
    </Modal>
  );
}

/** Who had it, from the start to now. */
function HistoryDialog({ instrument, onClose }) {
  const [list, setList] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    instrumentService.history(instrument.id).then(setList).catch((e) => setError(e.message));
    instrumentService.repairs(instrument.id).then(setRepairs).catch(() => {});
  }, [instrument.id]);

  return (
    <Modal title={`${instrument.name} — history`} onClose={onClose}>
      <p className="muted small">Added {fmtDateTime(instrument.createdAt)} by {instrument.createdBy?.fullName}.</p>
      {instrument.removedAt && (
        <p className="error small">Removed {fmtDateTime(instrument.removedAt)} by {instrument.removedBy?.fullName}: {instrument.removedReason}</p>
      )}
      {error && <p className="error">{error}</p>}
      {repairs.length > 0 && (
        <>
          <h3 className="inst-history-title">Repairs</h3>
          <ol className="inst-history">
            {[...repairs].reverse().map((r) => (
              <li key={r.id} className={r.returnedAt ? '' : 'is-now'}>
                <div className="inst-history-head">
                  <strong>{r.repairShop}</strong>
                  {!r.returnedAt && <span className="chip chip-late">Under repair now</span>}
                </div>
                <p className="small">{r.problem}</p>
                <p className="small">
                  {fmtDateTime(r.sentAt)} → {r.returnedAt ? fmtDateTime(r.returnedAt) : `now${r.expectedBack ? ` (expected ${fmtDate(r.expectedBack)})` : ''}`}
                  <span className="muted"> ({durationText(r.sentAt, r.returnedAt)})</span>
                </p>
                <p className="muted small">
                  Sent by {r.sentBy?.fullName}{money(r.estimatedCost) && ` · estimated ${money(r.estimatedCost)}`}{r.note && ` · ${r.note}`}
                  {r.returnedAt && <> · Back, marked by {r.returnedBy?.fullName}{money(r.repairCost) && ` · cost ${money(r.repairCost)}`}{r.returnNote && `: ${r.returnNote}`}</>}
                </p>
              </li>
            ))}
          </ol>
          <h3 className="inst-history-title">Who had it</h3>
        </>
      )}
      {list === null && !error ? <p className="muted">Loading…</p> : list?.length === 0 ? (
        <p className="muted">Nobody has used it yet. It has been in the office store since it was added.</p>
      ) : (
        <ol className="inst-history">
          {[...(list || [])].reverse().map((u) => (
            <li key={u.id} className={u.endedAt ? '' : 'is-now'}>
              <div className="inst-history-head">
                <strong>{u.holder?.fullName}</strong>
                {u.holder?.department && <span className="muted small"> · {u.holder.department}</span>}
                {!u.endedAt && <span className="chip chip-progress">Has it now</span>}
              </div>
              <p className="small">{u.location}{u.project && ` · ${u.project}`}</p>
              <p className="small">
                {fmtDateTime(u.startedAt)} → {u.endedAt ? fmtDateTime(u.endedAt) : 'now'}
                <span className="muted"> ({durationText(u.startedAt, u.endedAt)})</span>
              </p>
              <p className="muted small">
                Given by {u.givenBy?.fullName}{u.note && `: ${u.note}`}
                {u.endAction === 'SUBMITTED' && <> · Submitted to office store by {u.endedBy?.fullName}{u.endNote && `: ${u.endNote}`}</>}
                {u.endAction === 'SHIFTED' && <> · Shifted by {u.endedBy?.fullName}{u.endNote && `: ${u.endNote}`}</>}
                {u.endAction === 'REPAIR' && <> · Sent for repair by {u.endedBy?.fullName}{u.endNote && `: ${u.endNote}`}</>}
                {u.endAction === 'REMOVED' && <> · Removed by {u.endedBy?.fullName}{u.endNote && `: ${u.endNote}`}</>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

/**
 * Instruments tab: the company's site instruments, who has each one now and where, with its history.
 * Separate from tasks; it only uses the employee list. Everyone can add, give, shift, submit, repair and remove.
 * 5 instruments per page.
 */
export default function InstrumentsPage() {
  const [list, setList] = useState(null);
  const [removed, setRemoved] = useState(null);   // loaded when the "Removed" filter is picked
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);   // { kind: 'add' | 'give' | 'submit' | 'repair' | 'repairDone' | 'remove' | 'history', instrument }
  const removedView = status === 'REMOVED';

  const load = () => {
    instrumentService.list().then(setList).catch((e) => setError(e.message));
    if (removedView || removed) instrumentService.removed().then(setRemoved).catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
    employeeService.directory().then(setPeople).catch(() => {});
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (removedView && removed === null) instrumentService.removed().then(setRemoved).catch((e) => setError(e.message));
  }, [removedView, removed]);
  useEffect(() => { setPage(1); }, [q, status]);

  const saved = (text) => { setDialog(null); setMessage(text); setError(''); load(); };
  const source = removedView ? removed : list;
  const needle = q.trim().toLowerCase();
  const shown = (source || []).filter((i) => (removedView || !status || i.status === status)
    && (!needle || [i.name, i.make, i.info, i.location, i.project, i.removedReason, i.repair?.repairShop]
      .some((v) => v?.toLowerCase().includes(needle))
      || (i.holder && matchesPerson(i.holder, q)) || (i.removedBy && matchesPerson(i.removedBy, q))));
  const count = (s) => (list || []).filter((i) => i.status === s).length;
  const current = Math.min(page, pageCount(shown.length, PAGE_SIZE));   // stays valid when the list shrinks
  const pageRows = pageSlice(shown, current, PAGE_SIZE);
  const open = (kind, instrument) => () => setDialog({ kind, instrument });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Instruments</h1>
          <p className="muted">Site instruments, who has them now, and where they are.
            {list && list.length > 0 && ` ${list.length} instruments · ${count('FREE')} free · ${count('IN_USE')} in use`}
            {count('REPAIR') > 0 && ` · ${count('REPAIR')} under repair`}{list && list.length > 0 && '.'}</p>
        </div>
        <button className="btn primary" onClick={() => setDialog({ kind: 'add' })}>+ Add instrument</button>
      </header>
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="error">{error}</p>}

      {list && (list.length > 0 || removedView) && (
        <div className="employee-search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search instruments"
            placeholder="Search instrument, make, person, location or project" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All</option>
            <option value="FREE">Free</option>
            <option value="IN_USE">In use at site</option>
            <option value="REPAIR">Under repair</option>
            <option value="REMOVED">Removed</option>
          </select>
          {/* arrows at the top too, so the next page is one click away without scrolling down */}
          <div className="inst-top-pager">
            <Pagination compact page={current} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage}
              label="Instrument pages (top)" />
          </div>
        </div>
      )}

      {source === null ? <p className="muted">Loading…</p> : source.length === 0 ? (
        <section className="panel"><p className="muted">{removedView ? 'No instrument has been removed.'
          : 'No instruments yet. Use “Add instrument” to add the first one.'}</p></section>
      ) : shown.length === 0 ? (
        <p className="muted">No instrument matches. <button className="link-btn" onClick={() => { setQ(''); setStatus(''); }}>Clear filters</button></p>
      ) : (
        <>
        <div className="table-wrap">
          <table className="table inst-table">
            <colgroup>
              <col className="c-sr" /><col className="c-name" /><col className="c-info" /><col className="c-status" />
              <col className="c-loc" /><col className="c-owner" /><col className="c-hist" /><col className="c-act" />
            </colgroup>
            <thead>
              <tr>
                <th>Sr No</th><th>Instrument name</th><th>Instrument info</th><th>Status</th>
                <th>Location &amp; project</th><th>Owner (has it now)</th><th>History</th><th><span>Action</span></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((i) => (
                <tr key={i.id}>
                  <td className="inst-sr">{i.srNo}</td>
                  <td>
                    <strong className="inst-clip" title={i.name}>{i.name}</strong>
                    {i.status !== 'REMOVED' && (
                      <button type="button" className="link-btn small" onClick={open('edit', i)} aria-label={`Edit ${i.name}`}>Edit</button>
                    )}
                  </td>
                  <td><InfoCell make={i.make} info={i.info} /></td>
                  <td><InstrumentStatus status={i.status} /></td>
                  <td>
                    {i.status === 'REPAIR' && <span className="muted small block">At repair</span>}
                    <strong className="block inst-clip" title={i.location}>{i.location}</strong>
                    {i.project && <span className="muted small inst-clip2" title={i.project}>{i.project}</span>}
                    {i.status === 'REPAIR' && i.repair && (
                      <span className="muted small inst-clip2" title={i.repair.problem}>
                        {i.repair.problem}{i.repair.expectedBack && ` · back by ${fmtDate(i.repair.expectedBack)}`}
                      </span>
                    )}
                  </td>
                  <td>
                    {i.holder ? (
                      <span className="inst-owner">
                        <span className="avatar small" style={{ background: personColor(i.holder.fullName) }} aria-hidden="true">{initials(i.holder.fullName)}</span>
                        <span className="inst-owner-text">
                          <strong className="block inst-clip" title={i.holder.fullName}>{i.holder.fullName}</strong>
                          <small className="muted">{[i.holder.department, i.heldSince && `since ${fmtDateTime(i.heldSince)}`].filter(Boolean).join(' · ')}</small>
                        </span>
                      </span>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td>
                    <button className="btn ghost small inst-hist-btn" onClick={open('history', i)}
                      aria-label={`History of ${i.name}`}>View</button>
                  </td>
                  <td className="inst-actions">
                    {i.status === 'REMOVED' ? (
                      <span className="small inst-removed">
                        <span className="muted block">Removed {fmtDate(i.removedAt)} by</span>
                        <strong className="block inst-clip" title={i.removedBy?.fullName}>{i.removedBy?.fullName}</strong>
                        <span className="muted inst-clip2" title={i.removedReason}>{i.removedReason}</span>
                      </span>
                    ) : (
                      <div className="inst-action-grid">
                        {i.status === 'FREE' && (
                          <button className="btn primary small" onClick={open('give', i)}>Give to person</button>
                        )}
                        {i.status === 'IN_USE' && (
                          <>
                            <button className="btn ghost small" onClick={open('submit', i)}>Submit</button>
                            <button className="btn primary small" onClick={open('give', i)}>Shift</button>
                          </>
                        )}
                        {i.status === 'REPAIR' ? (
                          <button className="btn primary small" onClick={open('repairDone', i)}>Back from repair</button>
                        ) : (
                          <button className="btn ghost small" onClick={open('repair', i)} aria-label={`Repair ${i.name}`}>Repair</button>
                        )}
                        <button className="btn danger-ghost small" onClick={open('remove', i)} aria-label={`Remove ${i.name}`}>Remove</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={current} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} label="Instrument pages" />
        </>
      )}
      <p className="muted small">Submit = back to the office store (Free). Shift = give it to another person; that person becomes the owner.
        Repair = fill the repair form; it shows “Under repair” until you press “Back from repair”. Remove = take it off the list with a reason
        (your name is saved; see it under “Removed”). History shows everyone who had it and every repair.</p>

      {dialog?.kind === 'add' && <AddInstrumentForm people={people} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'edit' && <EditInstrumentForm instrument={dialog.instrument} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'give' && <GiveForm instrument={dialog.instrument} people={people} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'submit' && <SubmitForm instrument={dialog.instrument} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'repair' && <RepairForm instrument={dialog.instrument} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'repairDone' && <RepairDoneForm instrument={dialog.instrument} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'remove' && <RemoveForm instrument={dialog.instrument} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'history' && <HistoryDialog instrument={dialog.instrument} onClose={() => setDialog(null)} />}
    </div>
  );
}
