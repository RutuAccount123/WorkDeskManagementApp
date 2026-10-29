import { describe, expect, it } from 'vitest';
import { scheduledFmsForWeek } from './scheduledFms.js';

const daily = {
  id: 1, name: 'Daily purchase cycle', frequency: 'DAILY', active: true, startTime: '10:00',
  steps: [{ assignee: { id: 2 } }],
};

describe('scheduled FMS calendar entries', () => {
  it('projects daily occurrences on working days and skips existing runs and holidays', () => {
    const from = new Date(2026, 9, 26); // Monday
    const entries = scheduledFmsForWeek(
      [daily],
      [{ workflow: { name: daily.name, date: '2026-10-26' } }],
      from,
      { '2026-10-28': { name: 'Office holiday' } },
      2,
      new Date(2026, 9, 26),
    );

    expect(entries.map((entry) => entry.workflow.date)).toEqual([
      '2026-10-27', '2026-10-29', '2026-10-30', '2026-10-31',
    ]);
    expect(entries.every((entry) => entry.scheduled && entry.title === daily.name)).toBe(true);
  });

  it('projects weekly workflows only on their configured day for the selected employee', () => {
    const weekly = { ...daily, id: 2, name: 'Weekly site billing', frequency: 'WEEKLY', dayOfWeek: 'FRIDAY' };
    const entries = scheduledFmsForWeek([weekly], [], new Date(2026, 9, 26), {}, 2, new Date(2026, 9, 26));

    expect(entries.map((entry) => entry.workflow.date)).toEqual(['2026-10-30']);
    expect(scheduledFmsForWeek([weekly], [], new Date(2026, 9, 26), {}, 3, new Date(2026, 9, 26))).toEqual([]);
  });

  it('does not project schedule entries for days that have already passed', () => {
    const entries = scheduledFmsForWeek([daily], [], new Date(2026, 9, 26), {}, 2, new Date(2026, 9, 29));
    expect(entries.map((entry) => entry.workflow.date)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
  });
});
