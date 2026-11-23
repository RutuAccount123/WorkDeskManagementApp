import { describe, expect, it } from 'vitest';
import { upcomingRepeats } from './scheduledRepeats.js';

const monthly = {
  id: 7, title: 'Monthly stock audit', frequency: 'MONTHLY', startDate: '2026-11-10', dueTime: '18:00:00',
  dueDaysAfter: 0, active: true, assignee: { id: 2 }, lastGeneratedOn: null,
};
const today = new Date(2026, 10, 23); // Mon 23 Nov 2026

describe('upcoming repeating task entries', () => {
  it('shows a monthly task in a week beyond the 7 days the server fills', () => {
    const from = new Date(2027, 1, 8); // Mon 8 Feb 2027
    const entries = upcomingRepeats([monthly], [], from, new Date(2027, 1, 15), { employeeId: 2, today });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ title: 'Monthly stock audit', repeat: 'MONTHLY', startDate: '2027-02-10', upcoming: true });
  });

  it('shows each month on its day in the month view and skips a Sunday', () => {
    // 10 Jan 2027 is a Sunday, so no copy that month
    const jan = upcomingRepeats([monthly], [], new Date(2027, 0, 1), new Date(2027, 1, 1), { today });
    const dec = upcomingRepeats([monthly], [], new Date(2026, 11, 1), new Date(2027, 0, 1), { today });
    expect(jan).toHaveLength(0);
    expect(dec.map((e) => e.startDate)).toEqual(['2026-12-10']);
  });

  it('does not repeat a copy that already exists, or days the server already filled', () => {
    const from = new Date(2026, 10, 23);
    const to = new Date(2026, 11, 31);
    const daily = { ...monthly, id: 8, frequency: 'DAILY', startDate: null };
    const real = [{ recurringTemplateId: 7, dueAt: new Date(2026, 11, 10, 18).toISOString() }];
    const entries = upcomingRepeats([monthly, daily], real, from, to, { today });
    expect(entries.some((e) => e.templateId === 7)).toBe(false);
    expect(entries.filter((e) => e.templateId === 8).every((e) => e.startDate >= '2026-11-30')).toBe(true);
  });

  it('places the entry on its due date and leaves out other people and stopped tasks', () => {
    const later = { ...monthly, dueDaysAfter: 2 };
    const entries = upcomingRepeats([later, { ...monthly, id: 9, active: false }, { ...monthly, id: 10, assignee: { id: 3 } }],
      [], new Date(2027, 2, 8), new Date(2027, 2, 15), { employeeId: 2, today });
    expect(entries).toHaveLength(1);
    expect(new Date(entries[0].dueAt).getDate()).toBe(12);
  });
});
