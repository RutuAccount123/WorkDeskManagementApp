import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { desktopEnabled, disableDesktop, enableDesktop, showDesktop } from '@/features/notifications/desktopNotify.js';

describe('desktop reminders can be stopped and started again', () => {
  let shown;
  beforeEach(() => {
    shown = [];
    const FakeNotification = vi.fn(function FakeNotification(title, opts) { shown.push(opts.body); });
    FakeNotification.permission = 'granted';
    FakeNotification.requestPermission = vi.fn(async () => 'granted');
    vi.stubGlobal('Notification', FakeNotification);
    window.Notification = FakeNotification;
  });
  afterEach(() => { vi.unstubAllGlobals(); delete window.Notification; });

  it('stop → nothing pops up; start again → only reminders from then on', async () => {
    await enableDesktop();
    expect(desktopEnabled()).toBe(true);
    showDesktop({ type: 'DAY_REMINDER', id: 9001, message: 'First', createdAt: new Date(Date.now() + 1000).toISOString() });
    expect(shown).toEqual(['First']);

    disableDesktop();
    expect(desktopEnabled()).toBe(false);
    showDesktop({ type: 'DAY_REMINDER', id: 9002, message: 'While off', createdAt: new Date().toISOString() });
    expect(shown).toEqual(['First']);

    await new Promise((r) => setTimeout(r, 5));
    await enableDesktop();
    showDesktop({ type: 'DAY_REMINDER', id: 9002, message: 'While off', createdAt: new Date(Date.now() - 60000).toISOString() });
    showDesktop({ type: 'DAY_REMINDER', id: 9003, message: 'After', createdAt: new Date(Date.now() + 1000).toISOString() });
    expect(shown).toEqual(['First', 'After']);
  });

  it('only "Due tomorrow" / "Due today" reminders pop up; other notifications stay in the bell', async () => {
    await enableDesktop();
    const at = new Date(Date.now() + 1000).toISOString();
    for (const [id, type] of [[9101, 'TASK_ASSIGNED'], [9102, 'DUE_SOON'], [9103, 'OVERDUE'], [9104, 'COMMENT'],
      [9105, 'TICKET_RAISED'], [9106, 'DAILY_DIGEST'], [9107, 'DAY_REMINDER']]) {
      showDesktop({ id, type, message: type, createdAt: at });
    }
    expect(shown).toEqual(['DAY_REMINDER']);
  });
});
