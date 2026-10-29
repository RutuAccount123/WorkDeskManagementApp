import { describe, expect, it } from 'vitest';
import { groupFmsTasks } from './taskGroups.js';

function stage(id, runId, step, status, title) {
  return {
    id,
    title,
    status,
    workflow: {
      runId, name: 'Site inspection', step, total: 3, date: '2026-10-28', number: 1,
      sourceTaskId: null,
    },
  };
}

describe('groupFmsTasks', () => {
  it('shows one FMS item using its current stage and keeps separate runs separate', () => {
    const first = stage(1, 21, 1, 'COMPLETED', 'Prepare site');
    const current = stage(2, 21, 2, 'IN_PROGRESS', 'Inspect work');
    const nextRun = stage(3, 22, 1, 'TODO', 'Prepare site');

    const grouped = groupFmsTasks([first, current, nextRun]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({
      id: 2,
      title: 'Site inspection',
      workflowStageTitle: 'Inspect work',
    });
    expect(grouped[1]).toMatchObject({ id: 3, workflow: { runId: 22 } });
  });

  it('keeps regular tasks as individual items', () => {
    const task = { id: 7, title: 'Regular task', status: 'TODO' };

    expect(groupFmsTasks([task])).toEqual([task]);
  });

  it('keeps a task with a linked FMS as a task until a run starts for that task', () => {
    const task = {
      id: 8, title: 'Prepare site report', status: 'TODO', linkedWorkflowId: 4,
    };

    expect(groupFmsTasks([task])).toEqual([task]);
  });

  it('shows a source task and its FMS run as one dashboard item', () => {
    const sourceTask = {
      id: 9, title: 'Inspect the new site', status: 'TODO', linkedWorkflowId: 4,
    };
    const first = stage(10, 21, 1, 'COMPLETED', 'Collect documents');
    first.workflow.sourceTaskId = sourceTask.id;
    const current = stage(11, 21, 2, 'IN_PROGRESS', 'Inspect site');
    current.workflow.sourceTaskId = sourceTask.id;

    const grouped = groupFmsTasks([sourceTask, first, current]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      id: current.id,
      title: sourceTask.title,
      workflowStageTitle: current.title,
    });
  });

  it('keeps distinct runs of a linked task separate', () => {
    const sourceTask = { id: 9, title: 'Inspect the new site', status: 'TODO' };
    const oldRun = stage(10, 21, 1, 'COMPLETED', 'Old run');
    oldRun.workflow.sourceTaskId = sourceTask.id;
    oldRun.workflow.date = '2026-10-27';
    const latestRun = stage(11, 22, 1, 'IN_PROGRESS', 'Latest run');
    latestRun.workflow.sourceTaskId = sourceTask.id;

    const grouped = groupFmsTasks([sourceTask, oldRun, latestRun]);

    expect(grouped).toHaveLength(2);
    expect(grouped.find((task) => task.workflow.runId === 22)).toMatchObject({ title: sourceTask.title });
    expect(grouped.find((task) => task.workflow.runId === 21)).toMatchObject({ title: 'Site inspection' });
  });
});
