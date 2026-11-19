import { describe, expect, it } from 'vitest';
import { leaveService, notificationService, recurringService, taskService, ticketService } from '@/services/index.js';
import { tokenStore } from '@/services/http.js';
import { ADMIN, PRIYA, RAHUL, signIn } from '../helpers.js';
import { addDays, isoDay, laneOf } from '@/utils/format.js';

const asUser = async (email) => { tokenStore.clear(); return signIn(email); };
const at = (day, hhmm) => `${isoDay(day)}T${hhmm}`;

describe('personal leave', () => {
  it('no repeating copies on leave days; tasks due then are not overdue and wait for allow / deny', async () => {
    const today = new Date();
    const yesterday = addDays(today, -1);
    await asUser(ADMIN);
    const tpl = await recurringService.create({ title: 'Daily leave check', assigneeId: 2, frequency: 'DAILY', dueTime: '18:00' });

    await asUser(RAHUL);
    const a = await taskService.create({ title: 'Due on leave A', assigneeId: 2, dueAt: at(yesterday, '11:00') });
    const b = await taskService.create({ title: 'Due on leave B', assigneeId: 2, dueAt: at(yesterday, '12:00') });
    expect(a.overdue).toBe(true);

    // employees add only their own leave, and not for past days
    await asUser(PRIYA);
    await expect(leaveService.create({ employeeId: 2, startDate: isoDay(yesterday), endDate: isoDay(today) })).rejects.toThrow('today or later');
    await expect(leaveService.create({ employeeId: 3, startDate: isoDay(today), endDate: isoDay(today) })).rejects.toThrow('only for yourself');

    await asUser(ADMIN);
    await expect(leaveService.create({ employeeId: 2, startDate: isoDay(today), endDate: isoDay(yesterday) })).rejects.toThrow('last day');
    const leave = await leaveService.create({ employeeId: 2, startDate: isoDay(yesterday), endDate: isoDay(addDays(today, 2)), reason: 'Family function' });
    await expect(leaveService.create({ employeeId: 2, startDate: isoDay(today), endDate: isoDay(today) })).rejects.toThrow('already has leave');
    const leaveEnd = addDays(new Date(new Date().setHours(0, 0, 0, 0)), 3);
    const copies = (await taskService.list({ assigneeId: 2 })).filter((t) => t.recurringTemplateId === tpl.id);
    expect(copies.every((t) => new Date(t.dueAt) >= leaveEnd)).toBe(true);
    await expect(recurringService.generateNow(tpl.id)).rejects.toThrow('on leave today');

    await asUser(PRIYA);
    expect((await notificationService.list()).find((n) => n.type !== 'DAILY_DIGEST').type).toBe('LEAVE_ADDED');
    expect((await leaveService.list()).map((l) => l.id)).toEqual([leave.id]);
    const onLeave = await taskService.get(a.id);
    expect(onLeave.onLeave).toBe(true);
    expect(onLeave.overdue).toBe(false);
    expect(laneOf(onLeave)).toBe('leave');
    expect((await taskService.list({ overdue: 'true' })).map((t) => t.id)).not.toContain(a.id);

    await expect(taskService.leaveDecision(a.id, 'ALLOW', at(yesterday, '18:00'))).rejects.toThrow('today or a later day');
    await expect(taskService.leaveDecision(a.id, 'ALLOW', at(addDays(today, 1), '18:00'))).rejects.toThrow('also a leave day');
    const moved = await taskService.leaveDecision(a.id, 'ALLOW', at(addDays(today, 4), '18:00'), 'Back on Monday');
    expect(moved.onLeave).toBe(false);
    expect(moved.status).toBe('TODO');
    const skipped = await taskService.leaveDecision(b.id, 'DENY', null, 'No longer needed');
    expect(skipped.status).toBe('CANCELLED');

    await asUser(RAHUL);
    expect((await notificationService.list()).find((n) => n.type !== 'DAILY_DIGEST').message).toMatch(/was on leave and skipped "Due on leave B"/);
    await expect(taskService.leaveDecision(a.id, 'DENY')).rejects.toThrow();

    // removing the leave makes the repeating copies again
    await asUser(ADMIN);
    await leaveService.remove(leave.id);
    const after = (await taskService.list({ assigneeId: 2 })).filter((t) => t.recurringTemplateId === tpl.id);
    expect(after.length).toBeGreaterThan(copies.length);
  });

  it('employees add their own leave; only admins edit or remove it, so they ask with a ticket', async () => {
    const day = (n) => isoDay(addDays(new Date(), n));
    await asUser(PRIYA);
    const leave = await leaveService.create({ employeeId: 2, startDate: day(5), endDate: day(6), reason: 'Wedding' });
    await expect(leaveService.update(leave.id, { employeeId: 2, startDate: day(5), endDate: day(8) })).rejects.toThrow('Only an admin');
    await expect(leaveService.remove(leave.id)).rejects.toThrow('Only an admin');
    await expect(leaveService.raiseTicket(leave.id, 3, 'Change it')).rejects.toThrow('Choose an admin');
    const k = await leaveService.raiseTicket(leave.id, 1, 'Please make it till the 8th');
    expect(k.task).toBeNull();
    expect(k.subject).toMatch(/^Leave /);

    await asUser(ADMIN);
    expect((await notificationService.list()).some((n) => /Priya Sharma added leave/.test(n.message))).toBe(true);
    expect((await ticketService.list()).map((x) => x.id)).toContain(k.id);
    await expect(ticketService.markTaskDone(k.id, 'x')).rejects.toThrow('about a leave');
    const changed = await leaveService.update(leave.id, { employeeId: 2, startDate: day(5), endDate: day(8), reason: 'Wedding' });
    expect(changed.endDate).toBe(day(8));
    await ticketService.resolve(k.id, 'Changed to till the 8th');

    await asUser(PRIYA);
    expect((await notificationService.list()).find((n) => n.type !== 'DAILY_DIGEST').type).toBe('TICKET_RESOLVED');
    expect((await leaveService.list()).find((l) => l.id === leave.id).endDate).toBe(day(8));
  });
});
