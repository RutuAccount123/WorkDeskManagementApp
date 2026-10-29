import { afterEach, describe, expect, it, vi } from 'vitest';
import { notificationService, taskService } from '@/services/index.js';
import { tokenStore } from '@/services/http.js';
import { ADMIN, AMIT, PRIYA, RAHUL, localDue, signIn } from '../helpers.js';

const asUser = async (email) => { tokenStore.clear(); return signIn(email); };
// newest event notification (the once-a-day summary is skipped)
const lastNote = async () => (await notificationService.list()).find((n) => n.type !== 'DAILY_DIGEST');
afterEach(() => vi.useRealTimers());

describe('assign → submit → review flow', () => {
  it('works end to end with notifications to the right people', async () => {
    await asUser(RAHUL);
    const t = await taskService.create({ title: 'Collect GST bills', assigneeId: 2, reviewerId: 4, priority: 'HIGH', dueAt: localDue(3) }); // not due within 24 h, so no reminder comes first
    expect(t.status).toBe('TODO');
    expect(t.assignee.fullName).toBe('Priya Sharma');
    expect(t.reviewer.fullName).toBe('Sneha Kulkarni');
    expect(t.createdBy.fullName).toBe('Rahul Patil');

    await asUser(PRIYA);
    expect((await lastNote()).message).toMatch(/Rahul Patil assigned you: Collect GST bills/);
    await expect(taskService.changeStatus(t.id, 'COMPLETED')).rejects.toThrow('You cannot move this task');
    await taskService.changeStatus(t.id, 'IN_PROGRESS');
    const sub = await taskService.changeStatus(t.id, 'SUBMITTED');
    expect(sub.submittedAt).toBeTruthy();

    await asUser('sneha@company.com');
    expect((await taskService.list({ scope: 'review' })).map((x) => x.id)).toContain(t.id);
    await expect(taskService.changeStatus(t.id, 'REOPENED')).rejects.toThrow('add a comment');
    await taskService.changeStatus(t.id, 'REOPENED', 'Add the October bills too');

    await asUser(PRIYA);
    expect((await lastNote()).message).toMatch(/sent back .*October bills/);
    await taskService.changeStatus(t.id, 'IN_PROGRESS');
    await taskService.changeStatus(t.id, 'SUBMITTED');

    await asUser('sneha@company.com');
    const done = await taskService.changeStatus(t.id, 'COMPLETED');
    expect(done.status).toBe('COMPLETED');
    const history = await taskService.activity(t.id);
    expect(history.map((h) => h.toStatus).filter(Boolean)).toEqual(['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED']);

    await asUser(RAHUL);
    expect((await lastNote()).message).toMatch(/approved "Collect GST bills"/);
  });

  it('the person doing the task cannot review it', async () => {
    await asUser(RAHUL);
    await expect(taskService.create({ title: 'X', assigneeId: 2, reviewerId: 2 })).rejects.toThrow('cannot also review');
  });
  it('an empty reviewer falls back to the person assigning', async () => {
    await asUser(RAHUL);
    const t = await taskService.create({ title: 'X', assigneeId: 2, reviewerId: null });
    expect(t.reviewer.id).toBe(3);
  });
  it('inactive people cannot be given work', async () => {
    await asUser(ADMIN);
    const { employeeService } = await import('@/services/index.js');
    await employeeService.setActive(5, false);
    await expect(taskService.create({ title: 'X', assigneeId: 5 })).rejects.toThrow('inactive');
  });
  it('blank titles are refused', async () => {
    await asUser(PRIYA);
    await expect(taskService.create({ title: '   ' })).rejects.toThrow('title: must not be blank');
  });
});

describe('own work', () => {
  it('calculates an estimated deadline across workdays and marks it overdue after the deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-03T17:00:00'));
    await asUser(PRIYA);
    const task = await taskService.create({ title: 'Estimated work', status: 'IN_PROGRESS', estimatedHours: 4 });
    expect(task.estimatedHours).toBe(4);
    expect(task.dueAt).toBe(new Date('2025-01-04T13:00:00').toISOString());

    vi.setSystemTime(new Date('2025-01-04T13:01:00'));
    expect((await taskService.get(task.id)).overdue).toBe(true);
  });

  it('can be added already done and closed without review', async () => {
    await asUser(PRIYA);
    const t = await taskService.create({ title: 'Petty cash update', status: 'COMPLETED', dueAt: localDue(0, '17:00') });
    expect(t.status).toBe('COMPLETED');
    expect(t.selfAdded).toBe(true);
    expect(t.reviewer).toBeNull();
    const back = await taskService.changeStatus(t.id, 'IN_PROGRESS');
    expect(back.completedAt).toBeNull;
  });
  it('with a reviewer it cannot start as done', async () => {
    await asUser(PRIYA);
    const t = await taskService.create({ title: 'Salary sheet', status: 'COMPLETED', reviewerId: 1 });
    expect(t.status).toBe('TODO');
  });
});

describe('who can see and change a task', () => {
  it('outsiders get "not found"; assigner can edit and delete', async () => {
    await asUser(RAHUL);
    const t = await taskService.create({ title: 'Private', assigneeId: 2 });
    await asUser(AMIT);
    await expect(taskService.get(t.id)).rejects.toThrow('Task not found');
    await asUser(PRIYA);
    await expect(taskService.update(t.id, { title: 'Hack', priority: 'LOW' })).rejects.toThrow('Only the person who assigned');
    await asUser(RAHUL);
    const upd = await taskService.update(t.id, { title: 'Private v2', priority: 'URGENT', assigneeId: 2, dueAt: localDue(2) });
    expect(upd.title).toBe('Private v2');
    expect((await taskService.activity(t.id)).at(-1).comment).toMatch(/priority MEDIUM → URGENT/);
    await taskService.remove(t.id);
    await asUser(ADMIN);
    await expect(taskService.get(t.id)).rejects.toThrow('Task not found');
  });
  it('comments notify everyone involved except the writer', async () => {
    await asUser(RAHUL);
    const t = await taskService.create({ title: 'Plywood', assigneeId: 2, reviewerId: 4 });
    await taskService.addComment(t.id, 'Need it by Friday');
    await asUser('sneha@company.com');
    expect((await lastNote()).message).toMatch(/commented on "Plywood": Need it by Friday/);
    await expect(taskService.addComment(t.id, '  ')).rejects.toThrow('comment: must not be blank');
  });
});

describe('task list filters', () => {
  it('scopes: assigned / created / review / all', async () => {
    await asUser(RAHUL);
    const mine = await taskService.list({ scope: 'assigned' });
    expect(mine.every((t) => t.assignee.id === 3)).toBe(true);
    const created = await taskService.list({ scope: 'created' });
    expect(created.length).toBeGreaterThan(0);
    expect(created.every((t) => t.createdBy.id === 3 && t.assignee.id !== 3)).toBe(true);
    const review = await taskService.list({ scope: 'review' });
    expect(review.every((t) => t.reviewer?.id === 3)).toBe(true);
  });
  it('status, priority, overdue, search and date filters', async () => {
    await asUser(ADMIN);
    const all = await taskService.list({});
    const sub = await taskService.list({ status: ['SUBMITTED'] });
    expect(sub.every((t) => t.status === 'SUBMITTED')).toBe(true);
    expect((await taskService.list({ priority: 'URGENT' })).every((t) => t.priority === 'URGENT')).toBe(true);
    expect((await taskService.list({ overdue: 'true' })).every((t) => t.overdue)).toBe(true);
    expect((await taskService.list({ q: 'plywood' })).every((t) => /plywood/i.test(t.title + t.description))).toBe(true);
    expect((await taskService.list({ assigneeId: 2 })).every((t) => t.assignee.id === 2)).toBe(true);
    expect(all.length).toBeGreaterThan(sub.length);
    // sorted by due date, no-date last
    const dues = all.map((t) => (t.dueAt ? Date.parse(t.dueAt) : Infinity));
    expect([...dues].sort((a, b) => a - b)).toEqual(dues);
  });
});

describe('notifications', () => {
  it('daily summary arrives first, can be marked read', async () => {
    await asUser(PRIYA);
    const list = await notificationService.list();
    expect(list.some((n) => n.type === 'DAILY_DIGEST')).toBe(true);
    const before = (await notificationService.unreadCount()).count;
    await notificationService.markRead(list[0].id);
    expect((await notificationService.unreadCount()).count).toBe(before - 1);
    await notificationService.markAllRead();
    expect((await notificationService.unreadCount()).count).toBe(0);
  });
});

describe('editing keeps data clean', () => {
  it('a task cannot be saved with a blank title', async () => {
    await asUser(RAHUL);
    const t = await taskService.create({ title: 'Plywood rate', assigneeId: 2 });
    await expect(taskService.update(t.id, { title: ' ', priority: 'LOW' })).rejects.toThrow('title: must not be blank');
  });
});
