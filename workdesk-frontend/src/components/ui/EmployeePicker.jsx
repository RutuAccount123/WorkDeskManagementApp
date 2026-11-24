import { useMemo, useState } from 'react';
import { matchesPerson } from '@/utils/personSearch.js';

const NO_DEPARTMENT = '__none__';
const deptOf = (p) => p.department?.trim() || '';

/**
 * Employee picker: pick a department (optional) and search, then tick people in a list grouped by department.
 * selectedIds may hold numbers or strings; ids are compared as strings.
 * onSelectMany(ids, checked): optional, lets "Select everyone in <department>" tick or untick a whole department at once.
 */
export default function EmployeePicker({
  legend = 'Assign to',
  people,
  selectedIds,
  onToggle,
  onSelectMany,
  currentUserId,
  multiple = true,
  disabled = false,
  selectAll, // optional { label, checked, onChange }
}) {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const selected = useMemo(() => selectedIds.map(String), [selectedIds]);
  const nameOf = (p) => (String(p.id) === String(currentUserId) ? `Me (${p.fullName})` : p.fullName);

  const departments = [...new Set(people.map(deptOf).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const hasNoDepartment = people.some((p) => !deptOf(p));
  const showDepartments = departments.length > 1 || (departments.length === 1 && hasNoDepartment);

  const q = query.trim();
  const inDepartment = (p) => !department || (department === NO_DEPARTMENT ? !deptOf(p) : deptOf(p) === department);
  const filtered = people.filter((p) => inDepartment(p) && matchesPerson(p, q));
  const groups = [...departments, ...(hasNoDepartment ? [''] : [])]
    .map((name) => ({ name, items: filtered.filter((p) => deptOf(p) === name) }))
    .filter((g) => g.items.length > 0);

  // "Select everyone in this department": the people shown, except me
  const departmentIds = filtered.filter((p) => String(p.id) !== String(currentUserId)).map((p) => String(p.id));
  const allDepartmentSelected = departmentIds.length > 0 && departmentIds.every((id) => selected.includes(id));
  const departmentName = department === NO_DEPARTMENT ? 'No department' : department;
  const countIn = (name) => people.filter((p) => deptOf(p) === name).length;

  return (
    <fieldset className="assignee-picker compact" disabled={disabled}>
      <legend>{legend}</legend>
      {multiple && selected.length > 0 && <p className="muted small emp-count" role="status">{selected.length} selected</p>}
      <div className="emp-filters">
        {showDepartments && (
          <select className="emp-department" value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
            <option value="">All departments ({people.length})</option>
            {departments.map((name) => <option key={name} value={name}>{name} ({countIn(name)})</option>)}
            {hasNoDepartment && <option value={NO_DEPARTMENT}>No department ({countIn('')})</option>}
          </select>
        )}
        <input type="search" className="emp-search" placeholder="Search employee…" aria-label="Search employee"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="emp-list">
        {selectAll && !q && !department && (
          <label className="emp-option emp-option-all">
            <input type="checkbox" checked={selectAll.checked} onChange={selectAll.onChange} />
            <span>{selectAll.label}</span>
          </label>
        )}
        {multiple && onSelectMany && department && !q && departmentIds.length > 0 && (
          <label className="emp-option emp-option-all">
            <input type="checkbox" checked={allDepartmentSelected}
              onChange={() => onSelectMany(departmentIds, !allDepartmentSelected)} />
            <span>Select everyone in {departmentName} ({departmentIds.length})</span>
          </label>
        )}
        {groups.map((g) => (
          <div key={g.name || NO_DEPARTMENT} className="emp-group" role="group" aria-label={g.name || 'No department'}>
            {showDepartments && !department && <p className="emp-group-title">{g.name || 'No department'}</p>}
            {g.items.map((p) => (
              <label key={p.id} className="emp-option" title={p.department || undefined}>
                <input type={multiple ? 'checkbox' : 'radio'} name={multiple ? undefined : 'employee-picker'}
                  checked={selected.includes(String(p.id))} onChange={() => onToggle(p.id)} />
                <span>{nameOf(p)}</span>
              </label>
            ))}
          </div>
        ))}
        {filtered.length === 0 && <p className="muted small emp-empty">No employee found</p>}
      </div>
    </fieldset>
  );
}
