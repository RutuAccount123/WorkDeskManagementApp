import { useState } from 'react';
import { workflowService } from '@/services/index.js';
import Modal from '@/components/ui/Modal.jsx';
import DynamicForm from '@/components/form/DynamicForm.jsx';

/** "Start new": fill this workflow's form, then step 1 is assigned and started right away. */
export default function StartRunDialog({ workflow, sourceTaskId = null, onClose, onStarted }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const first = workflow.steps[0];

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
      <form className="form" onSubmit={submit}>
        {workflow.formFields.length > 0
          ? <DynamicForm fields={workflow.formFields} values={values} onChange={setValues} />
          : <p className="muted">This workflow has no form. Step 1 starts as soon as you press Start.</p>}
        <p className="hint">
          Step 1 “{first.title}” goes to {first.assignee?.fullName} straight away, due in {first.hours} h.
          Each next step is assigned when the one before it is done.
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>Start workflow</button>
        </div>
      </form>
    </Modal>
  );
}
