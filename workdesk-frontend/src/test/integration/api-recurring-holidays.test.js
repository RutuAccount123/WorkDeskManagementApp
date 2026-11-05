import { describe, expect, it } from 'vitest';
import { holidayService, recurringService, taskService } from '@/services/index.js';
import { tokenStore } from '@/services/http.js';
import { ADMIN, PRIYA, signIn } from '../helpers.js';
import { isoDay, addDays } from '@/utils/format.js';

const copiesOf = async (title) => (await taskService.list({ q: title })).filter((t) => t.title === title);

describe('repeating tasks', () => {
  it('daily: one copy per working day for the next 7 days, never on Sunday', async () => {
    await signIn(ADMIN);
    const tpl = await recurringService.create({ title: 'Cash book check', assigneeId: 2, frequency: 'DAILY', dueTime: '11:00', estimatedHours: 2.5 });
    expect(tpl.dueTime).toBe('11:00:00');
    expect(tpl.estimatedHours).toBe(2.5);
    const copies = await copiesOf('Cash book check');
    expect(copies.every((t) => t.estimatedHours === 2.5)).toBe(true);
    const days = copies.map((t) => new Date(t.dueAt));
    expect(days.some((d) => d.getDay() === 0)).toBe(false);
    expect(new Set(days.map((d) => isoDay(d))).size).toBe(days.length); // no duplicates
    expect(copies.length).toBeGreaterThanOrEqual(5);
    expect(copies.every((t) => t.repeat === 'DAILY')).toBe(true);
  });
  it('weekly needs a day; pausing removes future copies', async () => {
    await signIn(ADMIN);
    await expect(recurringService.create({ title: 'W', assigneeId: 3, frequency: 'WEEKLY' })).rejects.toThrow('Choose a day');
    const tpl = await recurringService.create({ title: 'Weekly vendor call', assigneeId: 3, frequency: 'WEEKLY', dayOfWeek: 'FRIDAY', dueTime: '16:00' });
    expect((await copiesOf('Weekly vendor call')).every((t) => new Date(t.dueAt).getDay() === 5)).toBe(true);
    await recurringService.setActive(tpl.id, false);
    const tomorrow = addDays(new Date(new Date().setHours(0, 0, 0, 0)), 1);
    expect((await copiesOf('Weekly vendor call')).filter((t) => new Date(t.dueAt) >= tomorrow)).toHaveLength(0);
  });
  it('employees see their templates and can create repeating work for another person', async () => {
    await signIn(PRIYA);
    const list = await recurringService.list();
    expect(list.every((r) => r.assignee.id === 2)).toBe(true);
    const adminMade = list.find((r) => !r.selfOwned);
    if (adminMade) await expect(recurringService.setActive(adminMade.id, false)).rejects.toThrow('Only your admin');
    const assigned = await recurringService.create({ title: 'My daily plan', frequency: 'DAILY', assigneeId: 5 });
    expect(assigned.assignee.id).toBe(5);
  });
});

describe('holidays', () => {
  it('everyone can read; only admin can change; no duplicates', async () => {
    await signIn(PRIYA);
    expect(Array.isArray(await holidayService.list({ year: new Date().getFullYear() }))).toBe(true);
    await expect(holidayService.create({ date: '2026-12-25', name: 'Christmas' })).rejects.toThrow('permission');
    tokenStore.clear();
    await signIn(ADMIN);
    const h = await holidayService.create({ date: '2030-12-25', name: 'Christmas' });
    await expect(holidayService.create({ date: '2030-12-25', name: 'Again' })).rejects.toThrow('already a holiday');
    await expect(holidayService.create({ date: '', name: 'X' })).rejects.toThrow('Choose a date');
    expect((await holidayService.list({ from: '2030-12-01', to: '2030-12-31' })).map((x) => x.name)).toEqual(['Christmas']);
    await holidayService.remove(h.id);
  });
  it('a new holiday removes daily copies already made for that day', async () => {
    await signIn(ADMIN);
    await recurringService.create({ title: 'Site report X', assigneeId: 4, frequency: 'DAILY', dueTime: '19:00' });
    const target = (await copiesOf('Site report X')).map((t) => isoDay(new Date(t.dueAt))).find((d) => d > isoDay());
    await holidayService.create({ date: target, name: 'Local holiday' });
    expect((await copiesOf('Site report X')).map((t) => isoDay(new Date(t.dueAt)))).not.toContain(target);
  });
});

describe('weekly off rule is the same everywhere', () => {
  it('weekly repeating work cannot be set for Sunday', async () => {
    await signIn(ADMIN);
    await expect(recurringService.create({ title: 'Sun job', assigneeId: 3, frequency: 'WEEKLY', dayOfWeek: 'SUNDAY' }))
      .rejects.toThrow('Sunday is the weekly off');
  });
});
