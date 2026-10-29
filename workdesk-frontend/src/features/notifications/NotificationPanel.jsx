import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '@/services/index.js';
import { fmtDateTime } from '@/utils/format.js';

export default function NotificationPanel({ onClose, onChange }) {
  const [items, setItems] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    notificationService.list().then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const open = async (n) => {
    if (!n.read) {
      await notificationService.markRead(n.id).catch(() => {});
      onChange((c) => Math.max(0, c - 1));
    }
    onClose();
    if (n.taskId) navigate(`/tasks/${n.taskId}`);
  };

  const readAll = async () => {
    try {
      await notificationService.markAllRead();
      setItems((list) => list.map((n) => ({ ...n, read: true })));
      onChange(0);
    } catch { /* keep the list as it is; the next refresh will retry */ }
  };

  return (
    <div className="scrim" onClick={onClose}>
      <aside className="drawer narrow" role="dialog" aria-label="Notifications" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2>Notifications</h2>
          <div className="row">
            <button className="link-btn" onClick={readAll}>Mark all read</button>
            <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>
        {items === null ? <p className="muted pad">Loading…</p> : items.length === 0 ? (
          <p className="muted pad">Nothing yet. New assignments and deadline reminders will appear here.</p>
        ) : (
          <ul className="notes">
            {items.map((n) => (
              <li key={n.id}>
                <button className={`note ${n.read ? '' : 'unread'} note-${n.type.toLowerCase()}`} onClick={() => open(n)}>
                  <span>{n.message}</span>
                  <small>{fmtDateTime(n.createdAt)}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
