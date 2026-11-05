import { Link } from 'react-router-dom';
import { LANES, PRIORITY_LABEL, fmtDateTime, laneOf, relativeDue } from '@/utils/format.js';
import StatusChip from '@/components/ui/StatusChip.jsx';
import { groupFmsTasks } from './taskGroups.js';

/** Tasks grouped into deadline lanes: Overdue, Due today, Next 7 days, Later, No date, Done. */
export default function TaskBoard({
  tasks, onOpen, showAssignee, hideClosed = false, emptyText, lanes: onlyLanes,
  maxPerLane, moreLink, cardLayout = false, selectableTaskIds = [], selectedTaskIds = [], onToggleTask,
}) {
  const groups = {};
  const groupedTasks = groupFmsTasks(tasks);
  const selectable = new Set(selectableTaskIds);
  const selected = new Set(selectedTaskIds);
  groupedTasks.forEach((t) => (groups[laneOf(t)] ||= []).push(t));
  const lanes = LANES.filter((l) => groups[l.key]?.length && !(hideClosed && l.key === 'closed') && (!onlyLanes || onlyLanes.includes(l.key)));

  if (!lanes.length) return <p className="empty">{emptyText || 'No tasks match.'}</p>;

  return (
    <div className="lanes">
      {lanes.map((lane) => (
        <section key={lane.key} className={`lane lane-${lane.key}`}>
          <h3 className="lane-title">
            {lane.title} <span className="count">{groups[lane.key].length}</span>
          </h3>
          <ul className={`task-list ${cardLayout ? 'task-list-cards' : ''} ${selectableTaskIds.length ? 'task-list-selectable' : ''}`}>
            {groups[lane.key].slice(0, maxPerLane || undefined).map((t) => (
              <li key={t.id} className={selectable.has(t.id) ? 'task-list-item-selectable' : undefined}>
                  {selectable.has(t.id) && (
                    <label className="task-select">
                      <input type="checkbox" aria-label={`Select task ${t.title}`}
                        checked={selected.has(t.id)} onChange={() => onToggleTask(t.id)} />
                    </label>
                  )}
                  <button className="task-row" onClick={() => onOpen(t.id)}>
                  <span className={`prio prio-${t.priority.toLowerCase()}`} title={`${PRIORITY_LABEL[t.priority]} priority`} />
                  <span className="task-main">
                    <span className="task-title">{t.title}</span>
                    <span className="task-meta">
                      {showAssignee && <span>{t.assignee.fullName}</span>}
                      {t.reviewer && <span>Reviewed by: {t.reviewer.fullName}</span>}
                      {t.workflow && <>
                        <span className="repeat-badge rb-flow">
                          FMS {t.workflow.date} · run #{t.workflow.number} · step {t.workflow.step}/{t.workflow.total}
                        </span>
                        <span>Current stage: {t.workflowStageTitle}</span>
                      </>}
                      <span title={fmtDateTime(t.dueAt)}>
                        {t.dueAt ? (lane.key === 'closed' ? `Due ${fmtDateTime(t.dueAt)}` : `${fmtDateTime(t.dueAt)}, ${relativeDue(t.dueAt)}`) : 'No due date'}
                      </span>
                      {t.scheduledAt && <span>Starts {fmtDateTime(t.scheduledAt)}</span>}
                      {t.repeat && <span className={`repeat-badge ${t.repeat === 'DAILY' ? 'rb-daily' : 'rb-weekly'}`}>
                        {t.repeat === 'DAILY' ? 'Daily' : t.repeat === 'WEEKLY' ? 'Weekly' : t.repeat === 'MONTHLY' ? 'Monthly' : 'Yearly'}
                      </span>}
                      {t.priority === 'URGENT' && <span className="tag">Urgent</span>}
                    </span>
                  </span>
                  <span className="task-status">
                    <StatusChip status={t.status} overdue={t.overdue} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {maxPerLane && groups[lane.key].length > maxPerLane && moreLink && (
            <Link className="more-link" to={moreLink(lane.key)}>Show all {groups[lane.key].length}</Link>
          )}
        </section>
      ))}
    </div>
  );
}
