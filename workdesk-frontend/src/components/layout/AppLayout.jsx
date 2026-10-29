import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { notificationService } from '@/services/index.js';
import NotificationPanel from '@/features/notifications/NotificationPanel.jsx';
import { desktopEnabled, showDesktop } from '@/features/notifications/desktopNotify.js';
import Sidebar, { MobileTabs } from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

const POLL_MS = 60000;

/** Page frame for every signed-in screen: sidebar + top bar + page content. */
export default function AppLayout() {
  const [unread, setUnread] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  // Check for new notifications every minute so reminders appear without a refresh.
  useEffect(() => {
    const load = () => notificationService.unreadCount().then((r) => {
      setUnread(r.count);
      if (r.count > 0 && desktopEnabled()) {
        notificationService.list(5).then((list) => list.filter((n) => !n.read).reverse().forEach(showDesktop)).catch(() => {});
      }
    }).catch(() => {});
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar unread={unread} onOpenNotifications={() => setShowNotes(true)} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      <MobileTabs />
      {showNotes && <NotificationPanel onClose={() => setShowNotes(false)} onChange={setUnread} />}
    </div>
  );
}
