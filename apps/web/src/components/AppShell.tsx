import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import logoUrl from '../../../Frontend/assets/images/logo.png';
import { logout } from '../services/auth';

const navItems = [
  { to: '/home', label: 'Home', icon: 'H' },
  { to: '/devices', label: 'Devices', icon: 'D' },
  { to: '/analytics', label: 'Analytics', icon: 'A' },
  { to: '/settings', label: 'Settings', icon: 'S' },
];

export function AppShell() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-row">
            <img className="brand-logo" src={logoUrl} alt="Smart Farm" />
            <span className="brand-name">Smart Farm</span>
          </div>

          <nav className="side-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <button type="button" className="logout-button" onClick={handleLogout}>
          Sign out
        </button>
      </aside>

      <main className="app-main">
        <div className="app-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
