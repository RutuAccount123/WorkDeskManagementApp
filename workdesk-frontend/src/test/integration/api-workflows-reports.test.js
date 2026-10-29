import { describe, expect, it } from 'vitest';
import { reportService, taskService, workflowService } from '@/services/index.js';
import { tokenStore } from '@/services/http.js';
import { ADMIN, PRIYA, RAHUL, SNEHA, signIn } from '../helpers.js';

const asUser = async (email) => { tokenStore.clear(); return signIn(email); };
const flow = (over = {}) => ({
  name: 'Bill approval', description: 'Vendor bill received', frequency: 'ON_DEMAND', startTime: '10:00', endTime: '18:00',
  formFields: [{ label: 'Vendor', type: 'text', required: true }, { label: 'Site', type: 'select', required: false, options: 'PIL, AIGP' }],
  steps: [
    { title: 'Check bill', assigneeId: 3, hours: 1, checklist: ['Match PO', 'Match GRN'], how: 'Use the register' },
    { title: 'Approve payment', assigneeId: 2, hours: 2 },
  ],
  ...over,
});

describe('FMS workflows', () => {
  it('validates the setup', async () => {
    await asUser(ADMIN);
    await expect(workflowService.create(flow({ name: '' }))).rejects.toThrow('Give the workflow a name');
    await expect(workflowService.create(flow({ steps: [flow().steps[0]] }))).rejects.toThrow('at least 2 steps');
    await expect(workflowService.create(flow({ endTime: '09:00' }))).rejects.toThrow('End time must be after');
    await expect(workflowService.create(flow({ formFields: [{ label: 'Pick', type: 'select', options: 'One' }] }))).rejects.toThrow('at least 2 options');
    await expect(workflowService.create(flow({ steps: [{ ...flow().steps[0], hours: 30 }, flow().steps[1]] }))).rejects.toThrow('hours must be between');
  });

  it('start → checklist → done passes the work to the next person → finished', async () => {
    await asUser(ADMIN);
    const wf = await workflowService.create(flow());
    expect(wf.formFields.map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(wf.formFields[1].options).toEqual(['PIL', 'AIGP']);
    expect(wf.totalHours).toBe(3);
    await expect(workflowService.startNow(wf.id, {})).rejects.toThrow('Please fill “Vendor”');
    await expect(workflowService.startNow(wf.id, { f1: 'Asian Paints', f2: 'Other' })).rejects.toThrow('valid option');
    const run = await workflowService.startNow(wf.id, { f1: 'Asian Paints', f2: 'PIL' });
    expect(run.label).toBe('Asian Paints');
    expect(run.steps[0].task.status).toBe('IN_PROGRESS'); // form filled → work started
    expect(run.steps[0].task.dueAt).toBeTruthy();
    expect(run.steps[1].task).toBeNull();

    await asUser(RAHUL);
    const stepTask = run.steps[0].task.id;
    const t1 = await taskService.get(stepTask);
    expect(t1.estimatedHours).toBe(1);
    expect(t1.workflow).toMatchObject({ name: 'Bill approval', step: 1, total: 2 });
    expect(t1.reviewer).toBeNull();
    await expect(taskService.changeStatus(stepTask, 'COMPLETED')).rejects.toThrow('Tick every checklist item');
    await taskService.tick(stepTask, 0, true);
    await taskService.tick(stepTask, 1, true);
    await taskService.changeStatus(stepTask, 'COMPLETED');

    await asUser(PRIYA);
    const live = await workflowService.run(run.id);
    expect(live.currentStep).toBe(2);
    const step2 = live.steps[1].task.id;
    expect(step2).toBe(stepTask);
    expect(live.steps[0].task).toMatchObject({ status: 'COMPLETED', id: null });
    expect((await taskService.get(stepTask))).toMatchObject({
      assignee: { id: 2 }, workflow: { step: 2 },
    });
    expect((await taskService.list({ scope: 'all' })).filter((task) => task.workflow?.runId === run.id)).toHaveLength(1);
    await expect(taskService.tick(step2, 0, true)).rejects.toThrow('Checklist item not found');
    await taskService.changeStatus(step2, 'COMPLETED');
    const finished = await workflowService.run(run.id);
    expect(finished.status).toBe('DONE');
    expect(finished.steps.every((s) => s.planned && s.actual && s.delayMinutes != null)).toBe(true);

    await asUser(ADMIN);
    const tracker = await workflowService.tracker(wf.id, '2000-01-01', '2999-12-31');
    expect(tracker.map((r) => r.id)).toContain(run.id);
    const nextRun = await workflowService.startNow(wf.id, { f1: 'Another vendor', f2: 'PIL' });
    expect(nextRun.id).not.toBe(run.id);
    expect(nextRun.steps[0].task.id).not.toBe(stepTask);
    expect((await workflowService.run(run.id)).formData.f1).toBe('Asian Paints');
  });

  it('a scheduled run waits for step 1 to fill the form', async () => {
    await asUser(ADMIN);
    const wf = await workflowService.create(flow({ name: 'Daily check', frequency: 'DAILY' }));
    const today = (await workflowService.runs()).find((r) => r.workflowId === wf.id);
    if (!today) return; // Sunday or office holiday: nothing runs today
    expect(today.needsForm).toBe(true);
    await asUser(RAHUL);
    const step1 = today.steps[0].task.id;
    await expect(taskService.changeStatus(step1, 'IN_PROGRESS')).rejects.toThrow('Fill the workflow form first');
    await asUser(PRIYA);
    await expect(workflowService.fillForm(today.id, { f1: 'X' })).rejects.toThrow('Only step 1');
    await asUser(RAHUL);
    const filled = await workflowService.fillForm(today.id, { f1: 'Berger' });
    expect(filled.needsForm).toBe(false);
    expect((await taskService.get(step1)).status).toBe('IN_PROGRESS');
  });

  it('starting a scheduled FMS for a linked task avoids scheduler duplicates and allows another manual run', async () => {
    await asUser(ADMIN);
    const sourceTask = await taskService.create({ title: 'Linked daily FMS task' });
    const wf = await workflowService.create(flow({
      name: 'Linked daily FMS',
      frequency: 'DAILY',
      sourceTaskId: sourceTask.id,
      startNow: true,
    }));

    const runs = await workflowService.tracker(wf.id, '2000-01-01', '2999-12-31');
    expect(runs).toHaveLength(1);
    expect(runs[0].sourceTask.id).toBe(sourceTask.id);
    if (new Date().getDay() !== 0) {
      const secondRun = await workflowService.startNow(wf.id, { f1: 'Another vendor', f2: 'PIL' });
      expect(secondRun.id).not.toBe(runs[0].id);
      expect(await workflowService.tracker(wf.id, '2000-01-01', '2999-12-31')).toHaveLength(2);
    }
  });

  it('linked to a task: listed on the task, and the task hears when it finishes', async () => {
    await asUser(SNEHA);
    const t = await taskService.create({ title: 'Site bill', assigneeId: 4 });
    const wf = await workflowService.create(flow({ name: 'Site bill FMS', sourceTaskId: t.id, formFields: [],
      steps: [{ title: 'A', assigneeId: 4, hours: 1 }, { title: 'B', assigneeId: 4, hours: 1 }] }));
    expect((await workflowService.list(t.id)).map((w) => w.id)).toEqual([wf.id]);
    const run = await workflowService.startNow(wf.id, {}, t.id);
    await taskService.changeStatus(run.steps[0].task.id, 'COMPLETED');
    const r2 = await workflowService.run(run.id);
    expect(r2.steps[1].task.id).toBe(run.steps[0].task.id);
    await taskService.changeStatus(r2.steps[1].task.id, 'COMPLETED');
    expect((await workflowService.runsForTask(t.id))[0].status).toBe('DONE');
    expect((await taskService.activity(t.id)).at(-1).comment).toMatch(/finished: all 2 steps completed/);
  });

  it('anyone who can view can edit the FMS; only its owner or admin can pause it', async () => {
    await asUser(ADMIN);
    const wf = await workflowService.create(flow());
    await asUser(RAHUL);
    const updated = await workflowService.update(wf.id, flow({ name: 'Updated bill approval' }));
    expect(updated.name).toBe('Updated bill approval');
    await expect(workflowService.setActive(wf.id, false)).rejects.toThrow('Only the person who set up');
    await asUser(ADMIN);
    await workflowService.setActive(wf.id, false);
    await expect(workflowService.startNow(wf.id, { f1: 'X' })).rejects.toThrow('paused');
  });
});

describe('reports', () => {
  it('dashboard numbers add up', async () => {
    await asUser(ADMIN);
    const d = await reportService.dashboard();
    expect(d.totalOpen).toBe(d.todo + d.inProgress + d.awaitingReview);
    expect(Object.values(d.openByPriority).reduce((a, b) => a + b, 0)).toBe(d.totalOpen);
  });
  it('team view is admin only and has one card per employee', async () => {
    await asUser(ADMIN);
    const team = await reportService.team();
    expect(team.map((m) => m.employee.fullName)).toEqual(['Amit Deshmukh', 'Priya Sharma', 'Rahul Patil', 'Sneha Kulkarni']);
    team.forEach((m) => expect(m.today.total).toBe(m.today.todo + m.today.inProgress + m.today.done));
    const week = await reportService.team('week');
    const month = await reportService.team('month');
    week.forEach((m) => {
      expect(m.range.total).toBe(m.range.todo + m.range.inProgress + m.range.done);
      expect(m.rangeTasks).toHaveLength(m.range.total);
    });
    month.forEach((m, i) => expect(m.range.total).toBeGreaterThanOrEqual(week[i].range.total));
    await expect(reportService.team('year')).rejects.toThrow('Period must be today, week, or month');
    await asUser(PRIYA);
    await expect(reportService.team()).rejects.toThrow('permission');
  });
  it('performance score = 60% done + 40% on time', async () => {
    await asUser(ADMIN);
    const p = await reportService.performance({ employeeId: 2 });
    if (p.score != null) {
      expect(p.score).toBe(Math.round(0.6 * p.completionRate + 0.4 * (p.onTimeRate ?? 0)));
      expect(p.completed).toBe(p.completedOnTime + p.completedLate);
    }
    expect(p.trend).toHaveLength(6);
    const y = await reportService.yearly({ employeeId: 2, year: new Date().getFullYear() });
    expect(y.months).toHaveLength(12);
  });
  it('employees only ever see their own numbers', async () => {
    await asUser(PRIYA);
    expect((await reportService.performance({ employeeId: 3 })).employeeId).toBe(2);
    await expect(reportService.employeeSummary({ from: '2026-10-01', to: '2026-10-27' })).rejects.toThrow('permission');
  });
  it('daily report has one row per day and checks the dates', async () => {
    await asUser(ADMIN);
    const rows = await reportService.daily({ from: '2026-10-01', to: '2026-10-07' });
    expect(rows.map((r) => r.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']);
    await expect(reportService.daily({ from: '2026-10-07', to: '2026-10-01' })).rejects.toThrow("'to' date must be on or after");
  });
});
