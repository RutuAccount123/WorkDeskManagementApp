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

/** Counts up the number at the end, keeping its zeros: INS-009 → INS-010; no number at the end → "-2". Same as the server. */
export function nextCode(code) {
  const m = /^(.*?)(\d+)$/.exec(code);
  if (!m) return `${code}-2`;
  return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0');
}

const usedCodes = (units, selfId) => new Set(units.filter((u) => u.id !== selfId && u.materialCode)
  .map((u) => u.materialCode.trim().toUpperCase()));

/** The codes that `quantity` new units get from `code`: the first as written, the next ones count up skipping used codes. */
export function codesFrom(units, code, quantity) {
  const used = usedCodes(units);
  const out = [];
  let c = (code || '').trim().toUpperCase();
  if (!c) return out;
  out.push(c);
  while (out.length < quantity) {
    do { c = nextCode(c); } while (used.has(c) || out.includes(c));
    out.push(c);
  }
  return out;
}

/** The next free code after the highest code of a material's units (for "add more"): HD-03 → HD-04. */
export function nextFreeCodeFor(units, material) {
  const own = material.units.map((u) => (u.materialCode || '').trim().toUpperCase()).filter(Boolean).sort();
  if (!own.length) return '';
  const used = usedCodes(units);
  let c = own[own.length - 1];
  do { c = nextCode(c); } while (used.has(c));
  return c;
}

/**
 * Each unit has its own material code. Returns a message when another listed unit already has this code
 * (with the next free one), else null.
 */
export function codeTaken(units, code, selfId) {
  const c = (code || '').trim().toUpperCase();
  if (!c) return null;
  const owner = units.find((u) => u.id !== selfId && (u.materialCode || '').trim().toUpperCase() === c);
  if (!owner) return null;
  const used = usedCodes(units, selfId);
  let next = c;
  do { next = nextCode(next); } while (used.has(next));
  return `Material code ${c} is already the code of a “${owner.name}”. Each unit needs its own code; the next free one is ${next}.`;
}

/**
 * Add instrument: its details, how many units, and (for one unit) optionally the person who takes it now.
 * Units with the same name are one material; each unit has its own material code.
 * preset: a material to add more units of (name locked, code filled with its next free code).
 * units: every listed unit, to check codes.
 */
function AddInstrumentForm({ people, preset, units = [], onClose, onSaved }) {
  const [form, setForm] = useState({
    name: preset?.name || '', make: preset?.make || '', materialCode: preset ? nextFreeCodeFor(units, preset) : '',
    info: preset?.info || '', quantity: '1', holderId: '', location: '', project: '', note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const quantity = Math.max(1, Number(form.quantity) || 1);
  const giving = quantity === 1 && !!form.holderId;
  const clash = codeTaken(units, form.materialCode);
  const codes = quantity > 1 ? codesFrom(units, form.materialCode, quantity) : [];

  const submit = async (e) => {
    e.preventDefault();
    if (clash) return;   // the message is already under the code box
    setError('');
    setSaving(true);
    try {
      await instrumentService.add({
        name: form.name.trim(), make: form.make.trim(), materialCode: form.materialCode.trim(), info: form.info.trim(),
        quantity,
        holderId: giving ? Number(form.holderId) : null,
        location: giving ? form.location.trim() : null, project: giving ? form.project.trim() : null,
        note: giving ? form.note.trim() : null,
      });
      const what = quantity > 1 ? `${quantity} × “${form.name.trim()}”` : `“${form.name.trim()}”`;
      onSaved(`${what} added${giving ? ` and given to ${people.find((p) => String(p.id) === form.holderId)?.fullName}` : ' to the office store'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={preset ? `Add more ${preset.name}` : 'Add instrument'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {preset && (
          <p className="hint">More units of <strong>{preset.name}</strong>. Units with the same name are one material,
            so they show in this same list; each one gets its own code.</p>
        )}
        <label>Instrument name<input value={form.name} onChange={set('name')} required autoFocus={!preset} maxLength={120}
          readOnly={!!preset} placeholder="e.g. Moisture meter" /></label>
        <div className="grid-2">
          <label>Make (company)<input value={form.make} onChange={set('make')} maxLength={120}
            placeholder="e.g. Bosch" /></label>
          <label>{quantity > 1 ? 'Material code (first unit)' : 'Material code'}<input value={form.materialCode}
            onChange={set('materialCode')} maxLength={40} aria-invalid={!!clash} placeholder="e.g. HD-01" /></label>
        </div>
        {clash
          ? <p className="error small" role="alert">{clash}</p>
          : codes.length > 1
            ? <p className="muted small">The {quantity} units get the codes <strong>{codes.join(', ')}</strong>.</p>
            : <p className="muted small">Each unit has its own code. Units with the same name are one material.</p>}
        <label>Instrument info<textarea rows={2} value={form.info} onChange={set('info')} maxLength={1000}
          placeholder="e.g. Pin + pinless, for wall / slab dampness before waterproofing" /></label>
        <div className="grid-2">
          <label>Quantity<input type="number" min="1" max="100" step="1" value={form.quantity} onChange={set('quantity')}
            required autoFocus={!!preset} /></label>
          {quantity === 1 ? (
            <PersonSelect people={people} value={form.holderId} onChange={(v) => setForm((f) => ({ ...f, holderId: v }))}
              label="Give it to" emptyLabel="Nobody yet — keep in office store" />
          ) : (
            <p className="hint">All {quantity} go to the office store. Give them to people one by one from the list.</p>
          )}
        </div>
        {giving && (
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
function EditInstrumentForm({ instrument, units = [], onClose, onSaved }) {
  const [form, setForm] = useState({ name: instrument.name, make: instrument.make || '', materialCode: instrument.materialCode || '', info: instrument.info || '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const clash = codeTaken(units, form.materialCode, instrument.id);
  const submit = async (e) => {
    e.preventDefault();
    if (clash) return;   // the message is already under the code box
    setError('');
    setSaving(true);
    try {
      await instrumentService.update(instrument.id, { name: form.name.trim(), make: form.make.trim(), materialCode: form.materialCode.trim(), info: form.info.trim() });
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
        <label>Material code<input value={form.materialCode} onChange={set('materialCode')} maxLength={40} aria-invalid={!!clash} placeholder="e.g. INS-010" /></label>
        {clash && <p className="error small" role="alert">{clash}</p>}
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

/** Units with the same name are one material (each unit keeps its own material code). Capitals and spaces do not matter. */
export const materialKey = (i) => i.name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Materials (one per name) in the order they were first added, each with its units. */
export function groupMaterials(units) {
  const byKey = new Map();
  units.forEach((u) => {
    const key = materialKey(u);
    if (!byKey.has(key)) byKey.set(key, { key, name: u.name, make: u.make, info: u.info, units: [] });
    byKey.get(key).units.push(u);
  });
  return [...byKey.values()];
}

const STATUS_WORD = { FREE: 'free', IN_USE: 'in use', REPAIR: 'under repair' };
const statusSummary = (units) => Object.entries(STATUS_WORD)
  .map(([s, word]) => [units.filter((u) => u.status === s).length, word, s])
  .filter(([n]) => n > 0);

/** Each unit with all its fields: status, where it is, who has it, history and actions. */
function UnitsTable({ rows, srOf, open }) {
  return (
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
          {rows.map((i) => (
            <tr key={i.id}>
              <td className="inst-sr">{srOf(i)}</td>
              <td>
                <strong className="inst-clip" title={i.name}>{i.name}</strong>
                {i.materialCode && <code className="mat-code block-code" title="Material code">{i.materialCode}</code>}
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
  );
}

/** Where the units of a material are: each place with how many ("Office store · 2", "Talegaon · 1"). */
function placesOf(units) {
  const places = new Map();
  units.forEach((u) => {
    const place = u.status === 'REPAIR' ? `${u.location} (repair)` : u.location;
    places.set(place, (places.get(place) || 0) + 1);
  });
  return [...places.entries()];
}

/** First page: one row per material: how many there are, how many free / in use, and where they are. The quantity opens its units. */
function MaterialsTable({ rows, srOf, onOpen }) {
  const countOf = (m, s) => m.units.filter((u) => u.status === s).length;
  return (
    <div className="table-wrap">
      <table className="table inst-table mat-table">
        <colgroup>
          <col className="c-sr" /><col className="c-mname" /><col className="c-qty" /><col className="c-count" />
          <col className="c-count" /><col className="c-where" />
        </colgroup>
        <thead>
          <tr>
            <th>Sr No</th><th>Material</th><th>Quantity</th><th>Free</th><th>In use</th><th>Where they are</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const repair = countOf(m, 'REPAIR');
            return (
              <tr key={m.key}>
                <td className="inst-sr">{srOf(m)}</td>
                <td><strong className="inst-clip" title={m.name}>{m.name}</strong></td>
                <td>
                  <button type="button" className="btn ghost small mat-qty" onClick={() => onOpen(m.key)}
                    aria-label={`Show the ${m.units.length} ${m.name} units`} title="Show each unit">
                    {m.units.length} <span aria-hidden="true">›</span>
                  </button>
                </td>
                <td><span className="mat-count mat-status-free" aria-label={`${countOf(m, 'FREE')} free`}>{countOf(m, 'FREE')}</span></td>
                <td>
                  <span className="mat-count mat-status-in_use" aria-label={`${countOf(m, 'IN_USE')} in use`}>{countOf(m, 'IN_USE')}</span>
                  {repair > 0 && <span className="muted small block mat-status-repair">{repair} under repair</span>}
                </td>
                <td>
                  <ul className="mat-places">
                    {placesOf(m.units).map(([place, n]) => (
                      <li key={place}><span className="inst-clip" title={place}>{place}</span><span className="muted"> · {n}</span></li>
                    ))}
                  </ul>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Instruments tab: the company's site instruments, who has each one now and where, with its history.
 * Separate from tasks; it only uses the employee list. Everyone can add, give, shift, submit, repair and remove.
 * First page: materials (one row each, with quantity). Click the quantity: each unit of that material, with all its fields.
 * 5 rows per page.
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
  const [openKey, setOpenKey] = useState(null);   // the material whose units are shown; null = the materials list
  // { kind: 'add' | 'edit' | 'give' | 'submit' | 'repair' | 'repairDone' | 'remove' | 'history', instrument, preset }
  const [dialog, setDialog] = useState(null);
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
  useEffect(() => { setPage(1); }, [q, status, openKey]);

  const saved = (text) => { setDialog(null); setMessage(text); setError(''); load(); };
  const needle = q.trim().toLowerCase();
  const unitMatches = (i) => !needle || [i.name, i.make, i.materialCode, i.info, i.location, i.project, i.removedReason, i.repair?.repairShop]
    .some((v) => v?.toLowerCase().includes(needle))
    || (i.holder && matchesPerson(i.holder, q)) || (i.removedBy && matchesPerson(i.removedBy, q));
  const statusMatches = (i) => !status || removedView || i.status === status;

  const materials = groupMaterials(list || []);
  const material = openKey ? materials.find((m) => m.key === openKey) : null;
  // view: removed units (flat) · one material's units · the materials list
  const view = removedView ? 'removed' : material ? 'units' : 'materials';
  const rows = view === 'removed' ? (removed || []).filter(unitMatches)
    : view === 'units' ? material.units.filter((u) => statusMatches(u) && unitMatches(u))
      : materials.filter((m) => m.units.some((u) => statusMatches(u) && unitMatches(u)));
  const current = Math.min(page, pageCount(rows.length, PAGE_SIZE));   // stays valid when the list shrinks
  const pageRows = pageSlice(rows, current, PAGE_SIZE);
  const open = (kind, instrument) => () => setDialog({ kind, instrument });
  const count = (s) => (list || []).filter((i) => i.status === s).length;
  const loading = view === 'removed' ? removed === null : list === null;
  const openMaterial = (key) => { setOpenKey(key); setQ(''); setMessage(''); };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Instruments</h1>
          <p className="muted">Site instruments, who has them now, and where they are.
            {list && list.length > 0 && ` ${materials.length} materials · ${list.length} units · ${count('FREE')} free · ${count('IN_USE')} in use`}
            {count('REPAIR') > 0 && ` · ${count('REPAIR')} under repair`}{list && list.length > 0 && '.'}</p>
        </div>
        {/* inside a material, adding means one more unit of it */}
        <button className="btn primary" onClick={() => setDialog({ kind: 'add', preset: material || undefined })}>
          {material ? `+ Add ${material.name}` : '+ Add instrument'}
        </button>
      </header>
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="error">{error}</p>}

      {view === 'units' && (
        <div className="mat-head">
          <button type="button" className="btn ghost small" onClick={() => setOpenKey(null)}>‹ All materials</button>
          <div className="mat-head-title">
            <h2>{material.name}</h2>
            <span className="muted small">
              {material.make && `${material.make} · `}
              {material.units.length} unit{material.units.length === 1 ? '' : 's'}
              {statusSummary(material.units).map(([n, word, s]) => <span key={s}> · {n} {word}</span>)}
            </span>
          </div>
          <button type="button" className="btn ghost small" onClick={() => setDialog({ kind: 'add', preset: material })}>
            + Add more units
          </button>
        </div>
      )}

      {list && (list.length > 0 || removedView) && (
        <div className="employee-search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search instruments"
            placeholder={view === 'materials' ? 'Search material, code, make, person or location' : 'Search code, make, person, location or project'} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All</option>
            <option value="FREE">Free</option>
            <option value="IN_USE">In use at site</option>
            <option value="REPAIR">Under repair</option>
            <option value="REMOVED">Removed</option>
          </select>
          {/* arrows at the top too, so the next page is one click away without scrolling down */}
          <div className="inst-top-pager">
            <Pagination compact page={current} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage}
              label="Instrument pages (top)" />
          </div>
        </div>
      )}

      {loading ? <p className="muted">Loading…</p> : (view === 'removed' ? removed : list).length === 0 ? (
        <section className="panel"><p className="muted">{removedView ? 'No instrument has been removed.'
          : 'No instruments yet. Use “Add instrument” to add the first one.'}</p></section>
      ) : rows.length === 0 ? (
        <p className="muted">No instrument matches. <button className="link-btn" onClick={() => { setQ(''); setStatus(''); }}>Clear filters</button></p>
      ) : (
        <>
          {view === 'materials'
            ? <MaterialsTable rows={pageRows} srOf={(m) => materials.indexOf(m) + 1} onOpen={openMaterial} />
            : <UnitsTable rows={pageRows} open={open}
                srOf={(i) => (view === 'units' ? material.units.indexOf(i) + 1 : i.srNo)} />}
          <Pagination page={current} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} label="Instrument pages" />
        </>
      )}
      <p className="muted small">
        {view === 'materials'
          ? 'Units with the same name are one material; each unit has its own material code. Click the quantity to see each unit: who has it, where, its history, and Give / Shift / Submit / Repair / Remove.'
          : <>Submit = back to the office store (Free). Shift = give it to another person; that person becomes the owner.
            Repair = fill the repair form; it shows “Under repair” until you press “Back from repair”. Remove = take it off the list with a reason
            (your name is saved; see it under “Removed”). History shows everyone who had it and every repair.</>}
      </p>

      {dialog?.kind === 'add' && <AddInstrumentForm people={people} preset={dialog.preset} units={list || []} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'edit' && <EditInstrumentForm instrument={dialog.instrument} units={list || []} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'give' && <GiveForm instrument={dialog.instrument} people={people} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'submit' && <SubmitForm instrument={dialog.instrument} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'repair' && <RepairForm instrument={dialog.instrument} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'repairDone' && <RepairDoneForm instrument={dialog.instrument} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'remove' && <RemoveForm instrument={dialog.instrument} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.kind === 'history' && <HistoryDialog instrument={dialog.instrument} onClose={() => setDialog(null)} />}
    </div>
  );
}
