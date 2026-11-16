import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicFormService } from '@/services/index.js';
import { APP_NAME } from '@/config/env.js';
import FormQuestion from '@/components/form/FormQuestion.jsx';

/**
 * /f/:token: the shareable FMS form, laid out like a Google Form
 * (header card, then one card per question). Opens without signing in.
 * Sending it adds a new entry to that FMS (step 1 starts straight away).
 */
export default function PublicFormPage() {
  const { token } = useParams();
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [values, setValues] = useState({});
  const [filledByName, setFilledByName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    publicFormService.get(token)
      .then((f) => { setForm(f); document.title = f.name; })
      .catch((err) => setLoadError(err.status === 404 ? 'This form link is not valid, or it has been turned off.' : err.message));
  }, [token]);

  const set = (id, v) => setValues((old) => ({ ...old, [id]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await publicFormService.submit(token, values, filledByName);
      setSent(true);
      document.querySelector('.gform')?.scrollIntoView?.({ block: 'start' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => { setValues({}); setFilledByName(''); setError(''); };
  const again = () => { clear(); setSent(false); };
  const anyRequired = !!form; // "Your name" is always required

  return (
    <div className="gform">
      <main className="gform-wrap">
        {loadError ? (
          <section className="gform-card gform-head">
            <h1>Form not available</h1>
            <p className="gform-desc">{loadError}</p>
          </section>
        ) : !form ? (
          <section className="gform-card gform-head"><p className="gform-desc">Loading…</p></section>
        ) : sent ? (
          <section className="gform-card gform-head" role="status">
            <h1>{form.name}</h1>
            <p className="gform-desc">Your response has been recorded.</p>
            {form.signedInAs && <p className="gform-desc">Your “Fill the form” task for this link is marked as done.</p>}
            <button type="button" className="gform-link" onClick={again}>Submit another response</button>
          </section>
        ) : (
          <form onSubmit={submit}>
            <section className="gform-card gform-head">
              <h1>{form.name}</h1>
              {form.description && <p className="gform-desc">{form.description}</p>}
              {anyRequired && <p className="gform-req-note"><span className="gform-req">*</span> Indicates required question</p>}
            </section>

            {/* always asked: this name is what the FMS sheet shows as "Filled by" */}
            <section className="gform-card gform-q">
              <label htmlFor="q-filled-by" className="gform-q-title">
                Your name<span className="gform-req" aria-hidden="true"> *</span>
              </label>
              <input id="q-filled-by" className="gform-input" value={filledByName} maxLength={120} required
                autoComplete="name" placeholder="Your answer" disabled={busy}
                onChange={(e) => setFilledByName(e.target.value)} />
            </section>

            {form.formFields.map((f) => (
              <FormQuestion key={f.id} field={f} value={values[f.id]} onChange={(v) => set(f.id, v)} disabled={busy} />
            ))}

            {form.formFields.length === 0 && (
              <section className="gform-card"><p className="gform-desc">This form has no questions. Press Submit to send an entry.</p></section>
            )}

            {error && <p className="gform-error" role="alert">{error}</p>}

            <div className="gform-actions">
              <button className="btn primary gform-submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</button>
              <button type="button" className="gform-link" onClick={clear} disabled={busy}>Clear form</button>
            </div>
          </form>
        )}
        <p className="gform-footer">Never submit passwords through this form. · {APP_NAME}</p>
      </main>
    </div>
  );
}
