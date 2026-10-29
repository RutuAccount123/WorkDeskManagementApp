import { answerText } from '@/features/workflows/workflowFormat.js';

/**
 * Renders a form from a list of field definitions:
 *   { id, label, type: text | textarea | number | date | select | checkbox, required, options[] }
 * `values` is { [fieldId]: value }; `onChange(nextValues)` is called on every edit.
 */
export default function DynamicForm({ fields, values, onChange, disabled = false }) {
  const set = (id, v) => onChange({ ...values, [id]: v });

  return (
    <div className="dyn-form">
      {fields.map((f) => {
        const v = values[f.id] ?? (f.type === 'checkbox' ? false : '');
        const label = <>{f.label}{f.required && <span className="req" aria-hidden="true"> *</span>}</>;
        if (f.type === 'checkbox') {
          return (
            <label key={f.id} className="check dyn-check">
              <input type="checkbox" checked={!!v} onChange={(e) => set(f.id, e.target.checked)} disabled={disabled} />
              {label}
            </label>
          );
        }
        return (
          <label key={f.id} className={f.type === 'textarea' ? 'dyn-wide' : ''}>
            {label}
            {f.type === 'textarea' ? (
              <textarea rows={3} value={v} onChange={(e) => set(f.id, e.target.value)} required={f.required} disabled={disabled} />
            ) : f.type === 'select' ? (
              <select value={v} onChange={(e) => set(f.id, e.target.value)} required={f.required} disabled={disabled}>
                <option value="">Choose…</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={f.type} value={v} onChange={(e) => set(f.id, e.target.value)} required={f.required} disabled={disabled}
                step={f.type === 'number' ? 'any' : undefined} />
            )}
          </label>
        );
      })}
    </div>
  );
}

/** Read-only view of filled answers. */
export function FormAnswers({ fields, values }) {
  if (!values) return null;
  return (
    <dl className="answers">
      {fields.map((f) => {
        const v = values[f.id];
        const shown = answerText(f, v) || '—';
        return <div key={f.id}><dt>{f.label}</dt><dd>{shown}</dd></div>;
      })}
    </dl>
  );
}
