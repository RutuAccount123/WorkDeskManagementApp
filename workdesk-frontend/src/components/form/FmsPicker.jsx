import { useState } from 'react';

const NO_DEPARTMENT = '__none__';
const deptOf = (wf) => wf.department?.trim() || '';

/**
 * Pick an existing FMS to save a task's form data in, department-wise:
 * first narrow by department, then choose from the FMS grouped under their department.
 */
export default function FmsPicker({ workflows, value, onChange, label = 'Save form data in existing FMS' }) {
  const [department, setDepartment] = useState('');
  const departments = [...new Set(workflows.map(deptOf).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const hasNoDepartment = workflows.some((wf) => !deptOf(wf));

  const inDepartment = (wf) => !department || (department === NO_DEPARTMENT ? !deptOf(wf) : deptOf(wf) === department);
  const shown = workflows.filter(inDepartment);
  const groups = [...departments, ...(hasNoDepartment ? [''] : [])]
    .map((name) => ({
      name,
      items: shown.filter((wf) => deptOf(wf) === name).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.items.length > 0);

  const pickDepartment = (next) => {
    setDepartment(next);
    // keep the chosen FMS only if it is still in the list
    const still = workflows.find((wf) => String(wf.id) === String(value));
    if (still && next && (next === NO_DEPARTMENT ? deptOf(still) : deptOf(still) !== next)) onChange('');
  };

  return (
    <div className="fms-picker">
      {(departments.length > 0) && (
        <label>FMS department
          <select value={department} onChange={(e) => pickDepartment(e.target.value)}>
            <option value="">All departments ({workflows.length})</option>
            {departments.map((name) => (
              <option key={name} value={name}>{name} ({workflows.filter((wf) => deptOf(wf) === name).length})</option>
            ))}
            {hasNoDepartment && <option value={NO_DEPARTMENT}>No department</option>}
          </select>
        </label>
      )}
      <label>{label}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">No FMS — regular task</option>
          {groups.map((g) => (
            <optgroup key={g.name || NO_DEPARTMENT} label={g.name || 'No department'}>
              {g.items.map((wf) => (
                <option key={wf.id} value={wf.id}>{wf.name}{wf.active ? '' : ' (Paused)'}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  );
}
