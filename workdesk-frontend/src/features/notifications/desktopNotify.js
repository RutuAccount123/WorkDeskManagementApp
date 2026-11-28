// Desktop (Windows / Chrome) pop-up notifications for reminders.
// Only the day reminders pop up ("Due tomorrow" / "Due today"); everything else stays in the bell.
// The person has to allow them once in the browser; after that they can turn them off and on again here.
// (A website cannot take back the browser permission, so "off" is remembered in this browser.)

const OFF_KEY = 'ewms_desktop_off';
const SINCE_KEY = 'ewms_desktop_since';

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => {
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* ignore */ }
};

export const desktopSupported = () => typeof window !== 'undefined' && 'Notification' in window;
/** Allowed by the browser and not turned off here. */
export const desktopEnabled = () => desktopSupported() && Notification.permission === 'granted' && read(OFF_KEY) !== '1';

/** Turn on (asks the browser the first time). Only reminders from now on pop up, not ones that came while off. */
export async function enableDesktop() {
  if (!desktopSupported()) return 'unsupported';
  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (result === 'granted') {
    write(OFF_KEY, null);
    write(SINCE_KEY, new Date().toISOString());
  }
  return result; // 'granted' | 'denied' | 'default'
}

/** Stop desktop pop-ups (the bell in the app still shows everything). */
export function disableDesktop() {
  write(OFF_KEY, '1');
}

/** The kinds of notification that pop up on the desktop. */
export const DESKTOP_TYPES = ['DAY_REMINDER'];

/** Shows each day reminder once (remembered by id), and only ones that arrived after reminders were turned on. */
export function showDesktop(notification) {
  if (!desktopEnabled() || !DESKTOP_TYPES.includes(notification.type)) return;
  const since = read(SINCE_KEY);
  if (since && notification.createdAt && new Date(notification.createdAt) < new Date(since)) return;
  const key = 'ewms_desktop_shown';
  let shown = [];
  try { shown = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* ignore */ }
  if (shown.includes(notification.id)) return;
  try {
    new Notification('Work Desk', { body: notification.message, tag: `ewms-${notification.id}` });
  } catch { /* some browsers only allow this from a service worker */ }
  shown.push(notification.id);
  try { localStorage.setItem(key, JSON.stringify(shown.slice(-200))); } catch { /* ignore */ }
}
