/**
 * One question of an FMS form as a Google Form style card (used on the shared form link and in "Start new").
 * select = multiple choice (radio buttons), checkbox = a single "Yes" tick box, other types = an underlined input.
 */
export default function FormQuestion({ field: f, value, onChange, disabled }) {
  const id = `q-${f.id}`;
  const title = (
    <>
      {f.label}
      {f.required && <span className="gform-req" aria-hidden="true"> *</span>}
    </>
  );

  if (f.type === 'select') {
    return (
      <fieldset className="gform-card gform-q" disabled={disabled}>
        <legend className="gform-q-title">{title}</legend>
        <div className="gform-options">
          {f.options.map((o) => (
            <label key={o} className="gform-option">
              <input type="radio" name={id} value={o} checked={value === o} onChange={() => onChange(o)} required={f.required} />
              <span>{o}</span>
            </label>
          ))}
        </div>
        {!f.required && value && (
          <button type="button" className="gform-link gform-clear-choice" onClick={() => onChange('')}>Clear selection</button>
        )}
      </fieldset>
    );
  }

  if (f.type === 'checkbox') {
    return (
      <fieldset className="gform-card gform-q" disabled={disabled}>
        <legend className="gform-q-title">{title}</legend>
        <label className="gform-option">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} required={f.required} />
          <span>Yes</span>
        </label>
      </fieldset>
    );
  }

  const common = {
    id, value: value ?? '', onChange: (e) => onChange(e.target.value), required: f.required, disabled,
    className: 'gform-input', placeholder: f.type === 'date' ? undefined : 'Your answer',
  };
  return (
    <section className="gform-card gform-q">
      <label htmlFor={id} className="gform-q-title">{title}</label>
      {f.type === 'textarea' ? (
        <textarea {...common} rows={3} />
      ) : (
        <input {...common} type={f.type} step={f.type === 'number' ? 'any' : undefined}
          className={`gform-input${f.type === 'date' ? ' gform-date' : ''}`} />
      )}
    </section>
  );
}
