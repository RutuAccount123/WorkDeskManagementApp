import { describe, expect, it } from 'vitest';
import { notificationService, taskService } from '@/services/index.js';
import { tokenStore } from '@/services/http.js';
import { ADMIN, RAHUL, localDue, signIn } from '../helpers.js';

const asUser = async (email) => { tokenStore.clear(); return signIn(email); };
const dayNotes = async (word) => (await notificationService.list())
  .filter((n) => /^Due (today|tomorrow): /.test(n.message) && n.message.includes(word)).map((n) => n.message);

describe('day reminders: the day before the due date and the due day', () => {
  it('high priority work is reminded whatever its status; other work only while still in To do', async () => {
    await asUser(ADMIN);
    const high = await taskService.create({ title: 'Urgent site visit', assigneeId: 3, priority: 'HIGH', dueAt: localDue(1, '23:00') });
    await taskService.create({ title: 'Plain todo', assigneeId: 3, priority: 'LOW', dueAt: localDue(1, '23:00') });
    await taskService.create({ title: 'Far away', assigneeId: 3, priority: 'HIGH', dueAt: localDue(3, '18:00') });

    await asUser(RAHUL);
    await taskService.changeStatus(high.id, 'IN_PROGRESS');
    // own work added already started: never in To do, so no day reminder
    await taskService.create({ title: 'Plain started', priority: 'MEDIUM', status: 'IN_PROGRESS', dueAt: localDue(1, '23:00') });
    await notificationService.list();   // reminders run
    await notificationService.list();   // ... and are not sent twice the same day

    const urgent = await dayNotes('Urgent site visit');
    expect(urgent).toHaveLength(1);
    expect(urgent[0]).toMatch(/^Due tomorrow: High priority: "Urgent site visit"/);
    const todo = await dayNotes('Plain todo');
    expect(todo).toHaveLength(1);
    expect(todo[0]).toMatch(/is not started yet$/);
    expect(await dayNotes('Plain started')).toEqual([]);
    expect(await dayNotes('Far away')).toEqual([]);
  });
});
