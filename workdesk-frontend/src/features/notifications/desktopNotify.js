// Desktop (Windows / Chrome) pop-up notifications for reminders.
// The person has to allow them once; after that, new reminders also pop up outside the browser tab.

export const desktopSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const desktopEnabled = () => desktopSupported() && Notification.permission === 'granted';

export async function enableDesktop() {
  if (!desktopSupported()) return 'unsupported';
  return Notification.requestPermission(); // 'granted' | 'denied' | 'default'
}

/** Shows each notification once (remembered by id). */
export function showDesktop(notification) {
  if (!desktopEnabled()) return;
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
