import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import logoUrl from '../../../Frontend/assets/images/logo.png';
import { logout } from '../services/auth';

type NavIconName = 'home' | 'devices' | 'analytics' | 'settings' | 'profile' | 'logout';

const navItems: { to: string; label: string; icon: NavIconName }[] = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/devices', label: 'Devices', icon: 'devices' },
  { to: '/analytics', label: 'Analytics', icon: 'analytics' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

function AppIcon({ name }: { name: NavIconName }) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }

  if (name === 'devices') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </svg>
    );
  }

  if (name === 'analytics') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 15l3-3 3 2 5-7" />
        <path d="M18 7h-4" />
        <path d="M18 7v4" />
      </svg>
    );
  }

  if (name === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.35.35.69.6 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-.51 1z" />
      </svg>
    );
  }

  if (name === 'logout') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 17 15 12 10 7" />
        <path d="M15 12H3" />
        <path d="M21 3v18" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function AppShell() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-row">
            <div className="brand-logo-wrap">
              <img className="brand-logo" src={logoUrl} alt="Smart Farm" />
            </div>

            <div className="brand-copy">
              <span className="brand-name">Smart Farm</span>
              <span className="brand-subtitle">IoT Dashboard</span>
            </div>
          </div>

          <nav className="side-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon" aria-hidden="true">
                  <AppIcon name={item.icon} />
                </span>

                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <NavLink
            to="/profile"
            className={({ isActive }) => `sidebar-profile ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-profile-avatar">
              <AppIcon name="profile" />
            </span>

            <span className="sidebar-profile-copy">
              <strong>Profile</strong>
              <small>Edit account</small>
            </span>
          </NavLink>

          <button type="button" className="logout-button" onClick={handleLogout}>
            <span className="logout-icon" aria-hidden="true">
              <AppIcon name="logout" />
            </span>

            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
