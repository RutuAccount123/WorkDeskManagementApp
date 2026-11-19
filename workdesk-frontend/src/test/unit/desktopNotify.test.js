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
    showDesktop({ id: 9001, message: 'First', createdAt: new Date(Date.now() + 1000).toISOString() });
    expect(shown).toEqual(['First']);

    disableDesktop();
    expect(desktopEnabled()).toBe(false);
    showDesktop({ id: 9002, message: 'While off', createdAt: new Date().toISOString() });
    expect(shown).toEqual(['First']);

    await new Promise((r) => setTimeout(r, 5));
    await enableDesktop();
    showDesktop({ id: 9002, message: 'While off', createdAt: new Date(Date.now() - 60000).toISOString() });
    showDesktop({ id: 9003, message: 'After', createdAt: new Date(Date.now() + 1000).toISOString() });
    expect(shown).toEqual(['First', 'After']);
  });
});
