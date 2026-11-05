import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  STATUS_LABEL, PRIORITY_LABEL, GROUPS, LANES, addDays, dayLabel, fmtDate, fmtDateTime, isoDay, laneOf,
  monthKey, fromMonthKey, relativeDue, sameDay, startOfWeek, statusGroup, toLocalInput, workDate,
} from '@/utils/format.js';
import { personColor } from '@/utils/colors.js';

afterEach(() => vi.useRealTimers());

describe('status words', () => {
  it('uses the same plain words as the coloured status chips', () => {
    expect(STATUS_LABEL).toEqual({
      TODO: 'To do', IN_PROGRESS: 'In progress', SUBMITTED: 'Waiting for review',
      COMPLETED: 'Done', REOPENED: 'Sent back', CANCELLED: 'Cancelled',
    });
  });
  it('day-view groups match the status words', () => {
    expect(GROUPS.map((g) => g.title)).toEqual(['To do', 'In progress', 'Done']);
  });
  it('has a label for every priority', () => {
    expect(Object.keys(PRIORITY_LABEL)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
  });
});

describe('date helpers', () => {
  it('isoDay gives the local yyyy-mm-dd', () => {
    expect(isoDay(new Date(2026, 9, 27, 23, 50))).toBe('2026-10-27');
    expect(isoDay(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
  it('toLocalInput converts an API instant to a datetime-local value', () => {
    expect(toLocalInput('2026-10-27T12:30:00.000Z')).toBe('2026-10-27T18:00'); // India time
    expect(toLocalInput(null)).toBe('');
  });
  it('fmtDate / fmtDateTime show a dash for empty values', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDateTime(undefined)).toBe('—');
    expect(fmtDate('2026-10-27T05:00:00Z')).toMatch(/27 Oct 2026/);
    expect(fmtDateTime('2026-10-27T05:00:00Z')).toMatch(/27 Oct.*10:30/i);
  });
  it('startOfWeek is the Monday', () => {
    const mon = startOfWeek(new Date(2026, 10, 1)); // Sunday 1 Nov 2026
    expect(mon.getDay()).toBe(1);
    expect(isoDay(mon)).toBe('2026-10-26');
  });
  it('addDays / sameDay / monthKey round-trip', () => {
    const d = new Date(2026, 9, 31);
    expect(isoDay(addDays(d, 1))).toBe('2026-11-01');
    expect(sameDay(d, new Date(2026, 9, 31, 22))).toBe(true);
    expect(monthKey(d)).toBe('2026-10');
    expect(fromMonthKey('2026-10').getMonth()).toBe(9);
  });
  it('dayLabel capitalises a weekday', () => expect(dayLabel('MONDAY')).toBe('Monday'));
  it('dayLabel handles missing values from incomplete API data', () => {
    expect(dayLabel(null)).toBe('—');
    expect(dayLabel(undefined)).toBe('—');
    expect(dayLabel('')).toBe('—');
  });
});

describe('relativeDue', () => {
  it('talks in minutes, hours and days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T06:00:00Z'));
    expect(relativeDue(null)).toBe('No due date');
    expect(relativeDue('2026-10-27T06:30:00Z')).toBe('in 30 min');
    expect(relativeDue('2026-10-27T09:00:00Z')).toBe('in 3 h');
    expect(relativeDue('2026-10-25T07:00:00Z')).toBe('47 h late');
    expect(relativeDue('2026-10-20T06:00:00Z')).toBe('7 days late');
  });
});

describe('laneOf and statusGroup', () => {
  const now = new Date();
  const at = (h) => new Date(now.getTime() + h * 3600e3).toISOString();
  it('puts work in the right deadline lane', () => {
    expect(laneOf({ status: 'COMPLETED', dueAt: at(-5) })).toBe('closed');
    expect(laneOf({ status: 'TODO', dueAt: null })).toBe('nodate');
    expect(laneOf({ status: 'TODO', dueAt: at(-1), overdue: true })).toBe('overdue');
    expect(laneOf({ status: 'TODO', dueAt: at(24 * 3) })).toBe('week');
    expect(laneOf({ status: 'TODO', dueAt: at(24 * 30) })).toBe('later');
    expect(LANES.map((l) => l.key)).toEqual(['overdue', 'today', 'week', 'later', 'nodate', 'closed']);
  });
  it('groups statuses for counts', () => {
    expect(statusGroup({ status: 'COMPLETED' })).toBe('done');
    expect(statusGroup({ status: 'SUBMITTED' })).toBe('progress');
    expect(statusGroup({ status: 'REOPENED' })).toBe('todo');
    expect(statusGroup({ status: 'CANCELLED' })).toBe('cancelled');
  });
  it('workDate falls back to createdAt', () => {
    expect(workDate({ createdAt: '2026-10-01T00:00:00Z' }).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('personColor', () => {
  it('is stable for a name and a valid colour', () => {
    expect(personColor('Rahul Patil')).toBe(personColor('Rahul Patil'));
    expect(personColor('')).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
