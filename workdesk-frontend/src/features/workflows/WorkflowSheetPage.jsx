import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { workflowService } from '@/services/index.js';
import FmsTaskSheet from './FmsTaskSheet.jsx';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import StartRunDialog from './StartRunDialog.jsx';
import FormLinkDialog from './FormLinkDialog.jsx';
import { freqText } from './workflowFormat.js';

/** One FMS: page heading with its actions (same layout as other pages), then the sheet and tracker. */
export default function WorkflowSheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [wf, setWf] = useState(null);
  const { user, isAdmin } = useAuth();
  const [starting, setStarting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [version, setVersion] = useState(0); // reloads the sheet after "Start new"
  const canStart = wf?.steps.every((step) => step.assignee);
  const canManage = !!wf && (isAdmin || wf.createdBy?.id === user?.id);

  useEffect(() => { workflowService.get(id).then(setWf).catch(() => setWf(null)); }, [id]);

  return (
    <div className="page">
      <button className="link-btn back-link" onClick={() => navigate('/workflows')}>‹ All FMS</button>
      <header className="page-head">
        <div>
          <h1>{wf?.name || 'FMS sheet'}</h1>
          {wf && <p className="muted">
            {freqText(wf)} · {wf.steps.length} steps · {wf.totalHours} h total
            {wf.department && ` · Department: ${wf.department}`}
            {!canStart && ' · Unassigned'}
            {!wf.active && ' · paused'}
          </p>}
          {wf && !canStart && <p className="muted small">Assign a person to every step before starting this FMS.</p>}
        </div>
        {wf && (
          <div className="row">
            <button className="btn ghost" onClick={() => navigate(`/workflows/${wf.id}/edit`)}>Edit</button>
            {(wf.publicFormToken || canManage) && <button className="btn ghost" onClick={() => setSharing(true)}>Form link</button>}
            {wf.active && canStart && <button className="btn primary" onClick={() => setStarting(true)}>Start new</button>}
          </div>
        )}
      </header>
      <FmsTaskSheet key={version} workflowId={id} heading="Sheet and tracker" />
      {starting && wf && (
        <StartRunDialog workflow={wf} onClose={() => setStarting(false)}
          onStarted={() => { setStarting(false); setVersion((v) => v + 1); }} />
      )}
      {sharing && wf && (
        <FormLinkDialog workflow={wf} canManage={canManage} onClose={() => setSharing(false)} onChanged={setWf} />
      )}
    </div>
  );
}
