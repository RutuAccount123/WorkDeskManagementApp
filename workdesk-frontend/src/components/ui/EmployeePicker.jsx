import { useMemo, useState } from 'react';

/**
 * Simple employee picker: a search box with the employee list (round checkboxes) right below it.
 * selectedIds may hold numbers or strings; ids are compared as strings.
 */
export default function EmployeePicker({
  legend = 'Assign to',
  people,
  selectedIds,
  onToggle,
  currentUserId,
  multiple = true,
  disabled = false,
  selectAll, // optional { label, checked, onChange }
}) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => selectedIds.map(String), [selectedIds]);
  const nameOf = (p) => (String(p.id) === String(currentUserId) ? `Me (${p.fullName})` : p.fullName);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? people.filter((p) => [p.fullName, p.department, p.email, p.employeeCode]
      .some((v) => v && String(v).toLowerCase().includes(q)))
    : people;

  return (
    <fieldset className="assignee-picker compact" disabled={disabled}>
      <legend>{legend}</legend>
      <input type="search" className="emp-search" placeholder="Search employee…" aria-label="Search employee"
        value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="emp-list">
        {selectAll && !q && (
          <label className="emp-option emp-option-all">
            <input type="checkbox" checked={selectAll.checked} onChange={selectAll.onChange} />
            <span>{selectAll.label}</span>
          </label>
        )}
        {filtered.map((p) => (
          <label key={p.id} className="emp-option" title={p.department || undefined}>
            <input type={multiple ? 'checkbox' : 'radio'} name={multiple ? undefined : 'employee-picker'}
              checked={selected.includes(String(p.id))} onChange={() => onToggle(p.id)} />
            <span>{nameOf(p)}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="muted small emp-empty">No employee found</p>}
      </div>
    </fieldset>
  );
}
