import { describe, expect, it } from 'vitest';
import { notificationService, reportService, taskService, ticketService } from '@/services/index.js';
import { laneOf } from '@/utils/format.js';
import { tokenStore } from '@/services/http.js';
import { ADMIN, AMIT, PRIYA, RAHUL, localDue, signIn } from '../helpers.js';

const asUser = async (email) => { tokenStore.clear(); return signIn(email); };
// the latest notice about something that happened (not the daily summary or a due-date reminder)
const lastNote = async () => (await notificationService.list()).find((n) => !['DAILY_DIGEST', 'DUE_SOON', 'DAY_REMINDER'].includes(n.type));

describe('tickets on a task', () => {
  it('a ticket is also a task in the list of the person it is raised to', async () => {
    await asUser(RAHUL);
    const t = await taskService.create({ title: 'Check vendor bills', assigneeId: 2, priority: 'HIGH' });

    await asUser(PRIYA);
    const k = await ticketService.raise(t.id, 5, 'Please check the GST on these');

    // Amit now has it as a task of his own
    await asUser(AMIT);
    const ticketTask = (await taskService.list({ scope: 'assigned' })).find((x) => x.fromTicket?.ticketId === k.id);
    expect(ticketTask).toMatchObject({ title: 'Ticket: Check vendor bills', priority: 'HIGH', status: 'TODO' });
    expect(ticketTask.fromTicket.task.id).toBe(t.id);
    expect(ticketTask.createdBy.fullName).toBe('Priya Sharma');

    // resolving the ticket marks it done, at the real time
    await ticketService.resolve(k.id, 'GST is correct');
    const done = await taskService.get(ticketTask.id);
    expect(done.status).toBe('COMPLETED');
    expect(done.completedAt).toBeTruthy();
    expect(done.fromTicket.status).toBe('RESOLVED');

    // and the other way round: marking the ticket task done resolves the ticket with the note
    await asUser(PRIYA);
    const k2 = await ticketService.raise(t.id, 5, 'One more bill');
    await asUser(AMIT);
    const second = (await taskService.list({ scope: 'assigned' })).find((x) => x.fromTicket?.ticketId === k2.id);
    await taskService.changeStatus(second.id, 'COMPLETED', 'Checked it');
    const answered = (await ticketService.forTask(t.id)).find((x) => x.id === k2.id);
    expect(answered).toMatchObject({ status: 'RESOLVED', reply: 'Checked it' });
  });

  it('raise → the other person is notified, can open the task, and resolves it with a reply', async () => {
    await asUser(RAHUL);
    const t = await taskService.create({ title: 'Fix vendor GST mismatch', assigneeId: 2, priority: 'HIGH' });

    await asUser(AMIT);
    await expect(taskService.get(t.id)).rejects.toThrow('Task not found');

    await asUser(PRIYA);
    await expect(ticketService.raise(t.id, 2, 'Help')).rejects.toThrow('Choose someone else');
    await expect(ticketService.raise(t.id, 5, '  ')).rejects.toThrow('note: must not be blank');
    const k = await ticketService.raise(t.id, 5, 'Vendor PAN does not match the GSTIN, please check');
    expect(k.status).toBe('OPEN');
    expect(k.assignedTo.fullName).toBe('Amit Deshmukh');
    expect((await ticketService.list({ scope: 'raised', status: 'OPEN' })).map((x) => x.id)).toContain(k.id);
    await expect(ticketService.list({ scope: 'all' })).rejects.toThrow('Only admins');

    await asUser(AMIT);
    const note = await lastNote();
    expect(note.type).toBe('TICKET_RAISED');
    expect(note.message).toMatch(/Priya Sharma raised a ticket to you on "Fix vendor GST mismatch"/);
    expect((await taskService.get(t.id)).title).toBe('Fix vendor GST mismatch');
    expect((await ticketService.list()).map((x) => x.id)).toContain(k.id);
    await expect(ticketService.resolve(k.id, '')).rejects.toThrow('reply: must not be blank');
    const done = await ticketService.resolve(k.id, 'Corrected the GSTIN');
    expect(done.status).toBe('RESOLVED');
    expect(done.resolvedBy.fullName).toBe('Amit Deshmukh');
    await expect(ticketService.resolve(k.id, 'Again')).rejects.toThrow('already resolved');

    await asUser(PRIYA);
    expect((await lastNote()).type).toBe('TICKET_RESOLVED');
    const history = (await taskService.activity(t.id)).map((h) => h.action);
    expect(history).toEqual(expect.arrayContaining(['TICKET_RAISED', 'TICKET_RESOLVED']));

    await asUser(ADMIN);
    expect((await ticketService.list({ scope: 'all' })).map((x) => x.id)).toContain(k.id);
    expect(await ticketService.forTask(t.id)).toHaveLength(1);
  });

  it('an open ticket makes the task pending: out of overdue and the status counts, back when resolved', async () => {
    await asUser(PRIYA);
    const late = await taskService.create({ title: 'Late own work', dueAt: localDue(-1) });
    expect(late.overdue).toBe(true);
    expect(laneOf(late)).toBe('overdue');
    const before = await reportService.dashboard();

    const k = await ticketService.raise(late.id, 3, 'Need the purchase rate first');
    const pending = await taskService.get(late.id);
    expect(pending.pending).toBe(true);
    expect(pending.overdue).toBe(false);
    expect(pending.status).toBe('TODO');
    expect(laneOf(pending)).toBe('pending');
    expect((await taskService.list({ overdue: 'true' })).map((t) => t.id)).not.toContain(late.id);
    const during = await reportService.dashboard();
    expect(during.pending).toBe(before.pending + 1);
    expect(during.overdue).toBe(before.overdue - 1);
    expect(during.todo).toBe(before.todo - 1);

    await asUser(RAHUL);
    await ticketService.resolve(k.id, 'Rate is 1450 per sheet');
    await asUser(PRIYA);
    const back = await taskService.get(late.id);
    expect(back.pending).toBe(false);
    expect(back.overdue).toBe(true);
    expect(laneOf(back)).toBe('overdue');
  });

  it('cannot be raised on a closed task; the ticket person cannot edit or delete the task', async () => {
    await asUser(PRIYA);
    const own = await taskService.create({ title: 'Closed own work', status: 'COMPLETED' });
    await expect(ticketService.raise(own.id, 3, 'Help')).rejects.toThrow('This task is closed');

    const open = await taskService.create({ title: 'Open own work' });
    const k = await ticketService.raise(open.id, 3, 'Please check the rate');
    await expect(taskService.remove(open.id)).rejects.toThrow('Only an admin'); // own work: not the person doing it

    // an employee the ticket is raised to cannot edit or delete the task: only admins can
    await asUser(RAHUL);
    await expect(taskService.update(open.id, { title: 'Changed', priority: 'HIGH', assigneeId: 2 })).rejects.toThrow('Only an admin');
    await expect(taskService.remove(open.id)).rejects.toThrow('Only an admin');
    await asUser(ADMIN);
    await taskService.remove(open.id);
    await asUser(RAHUL);
    expect((await ticketService.list({ status: '' })).map((x) => x.id)).not.toContain(k.id);
  });

  it('mark task done: the task moves to the ticket person and is done, not sent back', async () => {
    await asUser(RAHUL);
    const t = await taskService.create({ title: 'Release vendor payment', assigneeId: 2 });
    await asUser(PRIYA);
    const k = await ticketService.raise(t.id, 5, 'I cannot approve payments, please do it');
    await expect(ticketService.markTaskDone(k.id, 'Me')).rejects.toThrow('Only the person this ticket is assigned to');

    await asUser(AMIT);
    await expect(ticketService.markTaskDone(k.id, ' ')).rejects.toThrow('reply: must not be blank');
    const closed = await ticketService.markTaskDone(k.id, 'Payment released');
    expect(closed.status).toBe('RESOLVED');
    expect(closed.taskDone).toBe(true);
    const done = await taskService.get(t.id);
    expect(done.status).toBe('COMPLETED');
    expect(done.assignee.fullName).toBe('Amit Deshmukh');
    expect((await taskService.list({ scope: 'assigned', status: ['COMPLETED'] })).map((x) => x.id)).toContain(t.id);
    expect((await ticketService.list({ status: 'RESOLVED' })).map((x) => x.id)).toContain(k.id);

    await asUser(PRIYA);
    expect((await lastNote()).message).toMatch(/Amit Deshmukh finished "Release vendor payment"/);
    expect((await taskService.list({ scope: 'assigned' })).map((x) => x.id)).not.toContain(t.id);
  });
});
