import { NavLink } from 'react-router-dom';
import { APP_NAME } from '@/config/env.js';
import { ADMIN_NAV, EMPLOYEE_NAV } from '@/config/navigation.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import Icon from '@/components/ui/Icon.jsx';
import { personColor } from '@/utils/colors.js';

/** Dark left menu: brand, grouped navigation, signed-in user. */
export default function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const groups = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark"><Icon name="logo" size={18} strokeWidth={2.2} /></span>
        <span className="brand-name">{APP_NAME}</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        {groups.map((g) => (
          <div key={g.section} className="nav-group">
            <p className="nav-section">{g.section}</p>
            {g.items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-item">
                <Icon name={n.icon} size={19} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <NavLink to="/account" className="user-chip">
          <span className="avatar" style={{ background: personColor(user.fullName) }}>{user.fullName.charAt(0)}</span>
          <span className="user-text">
            <strong>{user.fullName}</strong>
            <small>{isAdmin ? 'Administrator' : user.designation || 'Employee'}</small>
          </span>
        </NavLink>
        <button className="icon-btn on-dark" onClick={logout} aria-label="Sign out" title="Sign out">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </aside>
  );
}

/** Bottom tab bar used on phones instead of the sidebar. */
export function MobileTabs() {
  const { isAdmin } = useAuth();
  const items = (isAdmin ? ADMIN_NAV : EMPLOYEE_NAV).flatMap((g) => g.items).slice(0, 5); // phones show the first five
  return (
    <nav className="mobile-tabs" aria-label="Main">
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/'} className="mobile-tab">
          <Icon name={n.icon} size={20} />
          <span>{n.short || n.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
