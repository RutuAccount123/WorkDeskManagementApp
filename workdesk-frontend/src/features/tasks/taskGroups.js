const OPEN_STATUSES = new Set(['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED']);

function preferredStage(first, candidate) {
  const firstOpen = OPEN_STATUSES.has(first.status);
  const candidateOpen = OPEN_STATUSES.has(candidate.status);
  if (firstOpen !== candidateOpen) return candidateOpen ? candidate : first;

  if (firstOpen) return candidate.workflow.step < first.workflow.step ? candidate : first;
  return candidate.workflow.step > first.workflow.step ? candidate : first;
}

function preferredRun(first, candidate) {
  const firstOpen = OPEN_STATUSES.has(first.current.status);
  const candidateOpen = OPEN_STATUSES.has(candidate.current.status);
  if (firstOpen !== candidateOpen) return candidateOpen ? candidate : first;

  const firstDate = first.current.workflow.date || '';
  const candidateDate = candidate.current.workflow.date || '';
  if (firstDate !== candidateDate) return candidateDate > firstDate ? candidate : first;
  return candidate.current.workflow.number > first.current.workflow.number ? candidate : first;
}

/** Show a workflow run once, using its current stage as the actionable task. */
export function groupFmsTasks(tasks) {
  const groups = new Map();
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  tasks.forEach((task) => {
    const key = task.workflow?.runId == null ? `task:${task.id}` : `run:${task.workflow.runId}`;
    const group = groups.get(key);
    if (group) {
      group.current = preferredStage(group.current, task);
    } else {
      groups.set(key, { current: task });
    }
  });

  const runBySourceTask = new Map();
  for (const [key, group] of groups) {
    const sourceTaskId = group.current.workflow?.sourceTaskId;
    if (sourceTaskId == null || !tasksById.has(sourceTaskId)) continue;
    const existing = runBySourceTask.get(sourceTaskId);
    const candidate = { ...group, key };
    if (!existing || preferredRun(existing, candidate) === candidate) {
      runBySourceTask.set(sourceTaskId, candidate);
    }
  }

  const sourceTaskIdsToHide = new Set(runBySourceTask.keys());
  const emittedRuns = new Set();
  const result = [];
  for (const task of tasks) {
    const key = task.workflow?.runId == null ? `task:${task.id}` : `run:${task.workflow.runId}`;
    if (sourceTaskIdsToHide.has(task.id) && !task.workflow) continue;
    if (task.workflow) {
      if (emittedRuns.has(key)) continue;
      emittedRuns.add(key);
      const current = runBySourceTask.get(task.workflow.sourceTaskId)?.key === key
        ? { ...groups.get(key).current, sourceTask: tasksById.get(task.workflow.sourceTaskId) }
        : groups.get(key).current;
      result.push({
        ...current,
        title: current.sourceTask?.title || current.workflow.name,
        workflowStageTitle: current.title,
      });
    } else {
      result.push(task);
    }
  }
  return result;
}
