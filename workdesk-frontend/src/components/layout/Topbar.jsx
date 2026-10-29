import { Link, useLocation } from 'react-router-dom';
import { APP_NAME } from '@/config/env.js';
import { pageTitle } from '@/config/navigation.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import Icon from '@/components/ui/Icon.jsx';
import { personColor } from '@/utils/colors.js';

const dateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Top bar: where you are, today's date, notifications, account. */
export default function Topbar({ unread, onOpenNotifications }) {
  const { user, isAdmin } = useAuth();
  const { pathname } = useLocation();
  const title = pageTitle(pathname, isAdmin);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="mobile-brand">{APP_NAME}</span>
        <p className="crumbs"><span>{APP_NAME}</span><span aria-hidden="true">/</span><strong>{title}</strong></p>
      </div>
      <div className="topbar-right">
        <span className="today">{dateFmt.format(new Date())}</span>
        <button className="topbar-btn" onClick={onOpenNotifications} aria-label={`Notifications, ${unread} unread`}>
          <Icon name="bell" size={20} />
          {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
        </button>
        <Link to="/account" className="avatar topbar-avatar" style={{ background: personColor(user.fullName) }}
          aria-label="My account">{user.fullName.charAt(0)}</Link>
      </div>
    </header>
  );
}
