import { useCallback, useEffect, useState } from 'react';
import { workflowService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import StartRunDialog from './StartRunDialog.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { freqText } from './workflowFormat.js';

/**
 * Admins can see daily progress; employees go straight to their own FMS sheets.
 */
export default function WorkflowsPage() {
  const { user, isAdmin } = useAuth();
  const [list, setList] = useState(null);
  const [starting, setStarting] = useState(null);
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    workflowService.list().then(setList).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, ok) => {
    setError(''); setMessage('');
    try { await fn(); if (ok) setMessage(ok); load(); } catch (e) { setError(e.message); }
  };

  const canChange = (wf) => isAdmin || wf.createdBy?.id === user.id;
  const sheetPath = (workflowId) => `/workflows/${workflowId}`;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Workflows (FMS)</h1>
          <p className="muted">Work that happens step by step. Fill the form to start, and when one step is done the next person gets their step automatically.</p>
        </div>
        <button className="btn primary" onClick={() => navigate('/workflows/new')}>New FMS</button>
      </header>

      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2 className="section-title">{isAdmin ? 'All workflows' : 'My FMS'}</h2>
        {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? (
          <p className="empty">No workflows yet. Use <strong>New FMS</strong>, or create one from a task page.</p>
        ) : (
          <ul className={`wf-list ${isAdmin ? '' : 'wf-employee-list'}`}>
            {list.map((wf) => (
              <li key={wf.id} className={`wf-card-link ${wf.active ? '' : 'paused'}`}
                role="link" tabIndex={0} aria-label={`Open ${wf.name} FMS sheet`}
                onClick={(event) => {
                  if (event.target.closest('a, button, input, select, textarea')) return;
                  navigate(sheetPath(wf.id));
                }}
                onKeyDown={(event) => {
                  if (event.target.closest('a, button, input, select, textarea')) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(sheetPath(wf.id));
                  }
                }}>
                <div className="wf-top">
                  <div>
                    <Link className="wf-name" to={sheetPath(wf.id)} onClick={(event) => event.stopPropagation()}>{wf.name}</Link>
                    <div className="wf-card-badges">
                      <span className={`repeat-badge ${wf.frequency === 'DAILY' ? 'rb-daily' : wf.frequency === 'WEEKLY' ? 'rb-weekly' : 'rb-flow'}`}>
                        {freqText(wf)}
                      </span>
                      <span className={`wf-active-badge ${wf.active ? 'active' : ''}`}>{wf.active ? 'Active' : 'Paused'}</span>
                      <span className="muted small">{wf.steps.length} steps · {wf.totalHours} h total</span>
                    </div>
                    <p className="muted small">
                      {`${wf.startTime} to ${wf.endTime}`}
                      {wf.formFields.length > 0 && ` · Form: ${wf.formFields.map((f) => f.label).join(', ')}`}
                      {wf.sourceTask && <> · for task <Link to={`/tasks/${wf.sourceTask.id}`} onClick={(event) => event.stopPropagation()}>{wf.sourceTask.title}</Link></>}
                      {wf.createdBy && ` · set up by ${wf.createdBy.id === user.id ? 'you' : wf.createdBy.fullName}`}
                      {!wf.active && ' · paused'}
                    </p>
                  </div>
                  <span className="row-actions">
                    <button className="btn ghost small" onClick={(event) => { event.stopPropagation(); navigate(sheetPath(wf.id)); }}>Open sheet</button>
                    {wf.active && <button className="btn primary small" onClick={(event) => { event.stopPropagation(); setStarting(wf); }}>Start new</button>}
                    <button className="link-btn" onClick={(event) => { event.stopPropagation(); navigate(`/workflows/${wf.id}/edit`); }}>Edit</button>
                    {canChange(wf) && (
                      <>
                        <button className="link-btn" onClick={(event) => { event.stopPropagation(); act(() => workflowService.setActive(wf.id, !wf.active)); }}>{wf.active ? 'Pause' : 'Resume'}</button>
                        <button className="link-btn danger" onClick={(event) => {
                          event.stopPropagation();
                          window.confirm(`Delete “${wf.name}”? Past runs stay in the record.`)
                            && act(() => workflowService.remove(wf.id));
                        }}>Delete</button>
                      </>
                    )}
                  </span>
                </div>
                <ol className="wf-steps">
                  {wf.steps.map((s) => (
                    <li key={s.step}>
                      <span className="run-num">{s.step}</span>
                      <span><strong>{s.title}</strong><small className="muted"> {s.assignee?.fullName}, {s.hours} h{s.checklist.length > 0 && `, ${s.checklist.length} checks`}</small></span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </section>

      {starting && (
        <StartRunDialog workflow={starting} onClose={() => setStarting(null)}
          onStarted={(run) => { setStarting(null); setMessage(`Started “${run.name}”${run.label ? ` for ${run.label}` : ''}. Step 1 is assigned.`); load(); }} />
      )}
    </div>
  );
}
