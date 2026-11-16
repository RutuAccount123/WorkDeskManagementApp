import { useState } from 'react';
import { workflowService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import Modal from '@/components/ui/Modal.jsx';
import FormQuestion from '@/components/form/FormQuestion.jsx';

/**
 * "Start new": fill this workflow's form (same card layout as the shared form link), then step 1
 * is assigned and started right away. No name is asked: "Filled by" is the signed-in member.
 */
export default function StartRunDialog({ workflow, sourceTaskId = null, onClose, onStarted }) {
  const { user } = useAuth();
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const first = workflow.steps[0];
  const anyRequired = workflow.formFields.some((f) => f.required);

  const set = (id, v) => setValues((old) => ({ ...old, [id]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onStarted(await workflowService.startNow(workflow.id, values, sourceTaskId));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Start “${workflow.name}”`} onClose={onClose}>
      <form className="gform-modal" onSubmit={submit}>
        <section className="gform-card gform-head">
          <h2>{workflow.name}</h2>
          {workflow.description && <p className="gform-desc">{workflow.description}</p>}
          <p className="gform-filled-by">Filled by: <strong>{user?.fullName}</strong></p>
          {anyRequired && <p className="gform-req-note"><span className="gform-req">*</span> Indicates required question</p>}
        </section>

        {workflow.formFields.length > 0
          ? workflow.formFields.map((f) => (
            <FormQuestion key={f.id} field={f} value={values[f.id]} onChange={(v) => set(f.id, v)} disabled={busy} />
          ))
          : <section className="gform-card"><p className="gform-desc">This workflow has no form. Step 1 starts as soon as you press Start.</p></section>}

        <p className="hint gform-modal-hint">
          Step 1 “{first.title}” goes to {first.assignee?.fullName} straight away, due in {first.hours} h.
          Each next step is assigned when the one before it is done.
        </p>
        {error && <p className="gform-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Starting…' : 'Start workflow'}</button>
        </div>
      </form>
    </Modal>
  );
}
