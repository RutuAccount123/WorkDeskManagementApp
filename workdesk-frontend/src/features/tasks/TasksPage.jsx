import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { employeeService, taskService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL } from '@/utils/format.js';
import TaskBoard from '@/features/tasks/TaskBoard.jsx';
import TaskForm from '@/features/tasks/TaskForm.jsx';
import AddWorkForm from '@/features/my-work/AddWorkForm.jsx';
import TaskPanel from '@/features/tasks/TaskPanel.jsx';
import { groupFmsTasks } from './taskGroups.js';

const STATUS_VIEWS = [
  { key: 'open', label: 'Open', statuses: ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED'] },
  { key: 'SUBMITTED', label: 'Needs review', statuses: ['SUBMITTED'] },
  { key: 'COMPLETED', label: 'Done', statuses: ['COMPLETED'] },
  { key: 'all', label: 'All', statuses: [] },
];

/** Whose tasks to show. Admins also get "Everyone". */
const SCOPES = [
  { key: 'all', label: 'Everyone', adminOnly: true },
  { key: 'assigned', label: 'Assigned to me' },
  { key: 'created', label: 'I assigned' },
  { key: 'review', label: 'To review' },
];

export default function Tasks() {
  const { isAdmin, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tasks, setTasks] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [approving, setApproving] = useState(false);

  const scope = params.get('scope') || (isAdmin ? 'all' : 'assigned');
  const view = params.get('status') || 'open';
  const assigneeId = params.get('assigneeId') || '';
  const priority = params.get('priority') || '';
  const overdue = params.get('overdue') === '1';
  const dueToday = params.get('dueToday') === '1';
  const completedThisWeek = params.get('completedThisWeek') === '1';
  const q = params.get('q') || '';
  const openId = params.get('open');

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    try {
      const statuses = (STATUS_VIEWS.find((v) => v.key === view) || STATUS_VIEWS[0]).statuses;
      const results = await taskService.list({
        scope, status: statuses, assigneeId: scope === 'all' ? assigneeId : '', priority, overdue: overdue || '', q,
      });
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      setTasks(results.filter((task) => {
        if (dueToday && (!task.dueAt || new Date(task.dueAt) < todayStart || new Date(task.dueAt) >= tomorrowStart)) return false;
        if (completedThisWeek && (!task.completedAt || new Date(task.completedAt) < weekStart || new Date(task.completedAt) >= tomorrowStart)) return false;
        return true;
      }));
    } catch (e) {
      setError(e.message);
    }
  }, [scope, view, assigneeId, priority, overdue, dueToday, completedThisWeek, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelectedTaskIds([]); }, [scope, view, assigneeId, priority, overdue, dueToday, completedThisWeek, q]);
  useEffect(() => { if (isAdmin) employeeService.list().then(setEmployees).catch(() => {}); }, [isAdmin]);

  const reviewableTasks = tasks
    ? groupFmsTasks(tasks).filter((task) => task.status === 'SUBMITTED'
      && (isAdmin || task.reviewer?.id === user.id))
    : [];
  const reviewableIds = reviewableTasks.map((task) => task.id);
  const allReviewableSelected = reviewableIds.length > 0
    && reviewableIds.every((id) => selectedTaskIds.includes(id));
  const toggleReviewableSelection = () => {
    setSelectedTaskIds((selected) => allReviewableSelected
      ? selected.filter((id) => !reviewableIds.includes(id))
      : [...new Set([...selected, ...reviewableIds])]);
  };
  const toggleTaskSelection = (id) => {
    setSelectedTaskIds((selected) => selected.includes(id)
      ? selected.filter((selectedId) => selectedId !== id)
      : [...selected, id]);
  };
  const approveSelected = async () => {
    if (!selectedTaskIds.length) return;
    setApproving(true);
    setError('');
    try {
      await taskService.approveMany(selectedTaskIds);
      setSelectedTaskIds([]);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{isAdmin ? 'Tasks' : 'My tasks'}</h1>
          <p className="muted">{tasks ? `${groupFmsTasks(tasks).length} shown` : ' '}</p>
        </div>
        <div className="row">
          {!isAdmin && <button className="btn ghost" onClick={() => setEditing({ own: true })}>Add my work</button>}
          <button className="btn primary" onClick={() => setEditing({})}>Assign a task</button>
        </div>
      </header>

      <div className="scope-tabs" role="tablist" aria-label="Whose tasks">
        {SCOPES.filter((sc) => isAdmin || !sc.adminOnly).map((sc) => (
          <button key={sc.key} role="tab" aria-selected={scope === sc.key} className={scope === sc.key ? 'on' : ''}
            onClick={() => setParam('scope', sc.key === (isAdmin ? 'all' : 'assigned') ? '' : sc.key)}>
            {sc.label}
          </button>
        ))}
      </div>

      <div className="filters">
        <div className="segmented" role="tablist" aria-label="Status">
          {STATUS_VIEWS.map((v) => (
            <button key={v.key} role="tab" aria-selected={view === v.key}
              className={view === v.key ? 'on' : ''} onClick={() => setParam('status', v.key === 'open' ? '' : v.key)}>
              {v.label}
            </button>
          ))}
        </div>
        <input type="search" placeholder="Search tasks" defaultValue={q} aria-label="Search tasks"
          onKeyDown={(e) => e.key === 'Enter' && setParam('q', e.target.value.trim())}
          onBlur={(e) => e.target.value.trim() !== q && setParam('q', e.target.value.trim())} />
        {isAdmin && scope === 'all' && (
          <select value={assigneeId} onChange={(e) => setParam('assigneeId', e.target.value)} aria-label="Person">
            <option value="">Everyone</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </select>
        )}
        <select value={priority} onChange={(e) => setParam('priority', e.target.value)} aria-label="Priority">
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={overdue} onChange={(e) => setParam('overdue', e.target.checked ? '1' : '')} />
          Overdue only
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {reviewableTasks.length > 0 && (
        <div className="row task-bulk-actions">
          <label className="check">
            <input type="checkbox" checked={allReviewableSelected} onChange={toggleReviewableSelection} />
            Select all submitted tasks ({reviewableTasks.length})
          </label>
          <button className="btn primary" disabled={!selectedTaskIds.length || approving} onClick={approveSelected}>
            {approving ? 'Approving…' : `Approve selected${selectedTaskIds.length ? ` (${selectedTaskIds.length})` : ''}`}
          </button>
        </div>
      )}
      {tasks === null ? <p className="muted">Loading…</p> : (
        <TaskBoard tasks={tasks} onOpen={(id) => setParam('open', String(id))} showAssignee={scope !== 'assigned'} cardLayout
          selectableTaskIds={reviewableIds} selectedTaskIds={selectedTaskIds} onToggleTask={toggleTaskSelection}
          emptyText={scope === 'review' ? 'Nothing waiting for your review.'
            : scope === 'created' ? 'You haven’t assigned any matching tasks to others.'
              : view === 'open' ? 'No open tasks match these filters.' : `No ${STATUS_LABEL[view]?.toLowerCase() || ''} tasks match these filters.`} />
      )}

      <TaskPanel openId={openId} onClose={() => { const next = new URLSearchParams(params); next.delete('open'); setParams(next, { replace: true }); }} />
      {editing && (editing.own
        ? <AddWorkForm onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
        : <TaskForm task={null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />)}
    </div>
  );
}
